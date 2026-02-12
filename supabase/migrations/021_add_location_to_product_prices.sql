-- Extend product_prices for per-city, multi-supplier weekly pricing
-- Supports price trends, cross-supplier comparison, historical analytics

-- Add location reference
ALTER TABLE product_prices
  ADD COLUMN location_id TEXT REFERENCES locations(id);

-- Add supplier reference (denormalized for analytics queries)
ALTER TABLE product_prices
  ADD COLUMN supplier_id TEXT REFERENCES suppliers(id);

-- Add week_of for efficient weekly analytics partitioning
ALTER TABLE product_prices
  ADD COLUMN week_of DATE;

-- Analytics indexes
CREATE INDEX idx_product_prices_location ON product_prices(location_id);
CREATE INDEX idx_product_prices_supplier ON product_prices(supplier_id);
CREATE INDEX idx_product_prices_week ON product_prices(week_of DESC);

-- Composite for price trends: "product X in location Y over time"
CREATE INDEX idx_product_prices_analytics
  ON product_prices(product_id, location_id, week_of DESC);

-- Composite for cross-supplier comparison
CREATE INDEX idx_product_prices_supplier_compare
  ON product_prices(product_id, location_id, supplier_id, effective_at DESC);

-- View for current prices (latest per product/location/supplier combo)
CREATE VIEW current_prices AS
SELECT DISTINCT ON (product_id, location_id, supplier_id)
  id,
  product_id,
  location_id,
  supplier_id,
  price,
  currency,
  effective_at,
  week_of,
  created_at
FROM product_prices
WHERE location_id IS NOT NULL
ORDER BY product_id, location_id, supplier_id, effective_at DESC;

-- Grant access to the view
GRANT SELECT ON current_prices TO anon, authenticated;
