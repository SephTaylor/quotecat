# Short Email Draft to Xbyte

---

Hi Shail and Team,

Thanks for the sample data! Overall quality looks great - product names, prices, URLs, and stock status are exactly what we need.

## Critical Issue: Missing Unit Field ⚠️

The data is missing a **"Unit/Unit of Measure"** field, which is required for our quoting system to work. We need to know if products are sold by:
- Each (EA), Linear Foot (LF), Square Foot (SF), Box (BOX), Sheet (SHEET), Gallon (GAL), etc.

**Example:**
- 2x4x8 Stud → EA
- Copper Wire 12/2 → LF
- 1/2" Drywall 4x8 → SHEET

**Request:** Add a Unit column with the retailer's official unit of measure.

## Other Issues:

1. **Construction products only** - Sample included toys (Pufferz monkey, rubber ducks). Please filter to construction categories: lumber, electrical, plumbing, fasteners, roofing, etc.

2. **Timestamp format** - Home Depot/Menards using Excel serial numbers. Can you standardize to `YYYY-MM-DD HH:MM:SS` format?

3. **Larger sample** - Can we get 100-200 products per retailer (with Unit field) to properly test our import pipeline?

## Answering Your Questions:

**1. Product scope:** We need a broad catalog (2,000-5,000 products per retailer) across construction categories, not a fixed SKU list. Our contractors work on diverse projects and need access to a wide range of materials.

**2. Update frequency:** Daily preferred (overnight), weekly acceptable.

**3. Delivery method:** API strongly preferred for automated daily queries.

## Next Steps:

1. You send updated sample with Unit field (~100-200 products, construction only)
2. We test import pipeline (1-2 days)
3. We confirm format works → discuss commercials

Sound good?

Thanks!
Joe and Kellie Taylor
QuoteCat.ai
