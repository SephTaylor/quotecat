-- Add missing columns to quotes table
-- These columns exist in the mobile app Quote type but were missing from initial schema

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_number TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_address TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ;

-- Add index for quote_number lookups
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);
