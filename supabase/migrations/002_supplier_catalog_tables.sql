-- QuoteCat Supplier Catalog Schema
-- Created: 2025-01-23
-- Description: Tables for supplier product catalog with API integration support

-- =============================================================================
-- SUPPLIERS TABLE
-- =============================================================================
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_provider TEXT, -- 'lowes', 'homedepot', 'menards', '1build', etc.
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_api_provider ON suppliers(api_provider);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view suppliers"
  ON suppliers FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage suppliers"
  ON suppliers FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- CATEGORIES TABLE
-- =============================================================================
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES categories(id),
  icon TEXT,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage categories"
  ON categories FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- PRODUCTS TABLE (Supplier catalog)
-- =============================================================================
CREATE TABLE products (
  id TEXT PRIMARY KEY,

  -- Product info
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  category_id TEXT REFERENCES categories(id),

  -- Supplier info
  supplier_id TEXT REFERENCES suppliers(id),
  supplier_product_id TEXT, -- Their internal ID
  supplier_url TEXT,

  -- Pricing (current)
  unit_price DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'EA', -- EA, LF, SF, etc.
  currency TEXT DEFAULT 'USD',

  -- Availability
  in_stock BOOLEAN DEFAULT TRUE,
  stock_quantity INTEGER,

  -- Images
  image_url TEXT,
  thumbnail_url TEXT,

  -- Metadata
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- PRODUCT_PRICES TABLE (Price history)
-- =============================================================================
CREATE TABLE product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,

  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- When this price was observed
  effective_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_prices_product ON product_prices(product_id);
CREATE INDEX idx_product_prices_date ON product_prices(effective_at DESC);

ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product prices"
  ON product_prices FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage product prices"
  ON product_prices FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- TRIGGERS
-- =============================================================================
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
