
# Data Quality & Category Mapping Plan

## Overview

This document defines our data quality standards and category mapping strategy for importing Xbyte product data into QuoteCat.

---

## 📊 Data Quality Standards

### Production Requirements (100% Coverage)

All production data from Xbyte API must meet these standards:

#### Critical Fields (Must Have - No Exceptions)

| Field | Type | Requirement | Example |
|-------|------|-------------|---------|
| Product ID / SKU | String | Unique within retailer | "100321605" |
| Product Name | String | Not empty, min 3 characters | "4.5 gal Joint Compound" |
| Price (USD) | Number | Greater than $0 | 22.28 |
| Unit of Measure | String | Must be present | "gallon" |
| Category | String | Valid retailer category | "Building Materials \| Drywall" |
| Retailer Identifier | String | One of: homedepot, lowes, menards | "homedepot" |

#### Optional Fields (Nice to Have)

| Field | Type | Notes |
|-------|------|-------|
| Brand | String | Manufacturer name |
| In-Stock Status | String | Availability info |
| Product URL | String | Link to retailer product page |
| Last Update Timestamp | String | When price was last checked |

### Validation Rules

**Automatic Rejection (Critical Errors):**
- Missing any required field
- Price ≤ 0
- Invalid retailer identifier
- Duplicate product ID within same retailer

**Warnings (Review Recommended):**
- Price > $10,000 (outlier detection)
- Price < $0.10 (suspiciously low)
- Unknown unit of measure (needs manual mapping)

**Info (Nice to Fix):**
- Missing optional fields
- Very long product names (> 200 chars)

### Sample Data Results

**Test Date:** November 14, 2024
**Sample Size:** 1,158 products

**Results:**
- ✅ 100% category mapping coverage
- ⚠️ 98.6% have Unit field (16 missing)
- ⚠️ Retailer field inconsistency in Menards data

**Conclusion:** Sample data suitable for testing. Production data must have 100% Unit coverage.

---

## 🗂️ Category Mapping Strategy

### QuoteCat Categories (11 Total)

We expanded from 7 to 11 categories to accommodate Xbyte product range:

#### Original Categories (7)
1. **Framing** - Lumber, plywood, studs, boards, OSB
2. **Fasteners** - Nails, screws, bolts, anchors, connectors
3. **Drywall** - Gypsum, joint compound, corner beads
4. **Electrical** - Wire, cable, conduit, outlets, switches
5. **Plumbing** - Pipe, fittings, valves, fixtures
6. **Roofing** - Shingles, underlayment, flashing, roof coatings
7. **Masonry** - Concrete, bricks, blocks, cement, mortar

#### New Categories (4)
8. **Insulation** - Foam board, batt, spray foam, fiberglass
9. **Painting** - Paint, stains, primers, painting supplies
10. **Sealants** - Caulk, adhesives, tape, sealants
11. **Flooring** - Carpet, tile, hardwood

### Mapping Approach

**Backend Mapping (Import-Time):**
- Xbyte provides raw retailer categories
- Our import script maps to QuoteCat categories
- App only sees pre-mapped categories

**Mapping Logic:**
- Keywords-based matching
- Priority system (specific → broad)
- Case-insensitive substring matching

**Example:**
```
Xbyte Category: "Building Materials | Drywall | Joint Compound"
               ↓
QuoteCat Category: "drywall"
               ↓
App displays: "Drywall" section
```

### Mapping Coverage

**Test Results (Sample Data):**
- **100% coverage** (1,158/1,158 products mapped)
- **Distribution:**
  - Electrical: 246 products (21.2%)
  - Framing: 205 products (17.7%)
  - Fasteners: 192 products (16.6%)
  - Painting: 115 products (9.9%)
  - Roofing: 103 products (8.9%)
  - Masonry: 90 products (7.8%)
  - Drywall: 84 products (7.3%)
  - Insulation: 78 products (6.7%)
  - Flooring: 28 products (2.4%)
  - Plumbing: 17 products (1.5%)

### Unmapped Products

**Policy:** Products that don't map to any QuoteCat category are logged but not imported.

**Review Process:**
1. Import script logs unmapped products
2. Review unmapped category patterns
3. Add new keywords to mapping table OR
4. Exclude non-construction items

---

## 🔧 Technical Implementation

### Tools

**1. Category Mapping (`category-mapping.ts`)**
- Maps retailer categories to QuoteCat categories
- Priority-based keyword matching
- Supports all 11 categories

**2. Data Quality Validator (`data-quality-validator.ts`)**
- Validates required fields
- Checks data types and ranges
- Standardizes units of measure
- Detects outliers and duplicates

**3. Import Script (`import-xbyte-data.ts`)**
- Loads Excel/JSON data
- Validates with data-quality-validator
- Maps categories with category-mapping
- Imports to Supabase products table

### Unit Standardization

**Xbyte Units → QuoteCat Standard:**

| Xbyte Variants | QuoteCat Standard |
|----------------|-------------------|
| Each, Piece, Unit, PC | EA |
| Foot, Feet, Linear Foot, FT | LF |
| Sq. Feet, Square Foot, SQ FT | SF |
| Box, Package, PKG, Carton | BOX |
| Gallon, Gallons, gal | GAL |
| Quart, Quarts, QT | QT |
| Roll | ROLL |
| Bag, Sack | BAG |
| lbs, Pounds | LB |

**Handling Unknown Units:**
- Log warning during validation
- Convert to uppercase for consistency
- Review and add to mapping table

### Retailer Normalization

**Xbyte Identifiers → QuoteCat Standard:**

| Xbyte Variants | QuoteCat ID |
|----------------|-------------|
| Homedepot, Home Depot | homedepot |
| Lowes, Lowe's | lowes |
| Menards | menards |

---

## 📋 Import Workflow

### Step 1: Receive Data
- **Source:** Xbyte API (JSON response)
- **Frequency:** Daily updates (overnight)
- **Format:** Same structure as Excel sample

### Step 2: Validation
- Run `validateProducts()` on raw data
- Check 100% coverage of required fields
- Flag outliers and warnings
- **Pass/Fail:** Must pass to proceed

### Step 3: Category Mapping
- Run `mapProducts()` on validated data
- Map retailer categories to QuoteCat categories
- Log unmapped products for review
- **Target:** 95%+ mapping coverage

### Step 4: Transform
- Generate product IDs (`retailer-sku`)
- Standardize units
- Normalize retailer names
- Add metadata (data_source, last_synced)

### Step 5: Import to Supabase
- Upsert to `products` table (on conflict: update)
- Batch size: 1,000 products per request
- Mark old AI products as deprecated (optional)

### Step 6: Sync to App
- App pulls from Supabase on startup
- User can pull-to-refresh for latest data
- Status indicator shows sync state

---

## 🧪 Testing Procedures

### Before Production Import

**1. Dry Run Import:**
```bash
npx tsx supabase/import-xbyte-data.ts xbyte/ --dry-run
```

**2. Review Validation Results:**
- Zero critical errors required
- Review all warnings
- Check mapping coverage ≥ 95%

**3. Test with Sample Data:**
```bash
npx tsx supabase/import-xbyte-data.ts xbyte/
```

**4. Verify in App:**
- Open QuoteCat app
- Pull to refresh materials screen
- Check products display correctly
- Test search and filtering
- Verify pricing and units

### Ongoing Monitoring

**Daily (Automated):**
- Import script runs overnight
- Logs validation results
- Alerts on critical errors

**Weekly (Manual Review):**
- Review unmapped products log
- Check for new retailer categories
- Update mapping keywords if needed
- Monitor data quality trends

**Monthly:**
- Review category distribution
- Assess need for new categories
- Update validation rules if needed

---

## 📧 Production Requirements for Xbyte

### API Specifications

**Endpoint Requirements:**
- REST API with authentication
- JSON response format
- Same field structure as sample data
- Pagination support for large datasets
- Filter by retailer and category

**Data Quality Requirements:**
1. **100% Unit field coverage** (no missing units)
2. **Consistent field names** (same as sample: "Product Name", "Price (USD)", etc.)
3. **Consistent retailer identifiers** (Homedepot, Lowes, Menards)
4. **Construction categories only** (no toys, furniture, etc.)
5. **Volume:** 2,000-5,000 products per retailer (6K-15K total)

**Update Frequency:**
- **Preferred:** Daily price updates
- **Acceptable:** Weekly updates
- **Minimum:** Bi-weekly updates

**Update Method:**
- Full dataset OR delta updates (new/changed products only)
- Include `last_updated` timestamp for each product
- Flag discontinued products (soft delete)

---

## 🚀 Next Steps

### Immediate (Testing Phase)
- [x] Build category mapping tool
- [x] Build data quality validator
- [x] Update import script
- [x] Test with sample data
- [ ] Email Xbyte with production requirements

### Short Term (Pre-Launch)
- [ ] Receive production API credentials from Xbyte
- [ ] Test API integration
- [ ] Run full import with production data
- [ ] Verify app sync works correctly
- [ ] Update CLAUDE.md with Xbyte integration status

### Long Term (Post-Launch)
- [ ] Monitor data quality metrics
- [ ] Add automated alerting for failed imports
- [ ] Consider adding more categories (HVAC, Windows/Doors)
- [ ] Explore cross-retailer product matching (same product, different retailers)
- [ ] Build admin dashboard for data quality monitoring

---

## 📞 Support & Contacts

**Xbyte Integration:**
- Contact for API issues, data quality problems, or category questions
- [Email/contact info to be added]

**Internal:**
- Import script: `supabase/import-xbyte-data.ts`
- Validation: `supabase/data-quality-validator.ts`
- Mapping: `supabase/category-mapping.ts`
- Documentation: This file (`DATA_QUALITY_PLAN.md`)

---

**Last Updated:** November 14, 2024
**Version:** 1.0
