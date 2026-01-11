-- Add category filter to search_products
-- Created: 2026-01-11
-- Description: Filter product search by category to prevent cross-trade results

-- =============================================================================
-- DROP EXISTING FUNCTION FIRST (required to change signature)
-- =============================================================================
DROP FUNCTION IF EXISTS search_products(TEXT, INTEGER);

-- =============================================================================
-- REPLACE SEARCH FUNCTION WITH CATEGORY FILTER
-- =============================================================================
CREATE OR REPLACE FUNCTION search_products(
  search_query TEXT,
  result_limit INTEGER DEFAULT 10,
  category_filter TEXT DEFAULT NULL  -- Optional: filter by category name (partial match)
) RETURNS TABLE (
  id TEXT,
  name TEXT,
  unit TEXT,
  unit_price DECIMAL,
  category_id TEXT,
  retailer TEXT,
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

  -- Check if full-text search has results (with optional category filter)
  IF category_filter IS NOT NULL THEN
    SELECT COUNT(*) INTO result_count
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.search_vector @@ to_tsquery('english', tsquery_str)
      AND lower(c.name) LIKE '%' || lower(category_filter) || '%';
  ELSE
    SELECT COUNT(*) INTO result_count
    FROM products p
    WHERE p.search_vector @@ to_tsquery('english', tsquery_str);
  END IF;

  IF result_count > 0 THEN
    -- Return full-text search results (ranked)
    IF category_filter IS NOT NULL THEN
      RETURN QUERY
      SELECT
        p.id,
        p.name,
        p.unit,
        p.unit_price,
        p.category_id,
        p.retailer,
        ts_rank(p.search_vector, to_tsquery('english', tsquery_str)) AS rank
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.search_vector @@ to_tsquery('english', tsquery_str)
        AND lower(c.name) LIKE '%' || lower(category_filter) || '%'
      ORDER BY rank DESC, p.name ASC
      LIMIT result_limit;
    ELSE
      RETURN QUERY
      SELECT
        p.id,
        p.name,
        p.unit,
        p.unit_price,
        p.category_id,
        p.retailer,
        ts_rank(p.search_vector, to_tsquery('english', tsquery_str)) AS rank
      FROM products p
      WHERE p.search_vector @@ to_tsquery('english', tsquery_str)
      ORDER BY rank DESC, p.name ASC
      LIMIT result_limit;
    END IF;
  ELSE
    -- Fall back to fuzzy/trigram search (catches typos)
    IF category_filter IS NOT NULL THEN
      RETURN QUERY
      SELECT
        p.id,
        p.name,
        p.unit,
        p.unit_price,
        p.category_id,
        p.retailer,
        similarity(p.name, search_query) AS rank
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE similarity(p.name, search_query) > 0.1
        AND lower(c.name) LIKE '%' || lower(category_filter) || '%'
      ORDER BY rank DESC
      LIMIT result_limit;
    ELSE
      RETURN QUERY
      SELECT
        p.id,
        p.name,
        p.unit,
        p.unit_price,
        p.category_id,
        p.retailer,
        similarity(p.name, search_query) AS rank
      FROM products p
      WHERE similarity(p.name, search_query) > 0.1
      ORDER BY rank DESC
      LIMIT result_limit;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT EXECUTE ON FUNCTION search_products TO anon, authenticated, service_role;
