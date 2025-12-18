-- 007_create_contracts_tables.sql
-- Contracts and digital signatures for Premium users

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id UUID, -- Optional reference to source quote

  -- Contract identification
  contract_number TEXT NOT NULL,

  -- Client info
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,

  -- Contract content
  project_name TEXT NOT NULL,
  scope_of_work TEXT,
  materials JSONB DEFAULT '[]'::jsonb,
  labor NUMERIC(12,2) DEFAULT 0,
  material_estimate NUMERIC(12,2) DEFAULT 0,
  markup_percent NUMERIC(5,2),
  tax_percent NUMERIC(5,2),
  total NUMERIC(12,2) NOT NULL,

  -- Terms
  payment_terms TEXT,
  terms_and_conditions TEXT,
  start_date DATE,
  completion_date DATE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'declined', 'expired')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Optional expiration date

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Signatures table
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  -- Who signed
  signer_type TEXT NOT NULL CHECK (signer_type IN ('contractor', 'client')),
  signer_name TEXT NOT NULL,
  signer_email TEXT,

  -- Signature data
  signature_image TEXT NOT NULL, -- Base64 PNG

  -- Legal audit trail
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ DEFAULT now()
);

-- Contract views table (audit trail for legal compliance)
CREATE TABLE IF NOT EXISTS contract_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  -- Viewer info (for audit)
  ip_address TEXT,
  user_agent TEXT,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_contracts_user_id ON contracts(user_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_quote_id ON contracts(quote_id);
CREATE INDEX idx_signatures_contract_id ON signatures(contract_id);
CREATE INDEX idx_contract_views_contract_id ON contract_views(contract_id);

-- Row Level Security
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_views ENABLE ROW LEVEL SECURITY;

-- Contracts: users can only see their own
CREATE POLICY "Users can view own contracts"
  ON contracts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contracts"
  ON contracts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contracts"
  ON contracts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contracts"
  ON contracts FOR DELETE
  USING (auth.uid() = user_id);

-- Public access for viewing contracts (clients need to view without auth)
CREATE POLICY "Anyone can view contracts by id"
  ON contracts FOR SELECT
  USING (true);

-- Signatures: viewable by contract owner, insertable by anyone (client signing)
CREATE POLICY "Users can view signatures on own contracts"
  ON signatures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = signatures.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Allow public to insert signatures (clients signing)
CREATE POLICY "Anyone can insert signatures"
  ON signatures FOR INSERT
  WITH CHECK (true);

-- Allow public to view signatures (for confirmation page)
CREATE POLICY "Anyone can view signatures"
  ON signatures FOR SELECT
  USING (true);

-- Contract views: anyone can insert (tracking), owner can view
CREATE POLICY "Anyone can insert contract views"
  ON contract_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view views on own contracts"
  ON contract_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = contract_views.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_contracts_updated_at();
