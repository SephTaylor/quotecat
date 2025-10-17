// modules/catalog/productService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Product } from "./seed";
import { PRODUCTS_SEED } from "./seed";

const STORAGE_KEY = "@quotecat/products";
const SYNC_TIMESTAMP_KEY = "@quotecat/products_sync";

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type ProductCache = {
  data: Product[];
  lastSync: string | null;
  version: number;
};

/**
 * Get products from local cache (offline-first).
 * Falls back to seed data if cache is empty.
 */
export async function getProducts(): Promise<Product[]> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      const cache: ProductCache = JSON.parse(cached);
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
  if (!supabase) {
    console.warn("Supabase not configured - skipping sync");
    return false;
  }

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
 * Clear local cache (for testing).
 */
export async function clearProductCache(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(SYNC_TIMESTAMP_KEY);
  console.log("🗑️ Cleared product cache");
}
