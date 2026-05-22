-- Migration 028: Server-side free-tier export counters
--
-- Today, free-tier limits (5 PDFs/CSVs/invoices per month) are enforced in
-- AsyncStorage on the device. A user can clear app data to reset their
-- counters — direct revenue leak. This migration moves enforcement to the
-- database so clearing local state has no effect.
--
-- Columns pdfs_this_month, spreadsheets_this_month, last_usage_reset already
-- exist on profiles (from migration 001) but were never wired up from the
-- mobile app. We add invoices_this_month and create consume_usage RPC that
-- the mobile app calls instead of writing to local storage.

-- =============================================================================
-- 1. Schema: add missing column for invoice counters
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS invoices_this_month INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- 2. consume_usage(p_kind) RPC
-- =============================================================================
-- Single transactional entry point. Caller passes 'pdf' | 'csv' | 'invoice'.
-- Returns jsonb: { allowed: bool, used: int, limit: int, reason: text|null }
--
-- Behavior:
--   - Pro / Premium tiers always return { allowed: true, limit: -1 }
--   - Free tier:
--       - If last_usage_reset is in a previous month, reset all counters
--         and bump last_usage_reset to the current month's start
--       - If counter for p_kind is below FREE_TIER_LIMIT, increment + return allowed
--       - Otherwise return allowed=false with a reason
--   - Anonymous (no auth.uid) → 'unauthenticated' exception. Mobile falls
--     back to local AsyncStorage for that case.
--
-- Atomicity: SELECT ... FOR UPDATE locks the row so concurrent increments
-- can't both read N and both write N+1.

CREATE OR REPLACE FUNCTION consume_usage(p_kind TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_tier          TEXT;
  v_period_start  TIMESTAMPTZ;
  v_current_start TIMESTAMPTZ := date_trunc('month', NOW());
  v_used          INTEGER;
  v_limit         CONSTANT INTEGER := 10;  -- free-tier monthly limit (matches FREE_LIMITS in lib/user.ts)
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF p_kind NOT IN ('pdf', 'csv', 'invoice') THEN
    RAISE EXCEPTION 'invalid_kind: %', p_kind USING ERRCODE = '22023';
  END IF;

  -- Lock the row for the duration of this transaction
  SELECT tier, last_usage_reset
    INTO v_tier, v_period_start
    FROM profiles
    WHERE id = v_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Pro / Premium: no limit
  IF v_tier IN ('pro', 'premium') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'used', 0,
      'limit', -1,
      'reason', NULL
    );
  END IF;

  -- Free tier: reset counters if we've crossed a month boundary
  IF v_period_start IS NULL OR v_period_start < v_current_start THEN
    UPDATE profiles SET
      pdfs_this_month        = 0,
      spreadsheets_this_month = 0,
      invoices_this_month    = 0,
      last_usage_reset       = v_current_start
    WHERE id = v_user_id;
  END IF;

  -- Read the current value for the requested kind
  SELECT
    CASE p_kind
      WHEN 'pdf'     THEN pdfs_this_month
      WHEN 'csv'     THEN spreadsheets_this_month
      WHEN 'invoice' THEN invoices_this_month
    END
    INTO v_used
    FROM profiles
    WHERE id = v_user_id;

  -- Limit check
  IF v_used >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'limit', v_limit,
      'reason', 'monthly_limit_reached'
    );
  END IF;

  -- Increment + return new value
  CASE p_kind
    WHEN 'pdf' THEN
      UPDATE profiles SET pdfs_this_month = pdfs_this_month + 1 WHERE id = v_user_id;
    WHEN 'csv' THEN
      UPDATE profiles SET spreadsheets_this_month = spreadsheets_this_month + 1 WHERE id = v_user_id;
    WHEN 'invoice' THEN
      UPDATE profiles SET invoices_this_month = invoices_this_month + 1 WHERE id = v_user_id;
  END CASE;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used + 1,
    'limit', v_limit,
    'reason', NULL
  );
END;
$$;

-- Only signed-in callers can invoke this. Anonymous code paths skip the RPC.
REVOKE ALL ON FUNCTION consume_usage(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_usage(TEXT) TO authenticated;

COMMENT ON FUNCTION consume_usage(TEXT) IS
  'Atomically checks free-tier limits + increments the counter for the given kind. Returns jsonb {allowed, used, limit, reason}. Pro/Premium tiers always return allowed=true with limit=-1. Free tier resets counters on the first call of a new month.';

-- =============================================================================
-- 3. Read-only helper to peek at counters without consuming
-- =============================================================================
-- Used by the mobile app's "remaining exports" indicator on the dashboard /
-- promo card so we don't have to consume a quota slot just to display it.

CREATE OR REPLACE FUNCTION get_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_tier         TEXT;
  v_pdfs         INTEGER;
  v_csvs         INTEGER;
  v_invoices     INTEGER;
  v_period_start TIMESTAMPTZ;
  v_current_start TIMESTAMPTZ := date_trunc('month', NOW());
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT tier, pdfs_this_month, spreadsheets_this_month, invoices_this_month, last_usage_reset
    INTO v_tier, v_pdfs, v_csvs, v_invoices, v_period_start
    FROM profiles
    WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- If the period is stale, the displayed counters should look reset already.
  -- (consume_usage will do the actual reset on the next write.)
  IF v_period_start IS NULL OR v_period_start < v_current_start THEN
    v_pdfs := 0;
    v_csvs := 0;
    v_invoices := 0;
  END IF;

  RETURN jsonb_build_object(
    'tier', v_tier,
    'pdfs_used', v_pdfs,
    'csvs_used', v_csvs,
    'invoices_used', v_invoices,
    'limit', CASE WHEN v_tier IN ('pro', 'premium') THEN -1 ELSE 10 END
  );
END;
$$;

REVOKE ALL ON FUNCTION get_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_usage() TO authenticated;

COMMENT ON FUNCTION get_usage() IS
  'Returns current usage counters and tier for the calling user. Read-only — does not increment. Use consume_usage(kind) when actually performing the action.';

-- =============================================================================
-- 4. Soft-launch: reset all current free-tier counters to 0 in this migration
-- =============================================================================
-- Per the agreed plan: don't ship a "you've used 47 PDFs this month, blocked"
-- surprise to existing free users on first launch. Set everyone clean.
-- Pro/Premium users are unaffected — the counters aren't consulted for them.

UPDATE profiles SET
  pdfs_this_month         = 0,
  spreadsheets_this_month = 0,
  invoices_this_month     = 0,
  last_usage_reset        = date_trunc('month', NOW())
WHERE tier = 'free';
