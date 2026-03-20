// lib/searchAnalytics.ts
// Logs search queries to Supabase for analytics and improvement

interface SearchLogEntry {
  query: string;
  normalized_query?: string;
  results_count: number;
  supplier_filter?: string[];
  category_filter?: string[];
}

// Debounce map to avoid logging rapid typing
const recentSearches = new Map<string, number>();
const DEBOUNCE_MS = 2000; // Only log if same query hasn't been logged in 2s

/**
 * Log a search query to Supabase for analytics.
 * Non-blocking - fires and forgets to avoid impacting search performance.
 * Uses dynamic import to avoid module initialization issues.
 */
export function logSearch(entry: SearchLogEntry): void {
  try {
    // Skip empty or very short queries
    if (!entry.query || entry.query.trim().length < 2) return;

    const key = entry.query.toLowerCase().trim();
    const now = Date.now();
    const lastLogged = recentSearches.get(key);

    // Debounce: skip if we logged this exact query recently
    if (lastLogged && now - lastLogged < DEBOUNCE_MS) return;

    recentSearches.set(key, now);

    // Clean up old entries periodically
    if (recentSearches.size > 100) {
      const cutoff = now - DEBOUNCE_MS * 2;
      for (const [k, v] of recentSearches) {
        if (v < cutoff) recentSearches.delete(k);
      }
    }

    // Dynamic import to avoid module initialization issues
    import('./supabase').then(({ supabase }) => {
      supabase
        .from('search_logs')
        .insert({
          query: entry.query.trim(),
          normalized_query: entry.normalized_query,
          results_count: entry.results_count,
          supplier_filter: entry.supplier_filter,
          category_filter: entry.category_filter,
        })
        .then(({ error }) => {
          if (error) {
            console.warn('[SearchAnalytics] Failed to log search:', error.message);
          }
        });
    }).catch(() => {
      // Silently fail if supabase not available
    });
  } catch {
    // Never crash the app for analytics
  }
}

/**
 * Get failed searches (0 results) for review.
 * Useful for identifying missing synonyms.
 */
export async function getFailedSearches(limit = 50): Promise<
  Array<{ query: string; count: number; last_searched: string }>
> {
  const { data, error } = await supabase
    .from('search_logs')
    .select('query, created_at')
    .eq('results_count', 0)
    .order('created_at', { ascending: false })
    .limit(limit * 10); // Get more to aggregate

  if (error || !data) return [];

  // Aggregate by query
  const counts = new Map<string, { count: number; last: string }>();
  for (const row of data) {
    const q = row.query.toLowerCase();
    const existing = counts.get(q);
    if (existing) {
      existing.count++;
    } else {
      counts.set(q, { count: 1, last: row.created_at });
    }
  }

  // Sort by count descending
  return Array.from(counts.entries())
    .map(([query, { count, last }]) => ({
      query,
      count,
      last_searched: last,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get search stats for a time period.
 */
export async function getSearchStats(days = 7): Promise<{
  total_searches: number;
  failed_searches: number;
  unique_queries: number;
  top_queries: Array<{ query: string; count: number }>;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('search_logs')
    .select('query, results_count')
    .gte('created_at', since.toISOString());

  if (error || !data) {
    return { total_searches: 0, failed_searches: 0, unique_queries: 0, top_queries: [] };
  }

  const uniqueQueries = new Set<string>();
  const queryCounts = new Map<string, number>();
  let failed = 0;

  for (const row of data) {
    const q = row.query.toLowerCase();
    uniqueQueries.add(q);
    queryCounts.set(q, (queryCounts.get(q) || 0) + 1);
    if (row.results_count === 0) failed++;
  }

  const topQueries = Array.from(queryCounts.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    total_searches: data.length,
    failed_searches: failed,
    unique_queries: uniqueQueries.size,
    top_queries: topQueries,
  };
}
