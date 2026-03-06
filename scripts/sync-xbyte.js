#!/usr/bin/env node
/**
 * X-Byte Price Sync Script
 * Fetches product data from X-Byte API and syncs to Supabase
 * Runs via GitHub Actions every Friday
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SYNC_DATE = process.env.SYNC_DATE;

const XBYTE_BASE_URL = "https://3690-multi-retailer.xbyteapi.com/api/products";

// Configuration
const CITIES = ["lansing", "kalamazoo", "battle_creek"];
const FEEDS = ["lowes", "homedepot", "menards"];
const MAX_PAGES = 200;

// Map city IDs to X-Byte API format
const CITY_API_MAP = {
  lansing: "lansing",
  kalamazoo: "kalamazoo",
  battle_creek: "battle creek",
};

// Map retailer names to supplier IDs
const SUPPLIER_MAP = {
  Homedepot: "homedepot",
  homedepot: "homedepot",
  Lowes: "lowes",
  lowes: "lowes",
  Menards: "menards",
  menards: "menards",
};

// Map location names to location IDs
const LOCATION_MAP = {
  Lansing: "lansing",
  lansing: "lansing",
  Kalamazoo: "kalamazoo",
  kalamazoo: "kalamazoo",
  "Battle Creek": "battle_creek",
  battle_creek: "battle_creek",
};

// Product name normalization (simplified from edge function)
function normalizeProductName(name) {
  let result = name.toLowerCase();

  // Expand dimensional patterns
  result = result.replace(/(\d+)-in x (\d+)-in/gi, (match, w, h) =>
    `${match} ${w}x${h} ${w} in x ${h} in ${w} x ${h}`);
  result = result.replace(/(\d+) in\. x (\d+) in\./gi, (match, w, h) =>
    `${match} ${w}x${h} ${w}-in x ${h}-in ${w} x ${h}`);

  return result.replace(/\s+/g, ' ').trim();
}

// Extract coverage for flooring products
function extractCoverageSqft(name, category) {
  const isFlooring = /flooring|tile|vinyl|laminate|hardwood|carpet/i.test(category);
  if (!isFlooring) return null;

  const match = name.match(/(\d+\.?\d*)\s*-?sq\.?\s*ft\s*\/?\s*(Carton|case|ctn|box|Piece)/i);
  if (match) {
    const value = parseFloat(match[1]);
    return isNaN(value) ? null : value;
  }
  return null;
}

// Get week start date (Sunday)
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

// Format today's date for X-Byte API
function getTodayFormatted() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}`;
}

// Supabase client (simple fetch-based)
async function supabaseQuery(table, method, data, options = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);

  // Add on_conflict to URL for upsert
  if (options.onConflict) {
    url.searchParams.set('on_conflict', options.onConflict);
  }

  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' && options.onConflict
      ? 'resolution=merge-duplicates,return=minimal'
      : undefined,
  };

  const response = await fetch(url.toString(), {
    method: method,
    headers: Object.fromEntries(Object.entries(headers).filter(([_, v]) => v)),
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} ${text}`);
  }

  return response;
}

async function main() {
  console.log('='.repeat(60));
  console.log('X-Byte Price Sync');
  console.log('='.repeat(60));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const date = SYNC_DATE || getTodayFormatted();
  const weekOf = getWeekStart(new Date());

  console.log(`Date: ${date}`);
  console.log(`Week of: ${weekOf}`);
  console.log(`Cities: ${CITIES.join(', ')}`);
  console.log(`Feeds: ${FEEDS.join(', ')}`);
  console.log('');

  const stats = {
    productsUpserted: 0,
    pricesInserted: 0,
    errors: [],
    bySupplier: {},
  };

  for (const feed of FEEDS) {
    stats.bySupplier[feed] = 0;

    for (const city of CITIES) {
      console.log(`\nFetching ${feed} / ${city}...`);

      let page = 1;
      let hasMore = true;
      let cityCount = 0;

      while (hasMore && page <= MAX_PAGES) {
        const apiCity = encodeURIComponent(CITY_API_MAP[city] || city);
        const url = `${XBYTE_BASE_URL}?feed=${feed}&date=${date}&page=${page}&city=${apiCity}`;

        try {
          const response = await fetch(url);
          const data = await response.json();

          if (data.status === 404 || data.message === "Data not found !!!") {
            console.log(`  No data for page ${page}`);
            hasMore = false;
            continue;
          }

          if (data.status !== 200 || !data.data) {
            console.error(`  API error: ${JSON.stringify(data)}`);
            stats.errors.push(`${feed}/${city}: API error`);
            hasMore = false;
            continue;
          }

          // Dedupe products by ID
          const productMap = new Map();
          for (const item of data.data) {
            const id = `xbyte-${item["Retailer Identifier"].toLowerCase()}-${item["Product ID / SKU"]}`;
            const productName = item["Product Name"];
            const category = item["Category"] || "";

            productMap.set(id, {
              id,
              name: productName,
              search_name: normalizeProductName(productName),
              sku: String(item["Product ID / SKU"]),
              unit: item["Unit of Measure"] || "each",
              unit_price: item["Price (USD)"],
              currency: "USD",
              description: category,
              brand: item["Brand"] || null,
              supplier_id: SUPPLIER_MAP[item["Retailer Identifier"]] || item["Retailer Identifier"].toLowerCase(),
              supplier_url: item["Product URL"],
              product_url: item["Product URL"],
              in_stock: item["In-Stock Status"] === "In Stock",
              data_source: "retailer_scraped",
              retailer: item["Retailer Identifier"],
              coverage_sqft: extractCoverageSqft(productName, category),
              last_synced_at: new Date().toISOString(),
            });
          }
          const products = Array.from(productMap.values());

          // Upsert products
          try {
            await supabaseQuery('products', 'POST', products, { onConflict: 'id' });
            stats.productsUpserted += products.length;
          } catch (err) {
            console.error(`  Product upsert error: ${err.message}`);
            stats.errors.push(`${feed}/${city}: Product upsert failed`);
          }

          // Prepare price records
          const priceMap = new Map();
          for (const item of data.data) {
            const productId = `xbyte-${item["Retailer Identifier"].toLowerCase()}-${item["Product ID / SKU"]}`;
            const locationRaw = item["Location"];
            const locationId = LOCATION_MAP[locationRaw] || locationRaw.toLowerCase().replace(" ", "_");

            priceMap.set(`${productId}-${locationId}`, {
              product_id: productId,
              supplier_id: SUPPLIER_MAP[item["Retailer Identifier"]] || item["Retailer Identifier"].toLowerCase(),
              location_id: locationId,
              price: item["Price (USD)"],
              currency: "USD",
              effective_at: item["Last Update Timestamp"],
              week_of: weekOf,
            });
          }
          const prices = Array.from(priceMap.values());

          // Upsert prices
          try {
            await supabaseQuery('product_prices', 'POST', prices, { onConflict: 'product_id,location_id,week_of' });
            stats.pricesInserted += prices.length;
            cityCount += prices.length;
            stats.bySupplier[feed] += prices.length;
          } catch (err) {
            console.error(`  Price upsert error: ${err.message}`);
            stats.errors.push(`${feed}/${city}: Price upsert failed`);
          }

          process.stdout.write(`  Page ${page}: ${data.count} items\r`);

          hasMore = data.count === 100;
          page++;

          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 100));

        } catch (err) {
          console.error(`  Fetch error: ${err.message}`);
          stats.errors.push(`${feed}/${city}: ${err.message}`);
          hasMore = false;
        }
      }

      console.log(`  ${city}: ${cityCount} prices`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Products upserted: ${stats.productsUpserted}`);
  console.log(`Prices inserted: ${stats.pricesInserted}`);
  console.log('');
  console.log('By supplier:');
  for (const [supplier, count] of Object.entries(stats.bySupplier)) {
    console.log(`  ${supplier}: ${count}`);
  }

  if (stats.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const err of stats.errors) {
      console.log(`  - ${err}`);
    }
    process.exit(1);
  }

  // Write stats to file for notification script
  const fs = await import('fs');
  fs.writeFileSync('/tmp/sync-stats.json', JSON.stringify({
    date,
    weekOf,
    stats,
    timestamp: new Date().toISOString(),
  }));

  console.log('\nSync completed successfully!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
