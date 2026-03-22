# xByte Product Catalog Completeness Audit

**Prepared for:** xByte API Team
**Prepared by:** QuoteCat
**Date:** March 22, 2026

---

## Executive Summary

We conducted a comprehensive audit of the product catalog data received from xByte across all three suppliers (Home Depot, Lowe's, Menards) for our Michigan service areas (Lansing, Kalamazoo, Battle Creek).

**Key Findings:**
- **Menards** is missing entire product categories critical for construction (plywood, OSB, drywall panels, concrete, framing lumber)
- **Home Depot** has suspiciously low product counts in several core categories
- **Lowe's** has the most complete coverage across categories

**Total Products Analyzed:** 54,188
- Home Depot: 15,127
- Lowe's: 20,210
- Menards: 18,851

---

## Critical Gaps (Zero Products)

These categories have **zero products** for one or more suppliers, making the data unusable for contractors in these trades.

### Menards - Missing Categories

| Category | Home Depot | Lowe's | Menards | Notes |
|----------|-----------|--------|---------|-------|
| Plywood Sheets (CDX/BCX 4x8) | 8 | 41 | **0** | Only has plywood clips/accessories |
| OSB Sheathing | 12 | 13 | **0** | Zero panels |
| Drywall Panels (4x8) | 54 | 79 | **0** | Only has tape, screws, sanding sheets |
| Concrete/Mortar Mix | 40 | 53 | **0** | Zero Quikrete, Sakrete, etc. |
| Ice & Water Shield | 4 | 17 | **0** | Zero roofing membrane |
| HVAC/Furnace/Ductwork | 3 | 436 | **0** | Zero HVAC products |
| Untreated Framing Studs | 13+ | 177 | **0** | All Menards lumber is pressure treated |

### What This Means

A contractor building a basic room addition needs:
1. Framing studs (2x4, 2x6) - **Menards: NOT AVAILABLE**
2. Plywood/OSB sheathing - **Menards: NOT AVAILABLE**
3. Drywall panels - **Menards: NOT AVAILABLE**
4. Concrete for footings - **Menards: NOT AVAILABLE**

**Menards cannot be used as a supplier for most construction projects with the current data.**

---

## Detailed Category Audit

### 1. Framing Lumber (Untreated)

Standard dimensional lumber used for wall framing, floor joists, roof rafters.

| Size | Home Depot | Lowe's | Menards | Flag |
|------|-----------|--------|---------|------|
| 2x4 | 13 | 177 | 137* | HD very low |
| 2x6 | 12 | 82 | 80* | HD very low |
| 2x8 | 2 | 68 | 45* | HD very low |
| 2x10 | 5 | 93 | 44* | HD very low |
| 2x12 | 9 | 118 | 202* | HD very low |

**\*Menards Note:** These counts include hardwood boards (red oak, hickory, maple) from the Mastercraft line - NOT framing lumber. Actual framing stud count is effectively **zero**.

**Sample Menards "2x4" products (none are framing studs):**
- AC2® 2 x 4 x 8' #2 Prime Ground Contact Green Pressure Treated Lumber
- Mastercraft® 2 x 4 x 4' Red Oak Lumber
- American Pacific 32 x 48 Wainscot Panel (false positive)

**What's Missing from Menards:**
- 2x4 x 8' Kiln-Dried Stud
- 2x4 x 92-5/8" Precut Stud
- 2x4 x 96" SPF Lumber
- 2x6 x 8' Kiln-Dried Lumber
- All standard framing lumber

**Home Depot Issue:** Only 2-13 products per size is suspiciously low. Lowe's has 68-177 per size. This suggests the scraper may be missing lumber pages.

---

### 2. Pressure Treated Lumber

Lumber for outdoor use, decks, ground contact.

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 13 | Very low |
| Lowe's | 122 | Good |
| Menards | 89 | Good |

**Note:** Menards HAS pressure treated lumber (AC2 brand), but is missing untreated. Home Depot count is suspiciously low.

---

### 3. Sheet Goods (Plywood & OSB)

Essential for subfloors, wall sheathing, roof decking.

#### Plywood (4x8 sheets, CDX/BCX grades)

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 8 | Low |
| Lowe's | 41 | Good |
| Menards | **0** | MISSING |

**Sample Lowe's Plywood (what Menards should have):**
- 1/2-in x 4-ft x 8-ft CDX Douglas Fir Plywood Sheathing
- 15/32-in x 4-ft x 8-ft BCX Pine Sanded Plywood
- 3/4-in x 4-ft x 8-ft AC Douglas Fir Sanded Plywood
- 1/4-in x 4-ft x 8-ft Lauan Plywood

**Menards "Plywood" Products (not actual sheets):**
- MiTek® 5/8 G90 Steel Plywood Clips - 250 Count
- MiTek® 7/16 G90 Steel Plywood Clips - 250 Count
- ScaffoldMart 7' Severe Duty Aluminum Plywood Walkboard

#### OSB Sheathing

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 12 | OK |
| Lowe's | 13 | OK |
| Menards | **0** | MISSING |

**What Menards Should Have:**
- 7/16-in x 4-ft x 8-ft OSB Sheathing
- 15/32-in x 4-ft x 8-ft OSB Sheathing
- 23/32-in x 4-ft x 8-ft T&G OSB Subfloor

---

### 4. Drywall/Gypsum Board

Interior wall and ceiling finishing.

#### Drywall Panels (actual 4x8 sheets)

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 54 | Good |
| Lowe's | 79 | Good |
| Menards | **0** | MISSING |

**Total "Drywall" keyword matches:**
- Home Depot: 567 (includes panels + accessories)
- Lowe's: 361 (includes panels + accessories)
- Menards: 161 (ALL accessories, zero panels)

**Sample Menards "Drywall" Products (none are actual panels):**
- 3M CLAW 25 lb. Drywall Picture Hanger
- ADFORS FibaTape 1-7/8 x 300' Fiberglass Mesh Drywall Joint Tape
- DAP Eclipse 4" Rapid Drywall Repair Patch
- Dutch Boy Professional Drywall PVA White Primer
- Grip Fast #10 x 3-1/2 Drywall Screw
- Norton WallSand 11" 150-Grit Drywall Sanding Sheet
- SHEETROCK Drywall & Ceiling Repair Clips

**What Menards Should Have:**
- 1/2-in x 4-ft x 8-ft Regular Drywall Panel
- 1/2-in x 4-ft x 8-ft Mold Resistant Drywall Panel
- 5/8-in x 4-ft x 8-ft Type X Fire-Rated Drywall Panel
- 1/4-in x 4-ft x 8-ft Flexible Drywall Panel

---

### 5. Concrete & Mortar

Foundation work, footings, flatwork.

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 40 | Good |
| Lowe's | 53 | Good |
| Menards | **0** | MISSING |

**Search terms used:** concrete mix, mortar mix, quikrete, sakrete

**What Menards Should Have:**
- Quikrete 80 lb. Concrete Mix
- Sakrete 60 lb. High Strength Concrete Mix
- Quikrete 60 lb. Mortar Mix
- Fast-Setting Concrete

---

### 6. Electrical

#### Romex/NM-B Wire

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 51 | Good |
| Lowe's | 112 | Good |
| Menards | 26 | Low |

#### Outlets & Switches

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 387 | Good |
| Lowe's | 960 | Good |
| Menards | 507 | Good |

#### Electrical Boxes

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 31 | Low |
| Lowe's | 125 | Good |
| Menards | 123 | Good |

---

### 7. Plumbing

#### PEX Pipe

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 41 | Good |
| Lowe's | 217 | Good |
| Menards | 174 | Good |

#### Copper Pipe & Fittings

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 20 | Low |
| Lowe's | 44 | Good |
| Menards | 9 | Very Low |

#### Plumbing Fixtures (Toilets, Faucets, Sinks)

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 169 | Good |
| Lowe's | 467 | Good |
| Menards | 496 | Good |

---

### 8. Roofing

#### Shingles

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 86 | Good |
| Lowe's | 139 | Good |
| Menards | 43 | Low |

#### Roofing Felt/Underlayment

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 91 | Good |
| Lowe's | 148 | Good |
| Menards | 48 | Low |

#### Ice & Water Shield

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 4 | Low |
| Lowe's | 17 | Good |
| Menards | **0** | MISSING |

---

### 9. Insulation

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 85 | Good |
| Lowe's | 330 | Good |
| Menards | 55 | Low |

---

### 10. Doors

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 137 | Very Low |
| Lowe's | 1,434 | Good |
| Menards | 647 | Good |

**Home Depot Issue:** 137 vs 1,434 is a 10x difference. This strongly suggests missing data.

---

### 11. Windows

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 52 | Low |
| Lowe's | 86 | Good |
| Menards | 84 | Good |

---

### 12. Flooring

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 594 | Good |
| Lowe's | 960 | Good |
| Menards | 494 | Good |

---

### 13. Cabinets

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 41 | Very Low |
| Lowe's | 144 | Good |
| Menards | 404 | Good |

**Home Depot Issue:** 41 vs 144-404 suggests significant missing data.

---

### 14. Trim & Molding

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 256 | Good |
| Lowe's | 213 | Good |
| Menards | 236 | Good |

---

### 15. Fasteners (Screws & Nails)

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 1,989 | Good |
| Lowe's | 554 | Good |
| Menards | 1,355 | Good |

---

### 16. HVAC

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 3 | MISSING |
| Lowe's | 436 | Good |
| Menards | **0** | MISSING |

**Search terms used:** hvac, furnace, ductwork, register

---

### 17. Deck Boards

| Supplier | Count | Status |
|----------|-------|--------|
| Home Depot | 62 | Good |
| Lowe's | 10 | Very Low |
| Menards | 11 | Very Low |

---

## Summary Table

| Category | Home Depot | Lowe's | Menards |
|----------|-----------|--------|---------|
| Untreated 2x4 | 13 | 177 | 0* |
| Untreated 2x6 | 12 | 82 | 0* |
| Untreated 2x8 | 2 | 68 | 0* |
| Pressure Treated | 13 | 122 | 89 |
| Plywood (4x8) | 8 | 41 | **0** |
| OSB | 12 | 13 | **0** |
| Drywall Panels | 54 | 79 | **0** |
| Concrete Mix | 40 | 53 | **0** |
| Fasteners | 1,989 | 554 | 1,355 |
| Romex Wire | 51 | 112 | 26 |
| Outlets/Switches | 387 | 960 | 507 |
| Electrical Boxes | 31 | 125 | 123 |
| PEX Pipe | 41 | 217 | 174 |
| Copper Pipe | 20 | 44 | 9 |
| Plumbing Fixtures | 169 | 467 | 496 |
| Insulation | 85 | 330 | 55 |
| Shingles | 86 | 139 | 43 |
| Roofing Underlayment | 91 | 148 | 48 |
| Ice & Water Shield | 4 | 17 | **0** |
| Doors | 137 | 1,434 | 647 |
| Windows | 52 | 86 | 84 |
| Flooring | 594 | 960 | 494 |
| Cabinets | 41 | 144 | 404 |
| Trim/Molding | 256 | 213 | 236 |
| HVAC | 3 | 436 | **0** |
| Deck Boards | 62 | 10 | 11 |

*Menards "untreated" counts include hardwood boards, not framing lumber

---

## Recommendations

### Priority 1 - Menards (Critical)

Add these missing product categories:

1. **Framing Lumber (Untreated)**
   - 2x4 studs (8', 92-5/8", 96", 104-5/8")
   - 2x6 lumber (8', 10', 12', 14', 16')
   - 2x8, 2x10, 2x12 boards

2. **Plywood Sheets**
   - 1/4", 3/8", 1/2", 5/8", 3/4" thicknesses
   - CDX sheathing, BCX sanded, AC sanded
   - Pressure treated where applicable

3. **OSB Sheathing**
   - 7/16" wall sheathing
   - 15/32" sheathing
   - 23/32" T&G subfloor

4. **Drywall Panels**
   - 1/4", 1/2", 5/8" thicknesses
   - Regular, moisture resistant, fire rated (Type X)
   - Various lengths (8', 10', 12')

5. **Concrete & Mortar**
   - Quikrete, Sakrete products
   - Concrete mix, mortar mix, fast-setting

6. **Ice & Water Shield**
   - Grace Ice & Water Shield
   - GAF WeatherWatch
   - Similar roofing membranes

7. **HVAC Products**
   - Ductwork, registers, grilles
   - HVAC tape, insulation

### Priority 2 - Home Depot (Investigation Needed)

These categories have suspiciously low counts compared to Lowe's:

| Category | HD Count | Lowe's Count | Difference |
|----------|----------|--------------|------------|
| Dimensional Lumber | 2-13 | 68-177 | 5-34x lower |
| Doors | 137 | 1,434 | 10x lower |
| Cabinets | 41 | 144 | 3.5x lower |
| HVAC | 3 | 436 | 145x lower |

**Possible causes:**
- Scraper not reaching all category pages
- Different URL structure for these categories
- Rate limiting or blocking on specific sections

### Priority 3 - Minor Gaps

- Lowe's deck boards (10 vs 62)
- Menards copper pipe (9 vs 44)
- Menards insulation (55 vs 330)

---

## Methodology

**Queries Used:**

```sql
-- Plywood sheets
SELECT supplier_id, COUNT(*) FROM products
WHERE LOWER(name) LIKE '%plywood%'
AND (LOWER(name) LIKE '%4 x 8%' OR LOWER(name) LIKE '%cdx%' OR LOWER(name) LIKE '%bcx%')
GROUP BY supplier_id;

-- Drywall panels (not accessories)
SELECT supplier_id, COUNT(*) FROM products
WHERE (LOWER(name) LIKE '%drywall%' OR LOWER(name) LIKE '%gypsum%')
AND (LOWER(name) LIKE '%panel%' OR LOWER(name) LIKE '%1/2-in%' OR LOWER(name) LIKE '%5/8-in%')
GROUP BY supplier_id;

-- Untreated lumber (excluding PT keywords)
SELECT supplier_id, COUNT(*) FROM products
WHERE (LOWER(name) LIKE '%2 x 4%' OR LOWER(name) LIKE '%2x4%')
AND LOWER(name) NOT LIKE '%pressure%'
AND LOWER(name) NOT LIKE '%treated%'
AND LOWER(name) NOT LIKE '%ac2%'
GROUP BY supplier_id;
```

**Data Source:** Supabase `products` table
**Cities Covered:** Lansing, Kalamazoo, Battle Creek (Michigan)
**Suppliers:** Home Depot, Lowe's, Menards

---

## Contact

For questions about this audit:

**QuoteCat**
Email: hello@quotecat.ai
Website: quotecat.ai
