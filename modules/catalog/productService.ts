// modules/catalog/productService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { Product, Category } from "./seed";
import { PRODUCT_KEYS, CATEGORY_KEYS } from "@/lib/storageKeys";

const STORAGE_KEY = PRODUCT_KEYS.CACHE;
const SYNC_TIMESTAMP_KEY = PRODUCT_KEYS.SYNC_TIMESTAMP;
const CATEGORY_STORAGE_KEY = CATEGORY_KEYS.CACHE;
const MAX_PRODUCTS_PER_SYNC = 5000; // Prevent unbounded data fetches
const MAX_CATEGORIES_PER_SYNC = 100;

// In-memory cache to avoid repeated AsyncStorage reads
let inMemoryProductCache: Product[] | null = null;
let inMemoryCategoryCache: Category[] | null = null;

type ProductCache = {
  data: Product[];
  lastSync: string | null;
  version: number;
};

type CategoryCache = {
  data: Category[];
  lastSync: string | null;
};

/**
 * Get products from local cache (offline-first).
 * Uses in-memory cache for fast repeated access.
 * Returns empty array if no cache exists - call syncProducts() to populate.
 */
export async function getProducts(): Promise<Product[]> {
  // Return in-memory cache if available (fast path)
  if (inMemoryProductCache !== null) {
    return inMemoryProductCache;
  }

  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);

      // Validate parsed data structure
      if (typeof parsed !== 'object' || parsed === null) {
        console.warn("Invalid product cache format");
        return [];
      }

      const cache = parsed as ProductCache;

      // Validate cache.data is an array
      if (!Array.isArray(cache.data)) {
        console.warn("Invalid product cache data format");
        return [];
      }

      // Filter out invalid products
      inMemoryProductCache = cache.data.filter((p): p is Product =>
        p != null && typeof p === 'object' && p.id != null && p.name != null
      );
      return inMemoryProductCache;
    }

    // No cache - return empty array, user needs to sync
    return [];
  } catch (error) {
    console.error("Failed to get products from cache:", error);
    return [];
  }
}

/**
 * Check if products have been synced (cache exists).
 */
export async function hasProductCache(): Promise<boolean> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    return cached !== null;
  } catch {
    return false;
  }
}

/**
 * Get last sync timestamp.
 */
export async function getLastSyncTime(): Promise<Date | null> {
  try {
    const timestamp = await AsyncStorage.getItem(SYNC_TIMESTAMP_KEY);
    return timestamp ? new Date(timestamp) : null;
  } catch {
    return null;
  }
}

/**
 * Check if sync is needed (no cache or >24 hours since last sync).
 */
export async function needsSync(): Promise<boolean> {
  const hasCache = await hasProductCache();
  if (!hasCache) return true;

  const lastSync = await getLastSyncTime();
  if (!lastSync) return true;

  const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
  return hoursSinceSync > 24;
}

/**
 * Sync products from Supabase to local cache.
 * Returns true if successful, false if offline/error.
 */
export async function syncProducts(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .limit(MAX_PRODUCTS_PER_SYNC);

    if (error) {
      console.error("Cloud sync error:", error);
      return false;
    }

    if (!data || data.length === 0) {
      console.warn("No products from cloud");
      return false;
    }

    // Map Supabase data to Product type with validation
    const products: Product[] = [];
    for (const row of data) {
      try {
        // Skip invalid rows
        if (!row || !row.id || !row.name) {
          console.warn("Skipping invalid product row:", row);
          continue;
        }

        products.push({
          id: row.id,
          categoryId: row.category_id,
          name: row.name,
          unit: row.unit || "each",
          unitPrice: parseFloat(row.unit_price) || 0,
          supplierId: row.supplier_id || undefined,
        });
      } catch (parseError) {
        console.error(`Failed to parse product ${row?.id}:`, parseError);
        // Continue with next product
      }
    }

    // Save to cache
    const cache: ProductCache = {
      data: products,
      lastSync: new Date().toISOString(),
      version: 1,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    if (cache.lastSync) {
      await AsyncStorage.setItem(SYNC_TIMESTAMP_KEY, cache.lastSync);
    }

    // Update in-memory cache
    inMemoryProductCache = products;

    console.log(`✅ Synced ${products.length} products from cloud`);
    return true;
  } catch (error) {
    console.error("Failed to sync products:", error);
    return false;
  }
}

/**
 * Get products by category (from cache).
 */
export async function getProductsByCategory(
  categoryId: string,
): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((p) => p.categoryId === categoryId);
}

/**
 * Get product by ID (from cache).
 */
export async function getProductById(id: string): Promise<Product | null> {
  const all = await getProducts();
  return all.find((p) => p.id === id) || null;
}

/**
 * Search products by name/SKU (from cache).
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const all = await getProducts();
  const q = query.trim().toLowerCase();

  if (!q) return all.slice(0, 50);

  return all
    .filter((p) => {
      const searchable = `${p.name} ${p.id}`.toLowerCase();
      return searchable.includes(q);
    })
    .slice(0, 100);
}

/**
 * Force refresh cache from Supabase.
 * Use this for pull-to-refresh.
 */
export async function refreshProducts(): Promise<boolean> {
  console.log("🔄 Refreshing products...");
  return await syncProducts();
}

/**
 * Get categories from local cache (offline-first).
 * Uses in-memory cache for fast repeated access.
 * Returns empty array if no cache exists - call syncCategories() to populate.
 */
export async function getCategories(): Promise<Category[]> {
  // Return in-memory cache if available (fast path)
  if (inMemoryCategoryCache !== null) {
    return inMemoryCategoryCache;
  }

  try {
    const cached = await AsyncStorage.getItem(CATEGORY_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);

      // Validate parsed data structure
      if (typeof parsed !== 'object' || parsed === null) {
        console.warn("Invalid category cache format");
        return [];
      }

      const cache = parsed as CategoryCache;

      // Validate cache.data is an array
      if (!Array.isArray(cache.data)) {
        console.warn("Invalid category cache data format");
        return [];
      }

      // Filter out invalid categories
      inMemoryCategoryCache = cache.data.filter((c): c is Category =>
        c != null && typeof c === 'object' && c.id != null && c.name != null
      );
      return inMemoryCategoryCache;
    }
    // No cache - return empty array
    return [];
  } catch (error) {
    console.error("Failed to get categories from cache:", error);
    return [];
  }
}

/**
 * Sync categories from Supabase to local cache.
 * Returns true if successful, false if offline/error.
 */
export async function syncCategories(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .limit(MAX_CATEGORIES_PER_SYNC);

    if (error) {
      console.error("Cloud category sync error:", error);
      return false;
    }

    if (!data || data.length === 0) {
      console.warn("No categories from cloud");
      return false;
    }

    // Map Supabase data to Category type with validation
    const categories: Category[] = [];
    for (const row of data) {
      try {
        // Skip invalid rows
        if (!row || !row.id || !row.name) {
          console.warn("Skipping invalid category row:", row);
          continue;
        }

        categories.push({
          id: row.id,
          name: row.name,
        });
      } catch (parseError) {
        console.error(`Failed to parse category ${row?.id}:`, parseError);
        // Continue with next category
      }
    }

    // Save to cache
    const cache: CategoryCache = {
      data: categories,
      lastSync: new Date().toISOString(),
    };

    await AsyncStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(cache));

    // Update in-memory cache
    inMemoryCategoryCache = categories;

    console.log(`✅ Synced ${categories.length} categories from cloud`);
    return true;
  } catch (error) {
    console.error("Failed to sync categories:", error);
    return false;
  }
}

/**
 * Clear local cache (for testing).
 */
export async function clearProductCache(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(SYNC_TIMESTAMP_KEY);
  await AsyncStorage.removeItem(CATEGORY_STORAGE_KEY);

  // Clear in-memory caches
  inMemoryProductCache = null;
  inMemoryCategoryCache = null;

  console.log("🗑️ Cleared product cache");
}
