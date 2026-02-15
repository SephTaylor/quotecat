// modules/catalog/useProducts.ts
import { useCallback, useEffect, useState } from "react";
import type { Product, Category } from "./seed";
import {
  getLastSyncTime,
  getProducts,
  getCategories,
  needsSync,
  refreshProducts,
  syncAllProducts,
  syncCategories,
} from "./productService";

export type SyncProgress = {
  loaded: number;
  total: number;
};

/**
 * Hook for loading and syncing products.
 * Automatically syncs on mount if needed (weekly sync for xByte data).
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const [productData, categoryData] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(productData);

      // Build categories from actual product categoryIds to ensure all are included
      // The categories table may not have all categories that products reference
      const categorySet = new Map<string, Category>();

      // First add categories from the categories table
      categoryData.forEach(cat => {
        categorySet.set(cat.id, cat);
      });

      // Then add any missing categories from products
      productData.forEach(product => {
        if (product.categoryId && !categorySet.has(product.categoryId)) {
          categorySet.set(product.categoryId, {
            id: product.categoryId,
            name: product.categoryId
          });
        }
      });

      const allCategories = Array.from(categorySet.values());
      console.log(`[useProducts] Loaded ${productData.length} products, ${allCategories.length} categories (${categoryData.length} from table, ${allCategories.length - categoryData.length} from products)`);
      setCategories(allCategories);

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
      console.log("🔄 Background sync triggered (weekly sync)");
      setSyncing(true);
      setSyncProgress({ loaded: 0, total: 0 });

      // Sync products with progress callback, categories in parallel
      await Promise.all([
        syncAllProducts((loaded, total) => {
          setSyncProgress({ loaded, total });
        }),
        syncCategories(),
      ]);

      setSyncing(false);
      setSyncProgress(null);

      // Reload after sync
      await loadProducts();
    }
  }, [loadProducts]);

  const manualRefresh = useCallback(async () => {
    setSyncing(true);
    setSyncProgress({ loaded: 0, total: 0 });

    // Refresh products with progress callback, categories in parallel
    const [productSuccess, categorySuccess] = await Promise.all([
      refreshProducts((loaded, total) => {
        setSyncProgress({ loaded, total });
      }),
      syncCategories(),
    ]);

    setSyncing(false);
    setSyncProgress(null);

    if (productSuccess || categorySuccess) {
      await loadProducts();
    }

    return productSuccess;
  }, [loadProducts]);

  useEffect(() => {
    loadProducts();
    // Background sync after initial load (checks if >7 days since last sync)
    backgroundSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    products,
    categories,
    loading,
    syncing,
    syncProgress,
    lastSync,
    refresh: manualRefresh,
  };
}
