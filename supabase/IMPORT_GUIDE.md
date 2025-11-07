# Product Data Import Guide

## Quick Start (When Data Arrives)

### Step 1: Receive Data from Xbyte
They should send you a file like:
- `homedepot_products.csv`
- `lowes_products.json`
- `menards_data.csv`

Save it to `C:\Users\SephT\Documents\quotecat\data\`

---

### Step 2: Run the Import Script

Open terminal in the quotecat folder and run:

```bash
npx tsx supabase/import_retailer_data.ts data/homedepot_products.csv
```

This will:
- ✅ Validate all products
- ✅ Map categories and units
- ✅ Check for errors
- ✅ Generate SQL file ready to import

**Output Example:**
```
📂 Reading file: data/homedepot_products.csv
📊 Parsing CSV...
✅ Found 2453 raw products

🔍 Validating products...

📊 Validation Results:
  Total:    2453
  Valid:    2401 ✅
  Invalid:  52 ❌
  Warnings: 18 ⚠️

✨ Generating SQL...
✅ SQL written to: data/homedepot_products_import.sql

🎉 Ready to import 2401 products!
```

---

### Step 3: Run Migration 004 (One Time)

**First time only** - Add retailer support to database:

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/004_add_retailer_support.sql`
3. Click **RUN**

Expected: "Success. No rows returned"

---

### Step 4: Clean Up AI Products (Optional)

If you want to replace AI products with real data:

```sql
-- Check how many AI products exist
SELECT COUNT(*) FROM products WHERE data_source = 'ai_estimated';

-- Delete AI products
SELECT cleanup_products_by_source('ai_estimated');

-- Or keep both - AI products as fallback
-- (Skip this step to keep AI products)
```

---

### Step 5: Import the SQL

1. Open the generated SQL file: `data/homedepot_products_import.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **RUN**

Expected: "Success. 2401 rows inserted"

---

### Step 6: Verify in Database

```sql
-- Check total products
SELECT COUNT(*) FROM products;

-- Count by retailer
SELECT retailer, COUNT(*)
FROM products
WHERE retailer IS NOT NULL
GROUP BY retailer;

-- Count by category
SELECT category_id, COUNT(*)
FROM products
GROUP BY category_id
ORDER BY category_id;

-- Check price ranges
SELECT
  retailer,
  category_id,
  MIN(unit_price) as min_price,
  AVG(unit_price) as avg_price,
  MAX(unit_price) as max_price
FROM products
WHERE retailer IS NOT NULL
GROUP BY retailer, category_id;
```

---

### Step 7: Test in App

1. **Force quit** QuoteCat app
2. **Restart** the app
3. App will auto-sync new products from Supabase
4. Go to **Add Materials**
5. Pull down to refresh
6. Check status: Should say **"✅ Online (Up to date)"**
7. Browse categories - should see retailer badges

---

## Troubleshooting

### Problem: Import script shows validation errors

**Solution:** Check the errors shown in terminal:
- Missing fields? → Contact Xbyte for complete data
- Unknown categories? → Add mappings to `CATEGORY_MAP` in import script
- Unknown units? → Add mappings to `UNIT_MAP` in import script

### Problem: SQL import fails with "duplicate key" error

**Solution:** Products already exist
```sql
-- Option 1: Update prices instead
-- (Script already handles this with ON CONFLICT clause)

-- Option 2: Delete specific retailer first
DELETE FROM products WHERE retailer = 'homedepot';
-- Then re-run import
```

### Problem: Products don't appear in app

**Solution:**
1. Check app logs - look for sync errors
2. Force refresh in app (pull down on materials screen)
3. Verify products table has data:
   ```sql
   SELECT * FROM products WHERE retailer = 'homedepot' LIMIT 10;
   ```

### Problem: Prices look wrong

**Solution:**
- Spot-check against retailer website
- Check if prices need decimal adjustment (cents vs dollars)
- Verify Xbyte data format

---

## Daily Updates

When Xbyte sends daily price updates:

### Option A: Delta Updates (Preferred)
If they send only changed products:
```bash
npx tsx supabase/import_retailer_data.ts data/daily_update.csv
```
Script handles updates automatically (ON CONFLICT clause)

### Option B: Full Refresh
If they send complete catalog:
```sql
-- Delete old data for that retailer
DELETE FROM products WHERE retailer = 'homedepot';

-- Import fresh data
-- (Run import script + paste SQL)
```

---

## Multi-Retailer Import

To import Home Depot + Lowe's + Menards:

```bash
# Import Home Depot
npx tsx supabase/import_retailer_data.ts data/homedepot.csv

# Import Lowe's
npx tsx supabase/import_retailer_data.ts data/lowes.csv

# Import Menards
npx tsx supabase/import_retailer_data.ts data/menards.csv

# Then paste all 3 SQL files into Supabase
```

---

## Data Quality Checks

After import, run these queries:

```sql
-- Products with no category
SELECT COUNT(*) FROM products WHERE category_id IS NULL;

-- Products with zero price
SELECT name, retailer, unit_price
FROM products
WHERE unit_price = 0
LIMIT 20;

-- Outlier prices (very high)
SELECT name, retailer, unit_price
FROM products
WHERE unit_price > 1000
ORDER BY unit_price DESC
LIMIT 20;

-- Products with unusual units
SELECT DISTINCT unit FROM products
WHERE unit NOT IN ('EA', 'LF', 'SF', 'BOX', 'SHEET', 'ROLL', 'GAL', 'BUCKET', 'BAG', 'BUNDLE');

-- Retailer distribution
SELECT
  retailer,
  COUNT(*) as products,
  COUNT(DISTINCT category_id) as categories
FROM products
WHERE retailer IS NOT NULL
GROUP BY retailer;
```

---

## Success Checklist

✅ Migration 004 run successfully
✅ Import script validates with < 5% errors
✅ SQL import completes without errors
✅ Database has 2000+ products
✅ All retailers represented
✅ All 11 categories have products
✅ Price ranges look reasonable
✅ App syncs and displays products
✅ Retailer badges show correctly
✅ Pull-to-refresh works
✅ Status shows "Online (Up to date)"

---

## Need Help?

**Common Issues:**
1. **File format wrong** → Ask Xbyte for CSV with headers
2. **Categories don't match** → Update CATEGORY_MAP in import script
3. **App crashes** → Check for null values in required fields
4. **Prices in cents** → Multiply by 0.01 in import script

**Contact:**
- Xbyte support for data issues
- Check RETAILER_DATA_SPEC.md for required format
- Review validation errors in import script output
