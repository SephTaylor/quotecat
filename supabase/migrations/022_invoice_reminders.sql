-- Invoice Payment Reminders Migration
-- Created: 2026-03-06
-- Description: Add invoice_reminders table and tracking columns for payment reminder emails/SMS

-- =============================================================================
-- ADD MISSING COLUMNS TO INVOICES (if not already present)
-- =============================================================================

-- Client contact info (needed for sending reminders)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_address TEXT;

-- Reminder tracking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- =============================================================================
-- INVOICE REMINDERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Reminder details
  reminder_type TEXT DEFAULT 'email' CHECK (reminder_type IN ('email', 'sms')),
  remind_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error TEXT,

  -- Tracking
  reminder_number INTEGER DEFAULT 1,  -- 1st, 2nd, 3rd reminder

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate reminders
  UNIQUE(invoice_id, reminder_type, reminder_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_pending
  ON invoice_reminders(status, remind_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_user
  ON invoice_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice
  ON invoice_reminders(invoice_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice reminders"
  ON invoice_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoice reminders"
  ON invoice_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoice reminders"
  ON invoice_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoice reminders"
  ON invoice_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- SERVICE ROLE ACCESS (for cron job processing)
-- =============================================================================

-- Allow service role to process reminders (for cron job)
CREATE POLICY "Service role can manage all reminders"
  ON invoice_reminders FOR ALL
  USING (auth.role() = 'service_role');
