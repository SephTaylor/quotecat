-- Migration 038: a change order becomes a modification to a signed contract.
--
-- Until now a change order was a record that a quote changed: a diff, with a
-- required quote_id and no identity of its own. The decision (2026-09-18) is
-- that it is a contract modification. The quote does its job and becomes
-- history; the signed contract is the authoritative instrument; when the work
-- changes you issue a mod against it, and that mod is itself billable.
--
-- Safe to reshape properly rather than work around: change_orders holds ZERO
-- rows in production, verified before writing this.

-- Parent. New change orders hang off a contract. quote_id becomes nullable
-- because it is no longer the parent, but stays for pre-January rows that a
-- long-lived device may still sync up (see migrateChangeOrdersToSQLite).
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS contract_id TEXT;
ALTER TABLE change_orders ALTER COLUMN quote_id DROP NOT NULL;

-- Every change order must hang off something. Prevents orphans without
-- forcing legacy rows to acquire a contract they never had.
ALTER TABLE change_orders DROP CONSTRAINT IF EXISTS change_orders_has_parent;
ALTER TABLE change_orders ADD CONSTRAINT change_orders_has_parent
  CHECK (contract_id IS NOT NULL OR quote_id IS NOT NULL);

-- Nesting, for Mike's scheme: contract 1000 -> 1000.1 -> 1000.1.2, uncapped.
-- display_number carries the dotted string; the existing integer `number`
-- stays as the per-parent counter rather than being retyped.
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS parent_change_order_id TEXT
  REFERENCES change_orders(id) ON DELETE CASCADE;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS display_number TEXT;

-- Its own scope text. `note` is "Reason for Change (Optional)" and stays that.
-- A document that gets signed needs to say what work it covers.
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS description TEXT;

-- Mike's Complete button: "Customer isn't going to want to pay for it until
-- it's done." Bill in full when complete is the default billing option.
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Status gains the contract lifecycle. Mirrors contracts exactly (draft, sent,
-- viewed, signed, completed, declined, changes_requested, expired) because a
-- change order signs the same way a contract does.
--
-- The three legacy values are kept rather than rewritten. Pre-January rows on
-- a device carry them, and the January decision deliberately preserved that
-- history for viewing. Rewriting someone's records to fit a new vocabulary is
-- not this migration's business.
ALTER TABLE change_orders DROP CONSTRAINT IF EXISTS change_orders_status_check;
ALTER TABLE change_orders ADD CONSTRAINT change_orders_status_check
  CHECK (status = ANY (ARRAY[
    'draft', 'sent', 'viewed', 'signed', 'completed',
    'declined', 'changes_requested', 'expired',
    'pending', 'approved', 'cancelled'
  ]));

CREATE INDEX IF NOT EXISTS idx_change_orders_contract_id ON change_orders(contract_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_parent ON change_orders(parent_change_order_id);
