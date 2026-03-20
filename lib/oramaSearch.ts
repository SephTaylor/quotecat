// lib/oramaSearch.ts
// Orama-powered local search with typo tolerance and native facets
// Runs fully offline, indexes 54k products in background

import { create, insert, search, type Orama, type Results } from '@orama/orama';
import type { Product } from '@/modules/catalog/seed';

// Index schema matching our product structure
const PRODUCT_SCHEMA = {
  id: 'string',
  name: 'string',
  categoryId: 'string',
  supplierId: 'string',
  searchName: 'string', // Expanded variations for search (2x4, 2-in x 4-in, etc.)
  unitPrice: 'number',
} as const;

type ProductDocument = {
  id: string;
  name: string;
  categoryId: string;
  supplierId: string;
  searchName: string;
  unitPrice: number;
};

export type OramaFacets = {
  supplierId: Record<string, number>;
  categoryId: Record<string, number>;
};

export type OramaSearchResult = {
  hits: Product[];
  facets: OramaFacets;
  elapsed: number;
};

// Singleton state
let oramaIndex: Orama<typeof PRODUCT_SCHEMA> | null = null;
let indexReady = false;
let indexing = false;
let productMap: Map<string, Product> = new Map();
let indexStartTime = 0;

// Listeners for index ready state
type ReadyListener = (ready: boolean) => void;
const readyListeners: Set<ReadyListener> = new Set();

/**
 * Check if the Orama index is ready for searching
 */
export function isOramaReady(): boolean {
  return indexReady && oramaIndex !== null;
}

/**
 * Subscribe to index ready state changes
 */
export function onOramaReady(listener: ReadyListener): () => void {
  readyListeners.add(listener);
  // Immediately notify if already ready
  if (indexReady) {
    listener(true);
  }
  return () => readyListeners.delete(listener);
}

/**
 * Build the Orama index from products array.
 * Runs in the background, never blocks UI.
 * Safe to call multiple times - will skip if already indexing.
 */
export async function buildOramaIndex(products: Product[]): Promise<void> {
  if (indexing) {
    console.log('[Orama] Index build already in progress, skipping');
    return;
  }

  if (products.length === 0) {
    console.log('[Orama] No products to index');
    return;
  }

  indexing = true;
  indexReady = false;
  indexStartTime = Date.now();

  console.log(`[Orama] Starting index build for ${products.length} products...`);

  try {
    // Create fresh index
    oramaIndex = await create({
      schema: PRODUCT_SCHEMA,
      components: {
        tokenizer: {
          stemming: true,
          stopWords: false, // Keep all words for product search
        },
      },
    });

    // Build product map for fast lookup after search
    productMap.clear();
    for (const product of products) {
      productMap.set(product.id, product);
    }

    // Insert products in batches to avoid blocking
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      // Use setImmediate/setTimeout to yield to UI thread
      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          for (const product of batch) {
            const doc: ProductDocument = {
              id: product.id,
              name: product.name || '',
              categoryId: product.categoryId || '',
              supplierId: product.supplierId || '',
              searchName: product.searchName || product.name || '',
              unitPrice: product.unitPrice || 0,
            };
            await insert(oramaIndex!, doc);
          }
          inserted += batch.length;
          resolve();
        }, 0);
      });

      // Log progress every 10k
      if (inserted % 10000 === 0) {
        console.log(`[Orama] Indexed ${inserted}/${products.length} products...`);
      }
    }

    const elapsed = Date.now() - indexStartTime;
    console.log(`[Orama] Index build complete: ${products.length} products in ${elapsed}ms`);

    indexReady = true;

    // Notify listeners
    for (const listener of readyListeners) {
      try {
        listener(true);
      } catch (e) {
        console.warn('[Orama] Listener error:', e);
      }
    }
  } catch (error) {
    console.error('[Orama] Index build failed:', error);
    oramaIndex = null;
    indexReady = false;
  } finally {
    indexing = false;
  }
}

/**
 * Search products using Orama with typo tolerance and facets.
 * Returns null if index isn't ready (caller should fall back to FTS5).
 */
export async function searchOrama(
  query: string,
  options?: {
    limit?: number;
    supplierFilter?: string[];
    categoryFilter?: string[];
  }
): Promise<OramaSearchResult | null> {
  if (!indexReady || !oramaIndex) {
    return null;
  }

  const { limit = 100, supplierFilter, categoryFilter } = options || {};

  try {
    // Build filter if needed
    let where: Record<string, unknown> | undefined;
    if (supplierFilter?.length || categoryFilter?.length) {
      where = {};
      if (supplierFilter?.length) {
        where.supplierId = supplierFilter;
      }
      if (categoryFilter?.length) {
        where.categoryId = categoryFilter;
      }
    }

    const startTime = Date.now();

    const results = await search(oramaIndex, {
      term: query,
      tolerance: 1, // Allow 1 character difference for typos
      properties: ['name', 'searchName'], // Search in name and expanded variations
      facets: {
        supplierId: {},
        categoryId: {},
      },
      where,
      limit,
      threshold: 0, // Return all matches above 0 relevance
    });

    const elapsed = Date.now() - startTime;

    // Map results back to full Product objects
    const hits: Product[] = [];
    for (const hit of results.hits) {
      const product = productMap.get(hit.document.id);
      if (product) {
        hits.push(product);
      }
    }

    // Extract facet counts
    const facets: OramaFacets = {
      supplierId: {},
      categoryId: {},
    };

    if (results.facets?.supplierId?.values) {
      for (const [key, count] of Object.entries(results.facets.supplierId.values)) {
        facets.supplierId[key] = count as number;
      }
    }

    if (results.facets?.categoryId?.values) {
      for (const [key, count] of Object.entries(results.facets.categoryId.values)) {
        facets.categoryId[key] = count as number;
      }
    }

    return { hits, facets, elapsed };
  } catch (error) {
    console.error('[Orama] Search failed:', error);
    return null;
  }
}

/**
 * Clear the index (call before rebuilding after sync)
 */
export function clearOramaIndex(): void {
  oramaIndex = null;
  indexReady = false;
  productMap.clear();

  // Notify listeners
  for (const listener of readyListeners) {
    try {
      listener(false);
    } catch (e) {
      console.warn('[Orama] Listener error:', e);
    }
  }
}

/**
 * Get index stats for debugging
 */
export function getOramaStats(): {
  ready: boolean;
  indexing: boolean;
  productCount: number;
  buildTimeMs: number;
} {
  return {
    ready: indexReady,
    indexing,
    productCount: productMap.size,
    buildTimeMs: indexReady ? Date.now() - indexStartTime : 0,
  };
}
