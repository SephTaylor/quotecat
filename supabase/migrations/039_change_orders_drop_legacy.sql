-- Migration 039: drop the legacy allowances added in 038.
--
-- 038 kept a nullable quote parent and three old statuses (pending, approved,
-- cancelled) for change orders created before January. Establishing the dates
-- showed that population is empty:
--
--   2025-12-22  change orders shipped, gated to Pro/Premium
--   2026-01-08  creation removed (change-order-simplification-plan.md)
--   2026-03-23  cloud sync added, two months AFTER nothing could create one
--
-- So the creation window was about two and a half weeks. One account existed in
-- it, created on 8 January, the same day creation was removed, and there were
-- ZERO subscriptions of any kind before May 2026 for the tier the feature was
-- gated behind. Anyone touching the app then was testing it.
--
-- The zero rows in this table were never evidence either way, since sync did not
-- exist until March. That was a bad inference on my part, corrected here.

-- A change order always modifies a contract. There is no other parent.
ALTER TABLE change_orders DROP CONSTRAINT IF EXISTS change_orders_has_parent;
ALTER TABLE change_orders ALTER COLUMN contract_id SET NOT NULL;

-- Status is exactly the contract lifecycle now, nothing else.
ALTER TABLE change_orders DROP CONSTRAINT IF EXISTS change_orders_status_check;
ALTER TABLE change_orders ADD CONSTRAINT change_orders_status_check
  CHECK (status = ANY (ARRAY[
    'draft', 'sent', 'viewed', 'signed', 'completed',
    'declined', 'changes_requested', 'expired'
  ]));

-- quote_id stays. It is not the parent and is never written by the new creation
-- path, but the quote-scoped read helpers are still wired into the dashboard and
-- quotes tabs. Dropping the column is a separate cleanup with its own blast
-- radius, not something to smuggle into this one.
