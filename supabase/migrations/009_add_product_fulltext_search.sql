-- Full-text search for products
-- Created: 2025-12-26
-- Description: Adds tsvector column and GIN index for robust product search

-- =============================================================================
-- ADD SEARCH VECTOR COLUMN
-- =============================================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- =============================================================================
-- CREATE FUNCTION TO UPDATE SEARCH VECTOR
-- Combines product name, description, and will join category name
-- =============================================================================
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
DECLARE
  category_name TEXT;
BEGIN
  -- Get category name if exists
  SELECT name INTO category_name FROM categories WHERE id = NEW.category_id;

  -- Build search vector from name, description, sku, and category
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.sku, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(category_name, '')), 'C');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CREATE TRIGGER
-- =============================================================================
DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_update();

-- =============================================================================
-- CREATE GIN INDEX FOR FAST SEARCHING
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vector);

-- =============================================================================
-- POPULATE EXISTING PRODUCTS
-- =============================================================================
UPDATE products SET
  search_vector = (
    SELECT
      setweight(to_tsvector('english', COALESCE(products.name, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(products.description, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE(products.sku, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE(c.name, '')), 'C')
    FROM categories c
    WHERE c.id = products.category_id
  )
WHERE search_vector IS NULL;

-- Handle products without categories
UPDATE products SET
  search_vector =
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(sku, '')), 'B')
WHERE search_vector IS NULL;

-- =============================================================================
-- ENABLE TRIGRAM EXTENSION FOR FUZZY SEARCH
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- CREATE TRIGRAM INDEX FOR FUZZY MATCHING
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);

-- =============================================================================
-- CREATE SEARCH FUNCTION
-- 1. Full-text search (fast, ranked, handles stemming)
-- 2. Fuzzy/trigram fallback (catches typos like "presure" → "pressure")
-- =============================================================================
CREATE OR REPLACE FUNCTION search_products(
  search_query TEXT,
  result_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  id TEXT,
  name TEXT,
  unit TEXT,
  unit_price DECIMAL,
  category_id TEXT,
  rank REAL
) AS $$
DECLARE
  tsquery_str TEXT;
  words TEXT[];
  result_count INTEGER;
BEGIN
  -- Build prefix-matching tsquery from search words
  words := regexp_split_to_array(lower(trim(search_query)), '\s+');
  tsquery_str := array_to_string(
    ARRAY(SELECT word || ':*' FROM unnest(words) AS word WHERE word != ''),
    ' & '
  );

  -- Check if full-text search has results
  SELECT COUNT(*) INTO result_count
  FROM products p
  WHERE p.search_vector @@ to_tsquery('english', tsquery_str);

  IF result_count > 0 THEN
    -- Return full-text search results (ranked)
    RETURN QUERY
    SELECT
      p.id,
      p.name,
      p.unit,
      p.unit_price,
      p.category_id,
      ts_rank(p.search_vector, to_tsquery('english', tsquery_str)) AS rank
    FROM products p
    WHERE p.search_vector @@ to_tsquery('english', tsquery_str)
    ORDER BY rank DESC, p.name ASC
    LIMIT result_limit;
  ELSE
    -- Fall back to fuzzy/trigram search (catches typos)
    RETURN QUERY
    SELECT
      p.id,
      p.name,
      p.unit,
      p.unit_price,
      p.category_id,
      similarity(p.name, search_query) AS rank
    FROM products p
    WHERE similarity(p.name, search_query) > 0.1
    ORDER BY rank DESC
    LIMIT result_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT EXECUTE ON FUNCTION search_products TO anon, authenticated, service_role;
