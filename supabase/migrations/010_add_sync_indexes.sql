-- Sync-optimized indexes for scaling to 30K+ items
-- Created: 2025-12-30
-- Description: Composite indexes for incremental sync and paginated queries

-- =============================================================================
-- QUOTES SYNC INDEX
-- Optimized for: "get all quotes updated since X for user Y"
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_quotes_user_sync
ON quotes(user_id, updated_at DESC)
WHERE deleted_at IS NULL;

-- For fetching deleted quotes (sync deletions across devices)
CREATE INDEX IF NOT EXISTS idx_quotes_user_deleted
ON quotes(user_id, updated_at DESC)
WHERE deleted_at IS NOT NULL;

-- For filtered list views (status filter + date ordering)
CREATE INDEX IF NOT EXISTS idx_quotes_user_status_date
ON quotes(user_id, status, updated_at DESC)
WHERE deleted_at IS NULL;

-- =============================================================================
-- INVOICES SYNC INDEX
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_user_sync
ON invoices(user_id, updated_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_user_deleted
ON invoices(user_id, updated_at DESC)
WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_user_status_date
ON invoices(user_id, status, updated_at DESC)
WHERE deleted_at IS NULL;

-- =============================================================================
-- CLIENTS SYNC INDEX
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_clients_user_sync
ON clients(user_id, updated_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_user_deleted
ON clients(user_id, updated_at DESC)
WHERE deleted_at IS NOT NULL;

-- For client name search/autocomplete
CREATE INDEX IF NOT EXISTS idx_clients_user_name
ON clients(user_id, name)
WHERE deleted_at IS NULL;

-- =============================================================================
-- CONTRACTS SYNC INDEX (if premium users scale)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_contracts_user_sync
ON contracts(user_id, updated_at DESC)
WHERE deleted_at IS NULL;

-- =============================================================================
-- ASSEMBLIES SYNC INDEX
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_assemblies_user_sync
ON assemblies(user_id, updated_at DESC)
WHERE deleted_at IS NULL;

-- =============================================================================
-- ANALYZE TABLES
-- Update statistics for query planner after adding indexes
-- =============================================================================
ANALYZE quotes;
ANALYZE invoices;
ANALYZE clients;
ANALYZE contracts;
ANALYZE assemblies;
