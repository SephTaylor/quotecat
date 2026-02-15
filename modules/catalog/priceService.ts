// modules/catalog/priceService.ts
// Location-based pricing service for supplier catalog
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { PRICE_KEYS } from "@/lib/storageKeys";

export type LocationPrice = {
  productId: string;
  supplierId: string;
  locationId: string;
  price: number;
  effectiveAt: string;
};

type PriceCache = {
  locationId: string;
  data: LocationPrice[];
  lastSync: string;
};

// In-memory cache for O(1) lookups: "productId:supplierId" -> price
let inMemoryPriceMap: Map<string, number> | null = null;
let cachedLocationId: string | null = null;

/**
 * Create lookup key for price map
 */
function makePriceKey(productId: string, supplierId: string): string {
  return `${productId}:${supplierId}`;
}

/**
 * Get prices for a location from local cache.
 * Returns a Map for O(1) price lookups.
 */
export async function getPricesForLocation(
  locationId: string
): Promise<Map<string, number>> {
  // Return in-memory cache if available for same location
  if (inMemoryPriceMap !== null && cachedLocationId === locationId) {
    return inMemoryPriceMap;
  }

  try {
    const cached = await AsyncStorage.getItem(PRICE_KEYS.CACHE);
    if (cached) {
      const cache = JSON.parse(cached) as PriceCache;

      // Only use cache if it matches requested location
      if (cache.locationId === locationId && Array.isArray(cache.data)) {
        const map = new Map<string, number>();
        for (const price of cache.data) {
          if (price.productId && price.supplierId && typeof price.price === "number") {
            map.set(makePriceKey(price.productId, price.supplierId), price.price);
          }
        }
        inMemoryPriceMap = map;
        cachedLocationId = locationId;
        return map;
      }
    }
    return new Map();
  } catch (error) {
    console.error("Failed to get prices from cache:", error);
    return new Map();
  }
}

/**
 * Sync prices for a location from Supabase.
 * Uses the current_prices view which returns latest price per product/location/supplier.
 */
export async function syncPricesForLocation(locationId: string): Promise<boolean> {
  if (!locationId) return false;

  try {
    const { data, error } = await supabase
      .from("current_prices")
      .select("product_id, supplier_id, location_id, price, effective_at")
      .eq("location_id", locationId);

    if (error) {
      console.error("Price sync error:", error);
      return false;
    }

    if (!data) {
      console.warn("No price data returned");
      return false;
    }

    // Map Supabase data to LocationPrice type
    const prices: LocationPrice[] = data
      .filter((row) => row.product_id && row.supplier_id && row.price != null)
      .map((row) => ({
        productId: row.product_id,
        supplierId: row.supplier_id,
        locationId: row.location_id,
        price: parseFloat(row.price),
        effectiveAt: row.effective_at,
      }));

    // Save to cache
    const cache: PriceCache = {
      locationId,
      data: prices,
      lastSync: new Date().toISOString(),
    };

    await AsyncStorage.setItem(PRICE_KEYS.CACHE, JSON.stringify(cache));
    await AsyncStorage.setItem(PRICE_KEYS.SYNC_TIMESTAMP, cache.lastSync);

    // Update in-memory cache
    const map = new Map<string, number>();
    for (const price of prices) {
      map.set(makePriceKey(price.productId, price.supplierId), price.price);
    }
    inMemoryPriceMap = map;
    cachedLocationId = locationId;

    console.log(`Synced ${prices.length} prices for ${locationId}`);
    return true;
  } catch (error) {
    console.error("Failed to sync prices:", error);
    return false;
  }
}

/**
 * Get price for a specific product/supplier from the price map.
 * Returns null if no location price exists.
 */
export function getPrice(
  priceMap: Map<string, number>,
  productId: string,
  supplierId: string | undefined
): number | null {
  if (!supplierId) return null;
  const price = priceMap.get(makePriceKey(productId, supplierId));
  return price !== undefined ? price : null;
}

/**
 * Get last price sync timestamp.
 */
export async function getLastPriceSyncTime(): Promise<Date | null> {
  try {
    const timestamp = await AsyncStorage.getItem(PRICE_KEYS.SYNC_TIMESTAMP);
    return timestamp ? new Date(timestamp) : null;
  } catch {
    return null;
  }
}

/**
 * Clear price cache (for testing or when changing locations).
 */
export async function clearPriceCache(): Promise<void> {
  await AsyncStorage.removeItem(PRICE_KEYS.CACHE);
  await AsyncStorage.removeItem(PRICE_KEYS.SYNC_TIMESTAMP);
  inMemoryPriceMap = null;
  cachedLocationId = null;
  console.log("Cleared price cache");
}
