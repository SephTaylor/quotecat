// lib/cache.ts
// Lightweight in-memory cache with TTL support
// Similar to React Query but simpler and framework-agnostic

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  stale: boolean;
};

type CacheConfig = {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  staleTime?: number; // Time before data is considered stale (default: 1 minute)
};

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private defaultStaleTime = 60 * 1000; // 1 minute

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if expired
    if (age > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Check if cached data is stale (should be refetched in background)
   */
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;

    const now = Date.now();
    const age = now - entry.timestamp;
    return age > this.defaultStaleTime || entry.stale;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      stale: false,
    });
  }

  /**
   * Mark cache entry as stale (will trigger refetch but can still be used)
   */
  markStale(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.stale = true;
    }
  }

  /**
   * Invalidate (delete) cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const cache = new CacheManager();

/**
 * Higher-order function for caching async operations
 * Implements stale-while-revalidate pattern
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: CacheConfig = {},
): Promise<T> {
  // Return cached data if available
  const cached = cache.get<T>(key);

  if (cached !== null) {
    // If stale, refetch in background but return stale data immediately
    if (cache.isStale(key)) {
      fetcher()
        .then((fresh) => cache.set(key, fresh))
        .catch((error) => {
          console.error(`Background refetch failed for ${key}:`, error);
        });
    }
    return cached;
  }

  // No cache - fetch and cache
  const data = await fetcher();
  cache.set(key, data);
  return data;
}

/**
 * Cache key builders for common patterns
 */
export const CacheKeys = {
  quotes: {
    all: () => "quotes:all",
    byId: (id: string) => `quotes:${id}`,
  },
  products: {
    all: () => "products:all",
    byId: (id: string) => `products:${id}`,
    byCategory: (categoryId: string) => `products:category:${categoryId}`,
  },
  assemblies: {
    all: () => "assemblies:all",
    byId: (id: string) => `assemblies:${id}`,
  },
  calculations: {
    quoteTotal: (quoteId: string) => `calc:quote:${quoteId}:total`,
    assemblyExpansion: (assemblyId: string, vars: string) =>
      `calc:assembly:${assemblyId}:${vars}`,
  },
} as const;
