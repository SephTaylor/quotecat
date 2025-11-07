# Supabase Product Catalog Setup

This guide walks you through loading the AI-generated product catalog into Supabase.

## Step 1: Run Migration 003 (Add data_source Field)

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `migrations/003_add_data_source.sql`
5. Paste into the SQL Editor
6. Click **RUN** (or press Ctrl+Enter)

**Expected Result**:
```
Success. No rows returned
```

This adds the `data_source` column to track AI vs API data.

---

## Step 2: Load Categories

1. In the same SQL Editor, click **New Query** (or clear previous query)
2. Copy the entire contents of `seed_categories.sql`
3. Paste into the SQL Editor
4. Click **RUN**

**Expected Result**:
```
Success. 7 rows inserted
```

This creates the 7 product categories that match your tester groups.

---

## Step 3: Load 368 Products (ALL TRADES)

1. In the same SQL Editor, click **New Query** (or clear previous query)
2. Copy the entire contents of `seed_all_products.sql`
3. Paste into the SQL Editor
4. Click **RUN**

**Expected Result**:
```
Success. 368 rows inserted
```

**Products Loaded - ALL TESTER GROUPS COVERED**:
- **Framing**: 42 products (lumber, studs, beams, posts, plywood, OSB)
- **Fasteners**: 59 products (nails, screws, bolts, anchors, adhesives)
- **Drywall**: 49 products (sheets, tape, compound, tools, accessories)
- **Electrical**: 59 products (wire, conduit, outlets, switches, breakers, panels)
- **Plumbing**: 59 products (PEX, PVC, copper, fittings, fixtures, toilets, sinks)
- **Roofing**: 50 products (shingles, underlayment, flashing, vents, gutters)
- **Masonry**: 50 products (blocks, bricks, cement, mortar, rebar, concrete)

---

## Step 4: Verify in Database

1. Navigate to **Table Editor** → **products** table
2. You should see **368 products** (or 410 if you have the original 42 seed products)
3. Look at the `data_source` column - all should show `ai_estimated`
4. Check products across different categories to ensure all trades are covered
5. Verify pricing looks reasonable for 2025 market rates

---

## Step 5: Test in App

1. Open QuoteCat app on your device/simulator
2. Navigate to **Add Materials** screen when creating/editing a quote
3. Pull to refresh or restart app to trigger product sync from Supabase
4. Verify ALL categories have products for ALL tester groups:
   - **Builders**: Framing (42), Fasteners (60), Drywall (50)
   - **Electricians**: Electrical (60) - wire, conduit, outlets, breakers
   - **Plumbers**: Plumbing (60) - PEX, PVC, fixtures, fittings
   - **Roofers**: Roofing (50) - shingles, underlayment, gutters
   - **Masonry**: Masonry (50) - blocks, bricks, cement, concrete

---

## Troubleshooting

### Issue: "duplicate key value violates unique constraint"

**Cause**: Products already exist in database

**Fix**: Either:
- Skip duplicates (query already has `ON CONFLICT (id) DO NOTHING`)
- Or delete existing AI products first:
  ```sql
  DELETE FROM products WHERE data_source = 'ai_estimated';
  ```
  Then re-run the seed file.

### Issue: App still shows old product count

**Cause**: App hasn't synced from Supabase yet

**Fix**:
1. Force quit and restart app
2. Or pull to refresh on materials screen
3. Check app logs for sync errors

### Issue: Products not appearing in app

**Cause**: RLS policies might be blocking reads

**Fix**: Verify products table has public read access:
```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'products';

-- If needed, enable public read
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT
  USING (true);
```

---

## What Happens Next?

After loading these 152 products:

1. **Beta testers** can create more realistic quotes with expanded catalog
2. **Pricing disclaimer** will be added to quote screens (⚠️ Estimated pricing)
3. **Product expansion** continues - targeting 500-1000 products across all categories
4. **API replacement** - When 1Build/Menards API arrives, run:
   ```sql
   SELECT cleanup_ai_products(); -- Removes all AI-estimated products
   -- Then load real API data
   ```

---

## Current Product Catalog Status

| Category | Products | Tester Group | Status |
|----------|----------|--------------|--------|
| Framing | 42 | Builders | ✅ Ready to load |
| Fasteners | 60 | Builders | ✅ Ready to load |
| Drywall | 50 | Builders | ✅ Ready to load |
| Electrical | 60 | Electricians | ✅ Ready to load |
| Plumbing | 60 | Plumbers | ✅ Ready to load |
| Roofing | 50 | Roofers | ✅ Ready to load |
| Masonry | 50 | Masonry contractors | ✅ Ready to load |
| Insulation | 0 | Future | 🔜 Phase 2 |
| HVAC | 0 | Future | 🔜 Phase 2 |
| Flooring | 0 | Future | 🔜 Phase 2 |
| Painting | 0 | Future | 🔜 Phase 2 |

**Total**: **368 products** covering all 5 current tester groups
**Next Goal**: 500-1000 products (add HVAC, Insulation, Flooring, Painting, Windows/Doors)
