// modules/catalog/productService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { Product, Category } from "./seed";
import { PRODUCTS_SEED, CATEGORIES as SEED_CATEGORIES } from "./seed";
import { PRODUCT_KEYS, CATEGORY_KEYS } from "@/lib/storageKeys";

const STORAGE_KEY = PRODUCT_KEYS.CACHE;
const SYNC_TIMESTAMP_KEY = PRODUCT_KEYS.SYNC_TIMESTAMP;
const CATEGORY_STORAGE_KEY = CATEGORY_KEYS.CACHE;

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
 * Automatically merges new seed products with existing cache.
 */
export async function getProducts(): Promise<Product[]> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      const cache: ProductCache = JSON.parse(cached);

      // Merge new seed products with existing cache
      await mergeSeedProducts(cache);

      // Re-read after merge
      const updated = await AsyncStorage.getItem(STORAGE_KEY);
      if (updated) {
        const updatedCache: ProductCache = JSON.parse(updated);
        return updatedCache.data;
      }

      return cache.data;
    }

    // No cache - use seed data as bootstrap
    await initializeCache();
    return getFlattenedSeedProducts();
  } catch (error) {
    console.error("Failed to get products from cache:", error);
    return getFlattenedSeedProducts();
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
 * Check if sync is needed (>24 hours since last sync).
 */
export async function needsSync(): Promise<boolean> {
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
    const { data, error } = await supabase.from("products").select("*");

    if (error) {
      console.error("Supabase sync error:", error);
      return false;
    }

    if (!data || data.length === 0) {
      console.warn("No products from Supabase - using cache");
      return false;
    }

    // Map Supabase data to Product type
    const products: Product[] = data.map((row: any) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      unit: row.unit,
      unitPrice: parseFloat(row.unit_price),
    }));

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

    console.log(`✅ Synced ${products.length} products from Supabase`);
    return true;
  } catch (error) {
    console.error("Failed to sync products:", error);
    return false;
  }
}

/**
 * Initialize cache with seed data (bootstrap on first launch).
 */
async function initializeCache(): Promise<void> {
  const products = getFlattenedSeedProducts();

  const cache: ProductCache = {
    data: products,
    lastSync: null, // Never synced
    version: 1,
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  console.log("📦 Initialized cache with seed data");
}

/**
 * Merge new seed products into existing cache.
 * - Seed products are added if they don't exist (by ID)
 * - Existing products (from Supabase or custom) are preserved
 */
async function mergeSeedProducts(cache: ProductCache): Promise<void> {
  const seedProducts = getFlattenedSeedProducts();

  // Build a map of existing IDs
  const existingIds = new Set(cache.data.map((p) => p.id));

  // Find new seed products
  const newProducts = seedProducts.filter((s) => !existingIds.has(s.id));

  if (newProducts.length > 0) {
    // Merge existing + new seed products
    const merged: ProductCache = {
      ...cache,
      data: [...cache.data, ...newProducts],
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    console.log(`✨ Added ${newProducts.length} new products from seed`);
  }
}

/**
 * Flatten PRODUCTS_SEED into a single array.
 */
function getFlattenedSeedProducts(): Product[] {
  return Object.values(PRODUCTS_SEED).flat();
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
 */
export async function getCategories(): Promise<Category[]> {
  try {
    const cached = await AsyncStorage.getItem(CATEGORY_STORAGE_KEY);
    if (cached) {
      const cache: CategoryCache = JSON.parse(cached);
      return cache.data;
    }
    // No cache - use seed categories as bootstrap
    return SEED_CATEGORIES;
  } catch (error) {
    console.error("Failed to get categories from cache:", error);
    return SEED_CATEGORIES;
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
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Supabase category sync error:", error);
      return false;
    }

    if (!data || data.length === 0) {
      console.warn("No categories from Supabase - using cache");
      return false;
    }

    // Map Supabase data to Category type
    const categories: Category[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
    }));

    // Save to cache
    const cache: CategoryCache = {
      data: categories,
      lastSync: new Date().toISOString(),
    };

    await AsyncStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(cache));
    console.log(`✅ Synced ${categories.length} categories from Supabase`);
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
  console.log("🗑️ Cleared product cache");
}
