-- ============================================================================
-- CATEGORY SEED DATA
-- ============================================================================
-- These categories match the product catalog structure

INSERT INTO categories (id, name, description) VALUES
  ('framing', 'Framing', 'Structural framing lumber, posts, beams, and hardware'),
  ('fasteners', 'Fasteners', 'Nails, screws, bolts, anchors, adhesives, and caulks'),
  ('drywall', 'Drywall', 'Drywall sheets, tape, compound, tools, and accessories'),
  ('electrical', 'Electrical', 'Wire, conduit, outlets, switches, breakers, and panels'),
  ('plumbing', 'Plumbing', 'Pipes, fittings, fixtures, valves, and drainage'),
  ('roofing', 'Roofing', 'Shingles, underlayment, flashing, vents, and gutters'),
  ('masonry', 'Masonry', 'Blocks, bricks, cement, mortar, rebar, and concrete')
ON CONFLICT (id) DO NOTHING;

-- Future categories (not yet populated with products)
-- INSERT INTO categories (id, name, description) VALUES
--   ('insulation', 'Insulation', 'Batt, spray foam, rigid foam, and vapor barriers'),
--   ('hvac', 'HVAC', 'Heating, ventilation, and air conditioning equipment'),
--   ('flooring', 'Flooring', 'Hardwood, laminate, tile, carpet, and underlayment'),
--   ('painting', 'Painting', 'Paint, primer, stain, brushes, rollers, and supplies')
-- ON CONFLICT (id) DO NOTHING;
