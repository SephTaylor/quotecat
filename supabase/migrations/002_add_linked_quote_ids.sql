-- QuoteCat Migration: Add linked_quote_ids for multi-tier quotes
-- Created: 2025-12-15
-- Description: Adds linked_quote_ids column to support Good/Better/Best quote tiers

-- Add linked_quote_ids column (stores array of quote IDs as JSONB)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS linked_quote_ids JSONB DEFAULT '[]'::jsonb;

-- Add follow_up_date column (for follow-up reminders)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ;

-- Create index for efficient lookup of linked quotes
CREATE INDEX IF NOT EXISTS idx_quotes_linked_quote_ids ON quotes USING GIN (linked_quote_ids);
