// supabase/functions/sync-xbyte/index.ts
// Syncs product and price data from xByte Multi-Retailer API
// Usage: POST with { date: "2026_02_12", cities: ["lansing", "kalamazoo", "battle_creek"], feeds: ["lowes", "homedepot", "menards"] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY");

const XBYTE_BASE_URL = "https://3690-multi-retailer.xbyteapi.com/api/products";

// Map xByte location names to our location IDs
const LOCATION_MAP: Record<string, string> = {
  "Lansing": "lansing",
  "lansing": "lansing",
  "Kalamazoo": "kalamazoo",
  "kalamazoo": "kalamazoo",
  "Battle Creek": "battle_creek",
  "battle_creek": "battle_creek",
};

// Map our city IDs to xByte API format (xByte expects spaces, not underscores)
const CITY_API_MAP: Record<string, string> = {
  "lansing": "lansing",
  "kalamazoo": "kalamazoo",
  "battle_creek": "battle creek",  // xByte expects space, gets URL-encoded
};

// Map xByte retailer names to our supplier IDs
const SUPPLIER_MAP: Record<string, string> = {
  "Homedepot": "homedepot",
  "homedepot": "homedepot",
  "Lowes": "lowes",
  "lowes": "lowes",
  "Menards": "menards",
  "menards": "menards",
};

// =============================================================================
// PRODUCT NAME NORMALIZATION
// Generates search_name with all search variations baked in
// =============================================================================

// Dimensional lumber patterns - expand to include all search variations
const DIMENSION_PATTERNS = [
  // "2-in x 8-in" format (dashes)
  { regex: /(\d+)-in x (\d+)-in/gi, expand: (w: string, h: string) =>
    `${w}x${h} ${w}-in x ${h}-in ${w} in x ${h} in ${w} x ${h}` },
  // "2 in. x 8 in." format (periods - common in xByte)
  { regex: /(\d+) in\. x (\d+) in\./gi, expand: (w: string, h: string) =>
    `${w}x${h} ${w}-in x ${h}-in ${w} in x ${h} in ${w} x ${h}` },
  // "2 in x 8 in" format (no periods)
  { regex: /(\d+) in x (\d+) in/gi, expand: (w: string, h: string) =>
    `${w}x${h} ${w}-in x ${h}-in ${w} in x ${h} in ${w} x ${h}` },
  // "4 x 4" format (no units - common for post bases, hangers)
  { regex: /(\d+) x (\d+)(?!\d| in| ft)/gi, expand: (w: string, h: string) =>
    `${w}x${h} ${w} x ${h}` },
  // Length patterns like "x 8 ft" or "x 12 ft"
  { regex: /x (\d+) ft/gi, expand: (len: string) =>
    `x ${len} ft ${len}ft ${len} foot` },
];

// Material synonym expansions
const MATERIAL_SYNONYMS: Record<string, string> = {
  'pressure treated': 'pressure treated pt treated lumber exterior',
  'pressure-treated': 'pressure treated pt treated lumber exterior',
  'galvanized': 'galvanized galv zinc coated',
  'southern yellow pine': 'southern yellow pine syp pine',
  'douglas fir': 'douglas fir df fir',
  'stainless steel': 'stainless steel ss stainless',
  'prime': 'prime #2 number 2 grade',
  'ground contact': 'ground contact gc burial underground',
};

// Unit expansions
const UNIT_EXPANSIONS: Record<string, string> = {
  'lb': 'lb pound pounds lbs',
  'oz': 'oz ounce ounces',
  'ft': 'ft foot feet',
  'in': 'in inch inches',
  'gal': 'gal gallon gallons',
  'qt': 'qt quart quarts',
  'sq ft': 'sq ft sqft square feet square foot',
};

// Category-specific term expansions (helps cross-match search terms)
const CATEGORY_TERMS: Record<string, string> = {
  'baluster': 'baluster spindle railing deck porch',
  'joist hanger': 'joist hanger bracket simpson lus hardware',
  'concrete mix': 'concrete mix cement bag',
  'quikrete': 'quikrete quickcrete concrete cement mix',
  'sakrete': 'sakrete concrete cement mix',
  'deck screw': 'deck screw fastener exterior wood',
  'drywall screw': 'drywall screw sheetrock gypsum',
  'stringer': 'stringer stair stairs step deck',
  'tread': 'tread stair stairs step',
  'post base': 'post base anchor bracket simpson',
  'ledger': 'ledger board deck attachment',
  'rim joist': 'rim joist band board perimeter',
  'joist': 'joist floor deck framing',
  'rafter': 'rafter roof framing',
  'stud': 'stud wall framing',
  'plate': 'plate top bottom wall framing',
  'header': 'header door window framing',
  'sheathing': 'sheathing plywood osb wall roof',
  'underlayment': 'underlayment subfloor floor',
  'lvp': 'lvp luxury vinyl plank flooring',
  'laminate': 'laminate flooring floor',
  'hardwood': 'hardwood flooring floor wood',
  'tile': 'tile flooring floor ceramic porcelain',
  'grout': 'grout tile floor',
  'thinset': 'thinset mortar tile adhesive',
  'romex': 'romex nm-b wire electrical',
  'pex': 'pex tubing pipe plumbing',
  'cpvc': 'cpvc pipe plumbing',
  'copper': 'copper pipe tubing plumbing',
};

/**
 * Normalize a product name to include all searchable variations.
 * This is the core function that enables users to search "2x8" and find "2-in x 8-in" products.
 */
function normalizeProductName(name: string): string {
  let result = name.toLowerCase();

  // Expand dimensional patterns
  for (const pattern of DIMENSION_PATTERNS) {
    result = result.replace(pattern.regex, (match, ...groups) => {
      const expansion = pattern.expand(...groups);
      return `${match} ${expansion}`;
    });
  }

  // Add material synonyms
  for (const [term, expansion] of Object.entries(MATERIAL_SYNONYMS)) {
    if (result.includes(term.toLowerCase())) {
      result += ' ' + expansion;
    }
  }

  // Add unit expansions
  for (const [term, expansion] of Object.entries(UNIT_EXPANSIONS)) {
    // Match unit at word boundary (e.g., "60 lb" but not "bulb")
    const unitRegex = new RegExp(`\\b${term}\\b`, 'gi');
    if (unitRegex.test(result)) {
      result += ' ' + expansion;
    }
  }

  // Add category-specific terms
  for (const [term, expansion] of Object.entries(CATEGORY_TERMS)) {
    if (result.includes(term.toLowerCase())) {
      result += ' ' + expansion;
    }
  }

  // Clean up: remove extra whitespace
  return result.replace(/\s+/g, ' ').trim();
}

interface XByteProduct {
  "Product ID / SKU": number;
  "Product Name": string;
  "Price (USD)": number;
  "Unit of Measure": string;
  "Category": string;
  "Retailer Identifier": string;
  "Brand": string;
  "In-Stock Status": string;
  "Product URL": string;
  "Last Update Timestamp": string;
  "Location": string;
}

interface XByteResponse {
  status: number;
  page: number;
  count: number;
  data: XByteProduct[];
  message?: string;
}

interface SyncPayload {
  date: string;           // Format: YYYY_MM_DD (e.g., "2026_02_12")
  cities?: string[];      // Default: all 3 cities
  feeds?: string[];       // Default: all 3 feeds
  max_pages?: number;     // Default: 100 (safety limit)
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-ingest-key",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check - use x-ingest-key header to avoid conflict with Supabase JWT
  const ingestKey = req.headers.get("x-ingest-key");
  if (!INGEST_API_KEY || ingestKey !== INGEST_API_KEY) {
    console.error("[sync-xbyte] Unauthorized request - invalid or missing x-ingest-key");
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: corsHeaders }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const payload: SyncPayload = await req.json();
    const {
      date,
      cities = ["lansing", "kalamazoo", "battle_creek"],
      feeds = ["lowes", "homedepot", "menards"],
      max_pages = 100,
    } = payload;

    if (!date) {
      return new Response(
        JSON.stringify({ success: false, error: "date is required (format: YYYY_MM_DD)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const weekOf = getWeekStart(now);

    const stats = {
      productsUpserted: 0,
      pricesInserted: 0,
      errors: [] as string[],
      skipped: 0,
    };

    // Process each city/feed combination
    for (const city of cities) {
      for (const feed of feeds) {
        console.log(`[sync-xbyte] Fetching ${feed} data for ${city} on ${date}`);

        let page = 1;
        let hasMore = true;

        while (hasMore && page <= max_pages) {
          // Convert our city ID to xByte API format (handles battle_creek -> "battle creek")
          const apiCity = encodeURIComponent(CITY_API_MAP[city] || city);
          const url = `${XBYTE_BASE_URL}?feed=${feed}&date=${date}&page=${page}&city=${apiCity}`;

          try {
            const response = await fetch(url);
            const data: XByteResponse = await response.json();

            if (data.status === 404 || data.message === "Data not found !!!") {
              console.log(`[sync-xbyte] No data for ${feed}/${city} page ${page}`);
              hasMore = false;
              continue;
            }

            if (data.status !== 200 || !data.data) {
              console.error(`[sync-xbyte] API error for ${feed}/${city}:`, data);
              stats.errors.push(`${feed}/${city}: API returned status ${data.status}`);
              hasMore = false;
              continue;
            }

            // Process products - dedupe by ID to avoid "cannot affect row a second time" error
            const productMap = new Map();
            for (const item of data.data) {
              const id = `xbyte-${item["Retailer Identifier"].toLowerCase()}-${item["Product ID / SKU"]}`;
              const productName = item["Product Name"];
              productMap.set(id, {
                id,
                name: productName,
                search_name: normalizeProductName(productName), // Normalized for FTS
                sku: String(item["Product ID / SKU"]),
                unit: item["Unit of Measure"] || "each",
                unit_price: item["Price (USD)"], // Required field
                currency: "USD",
                description: item["Category"], // Store category path in description
                brand: item["Brand"] || null,
                supplier_id: SUPPLIER_MAP[item["Retailer Identifier"]] || item["Retailer Identifier"].toLowerCase(),
                supplier_url: item["Product URL"],
                product_url: item["Product URL"],
                in_stock: item["In-Stock Status"] === "In Stock",
                data_source: "retailer_scraped",
                retailer: item["Retailer Identifier"],
                last_synced_at: new Date().toISOString(),
              });
            }
            const products = Array.from(productMap.values());

            // Upsert products
            const { error: productError } = await supabase
              .from("products")
              .upsert(products, { onConflict: "id", ignoreDuplicates: false });

            if (productError) {
              console.error(`[sync-xbyte] Product upsert error:`, productError);
              stats.errors.push(`${feed}/${city}: Product upsert failed - ${productError.message}`);
            } else {
              stats.productsUpserted += products.length;
            }

            // Prepare price records - dedupe by product_id (keep last occurrence)
            const priceMap = new Map();
            for (const item of data.data) {
              const productId = `xbyte-${item["Retailer Identifier"].toLowerCase()}-${item["Product ID / SKU"]}`;
              priceMap.set(productId, {
                product_id: productId,
                supplier_id: SUPPLIER_MAP[item["Retailer Identifier"]] || item["Retailer Identifier"].toLowerCase(),
                location_id: LOCATION_MAP[item["Location"]] || item["Location"].toLowerCase().replace(" ", "_"),
                price: item["Price (USD)"],
                currency: "USD",
                effective_at: item["Last Update Timestamp"],
                week_of: weekOf,
              });
            }
            const prices = Array.from(priceMap.values());

            // Upsert prices (update if exists, insert if not)
            const { error: priceError } = await supabase
              .from("product_prices")
              .upsert(prices, { onConflict: "product_id,location_id,week_of" });

            if (priceError) {
              console.error(`[sync-xbyte] Price insert error:`, priceError);
              stats.errors.push(`${feed}/${city}: Price insert failed - ${priceError.message}`);
            } else {
              stats.pricesInserted += prices.length;
            }

            console.log(`[sync-xbyte] Processed ${feed}/${city} page ${page}: ${data.count} items`);

            // Check if there are more pages
            hasMore = data.count === 100;
            page++;

          } catch (fetchError) {
            console.error(`[sync-xbyte] Fetch error for ${feed}/${city}:`, fetchError);
            stats.errors.push(`${feed}/${city}: ${fetchError.message}`);
            hasMore = false;
          }
        }
      }
    }

    console.log(`[sync-xbyte] Sync complete:`, stats);

    return new Response(
      JSON.stringify({
        success: stats.errors.length === 0,
        stats,
        date,
        weekOf,
        timestamp: now.toISOString(),
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("[sync-xbyte] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error"
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}
