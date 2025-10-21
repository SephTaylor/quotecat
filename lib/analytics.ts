// lib/analytics.ts
// Privacy-friendly product usage analytics

import AsyncStorage from "@react-native-async-storage/async-storage";

const USAGE_STATS_KEY = "@quotecat/product_usage";
const MAX_RECENT_PRODUCTS = 20; // Keep last 20 unique products

export type ProductUsageStats = {
  productId: string;
  timesUsed: number;
  lastUsed: string; // ISO timestamp
  totalQuantity: number;
};

type UsageCache = {
  stats: Record<string, ProductUsageStats>; // Keyed by productId
  recentOrder: string[]; // Product IDs in order of last use
};

/**
 * Track product usage locally (always runs, privacy-friendly)
 */
export async function trackProductUsage(
  productId: string,
  quantity: number = 1
): Promise<void> {
  try {
    const cache = await loadUsageCache();
    const now = new Date().toISOString();

    // Update or create stats for this product
    const existing = cache.stats[productId];
    cache.stats[productId] = {
      productId,
      timesUsed: (existing?.timesUsed || 0) + 1,
      lastUsed: now,
      totalQuantity: (existing?.totalQuantity || 0) + quantity,
    };

    // Update recent order (move to front)
    cache.recentOrder = [
      productId,
      ...cache.recentOrder.filter((id) => id !== productId),
    ].slice(0, MAX_RECENT_PRODUCTS);

    await saveUsageCache(cache);

    // TODO: Send anonymous analytics if user opted in
    // await sendAnonymousAnalytics(productId, quantity);
  } catch (error) {
    console.error("Failed to track product usage:", error);
    // Don't throw - analytics should never break the app
  }
}

/**
 * Get recently used products (sorted by last use)
 */
export async function getRecentlyUsedProducts(): Promise<string[]> {
  try {
    const cache = await loadUsageCache();
    return cache.recentOrder;
  } catch (error) {
    console.error("Failed to get recent products:", error);
    return [];
  }
}

/**
 * Get usage stats for a specific product
 */
export async function getProductStats(
  productId: string
): Promise<ProductUsageStats | null> {
  try {
    const cache = await loadUsageCache();
    return cache.stats[productId] || null;
  } catch (error) {
    console.error("Failed to get product stats:", error);
    return null;
  }
}

/**
 * Get all products sorted by usage frequency
 */
export async function getFrequentlyUsedProducts(): Promise<
  ProductUsageStats[]
> {
  try {
    const cache = await loadUsageCache();
    return Object.values(cache.stats).sort(
      (a, b) => b.timesUsed - a.timesUsed
    );
  } catch (error) {
    console.error("Failed to get frequent products:", error);
    return [];
  }
}

/**
 * Clear all usage stats (for testing or user privacy)
 */
export async function clearUsageStats(): Promise<void> {
  await AsyncStorage.removeItem(USAGE_STATS_KEY);
}

/**
 * Load usage cache from storage
 */
async function loadUsageCache(): Promise<UsageCache> {
  try {
    const json = await AsyncStorage.getItem(USAGE_STATS_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch (error) {
    console.error("Failed to load usage cache:", error);
  }

  // Return empty cache
  return {
    stats: {},
    recentOrder: [],
  };
}

/**
 * Save usage cache to storage
 */
async function saveUsageCache(cache: UsageCache): Promise<void> {
  await AsyncStorage.setItem(USAGE_STATS_KEY, JSON.stringify(cache));
}

/**
 * Send anonymous analytics to cloud (opt-in only)
 * TODO: Implement when ready for cloud analytics
 */
// async function sendAnonymousAnalytics(
//   productId: string,
//   quantity: number
// ): Promise<void> {
//   const preferences = await loadPreferences();
//   if (!preferences.shareAnonymousUsage) return;
//
//   // Send to Supabase or analytics service
//   // await supabase.from('product_usage').insert({
//   //   product_id: productId,
//   //   quantity,
//   //   timestamp: new Date().toISOString(),
//   //   // No user identifiers
//   // });
// }
