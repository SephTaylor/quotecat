// modules/catalog/usePrices.ts
// React hook for location-based pricing
import { useState, useEffect, useCallback } from "react";
import {
  getPricesForLocation,
  syncPricesForLocation,
  getPrice,
} from "./priceService";

type UsePricesResult = {
  priceMap: Map<string, number>;
  loading: boolean;
  syncing: boolean;
  locationId: string;
  setLocationId: (id: string) => void;
  refresh: () => Promise<void>;
  getPriceForProduct: (productId: string, supplierId: string | undefined) => number | null;
};

export function usePrices(initialLocationId: string | null): UsePricesResult {
  const [locationId, setLocationId] = useState(initialLocationId || "");
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load prices from cache when location changes
  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      if (!locationId) {
        setPriceMap(new Map());
        setLoading(false);
        return;
      }

      setLoading(true);
      const cached = await getPricesForLocation(locationId);
      if (!cancelled) {
        setPriceMap(cached);
        setLoading(false);

        // Sync in background if cache was empty
        if (cached.size === 0) {
          setSyncing(true);
          const success = await syncPricesForLocation(locationId);
          if (success && !cancelled) {
            const fresh = await getPricesForLocation(locationId);
            setPriceMap(fresh);
          }
          if (!cancelled) setSyncing(false);
        }
      }
    }

    loadPrices();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (!locationId) return;
    setSyncing(true);
    const success = await syncPricesForLocation(locationId);
    if (success) {
      const fresh = await getPricesForLocation(locationId);
      setPriceMap(fresh);
    }
    setSyncing(false);
  }, [locationId]);

  // Helper to get price for a specific product
  const getPriceForProduct = useCallback(
    (productId: string, supplierId: string | undefined): number | null => {
      return getPrice(priceMap, productId, supplierId);
    },
    [priceMap]
  );

  return {
    priceMap,
    loading,
    syncing,
    locationId,
    setLocationId,
    refresh,
    getPriceForProduct,
  };
}
