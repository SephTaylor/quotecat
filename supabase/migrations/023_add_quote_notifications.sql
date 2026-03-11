-- 023_add_quote_notifications.sql
-- Add quote_id column to notifications table and expand type constraint for quotes

-- Add quote_id column (nullable, references quotes table)
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE;

-- Create index for quote_id lookups
CREATE INDEX IF NOT EXISTS idx_notifications_quote_id ON notifications(quote_id);

-- Drop old constraint and add new one with expanded types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_type;
ALTER TABLE notifications ADD CONSTRAINT valid_type CHECK (
  type IN (
    'contract_signed',
    'contract_viewed',
    'contract_declined',
    'quote_approved',
    'quote_declined',
    'quote_viewed'
  )
);
