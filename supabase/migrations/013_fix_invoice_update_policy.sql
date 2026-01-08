-- Fix invoice UPDATE policy to allow soft deletes
-- The UPDATE policy needs WITH CHECK clause to allow setting deleted_at

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update own invoices" ON invoices;

-- Recreate with explicit WITH CHECK clause
CREATE POLICY "Users can update own invoices"
  ON invoices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Also fix quotes table if it has the same issue
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;

CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Also fix clients table
DROP POLICY IF EXISTS "Users can update own clients" ON clients;

CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
