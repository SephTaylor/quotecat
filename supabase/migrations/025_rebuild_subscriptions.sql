-- Migration: 025_rebuild_subscriptions.sql
-- Created:   2026-04-28
-- Purpose:   Replace the empty `subscriptions` table from 001_initial_schema.sql
--            with a new schema that captures payment source per user, supports
--            idempotent webhook processing, and stores Stripe customer info
--            on the subscription row (avoiding repeat Stripe API lookups).
--
-- Reference: docs/ENTITLEMENT_AUDIT.md is the canonical product/entitlement
--            map. The PRODUCT_TIER_MAP constant in webhook code must match it.
--
-- Pre-flight check (run separately before applying):
--   SELECT count(*) FROM subscriptions;   -- expected: 0
-- Verified 0 rows on 2026-04-28. Re-verify before this migration applies.
-- If non-zero, STOP and investigate before dropping.

-- =============================================================================
-- 1. Drop the existing empty table
-- =============================================================================
-- Verified at design time: subscriptions has 0 rows and no FK references in.
-- Only the user_id FK leaves the table; no other table references it.
DROP TABLE IF EXISTS subscriptions;

-- =============================================================================
-- 2. Enums for source and status
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE subscription_source AS ENUM ('app_store', 'play_store', 'stripe');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
-- Note: no 'promotional' source. VIPs / comped users redeem codes through the
-- real platforms (Apple offer codes, Google Play promo codes, Stripe coupons),
-- which flow through the same webhooks as paying customers. See docs/COMP_CODES.md.

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 3. New subscriptions table
-- =============================================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  source                subscription_source NOT NULL,
  tier                  TEXT NOT NULL CHECK (tier IN ('pro', 'premium')),
  status                subscription_status NOT NULL DEFAULT 'active',

  -- Identifiers
  product_id            TEXT NOT NULL,    -- IAP SKU ('ai.quotecat.app.pro.monthly')
                                          -- or Stripe price_id ('price_1T1uXb...')
  external_id           TEXT NOT NULL,    -- RC original_transaction_id (IAP)
                                          -- or Stripe subscription.id (stripe).
                                          -- Required: every subscription comes
                                          -- from a real payment platform event.
  stripe_customer_id    TEXT,             -- only when source='stripe'; avoids
                                          -- re-querying Stripe to build portal URL

  -- Lifecycle timestamps
  started_at            TIMESTAMPTZ NOT NULL,
  current_period_end    TIMESTAMPTZ NOT NULL,
  canceled_at           TIMESTAMPTZ,      -- set on CANCELLATION, kept until EXPIRATION

  -- Idempotency / out-of-order protection (per-row)
  last_event_id         TEXT,             -- skip if incoming event.id matches
  last_event_at         TIMESTAMPTZ,      -- skip if incoming timestamp_ms is older

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate (source, external_id) rows. external_id is NOT NULL so
  -- this is a strict unique constraint with no NULL-distinct gotcha.
  CONSTRAINT subscriptions_source_external_id_unique UNIQUE (source, external_id)
);

-- =============================================================================
-- 4. Indexes
-- =============================================================================
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Hot path: "find this user's currently-active subscription"
CREATE INDEX idx_subscriptions_user_id_active
  ON subscriptions(user_id) WHERE status = 'active';

-- =============================================================================
-- 5. updated_at trigger (reuses function defined in 001_initial_schema.sql)
-- =============================================================================
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 6. Row-Level Security
-- =============================================================================
-- Users can read their own subscriptions (used by the mobile app, the
-- create-portal-session edge function, and any future analytics).
-- Writes happen ONLY via service_role (webhook edge functions).
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Intentionally no INSERT/UPDATE/DELETE policies for the anon/authenticated
-- roles. service_role bypasses RLS and is the only writer.

-- =============================================================================
-- 7. Documentation
-- =============================================================================
COMMENT ON TABLE subscriptions IS
  'One row per subscription (active or historical). Webhooks (revenuecat-webhook, stripe-webhook) UPSERT here and mirror tier to profiles.tier in the same transaction. See docs/ENTITLEMENT_AUDIT.md for product/entitlement mapping.';

COMMENT ON COLUMN subscriptions.external_id IS
  'RevenueCat original_transaction_id for IAP, Stripe subscription.id for Stripe. Required.';

COMMENT ON COLUMN subscriptions.product_id IS
  'IAP product ID (e.g. ai.quotecat.app.pro.monthly) or Stripe price_id (e.g. price_1T1uXb...). Used to build deep-link URLs and as defensive cross-check against entitlement_ids in webhook handlers.';

COMMENT ON COLUMN subscriptions.last_event_id IS
  'Set to the most recently processed webhook event.id for this subscription. Webhook handlers compare incoming event.id against this and skip duplicates.';

COMMENT ON COLUMN subscriptions.last_event_at IS
  'Set to the most recently processed webhook event timestamp. Webhook handlers compare incoming event timestamps against this and skip out-of-order events.';

-- =============================================================================
-- 8. Helper function: upsert_subscription_event
-- =============================================================================
-- Webhook handlers (revenuecat-webhook, stripe-webhook) call this single RPC
-- to atomically:
--   1. UPSERT the subscription row
--   2. Recompute and update profiles.tier from highest active tier across all
--      of this user's subscriptions
--   3. Skip if event is a duplicate (event_id matches) or out-of-order
-- All inside a single PostgreSQL function = single transaction = atomic.
--
-- Returns one row with (action, subscription_id, profile_tier).
-- action ∈ {'inserted', 'updated', 'skipped_duplicate', 'skipped_out_of_order'}

CREATE OR REPLACE FUNCTION upsert_subscription_event(
  p_user_id              UUID,
  p_source               subscription_source,
  p_tier                 TEXT,
  p_status               subscription_status,
  p_product_id           TEXT,
  p_external_id          TEXT,
  p_stripe_customer_id   TEXT,
  p_started_at           TIMESTAMPTZ,
  p_current_period_end   TIMESTAMPTZ,
  p_canceled_at          TIMESTAMPTZ,
  p_event_id             TEXT,
  p_event_timestamp_ms   BIGINT
) RETURNS TABLE (
  action          TEXT,
  subscription_id UUID,
  profile_tier    TEXT
) AS $$
DECLARE
  v_event_at         TIMESTAMPTZ := to_timestamp(p_event_timestamp_ms / 1000.0);
  v_existing_id      UUID;
  v_existing_eid     TEXT;
  v_existing_eat     TIMESTAMPTZ;
  v_subscription_id  UUID;
  v_new_profile_tier TEXT;
  v_action           TEXT;
BEGIN
  -- Look up existing row by (source, external_id). external_id is NOT NULL on
  -- the table, so a plain equality check is sufficient.
  SELECT id, last_event_id, last_event_at
    INTO v_existing_id, v_existing_eid, v_existing_eat
    FROM subscriptions
    WHERE source = p_source AND external_id = p_external_id
    LIMIT 1;

  -- Idempotency: skip if same event already processed
  IF v_existing_eid IS NOT NULL AND v_existing_eid = p_event_id THEN
    RETURN QUERY SELECT 'skipped_duplicate'::TEXT, v_existing_id, NULL::TEXT;
    RETURN;
  END IF;

  -- Out-of-order: skip if incoming event is older than the last one we processed
  IF v_existing_eat IS NOT NULL AND v_event_at < v_existing_eat THEN
    RETURN QUERY SELECT 'skipped_out_of_order'::TEXT, v_existing_id, NULL::TEXT;
    RETURN;
  END IF;

  IF v_existing_id IS NULL THEN
    -- Insert new subscription row
    INSERT INTO subscriptions (
      user_id, source, tier, status, product_id, external_id, stripe_customer_id,
      started_at, current_period_end, canceled_at, last_event_id, last_event_at
    ) VALUES (
      p_user_id, p_source, p_tier, p_status, p_product_id, p_external_id, p_stripe_customer_id,
      p_started_at, p_current_period_end, p_canceled_at, p_event_id, v_event_at
    )
    RETURNING id INTO v_subscription_id;
    v_action := 'inserted';
  ELSE
    -- Update existing row
    UPDATE subscriptions SET
      tier               = p_tier,
      status             = p_status,
      product_id         = p_product_id,
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      current_period_end = COALESCE(p_current_period_end, current_period_end),
      canceled_at        = COALESCE(p_canceled_at, canceled_at),
      last_event_id      = p_event_id,
      last_event_at      = v_event_at
    WHERE id = v_existing_id
    RETURNING id INTO v_subscription_id;
    v_action := 'updated';
  END IF;

  -- Recompute profiles.tier from this user's current active subscriptions.
  -- Highest tier wins: premium > pro > free.
  SELECT CASE
    WHEN bool_or(tier = 'premium') THEN 'premium'
    WHEN bool_or(tier = 'pro')     THEN 'pro'
    ELSE 'free'
  END
  INTO v_new_profile_tier
  FROM subscriptions
  WHERE user_id = p_user_id AND status = 'active';

  -- Default if no active subscriptions exist
  IF v_new_profile_tier IS NULL THEN
    v_new_profile_tier := 'free';
  END IF;

  UPDATE profiles
     SET tier = v_new_profile_tier,
         updated_at = NOW()
   WHERE id = p_user_id;

  RETURN QUERY SELECT v_action, v_subscription_id, v_new_profile_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow service_role (and only service_role) to call the function.
-- Webhooks run with service role; clients should never call this directly.
REVOKE ALL ON FUNCTION upsert_subscription_event(UUID, subscription_source, TEXT, subscription_status, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_subscription_event(UUID, subscription_source, TEXT, subscription_status, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, BIGINT) TO service_role;

COMMENT ON FUNCTION upsert_subscription_event IS
  'Atomic upsert of a subscription row + sync of profiles.tier. Handles idempotency (event_id) and out-of-order (event_timestamp_ms) protection. Called from revenuecat-webhook and stripe-webhook edge functions.';

-- =============================================================================
-- ONE-TIME CLEANUP (NOT included in this migration; run via Management API)
-- =============================================================================
-- Audit (2026-04-28) found that of the 8 paid testers in profiles, only 2 are
-- real IAP customers (the developer's own accounts). 4 are dev/test accounts
-- with no real transactions. 2 are manual VIP grants (Drew + Wyatt) — these
-- are kept at tier='premium' for now per the team decision (2026-04-29);
-- if/when they need a real subscription row, they redeem comp codes per
-- docs/COMP_CODES.md.
--
-- Cleanup steps (run as a one-off after this migration applies):
--   1. UPDATE profiles SET tier='free', stripe_customer_id=NULL,
--      stripe_subscription_id=NULL WHERE email IN (
--        'seph.taylor@outlook.com', 'joseph@quotecat.ai',
--        'pro@quotecat.ai', 'premium@quotecat.ai'
--      );
--   2. INSERT subscriptions rows for jobhato@gmail.com and jobhato@icloud.com
--      with source=app_store|play_store (per platform), tier='premium', status='active',
--      product_id, external_id, current_period_end pulled from RC REST API.
--   3. Leave Drew (foxrider12@icloud.com) and Wyatt (wyattstephan@stephanelectric.com)
--      at tier='premium' with no subscriptions row. Manage Account button will return
--      "no active subscription" for them, which is acceptable per team decision.
--
-- After cleanup: 2 real IAP users have subscription rows + 2 VIPs at tier='premium'
-- (no row) + everyone else free. See docs/COMP_CODES.md for the comp code workflow.
