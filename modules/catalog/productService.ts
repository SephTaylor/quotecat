// modules/catalog/productService.ts
// SQLite-backed product catalog with paginated sync from Supabase
// Uses FTS5 full-text search with synonym support
import { supabase } from "@/lib/supabase";
import {
  listProductsDB,
  getProductCountDB,
  getProductByIdDB,
  saveProductsBatchDB,
  clearProductsDB,
  searchProductsFTS,
  listCategoriesDB,
  saveCategoriesBatchDB,
  clearCategoriesDB,
  getSyncMetadataDB,
  setSyncMetadataDB,
  setSynonymsBatchDB,
  needsFTSRebuild,
  rebuildProductsFTS,
} from "@/lib/database";
import type { Product, Category } from "./seed";

// Construction industry search synonyms
// Maps common shorthand to canonical forms found in product names
const CONSTRUCTION_SYNONYMS: Array<{ term: string; canonical: string }> = [
  // Dimensional lumber
  { term: "2x4", canonical: "2 in x 4 in" },
  { term: "2x6", canonical: "2 in x 6 in" },
  { term: "2x8", canonical: "2 in x 8 in" },
  { term: "2x10", canonical: "2 in x 10 in" },
  { term: "2x12", canonical: "2 in x 12 in" },
  { term: "4x4", canonical: "4 in x 4 in" },
  { term: "1x4", canonical: "1 in x 4 in" },
  { term: "1x6", canonical: "1 in x 6 in" },
  // Common abbreviations
  { term: "pt", canonical: "pressure treated" },
  { term: "osb", canonical: "oriented strand board" },
  { term: "mdf", canonical: "medium density fiberboard" },
  { term: "lvl", canonical: "laminated veneer lumber" },
  { term: "pvc", canonical: "polyvinyl chloride" },
  { term: "gfci", canonical: "ground fault circuit interrupter" },
  { term: "afci", canonical: "arc fault circuit interrupter" },
  // Electrical
  { term: "romex", canonical: "nm-b" },
  { term: "nm", canonical: "nm-b" },
  { term: "thhn", canonical: "thhn thwn" },
  // Plumbing
  { term: "pex", canonical: "pex tubing" },
  { term: "cpvc", canonical: "cpvc pipe" },
  { term: "abs", canonical: "abs pipe" },
  // Drywall
  { term: "sheetrock", canonical: "drywall" },
  { term: "gypsum", canonical: "drywall" },
  { term: "gyp", canonical: "drywall" },
  // Fasteners
  { term: "drywall screws", canonical: "drywall screw" },
  { term: "deck screws", canonical: "deck screw" },
  // Concrete
  { term: "rebar", canonical: "reinforcing bar" },
  { term: "quickcrete", canonical: "concrete mix" },
  { term: "quikrete", canonical: "concrete mix" },
];

// Canonical categories for Amazon-style category mapping
// Maps keywords to consistent top-level categories across all suppliers
const CANONICAL_CATEGORIES: Record<string, string[]> = {
  "Lumber": ["lumber", "dimensional", "plywood", "osb", "stud", "board", "timber", "mdf", "particleboard", "lvl"],
  "Electrical": ["electrical", "wire", "wiring", "outlet", "switch", "breaker", "panel", "conduit", "romex", "circuit"],
  "Plumbing": ["plumbing", "pipe", "fitting", "faucet", "toilet", "valve", "drain", "pvc", "copper", "pex"],
  "Drywall": ["drywall", "sheetrock", "gypsum", "joint compound"],
  "Hardware": ["hardware", "fastener", "screw", "nail", "bolt", "anchor", "bracket", "hinge"],
  "Paint": ["paint", "primer", "stain", "coating", "sealer"],
  "Flooring": ["flooring", "tile", "laminate", "vinyl floor", "hardwood floor", "carpet", "underlayment"],
  "Roofing": ["roofing", "shingle", "flashing", "gutter", "soffit", "fascia"],
  "Insulation": ["insulation", "foam board", "fiberglass", "weatherstrip"],
  "HVAC": ["hvac", "duct", "vent", "furnace", "air conditioner", "thermostat", "hvac filter"],
  "Doors & Windows": ["door", "window", "threshold", "screen door", "storm door"],
  "Decking": ["deck", "decking", "railing", "composite deck", "pergola"],
  "Fencing": ["fence", "fencing", "gate", "picket"],
  "Concrete & Masonry": ["concrete", "cement", "mortar", "brick", "block", "paver", "rebar"],
  "Tools": ["tool", "saw", "drill", "hammer", "level", "tape measure", "blade"],
  "Safety": ["safety", "glove", "glasses", "mask", "harness", "first aid"],
  "Lighting": ["lighting", "light fixture", "bulb", "led light", "lamp", "chandelier"],
  "Appliances": ["appliance", "water heater", "disposal", "range hood"],
  "Outdoor & Landscaping": ["outdoor", "landscape", "garden", "lawn", "sprinkler"],
};

/**
 * Get canonical category for a product based on keyword matching in its description/category path.
 * Returns "Other" if no keywords match.
 */
function getCanonicalCategory(description: string): string {
  if (!description) return "Other";
  const lowerDesc = description.toLowerCase();

  for (const [category, keywords] of Object.entries(CANONICAL_CATEGORIES)) {
    if (keywords.some(kw => lowerDesc.includes(kw))) {
      return category;
    }
  }

  return "Other";
}

const SYNC_KEY_PRODUCTS = "products_last_sync";
const SYNC_KEY_CATEGORIES = "categories_last_sync";
const PAGE_SIZE = 1000; // Supabase default limit
const SYNC_INTERVAL_HOURS = 168; // 7 days (xByte updates weekly on Fridays)

// In-memory cache for fast access (lazy loaded from SQLite)
let inMemoryProductCache: Product[] | null = null;
let inMemoryCategoryCache: Category[] | null = null;

/**
 * Get products from SQLite (offline-first).
 * Uses in-memory cache for fast repeated access.
 * Returns empty array if no products exist - call syncAllProducts() to populate.
 */
export async function getProducts(): Promise<Product[]> {
  // Return in-memory cache if available (fast path)
  if (inMemoryProductCache !== null) {
    return inMemoryProductCache;
  }

  // Load from SQLite
  const products = listProductsDB();
  inMemoryProductCache = products;

  // Check if FTS index needs rebuilding (products exist but FTS is empty)
  // This can happen after migration when products were synced before FTS existed
  if (products.length > 0 && needsFTSRebuild()) {
    console.log("🔧 FTS index empty, rebuilding...");
    rebuildProductsFTS();
    seedSearchSynonyms();
  }

  return products;
}

/**
 * Check if products have been synced (SQLite has data).
 */
export async function hasProductCache(): Promise<boolean> {
  const count = getProductCountDB();
  return count > 0;
}

/**
 * Get last sync timestamp for products.
 */
export async function getLastSyncTime(): Promise<Date | null> {
  const timestamp = getSyncMetadataDB(SYNC_KEY_PRODUCTS);
  return timestamp ? new Date(timestamp) : null;
}

/**
 * Check if sync is needed (no cache or >7 days since last sync).
 * xByte updates weekly on Fridays at 8am, app syncs at 9am.
 */
export async function needsSync(): Promise<boolean> {
  const hasCache = await hasProductCache();
  if (!hasCache) return true;

  const lastSync = await getLastSyncTime();
  if (!lastSync) return true;

  const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
  return hoursSinceSync > SYNC_INTERVAL_HOURS;
}

/**
 * Sync ALL products from Supabase with paginated fetching.
 * Reports progress via callback for UI updates.
 * Returns true if successful, false if offline/error.
 */
export async function syncAllProducts(
  onProgress?: (loaded: number, total: number) => void
): Promise<boolean> {
  console.log("[syncAllProducts] Starting paginated sync...");

  try {
    // Get total count first
    const { count, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("Failed to get product count:", countError);
      return false;
    }

    const total = count || 0;
    console.log(`[syncAllProducts] Total products in Supabase: ${total}`);

    if (total === 0) {
      console.warn("No products in Supabase");
      return false;
    }

    // Clear existing products for full resync
    clearProductsDB();
    inMemoryProductCache = null;

    let offset = 0;
    let successfulRows = 0;

    while (offset < total) {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error(`Sync error at offset ${offset}:`, error);
        return false;
      }

      if (!data || data.length === 0) {
        break;
      }

      // Map Supabase rows to Product type
      const products: Product[] = [];
      for (const row of data) {
        try {
          if (!row?.id || !row?.name) continue;

          // For xByte products, category is in description field
          let categoryId = row.category_id;
          if (!categoryId && row.description) {
            const parts = row.description.split("|").map((s: string) => s.trim());
            categoryId = parts[parts.length - 1] || "Other";
          }

          products.push({
            id: row.id,
            categoryId: categoryId || "Other",
            canonicalCategory: getCanonicalCategory(row.description || ""),
            name: row.name,
            unit: row.unit || "each",
            unitPrice: parseFloat(row.unit_price) || 0,
            supplierId: row.supplier_id || undefined,
          });
        } catch (parseError) {
          console.error(`Failed to parse product ${row?.id}:`, parseError);
        }
      }

      // Batch save to SQLite
      if (products.length > 0) {
        saveProductsBatchDB(products);
        successfulRows += products.length;
      }

      offset += data.length;
      onProgress?.(Math.min(offset, total), total);

      console.log(`[syncAllProducts] Progress: ${offset}/${total}`);
    }

    // Update sync timestamp
    setSyncMetadataDB(SYNC_KEY_PRODUCTS, new Date().toISOString());

    // Rebuild FTS index for all products (bulk operation is faster)
    console.log("📚 Building search index...");
    rebuildProductsFTS();

    // Seed search synonyms for construction terms
    seedSearchSynonyms();

    console.log(`✅ Synced ${successfulRows} products from Supabase`);
    return true;
  } catch (error) {
    console.error("Failed to sync products:", error);
    return false;
  }
}

/**
 * Legacy sync function - now calls syncAllProducts.
 * Kept for backward compatibility with existing code.
 */
export async function syncProducts(): Promise<boolean> {
  return syncAllProducts();
}

/**
 * Get products by category (from SQLite).
 */
export async function getProductsByCategory(
  categoryId: string
): Promise<Product[]> {
  return listProductsDB({ categoryId });
}

/**
 * Get product by ID (from SQLite).
 */
export async function getProductById(id: string): Promise<Product | null> {
  return getProductByIdDB(id);
}

/**
 * Search products using FTS5 full-text search.
 * Supports stemming, prefix matching, and synonym expansion.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim();
  if (!q) {
    return listProductsDB({ limit: 50 });
  }
  return searchProductsFTS(q, 100);
}

/**
 * Seed the search synonyms table with construction industry terms.
 * Called after product sync to ensure synonyms are available.
 */
function seedSearchSynonyms(): void {
  try {
    setSynonymsBatchDB(CONSTRUCTION_SYNONYMS);
    console.log(`📚 Seeded ${CONSTRUCTION_SYNONYMS.length} search synonyms`);
  } catch (error) {
    console.error("Failed to seed synonyms:", error);
  }
}

/**
 * Force refresh - clears cache and resyncs all products.
 * Use this for pull-to-refresh.
 */
export async function refreshProducts(
  onProgress?: (loaded: number, total: number) => void
): Promise<boolean> {
  console.log("🔄 Refreshing products...");
  inMemoryProductCache = null;
  return syncAllProducts(onProgress);
}

/**
 * Get categories from SQLite (offline-first).
 */
export async function getCategories(): Promise<Category[]> {
  if (inMemoryCategoryCache !== null) {
    return inMemoryCategoryCache;
  }

  const categories = listCategoriesDB();
  inMemoryCategoryCache = categories;
  return categories;
}

/**
 * Sync categories from Supabase with 2-level hierarchy.
 * Parses xByte product descriptions: "Building Materials | Lumber | Framing Lumber"
 * Creates Parent (second-to-last) and Leaf (last) categories with parentId relationships.
 */
export async function syncCategories(): Promise<boolean> {
  try {
    console.log("[syncCategories] Starting 2-level hierarchy sync...");

    // Fetch ALL product descriptions to extract categories
    // Need to paginate since we have 38k+ products
    const parentCategories = new Map<string, Category>();
    const leafCategories = new Map<string, Category>();

    let offset = 0;
    const pageSize = 5000;
    let hasMore = true;

    while (hasMore) {
      const { data: products, error } = await supabase
        .from("products")
        .select("description")
        .not("description", "is", null)
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error("Failed to fetch products for category sync:", error);
        return false;
      }

      if (!products || products.length === 0) {
        hasMore = false;
        break;
      }

      for (const product of products) {
        if (!product.description) continue;

        const parts = product.description.split("|").map((s: string) => s.trim());

        // Extract 2-level hierarchy:
        // - Leaf = last segment (product's categoryId)
        // - Parent = second-to-last segment (if exists)
        const leafName = parts[parts.length - 1];
        const parentName = parts.length >= 2 ? parts[parts.length - 2] : null;

        if (!leafName) continue;

        // Create/track parent category (level 0)
        if (parentName && !parentCategories.has(parentName)) {
          parentCategories.set(parentName, {
            id: parentName,
            name: parentName,
            parentId: undefined,
            level: 0,
            sortOrder: parentCategories.size, // Order by first seen
          });
        }

        // Create/track leaf category (level 1) with parentId
        if (!leafCategories.has(leafName)) {
          leafCategories.set(leafName, {
            id: leafName,
            name: leafName,
            parentId: parentName || undefined,
            level: 1,
            sortOrder: leafCategories.size,
          });
        }
      }

      offset += products.length;
      console.log(`[syncCategories] Processed ${offset} products...`);

      if (products.length < pageSize) {
        hasMore = false;
      }
    }

    // Combine parent and leaf categories
    const allCategories: Category[] = [
      ...Array.from(parentCategories.values()),
      ...Array.from(leafCategories.values()),
    ];

    // Clear and save to SQLite
    clearCategoriesDB();
    saveCategoriesBatchDB(allCategories);

    // Update sync timestamp
    setSyncMetadataDB(SYNC_KEY_CATEGORIES, new Date().toISOString());

    // Update in-memory cache
    inMemoryCategoryCache = allCategories;

    console.log(`✅ Synced ${allCategories.length} categories (${parentCategories.size} parents, ${leafCategories.size} leaves)`);
    return true;
  } catch (error) {
    console.error("Failed to sync categories:", error);
    return false;
  }
}

/**
 * Clear local product cache (for testing/reset).
 */
export async function clearProductCache(): Promise<void> {
  clearProductsDB();
  clearCategoriesDB();

  // Clear in-memory caches
  inMemoryProductCache = null;
  inMemoryCategoryCache = null;

  console.log("🗑️ Cleared product cache");
}
