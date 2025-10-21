// modules/quotes/storage.ts
// Consolidated quote storage layer with legacy migration support

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Quote } from "@/lib/types";
import { normalizeQuote, calculateMaterialSubtotal } from "@/lib/validation";
import { QUOTE_KEYS } from "@/lib/storageKeys";
import {
  withErrorHandling,
  ErrorType,
  logError,
  safeJsonParse,
} from "@/lib/errors";
import { cache, CacheKeys } from "@/lib/cache";

/**
 * Internal map type for de-duplication
 */
type QuotesMap = Record<string, Quote>;

/**
 * Safe timestamp extractor
 * Returns numeric epoch (0 if missing/invalid)
 */
function getTimestamp(dateString?: string): number {
  if (typeof dateString !== "string") return 0;
  const parsed = Date.parse(dateString);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Get the most recent timestamp from a quote
 */
function getLatestTimestamp(quote: Quote): number {
  return Math.max(getTimestamp(quote.updatedAt), getTimestamp(quote.createdAt));
}

/**
 * Read quotes from all storage keys (primary + legacy)
 * De-duplicates by ID, keeping the most recently updated version
 */
async function readAllQuotes(): Promise<Quote[]> {
  // Read from all keys in parallel
  const allKeys = [QUOTE_KEYS.PRIMARY, ...QUOTE_KEYS.LEGACY];
  const results = await Promise.all(
    allKeys.map((key) => AsyncStorage.getItem(key)),
  );

  // Parse and merge all quotes
  const allQuotes: Quote[] = [];
  for (const json of results) {
    if (json) {
      const parsed = safeJsonParse<any[]>(json, []);
      if (Array.isArray(parsed)) {
        allQuotes.push(...parsed.map(normalizeQuote));
      }
    }
  }

  // De-duplicate by ID, preferring newest
  const quotesMap: QuotesMap = {};
  for (const quote of allQuotes) {
    const existing = quotesMap[quote.id];
    if (!existing) {
      quotesMap[quote.id] = quote;
    } else {
      // Keep the one with the latest timestamp
      const existingTime = getLatestTimestamp(existing);
      const quoteTime = getLatestTimestamp(quote);
      quotesMap[quote.id] = quoteTime >= existingTime ? quote : existing;
    }
  }

  return Object.values(quotesMap);
}

/**
 * Write quotes to primary storage key
 */
async function writeQuotes(quotes: Quote[]): Promise<void> {
  const normalized = quotes.map(normalizeQuote);
  await AsyncStorage.setItem(QUOTE_KEYS.PRIMARY, JSON.stringify(normalized));

  // Clean up legacy keys after successful write
  for (const key of QUOTE_KEYS.LEGACY) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      // Don't fail if cleanup fails
      logError(error as Error, `cleanup-${key}`);
    }
  }
}

/**
 * List all quotes, sorted by most recently updated
 * Uses cache with stale-while-revalidate pattern
 */
export async function listQuotes(): Promise<Quote[]> {
  // Check cache first
  const cached = cache.get<Quote[]>(CacheKeys.quotes.all());
  if (cached) {
    // Return cached data immediately, refresh in background if stale
    if (cache.isStale(CacheKeys.quotes.all())) {
      // Background refresh
      withErrorHandling(async () => {
        const quotes = await readAllQuotes();
        const sorted = quotes.sort(
          (a, b) => getLatestTimestamp(b) - getLatestTimestamp(a),
        );
        cache.set(CacheKeys.quotes.all(), sorted);
        return sorted;
      }, ErrorType.STORAGE).catch((error) => {
        logError(error as Error, "listQuotes:background");
      });
    }
    return cached;
  }

  // No cache - fetch and cache
  const result = await withErrorHandling(async () => {
    const quotes = await readAllQuotes();
    return quotes.sort((a, b) => getLatestTimestamp(b) - getLatestTimestamp(a));
  }, ErrorType.STORAGE);

  if (result.success) {
    cache.set(CacheKeys.quotes.all(), result.data);
    return result.data;
  } else {
    logError(result.error, "listQuotes");
    return []; // Return empty array on error
  }
}

/**
 * Get a single quote by ID
 * Uses cache for individual quotes
 */
export async function getQuoteById(id: string): Promise<Quote | null> {
  // Check individual quote cache
  const cacheKey = CacheKeys.quotes.byId(id);
  const cached = cache.get<Quote | null>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Not in cache - fetch from storage
  const result = await withErrorHandling(async () => {
    const quotes = await readAllQuotes();
    const found = quotes.find((q) => q.id === id);
    return found || null;
  }, ErrorType.STORAGE);

  if (result.success) {
    cache.set(cacheKey, result.data);
    return result.data;
  } else {
    logError(result.error, "getQuoteById");
    return null;
  }
}

/**
 * Create a new quote with default values
 */
export async function createQuote(
  name: string = "",
  clientName: string = "",
): Promise<Quote> {
  const nowIso = new Date().toISOString();
  const newQuote: Quote = {
    id: `quote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name,
    clientName,
    items: [],
    labor: 0,
    currency: "USD",
    status: "draft",
    pinned: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const normalized = normalizeQuote(newQuote);
  await saveQuote(normalized);
  return normalized;
}

/**
 * Save (create or update) a quote
 * Automatically recalculates derived fields and updates timestamp
 * Invalidates relevant caches
 */
export async function saveQuote(quote: Quote): Promise<Quote> {
  const result = await withErrorHandling(async () => {
    const allQuotes = await readAllQuotes();
    const index = allQuotes.findIndex((q) => q.id === quote.id);
    const nowIso = new Date().toISOString();

    // Normalize and update timestamp
    const updated: Quote = {
      ...normalizeQuote(quote),
      updatedAt: nowIso,
    };

    // Recalculate derived fields
    updated.materialSubtotal = calculateMaterialSubtotal(updated.items);
    updated.total = updated.materialSubtotal + (updated.labor || 0);

    if (index === -1) {
      // New quote
      allQuotes.push(updated);
    } else {
      // Update existing
      allQuotes[index] = updated;
    }

    await writeQuotes(allQuotes);
    return updated;
  }, ErrorType.STORAGE);

  if (result.success) {
    // Invalidate caches
    cache.invalidate(CacheKeys.quotes.all());
    cache.invalidate(CacheKeys.quotes.byId(result.data.id));
    return result.data;
  } else {
    logError(result.error, "saveQuote");
    throw result.error; // Re-throw to let caller handle
  }
}

/**
 * Update a quote with partial data
 */
export async function updateQuote(
  id: string,
  patch: Partial<Quote>,
): Promise<Quote | null> {
  const current = await getQuoteById(id);
  if (!current) return null;

  const merged: Quote = {
    ...current,
    ...patch,
    id, // Ensure ID doesn't change
  };

  return saveQuote(merged);
}

/**
 * Delete a quote by ID
 * Invalidates relevant caches
 */
export async function deleteQuote(id: string): Promise<void> {
  const result = await withErrorHandling(async () => {
    const allQuotes = await readAllQuotes();
    const filtered = allQuotes.filter((q) => q.id !== id);
    await writeQuotes(filtered);
  }, ErrorType.STORAGE);

  if (!result.success) {
    logError(result.error, "deleteQuote");
    throw result.error;
  }

  // Invalidate caches
  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(id));
}

/**
 * Duplicate a quote
 * Creates a copy with a new ID, appending "Copy" to the name
 */
export async function duplicateQuote(id: string): Promise<Quote | null> {
  const result = await withErrorHandling(async () => {
    const original = await getQuoteById(id);
    if (!original) {
      throw new Error(`Quote ${id} not found`);
    }

    // Create a copy with new ID and updated name
    const now = new Date().toISOString();
    const copy: Quote = {
      ...original,
      id: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: original.name ? `${original.name} (Copy)` : "Untitled (Copy)",
      status: "draft", // Reset to draft
      createdAt: now,
      updatedAt: now,
      pinned: false, // Don't copy pinned status
    };

    // Save the copy
    const allQuotes = await readAllQuotes();
    await writeQuotes([...allQuotes, copy]);

    return copy;
  }, ErrorType.STORAGE);

  if (!result.success) {
    logError(result.error, "duplicateQuote");
    return null;
  }

  // Invalidate cache
  cache.invalidate(CacheKeys.quotes.all());

  return result.data;
}

/**
 * Clear all quotes (use with caution!)
 */
export async function clearAllQuotes(): Promise<void> {
  await AsyncStorage.removeItem(QUOTE_KEYS.PRIMARY);
  for (const key of QUOTE_KEYS.LEGACY) {
    await AsyncStorage.removeItem(key);
  }
}
