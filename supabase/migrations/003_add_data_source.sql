-- Migration 003: Add data_source field for tracking AI vs API data
-- Created: 2025-01-04
-- Description: Adds data_source column to distinguish between AI-estimated and real API data

-- =============================================================================
-- ADD DATA SOURCE FIELD
-- =============================================================================
ALTER TABLE products
ADD COLUMN data_source TEXT DEFAULT 'ai_estimated'
CHECK (data_source IN ('ai_estimated', 'api_live', 'user_submitted'));

COMMENT ON COLUMN products.data_source IS
  'Source of product data: ai_estimated (temporary AI pricing), api_live (real supplier API), user_submitted (contractor added)';

-- Index for fast filtering
CREATE INDEX idx_products_data_source ON products(data_source);

-- =============================================================================
-- HELPER FUNCTION: Get products by source
-- =============================================================================
CREATE OR REPLACE FUNCTION get_products_by_source(source_type TEXT)
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM products
  WHERE data_source = source_type
  ORDER BY name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_products_by_source IS
  'Helper function to filter products by data source type';

-- =============================================================================
-- HELPER FUNCTION: Clean up AI-estimated products (for when API arrives)
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_ai_products()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM products
  WHERE data_source = 'ai_estimated';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_ai_products IS
  'Deletes all AI-estimated products when ready to replace with real API data. Returns count of deleted rows.';
