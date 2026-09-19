-- Migration 040: a signature can belong to a change order, not only a contract.
--
-- A change order is a modification to a signed contract and is signed the same
-- way, by both parties, so it uses the same signatures table rather than a
-- parallel one. One table means one audit trail and one place to get the legal
-- fields right.
--
-- Note the type difference: contracts.id is UUID, change_orders.id is TEXT
-- (phone-created ids look like co_1788797883416_37nhbrz). So the new column is
-- TEXT. This is the same mismatch that silently broke contracts.quote_id until
-- migration 035; getting it right here avoids repeating that.
--
-- Three existing signature rows on two contracts are untouched: contract_id
-- only becomes nullable, and every current row has one.

ALTER TABLE signatures ADD COLUMN IF NOT EXISTS change_order_id TEXT
  REFERENCES change_orders(id) ON DELETE CASCADE;

ALTER TABLE signatures ALTER COLUMN contract_id DROP NOT NULL;

-- Exactly one parent. A signature that belongs to both, or to neither, is not
-- a thing that can be defended if someone disputes it later.
ALTER TABLE signatures DROP CONSTRAINT IF EXISTS signatures_one_parent;
ALTER TABLE signatures ADD CONSTRAINT signatures_one_parent
  CHECK (
    (contract_id IS NOT NULL AND change_order_id IS NULL)
    OR (contract_id IS NULL AND change_order_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_signatures_change_order_id
  ON signatures(change_order_id);

-- The owner-scoped policies walk to contracts to find user_id. A change order
-- signature has no contract_id, so those EXISTS clauses evaluate false and the
-- owner cannot see or delete their own signature. These mirror them via
-- change_orders, which carries user_id directly.
DROP POLICY IF EXISTS "Users can view signatures on own change orders" ON signatures;
CREATE POLICY "Users can view signatures on own change orders"
  ON signatures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM change_orders
      WHERE change_orders.id = signatures.change_order_id
        AND change_orders.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete signatures on own change orders" ON signatures;
CREATE POLICY "Users can delete signatures on own change orders"
  ON signatures FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM change_orders
      WHERE change_orders.id = signatures.change_order_id
        AND change_orders.user_id = auth.uid()
    )
  );
