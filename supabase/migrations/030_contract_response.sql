-- 030_contract_response.sql
-- Customer-facing contract responses: Decline and Request Changes.
--
-- v1.2.14 #5. Adds the inverse path of "Sign": a customer can either
-- decline outright (terminal-but-revertible) or request changes with a
-- message back to the contractor. Both produce in-app notifications.
--
-- The contractor can still Revert-to-Draft from either of these states
-- (declined or changes_requested) to edit and re-pitch the same contract.

-- 1. Extend contract status check constraint to include changes_requested.
--    Existing values: draft, sent, viewed, signed, declined, completed,
--    expired. Adding: changes_requested.
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE contracts ADD CONSTRAINT contracts_status_check
  CHECK (status IN (
    'draft', 'sent', 'viewed', 'signed', 'completed',
    'declined', 'changes_requested', 'expired'
  ));

-- 2. Add response columns. Both messages are bounded at 4000 chars to
--    prevent abuse; trimming happens server-side. Timestamps are nullable.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS decline_reason TEXT
  CHECK (decline_reason IS NULL OR char_length(decline_reason) <= 4000);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS change_request_message TEXT
  CHECK (change_request_message IS NULL OR char_length(change_request_message) <= 4000);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS change_requested_at TIMESTAMPTZ;

-- 3. Extend notifications type check to include the new event.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_type;
ALTER TABLE notifications ADD CONSTRAINT valid_type
  CHECK (type IN (
    'contract_signed',
    'contract_viewed',
    'contract_declined',
    'contract_changes_requested'
  ));
