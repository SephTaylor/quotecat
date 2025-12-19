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
import { trackEvent, AnalyticsEvents } from "@/lib/app-analytics";
import { incrementQuoteCount, decrementQuoteCount } from "@/lib/user";
// Note: quotesSync is imported dynamically to avoid circular dependency

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
 * Filters out soft-deleted quotes (where deletedAt is set)
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
        const active = quotes.filter((q) => !q.deletedAt);
        const sorted = active.sort(
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
    const active = quotes.filter((q) => !q.deletedAt);
    return active.sort((a, b) => getLatestTimestamp(b) - getLatestTimestamp(a));
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
 * Returns null if quote is deleted or not found
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
    const found = quotes.find((q) => q.id === id && !q.deletedAt);
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

  // Track quote creation analytics
  trackEvent(AnalyticsEvents.QUOTE_CREATED, {
    hasName: Boolean(name),
    hasClient: Boolean(clientName),
  });

  // Increment quote usage counter
  await incrementQuoteCount();

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

    const isNew = index === -1;

    if (isNew) {
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

    // Track quote updates (not creation - that's tracked in createQuote)
    // If createdAt and updatedAt are different, it's an update
    if (result.data.createdAt !== result.data.updatedAt) {
      trackEvent(AnalyticsEvents.QUOTE_UPDATED, {
        itemCount: result.data.items.length,
        hasLabor: Boolean(result.data.labor),
        total: result.data.total,
      });
    }

    // Auto-sync to cloud for Pro/Premium users (non-blocking, dynamic import to avoid circular dependency)
    import("@/lib/quotesSync").then(({ isSyncAvailable, uploadQuote }) => {
      isSyncAvailable().then((available) => {
        if (available) {
          uploadQuote(result.data).catch((error) => {
            console.warn("Background cloud sync failed:", error);
          });
        }
      });
    });

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
 * Delete a quote by ID (soft delete - sets deletedAt timestamp)
 * Invalidates relevant caches
 */
export async function deleteQuote(id: string): Promise<void> {
  const result = await withErrorHandling(async () => {
    const allQuotes = await readAllQuotes();
    const quote = allQuotes.find((q) => q.id === id);

    if (!quote) {
      throw new Error(`Quote ${id} not found`);
    }

    // Soft delete: set deletedAt timestamp
    quote.deletedAt = new Date().toISOString();
    quote.updatedAt = quote.deletedAt;

    // Write back all quotes (including soft-deleted one)
    await writeQuotes(allQuotes);
  }, ErrorType.STORAGE);

  if (!result.success) {
    logError(result.error, "deleteQuote");
    throw result.error;
  }

  // Track quote deletion analytics
  trackEvent(AnalyticsEvents.QUOTE_DELETED);

  // Decrement quote usage counter
  await decrementQuoteCount();

  // Delete from cloud for Pro/Premium users (non-blocking, dynamic import to avoid circular dependency)
  import("@/lib/quotesSync").then(({ isSyncAvailable, deleteQuoteFromCloud }) => {
    isSyncAvailable().then((available) => {
      if (available) {
        deleteQuoteFromCloud(id).catch((error) => {
          console.warn("Background cloud deletion failed:", error);
        });
      }
    });
  });

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

    // Track quote duplication analytics
    trackEvent(AnalyticsEvents.QUOTE_DUPLICATED, {
      originalItemCount: original.items.length,
      originalTotal: original.total,
    });

    // Increment quote usage counter (duplicating creates a new quote)
    await incrementQuoteCount();

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

// ============================================
// Linked Quotes (Multi-Tier/Good-Better-Best)
// ============================================

/**
 * Link multiple quotes together as tiers/options
 * Each quote will have references to all other quotes in the group
 */
export async function linkQuotes(quoteIds: string[]): Promise<void> {
  if (quoteIds.length < 2) {
    throw new Error("Need at least 2 quotes to link");
  }

  const result = await withErrorHandling(async () => {
    const allQuotes = await readAllQuotes();

    // Verify all quotes exist
    const quotesToLink = allQuotes.filter((q) => quoteIds.includes(q.id) && !q.deletedAt);
    if (quotesToLink.length !== quoteIds.length) {
      throw new Error("One or more quotes not found");
    }

    // For each quote, add references to all OTHER quotes in the group
    for (const quote of quotesToLink) {
      const otherIds = quoteIds.filter((id) => id !== quote.id);
      // Merge with any existing linked quotes (avoid duplicates)
      const existingLinks = quote.linkedQuoteIds || [];
      const allLinks = [...new Set([...existingLinks, ...otherIds])];
      quote.linkedQuoteIds = allLinks;
      quote.updatedAt = new Date().toISOString();
    }

    await writeQuotes(allQuotes);
  }, ErrorType.STORAGE);

  if (!result.success) {
    logError(result.error, "linkQuotes");
    throw result.error;
  }

  // Invalidate caches for all linked quotes
  cache.invalidate(CacheKeys.quotes.all());
  for (const id of quoteIds) {
    cache.invalidate(CacheKeys.quotes.byId(id));
  }
}

/**
 * Unlink a quote from its linked group
 * Removes this quote's reference from all linked quotes and clears its linkedQuoteIds
 */
export async function unlinkQuote(quoteId: string): Promise<void> {
  const result = await withErrorHandling(async () => {
    const allQuotes = await readAllQuotes();
    const quote = allQuotes.find((q) => q.id === quoteId && !q.deletedAt);

    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    const linkedIds = quote.linkedQuoteIds || [];

    // Remove this quote's ID from all linked quotes
    for (const linkedId of linkedIds) {
      const linkedQuote = allQuotes.find((q) => q.id === linkedId);
      if (linkedQuote && linkedQuote.linkedQuoteIds) {
        linkedQuote.linkedQuoteIds = linkedQuote.linkedQuoteIds.filter((id) => id !== quoteId);
        // If only one quote remains linked, clear its links too (can't have a group of 1)
        if (linkedQuote.linkedQuoteIds.length === 0) {
          delete linkedQuote.linkedQuoteIds;
        }
        linkedQuote.updatedAt = new Date().toISOString();
      }
    }

    // Clear this quote's links
    delete quote.linkedQuoteIds;
    quote.updatedAt = new Date().toISOString();

    await writeQuotes(allQuotes);
    return linkedIds;
  }, ErrorType.STORAGE);

  if (!result.success) {
    logError(result.error, "unlinkQuote");
    throw result.error;
  }

  // Invalidate caches
  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(quoteId));
  if (result.data) {
    for (const id of result.data) {
      cache.invalidate(CacheKeys.quotes.byId(id));
    }
  }
}

/**
 * Get all quotes linked to a given quote (including the original)
 * Returns quotes sorted by tier name or creation date
 */
export async function getLinkedQuotes(quoteId: string): Promise<Quote[]> {
  const quote = await getQuoteById(quoteId);
  if (!quote) return [];

  const linkedIds = quote.linkedQuoteIds || [];
  if (linkedIds.length === 0) return [quote]; // Just the original if no links

  // Get all linked quotes
  const allIds = [quoteId, ...linkedIds];
  const quotes: Quote[] = [];

  for (const id of allIds) {
    const q = await getQuoteById(id);
    if (q) quotes.push(q);
  }

  // Sort by tier name if present, otherwise by creation date
  return quotes.sort((a, b) => {
    // If both have tier names, sort alphabetically
    if (a.tier && b.tier) {
      return a.tier.localeCompare(b.tier);
    }
    // Quotes with tier names come first
    if (a.tier) return -1;
    if (b.tier) return 1;
    // Otherwise sort by creation date
    return getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
  });
}

/**
 * Create a new tier by duplicating an existing quote and linking them
 * @param sourceQuoteId - The quote to duplicate
 * @param tierName - Name for the new tier (e.g., "Better", "Best", "With Generator")
 * @returns The newly created quote
 */
export async function createTierFromQuote(
  sourceQuoteId: string,
  tierName: string
): Promise<Quote | null> {
  const result = await withErrorHandling(async () => {
    const original = await getQuoteById(sourceQuoteId);
    if (!original) {
      throw new Error(`Quote ${sourceQuoteId} not found`);
    }

    // Create a copy with new ID
    const now = new Date().toISOString();
    const newQuote: Quote = {
      ...original,
      id: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: original.name, // Keep same job name
      tier: tierName, // Set the tier name
      status: "draft", // Reset to draft
      createdAt: now,
      updatedAt: now,
      pinned: false,
      // Start with link to original
      linkedQuoteIds: [sourceQuoteId],
    };

    // If original doesn't have a tier name, set a default
    if (!original.tier) {
      original.tier = "Base";
      original.updatedAt = now;
    }

    // Add new quote ID to original's links
    const originalLinks = original.linkedQuoteIds || [];
    original.linkedQuoteIds = [...originalLinks, newQuote.id];

    // Also link new quote to all of original's existing linked quotes
    if (originalLinks.length > 0) {
      newQuote.linkedQuoteIds = [sourceQuoteId, ...originalLinks];

      // And add new quote to each of those linked quotes
      const allQuotes = await readAllQuotes();
      for (const linkedId of originalLinks) {
        const linkedQuote = allQuotes.find((q) => q.id === linkedId);
        if (linkedQuote) {
          linkedQuote.linkedQuoteIds = [...(linkedQuote.linkedQuoteIds || []), newQuote.id];
          linkedQuote.updatedAt = now;
        }
      }

      // Find and update original in allQuotes
      const origIndex = allQuotes.findIndex((q) => q.id === sourceQuoteId);
      if (origIndex !== -1) {
        allQuotes[origIndex] = original;
      }

      // Add new quote
      allQuotes.push(newQuote);
      await writeQuotes(allQuotes);
    } else {
      // Simple case: just original and new quote
      const allQuotes = await readAllQuotes();
      const origIndex = allQuotes.findIndex((q) => q.id === sourceQuoteId);
      if (origIndex !== -1) {
        allQuotes[origIndex] = original;
      }
      allQuotes.push(newQuote);
      await writeQuotes(allQuotes);
    }

    // Track analytics
    trackEvent(AnalyticsEvents.QUOTE_DUPLICATED, {
      originalItemCount: original.items.length,
      originalTotal: original.total,
      tierName,
    });

    // Increment quote count
    await incrementQuoteCount();

    return newQuote;
  }, ErrorType.STORAGE);

  if (!result.success) {
    logError(result.error, "createTierFromQuote");
    return null;
  }

  // Invalidate caches
  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(sourceQuoteId));

  return result.data;
}
