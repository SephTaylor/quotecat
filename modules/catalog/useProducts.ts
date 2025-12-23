// modules/catalog/useProducts.ts
import { useCallback, useEffect, useState } from "react";
import type { Product, Category } from "./seed";
import {
  getLastSyncTime,
  getProducts,
  getCategories,
  needsSync,
  refreshProducts,
  syncProducts,
  syncCategories,
} from "./productService";

/**
 * Hook for loading and syncing products.
 * Automatically syncs on mount if needed.
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const [productData, categoryData] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(productData);
      setCategories(categoryData);

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
      // Sync both products and categories
      await Promise.all([syncProducts(), syncCategories()]);
      setSyncing(false);

      // Reload after sync
      await loadProducts();
    }
  }, [loadProducts]);

  const manualRefresh = useCallback(async () => {
    setSyncing(true);
    // Refresh both products and categories
    const [productSuccess, categorySuccess] = await Promise.all([
      refreshProducts(),
      syncCategories(),
    ]);
    setSyncing(false);

    if (productSuccess || categorySuccess) {
      await loadProducts();
    }

    return productSuccess;
  }, [loadProducts]);

  useEffect(() => {
    loadProducts();
    // Background sync after initial load
    backgroundSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    products,
    categories,
    loading,
    syncing,
    lastSync,
    refresh: manualRefresh,
  };
}
