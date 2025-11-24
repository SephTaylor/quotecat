-- QuoteCat Invoices Table Migration
-- Created: 2025-01-24
-- Description: Add invoices table for cloud sync

-- =============================================================================
-- INVOICES TABLE
-- =============================================================================
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id TEXT, -- Reference to original quote (not FK because quotes can be deleted)

  -- Invoice identification
  invoice_number TEXT NOT NULL,

  -- Quote data (copied at time of invoice creation)
  name TEXT NOT NULL,
  client_name TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  labor DECIMAL(10,2) DEFAULT 0,
  material_estimate DECIMAL(10,2),
  overhead DECIMAL(10,2),
  markup_percent DECIMAL(5,2),
  notes TEXT,

  -- Invoice-specific fields
  invoice_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue')),
  paid_date TIMESTAMPTZ,
  paid_amount DECIMAL(10,2),

  -- Percentage/partial invoice support
  percentage DECIMAL(5,2), -- e.g., 50.00 for 50% deposit
  is_partial_invoice BOOLEAN DEFAULT FALSE,

  -- Metadata
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'CAD', 'EUR', 'CRC')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_quote_id ON invoices(quote_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX idx_invoices_deleted_at ON invoices(deleted_at) WHERE deleted_at IS NULL;

-- Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own invoices"
  ON invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
  ON invoices FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
