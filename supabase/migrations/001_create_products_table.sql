-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  sku TEXT,
  supplier_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for category lookups
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Create index for SKU lookups
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read products (public catalog)
CREATE POLICY "Products are viewable by everyone"
  ON products
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert/update (for now)
-- Later we'll restrict this to admin/supplier roles
CREATE POLICY "Authenticated users can insert products"
  ON products
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update products"
  ON products
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Insert seed data from PRODUCTS_SEED
INSERT INTO products (id, category_id, name, unit, unit_price) VALUES
  -- Framing
  ('stud-2x4x8', 'framing', '2x4x8 KD Stud', 'ea', 3.45),
  ('plate-2x4', 'framing', '2x4 Plate (10 ft)', '10ft', 6.90),

  -- Drywall
  ('sheet-1-2-4x8', 'drywall', 'Drywall 1/2 in 4x8', 'sheet', 11.75),
  ('screws-1-1-4', 'drywall', 'Drywall Screws 1-1/4 in (1 lb)', 'box', 6.50),

  -- Electrical
  ('nmb-12-2-250', 'electrical', 'NM-B 12/2 (250 ft)', 'roll', 112.00),
  ('box-single', 'electrical', 'Single-Gang Box (old work)', 'ea', 1.25),

  -- Plumbing
  ('pex-a-1-2-100', 'plumbing', 'PEX-A 1/2 in (100 ft)', 'coil', 42.00),
  ('angle-stop-1-2', 'plumbing', 'Angle Stop 1/2 in x 3/8 in', 'ea', 6.20)
ON CONFLICT (id) DO NOTHING;

-- Create categories table for reference
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
  ON categories
  FOR SELECT
  USING (true);

-- Insert categories
INSERT INTO categories (id, name) VALUES
  ('framing', 'Framing'),
  ('drywall', 'Drywall'),
  ('electrical', 'Electrical'),
  ('plumbing', 'Plumbing')
ON CONFLICT (id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
