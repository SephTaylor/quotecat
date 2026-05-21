-- Migration 027: Enable RLS on change_orders + add share-token scaffolding
--
-- Two things:
--   1. Enable RLS on change_orders. Migration 024 was supposed to do this but
--      apparently never applied to the live database (the schema_migrations
--      tracking table is out of sync — see FOLLOWUPS). Supabase Security
--      Advisor flagged change_orders as "rls_disabled_in_public" on 2026-05-17.
--   2. Add a change_order_shares table and a token-validated SELECT policy
--      on change_orders so the eventual portal customer-viewing flow has its
--      auth layer ready. Dormant until the portal route ships — no tokens
--      exist yet, no client code calls this. Cheap scaffold, no behavior
--      change today.
--
-- After this migration, change_orders is reachable by:
--   - The owning user (auth.uid() = user_id) via the mobile app
--   - Anyone presenting a valid, non-expired, non-revoked share token via the
--     x-co-share-token request header
--   - service_role (always, via the implicit bypass)

-- =============================================================================
-- 1. change_orders RLS + per-user policies
-- =============================================================================

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own change_orders" ON change_orders;
DROP POLICY IF EXISTS "Users can insert own change_orders" ON change_orders;
DROP POLICY IF EXISTS "Users can update own change_orders" ON change_orders;
DROP POLICY IF EXISTS "Users can delete own change_orders" ON change_orders;

CREATE POLICY "Users can view own change_orders"
  ON change_orders FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own change_orders"
  ON change_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own change_orders"
  ON change_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own change_orders"
  ON change_orders FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 2. Share-token scaffolding for future customer-facing portal access
-- =============================================================================

CREATE TABLE IF NOT EXISTS change_order_shares (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id    TEXT NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
  token              TEXT NOT NULL UNIQUE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '30 days'),
  revoked_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_change_order_shares_token
  ON change_order_shares(token);
CREATE INDEX IF NOT EXISTS idx_change_order_shares_change_order_id
  ON change_order_shares(change_order_id);

ALTER TABLE change_order_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own change_order_shares" ON change_order_shares;
DROP POLICY IF EXISTS "Anyone can read change_order_shares by token" ON change_order_shares;

-- Contractor (owner) can fully manage shares they created
CREATE POLICY "Users can manage own change_order_shares"
  ON change_order_shares FOR ALL
  USING (auth.uid() = created_by_user_id)
  WITH CHECK (auth.uid() = created_by_user_id);

-- Anonymous portal callers can read share rows that are still live, so the
-- portal can validate a presented token without service_role if it chooses.
CREATE POLICY "Anyone can read change_order_shares by token"
  ON change_order_shares FOR SELECT
  TO anon
  USING (revoked_at IS NULL AND expires_at > NOW());

-- =============================================================================
-- 3. Token-based SELECT policy on change_orders for customer-facing access
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can view change_orders via valid share token" ON change_orders;

-- Anonymous callers can SELECT a change_order row iff they present a valid
-- (non-expired, non-revoked) share token in the x-co-share-token request
-- header. Portal /c/<token> route is expected to forward the token this way.
CREATE POLICY "Anyone can view change_orders via valid share token"
  ON change_orders FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM change_order_shares
      WHERE change_order_shares.change_order_id = change_orders.id
        AND change_order_shares.token = current_setting('request.headers', true)::json->>'x-co-share-token'
        AND change_order_shares.revoked_at IS NULL
        AND change_order_shares.expires_at > NOW()
    )
  );
