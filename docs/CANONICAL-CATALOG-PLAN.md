# Canonical Product Catalog Plan

## Problem

Supplier data is inconsistent - products appear/disappear, names vary across suppliers, and gaps in data leave users without pricing. We need a stable, normalized product catalog with aggregated pricing.

## Solution

Build a **canonical product catalog** - our own normalized products mapped to supplier products, with aggregated pricing across suppliers and time.

## Benefits

- Data gaps don't break the catalog
- Price trends over time (historical analysis)
- Users see "typical" market pricing, not just one supplier snapshot
- Proprietary dataset competitors don't have
- More stable quotes even when supplier data fluctuates

---

## Database Schema

### 1. `canonical_products` - Normalized product list

```sql
CREATE TABLE canonical_products (
  id TEXT PRIMARY KEY,  -- slug: "2x4x8-stud", "deck-screw-3in-1lb"
  name TEXT NOT NULL,   -- "2x4 x 8' Stud"
  category TEXT NOT NULL,  -- framing, electrical, plumbing, hardware
  subcategory TEXT,     -- studs, receptacles, pex, screws
  unit TEXT NOT NULL,   -- each, lb, box, linear_ft
  specs JSONB,          -- {"length": "8ft", "material": "SPF", "dimensions": "2x4"}
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. `product_mappings` - Links supplier products to canonical

```sql
CREATE TABLE product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id TEXT REFERENCES canonical_products(id),
  supplier_id TEXT REFERENCES suppliers(id),
  supplier_product_id UUID REFERENCES products(id),
  confidence NUMERIC(3,2),  -- 0.00-1.00, for AI matches
  match_method TEXT,        -- 'manual', 'ai', 'rule'
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mappings_canonical ON product_mappings(canonical_id);
CREATE INDEX idx_mappings_supplier_product ON product_mappings(supplier_product_id);
```

### 3. `canonical_prices` - Aggregated pricing (materialized view)

```sql
CREATE MATERIALIZED VIEW canonical_prices AS
SELECT
  cp.id AS canonical_id,
  cp.name,
  cp.category,
  l.id AS location_id,

  -- Current prices (latest week)
  ROUND(AVG(pp.price), 2) AS avg_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pp.price), 2) AS median_price,
  MIN(pp.price) AS min_price,
  MAX(pp.price) AS max_price,
  COUNT(DISTINCT pm.supplier_id) AS supplier_count,

  -- Price from each supplier
  jsonb_object_agg(
    pm.supplier_id,
    pp.price
  ) FILTER (WHERE pp.price IS NOT NULL) AS prices_by_supplier,

  MAX(pp.week_of) AS as_of_date

FROM canonical_products cp
JOIN product_mappings pm ON pm.canonical_id = cp.id
JOIN product_prices pp ON pp.product_id = pm.supplier_product_id
JOIN locations l ON pp.location_id = l.id
WHERE pp.week_of = (SELECT MAX(week_of) FROM product_prices)
GROUP BY cp.id, cp.name, cp.category, l.id;

CREATE INDEX idx_canonical_prices_category ON canonical_prices(category);
CREATE INDEX idx_canonical_prices_location ON canonical_prices(location_id);
```

### 4. `canonical_price_history` - Trends over time

```sql
CREATE MATERIALIZED VIEW canonical_price_history AS
SELECT
  cp.id AS canonical_id,
  cp.name,
  l.id AS location_id,
  pp.week_of,
  ROUND(AVG(pp.price), 2) AS avg_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pp.price), 2) AS median_price,
  MIN(pp.price) AS min_price,
  MAX(pp.price) AS max_price,
  COUNT(*) AS data_points
FROM canonical_products cp
JOIN product_mappings pm ON pm.canonical_id = cp.id
JOIN product_prices pp ON pp.product_id = pm.supplier_product_id
JOIN locations l ON pp.location_id = l.id
GROUP BY cp.id, cp.name, l.id, pp.week_of
ORDER BY cp.id, pp.week_of DESC;
```

---

## Product Matching Strategy

### Phase 1: Manual Curation (Start Here)

- Pick top 50-100 products contractors actually use
- Manually create canonical entries
- Manually map supplier products

### Phase 2: Rule-Based Matching

```sql
-- Example: Match any "2x4" + "8" in product name to canonical 2x4x8-stud
INSERT INTO product_mappings (canonical_id, supplier_id, supplier_product_id, confidence, match_method)
SELECT
  '2x4x8-stud',
  p.supplier_id,
  p.id,
  0.85,
  'rule'
FROM products p
WHERE p.name ~* '2\s*x\s*4.*8.*stud'
  AND NOT EXISTS (SELECT 1 FROM product_mappings pm WHERE pm.supplier_product_id = p.id);
```

### Phase 3: AI Matching (Later)

- Use embeddings to find similar products
- Human review for low-confidence matches
- Could use Claude or OpenAI to suggest matches

---

## API / App Usage

```typescript
// Get canonical product with aggregated price
const { data } = await supabase
  .from('canonical_prices')
  .select('*')
  .eq('location_id', 'kalamazoo')
  .eq('category', 'framing');

// Returns:
{
  canonical_id: "2x4x8-stud",
  name: "2x4 x 8' Stud",
  category: "framing",
  avg_price: 4.87,
  median_price: 4.79,
  min_price: 4.29,  // Menards
  max_price: 5.48,  // Home Depot
  supplier_count: 3,
  prices_by_supplier: {
    "lowes": 4.79,
    "homedepot": 5.48,
    "menards": 4.29
  }
}
```

---

## Starter Canonical Products

| ID | Name | Category | Unit |
|----|------|----------|------|
| 2x4x8-stud | 2x4 x 8' Stud | framing | each |
| 2x4x10-stud | 2x4 x 10' Stud | framing | each |
| 2x6x8-stud | 2x6 x 8' Stud | framing | each |
| 2x6x10-stud | 2x6 x 10' Stud | framing | each |
| osb-7-16-4x8 | 7/16" OSB Sheathing (4x8) | sheathing | sheet |
| plywood-1-2-4x8 | 1/2" Plywood (4x8) | sheathing | sheet |
| plywood-3-4-4x8 | 3/4" Plywood (4x8) | sheathing | sheet |
| drywall-1-2-4x8 | 1/2" Drywall (4x8) | drywall | sheet |
| drywall-5-8-4x8 | 5/8" Drywall (4x8) | drywall | sheet |
| romex-14-2-250 | 14/2 Romex (250ft) | electrical | roll |
| romex-12-2-250 | 12/2 Romex (250ft) | electrical | roll |
| romex-10-2-250 | 10/2 Romex (250ft) | electrical | roll |
| outlet-15a-duplex | 15A Duplex Outlet | electrical | each |
| outlet-20a-duplex | 20A Duplex Outlet | electrical | each |
| switch-single-pole | Single Pole Switch | electrical | each |
| deck-screw-3in-1lb | 3" Deck Screws (1 lb) | hardware | lb |
| deck-screw-3in-5lb | 3" Deck Screws (5 lb) | hardware | box |
| construction-adhesive | Construction Adhesive (10oz) | adhesives | tube |
| pex-1-2-100ft | 1/2" PEX Tubing (100ft) | plumbing | roll |
| pex-3-4-100ft | 3/4" PEX Tubing (100ft) | plumbing | roll |

---

## Implementation Order

1. **Create tables** - canonical_products, product_mappings
2. **Seed 50-100 canonical products** - common items contractors use
3. **Manual mapping** - link existing supplier products to canonical
4. **Create materialized views** - canonical_prices, canonical_price_history
5. **Edge function** - refresh views after xByte sync
6. **Mobile app** - option to use canonical catalog vs supplier-specific
7. **Price trends UI** - show historical pricing charts (Premium feature?)

---

## Open Questions

- Should canonical prices be a Premium feature or available to all?
- How often to refresh materialized views? (after each sync vs daily)
- Should we show price source attribution? ("Based on 3 suppliers")
- Do we need regional canonical products? (products only available in certain areas)

---

## Future Enhancements

- **Price alerts** - notify users when prices change significantly
- **Price predictions** - ML model to predict price trends
- **Contractor price reporting** - let users report actual prices paid
- **Bulk pricing tiers** - show volume discounts when available
