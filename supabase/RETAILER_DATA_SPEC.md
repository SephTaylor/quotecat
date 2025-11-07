# Retailer Data Import Specification

## Purpose
This document defines the data format we need from RetailGators for importing Home Depot, Lowe's, and Menards product catalogs into QuoteCat.

---

## Required Fields

### Minimum Required (Must Have)
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `product_id` | String | Unique identifier (SKU or internal ID) | "HD-123456" |
| `name` | String | Product name/description | "2x4x8 KD Stud" |
| `price` | Decimal | Current price in USD | 3.45 |
| `unit` | String | Unit of measure | "EA", "LF", "SF", "BOX" |
| `category` | String | Product category | "Lumber", "Electrical", "Plumbing" |
| `retailer` | String | Retailer name | "homedepot", "lowes", "menards" |

### Preferred (Nice to Have)
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `description` | String | Detailed product description | "Kiln-dried framing stud, 2x4x8 feet" |
| `sku` | String | Retailer's SKU | "1000483068" |
| `upc` | String | Universal Product Code | "614141000000" |
| `brand` | String | Manufacturer/brand | "WeatherShield", "Simpson" |
| `in_stock` | Boolean | Availability | true/false |
| `image_url` | String | Product image URL | "https://..." |
| `product_url` | String | Direct link to product page | "https://homedepot.com/p/..." |
| `last_updated` | Timestamp | When price was last checked | "2025-01-04T12:00:00Z" |

### Optional (Future Use)
- `specifications` - JSON object with detailed specs
- `reviews_rating` - Average customer rating
- `reviews_count` - Number of reviews
- `availability_store` - Store-level stock info
- `bulk_pricing` - Tiered pricing for quantity

---

## Data Format Options

### Option 1: CSV (Preferred for Simple Import)
```csv
product_id,name,price,unit,category,retailer,description,sku,in_stock
HD-123456,"2x4x8 KD Stud",3.45,EA,Lumber,homedepot,"Kiln-dried framing stud",1000483068,true
LW-789012,"2x4x8 Precut Stud",3.65,EA,Lumber,lowes,"Precut stud for 8ft walls",23456,true
MN-345678,"2x6x8 KD Stud",6.25,EA,Lumber,menards,"Kiln-dried stud",7890123,true
```

### Option 2: JSON (Preferred for Complex Data)
```json
{
  "products": [
    {
      "product_id": "HD-123456",
      "name": "2x4x8 KD Stud",
      "price": 3.45,
      "unit": "EA",
      "category": "Lumber",
      "retailer": "homedepot",
      "description": "Kiln-dried framing stud",
      "sku": "1000483068",
      "in_stock": true,
      "last_updated": "2025-01-04T12:00:00Z"
    }
  ]
}
```

### Option 3: API Endpoint (Best for Daily Updates)
```
GET https://api.retailgators.com/v1/products?retailer=homedepot&category=lumber
Authorization: Bearer YOUR_API_KEY

Response: JSON array of products
```

---

## Category Mapping

We need products organized into these categories:

| Our Category ID | Display Name | Retailer Categories (Examples) |
|-----------------|--------------|--------------------------------|
| `framing` | Framing | Lumber, Dimensional Lumber, Framing Lumber |
| `fasteners` | Fasteners | Nails, Screws, Bolts, Anchors, Adhesives |
| `drywall` | Drywall | Drywall, Gypsum Board, Joint Compound |
| `electrical` | Electrical | Wire, Conduit, Outlets, Switches, Panels |
| `plumbing` | Plumbing | Pipe, Fittings, Fixtures, Valves |
| `roofing` | Roofing | Shingles, Underlayment, Flashing, Gutters |
| `masonry` | Masonry | Concrete, Blocks, Bricks, Cement, Mortar |
| `hvac` | HVAC | Furnaces, AC Units, Ductwork, Vents |
| `insulation` | Insulation | Batt, Spray Foam, Rigid Foam, Barriers |
| `flooring` | Flooring | Hardwood, Laminate, Tile, Carpet |
| `painting` | Painting | Paint, Primer, Stain, Supplies |

**Note:** RetailGators may use different category names. We'll need a mapping table.

---

## Unit Standardization

We need consistent units across retailers:

| Our Standard | Retailer Variants |
|--------------|-------------------|
| `EA` | Each, Unit, Piece, PC |
| `LF` | Linear Foot, Foot, FT, Linear Feet |
| `SF` | Square Foot, SQ FT, Square Feet |
| `BOX` | Box, Package, PKG, Carton |
| `SHEET` | Sheet, Panel |
| `ROLL` | Roll |
| `GAL` | Gallon, Gal |
| `BUCKET` | Bucket, Pail |
| `BAG` | Bag, Sack |
| `BUNDLE` | Bundle |

---

## Retailer Identification

We'll store retailer as lowercase identifier:

| Retailer ID | Display Name | Website |
|-------------|--------------|---------|
| `homedepot` | Home Depot | homedepot.com |
| `lowes` | Lowe's | lowes.com |
| `menards` | Menards | menards.com |

---

## Data Quality Requirements

### Critical:
- ✅ No null/empty product_id, name, price, unit, category, retailer
- ✅ Prices must be positive numbers
- ✅ Product IDs must be unique within each retailer
- ✅ Categories must map to our standard categories

### Important:
- ⚠️ Flag products with price = 0 (may be discontinued)
- ⚠️ Flag products with unusual units (need manual review)
- ⚠️ Flag products with very high/low prices (outliers)

### Nice to Have:
- 💡 Product descriptions help users identify correct items
- 💡 SKU/UPC enables cross-retailer matching
- 💡 Stock status helps contractors plan availability

---

## Update Frequency

**Initial Load:**
- One-time import of 2,000-3,000 products
- Manual review and category mapping
- Load time: ~1-2 hours for verification + import

**Daily Updates:**
- Price changes only (most common)
- New products added
- Discontinued products flagged
- Automated import via script (5-10 minutes)

---

## Import Pipeline (Technical)

```
RetailGators Data (CSV/JSON)
    ↓
1. Download file (manual or automated)
    ↓
2. Validation script checks data quality
    ↓
3. Category/unit mapping applied
    ↓
4. Import to Supabase products table
    ↓
5. Mark old AI products as deprecated
    ↓
6. App syncs new products on next refresh
```

---

## Questions for RetailGators

When Kellie contacts them, ask:

1. **Format:** CSV, JSON, or API? Which is easiest for daily updates?
2. **Categories:** Can you filter to only construction categories?
3. **Updates:** How are daily price updates delivered? (Full dump or delta?)
4. **Product IDs:** Are these stable over time or do they change?
5. **Matching:** Can same product be matched across Home Depot/Lowe's/Menards?
6. **Timeline:** How long from contract signing to first data delivery?
7. **Support:** What if we find data quality issues?

---

## Success Criteria

We'll know the data is ready when:
- ✅ 2,000+ products imported successfully
- ✅ All 11 categories have at least 50 products each
- ✅ All 3 retailers represented
- ✅ Prices are reasonable (spot-check against websites)
- ✅ No critical validation errors
- ✅ App displays products correctly with retailer badges
- ✅ Daily update pipeline tested and working

---

## Next Steps

1. Wait for Kellie's outreach to RetailGators
2. Build import script based on this spec
3. Create validation checks
4. Add retailer field to database
5. Update app UI to show retailer badges
6. Test with sample data
7. Ready to import real data when it arrives!
