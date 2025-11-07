-- Migration 004: Add retailer support for multi-retailer pricing
-- Created: 2025-01-04
-- Description: Adds retailer field and updates schema for Home Depot, Lowe's, Menards data

-- =============================================================================
-- ADD RETAILER FIELD
-- =============================================================================
ALTER TABLE products
ADD COLUMN retailer TEXT DEFAULT NULL;

COMMENT ON COLUMN products.retailer IS
  'Retailer identifier: homedepot, lowes, menards, etc. NULL for generic products.';

-- Index for filtering by retailer
CREATE INDEX idx_products_retailer ON products(retailer);

-- Combined index for category + retailer queries (common pattern)
CREATE INDEX idx_products_category_retailer ON products(category_id, retailer);

-- =============================================================================
-- UPDATE DATA SOURCE CHECK
-- =============================================================================
-- Expand data_source options to include retailers
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_data_source_check;

ALTER TABLE products
ADD CONSTRAINT products_data_source_check
CHECK (data_source IN ('ai_estimated', 'api_live', 'user_submitted', 'retailer_scraped'));

COMMENT ON CONSTRAINT products_data_source_check ON products IS
  'Valid sources: ai_estimated (temporary), api_live (1Build/Menards API), user_submitted (contractor added), retailer_scraped (RetailGators data)';

-- =============================================================================
-- HELPER FUNCTION: Get products by retailer
-- =============================================================================
CREATE OR REPLACE FUNCTION get_products_by_retailer(retailer_name TEXT)
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM products
  WHERE retailer = retailer_name
  ORDER BY category_id, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_products_by_retailer IS
  'Helper function to filter products by retailer (homedepot, lowes, menards)';

-- =============================================================================
-- HELPER FUNCTION: Get best price across retailers
-- =============================================================================
CREATE OR REPLACE FUNCTION get_best_price_product(product_name_pattern TEXT)
RETURNS TABLE(
  product_id TEXT,
  name TEXT,
  retailer TEXT,
  unit_price DECIMAL,
  category_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.name)
    p.id,
    p.name,
    p.retailer,
    p.unit_price,
    p.category_id
  FROM products p
  WHERE p.name ILIKE product_name_pattern
    AND p.retailer IS NOT NULL
  ORDER BY p.name, p.unit_price ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_best_price_product IS
  'Finds the lowest price for a product across all retailers. Useful for price comparison features.';

-- =============================================================================
-- HELPER FUNCTION: Clean up products by data source
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_products_by_source(source_type TEXT)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM products
  WHERE data_source = source_type;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_products_by_source IS
  'Deletes all products from a specific data source. Use before loading retailer data: SELECT cleanup_products_by_source(''ai_estimated'');';

-- =============================================================================
-- VIEWS: Useful queries for analytics
-- =============================================================================

-- View: Product count by retailer
CREATE OR REPLACE VIEW product_counts_by_retailer AS
SELECT
  retailer,
  category_id,
  COUNT(*) as product_count,
  AVG(unit_price) as avg_price,
  MIN(unit_price) as min_price,
  MAX(unit_price) as max_price
FROM products
WHERE retailer IS NOT NULL
GROUP BY retailer, category_id
ORDER BY retailer, category_id;

COMMENT ON VIEW product_counts_by_retailer IS
  'Summary view showing product counts and price ranges by retailer and category';

-- View: Price comparison (same product across retailers)
CREATE OR REPLACE VIEW price_comparison AS
SELECT
  p1.name,
  p1.unit,
  p1.category_id,
  MAX(CASE WHEN p1.retailer = 'homedepot' THEN p1.unit_price END) as homedepot_price,
  MAX(CASE WHEN p1.retailer = 'lowes' THEN p1.unit_price END) as lowes_price,
  MAX(CASE WHEN p1.retailer = 'menards' THEN p1.unit_price END) as menards_price,
  MIN(p1.unit_price) as best_price,
  MAX(p1.unit_price) - MIN(p1.unit_price) as price_difference
FROM products p1
WHERE p1.retailer IN ('homedepot', 'lowes', 'menards')
GROUP BY p1.name, p1.unit, p1.category_id
HAVING COUNT(DISTINCT p1.retailer) > 1  -- Only show products available at multiple retailers
ORDER BY price_difference DESC;

COMMENT ON VIEW price_comparison IS
  'Shows price differences for products available at multiple retailers. Useful for price comparison features.';

-- =============================================================================
-- SAMPLE QUERIES (for documentation)
-- =============================================================================

-- Get all Home Depot lumber products:
-- SELECT * FROM products WHERE retailer = 'homedepot' AND category_id = 'framing';

-- Find cheapest 2x4x8 stud across all retailers:
-- SELECT * FROM get_best_price_product('%2x4%8%');

-- Get product count by retailer:
-- SELECT retailer, COUNT(*) FROM products WHERE retailer IS NOT NULL GROUP BY retailer;

-- Compare prices across retailers:
-- SELECT * FROM price_comparison WHERE category_id = 'framing' LIMIT 20;

-- Clean up AI products before loading retailer data:
-- SELECT cleanup_products_by_source('ai_estimated');
