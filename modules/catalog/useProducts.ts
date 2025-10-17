// modules/catalog/useProducts.ts
import { useCallback, useEffect, useState } from "react";
import type { Product } from "./seed";
import {
  getLastSyncTime,
  getProducts,
  needsSync,
  refreshProducts,
  syncProducts,
} from "./productService";

/**
 * Hook for loading and syncing products.
 * Automatically syncs on mount if needed.
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const data = await getProducts();
      setProducts(data);

      const syncTime = await getLastSyncTime();
      setLastSync(syncTime);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const backgroundSync = useCallback(async () => {
    const shouldSync = await needsSync();
    if (shouldSync) {
      console.log("🔄 Background sync triggered");
      setSyncing(true);
      const success = await syncProducts();
      setSyncing(false);

      if (success) {
        // Reload products after sync
        await loadProducts();
      }
    }
  }, [loadProducts]);

  const manualRefresh = useCallback(async () => {
    setSyncing(true);
    const success = await refreshProducts();
    setSyncing(false);

    if (success) {
      await loadProducts();
    }

    return success;
  }, [loadProducts]);

  useEffect(() => {
    loadProducts();
    // Background sync after initial load
    backgroundSync();
  }, [loadProducts, backgroundSync]);

  return {
    products,
    loading,
    syncing,
    lastSync,
    refresh: manualRefresh,
  };
}
