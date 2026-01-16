// modules/quotes/storage.ts
// Consolidated quote storage layer with legacy migration support

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Quote } from "@/lib/types";
import { normalizeQuote, calculateMaterialSubtotal } from "@/lib/validation";
import { calculateQuoteTotal } from "@/lib/calculations";
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
import { loadPreferences, updateQuoteSettings } from "@/lib/preferences";
import { safeRead, clearCorruptData } from "@/lib/safeStorage";
// Note: quotesSync is imported dynamically to avoid circular dependency

// Flag to track if we've detected corruption this session
let corruptionDetectedThisSession = false;

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
 * Stable sort comparator - sorts by timestamp descending, then by id for determinism
 */
function stableSort(a: Quote, b: Quote): number {
  const timeDiff = getLatestTimestamp(b) - getLatestTimestamp(a);
  if (timeDiff !== 0) return timeDiff;
  return a.id.localeCompare(b.id);
}

/**
 * Read quotes from all storage keys (primary + legacy)
 * De-duplicates by ID, keeping the most recently updated version
 * Uses safe reads to detect and recover from corruption
 */
async function readAllQuotes(): Promise<Quote[]> {
  const allKeys = [QUOTE_KEYS.PRIMARY, ...QUOTE_KEYS.LEGACY];
  const allQuotes: Quote[] = [];
  let hadCorruption = false;

  // Read from each key with corruption detection
  for (const key of allKeys) {
    try {
      const result = await safeRead<Quote[]>(key);

      if (result.wasCorrupt) {
        hadCorruption = true;
        console.error(`🚨 Corrupt data detected in ${key}, clearing...`);
        await clearCorruptData(key);
        continue; // Skip this corrupt data
      }

      if (result.data && Array.isArray(result.data)) {
        // Normalize each quote safely
        for (const rawQuote of result.data) {
          try {
            allQuotes.push(normalizeQuote(rawQuote));
          } catch (e) {
            console.warn(`Skipping invalid quote:`, e);
            // Continue with other quotes
          }
        }
      }
    } catch (e) {
      console.error(`Error reading ${key}:`, e);
      // Clear the corrupt key
      await clearCorruptData(key);
      hadCorruption = true;
    }
  }

  // If we had corruption, flag it for potential cloud recovery
  if (hadCorruption && !corruptionDetectedThisSession) {
    corruptionDetectedThisSession = true;
    console.warn("📡 Local data was corrupt. Will rebuild from cloud on next sync.");
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
 * Check if corruption was detected this session
 * Used by sync to know if it should do a full rebuild
 */
export function wasCorruptionDetected(): boolean {
  return corruptionDetectedThisSession;
}

/**
 * Reset the corruption flag (after successful sync)
 */
export function clearCorruptionFlag(): void {
  corruptionDetectedThisSession = false;
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
        const sorted = active.sort(stableSort);
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
    return active.sort(stableSort);
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
  if (cached !== undefined) {
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
 * Generate next quote number using user preferences
 * Format: PREFIX-### (e.g., Q-001, EST-042, etc.)
 */
async function generateQuoteNumber(): Promise<string> {
  const prefs = await loadPreferences();
  const { prefix, nextNumber } = prefs.quote;

  // Increment the next number in preferences
  await updateQuoteSettings({ nextNumber: nextNumber + 1 });

  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

/**
 * Create a new quote with default values
 */
export async function createQuote(
  name: string = "",
  clientName: string = "",
): Promise<Quote> {
  const nowIso = new Date().toISOString();
  const quoteNumber = await generateQuoteNumber();

  const newQuote: Quote = {
    id: `quote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    quoteNumber,
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
 * Save a quote locally WITHOUT triggering cloud upload
 * Used during sync to prevent sync loops
 * @internal - Use saveQuote() for normal user operations
 */
export async function saveQuoteLocally(quote: Quote): Promise<Quote> {
  const result = await withErrorHandling(async () => {
    const allQuotes = await readAllQuotes();
    const index = allQuotes.findIndex((q) => q.id === quote.id);

    // Normalize but preserve the existing updatedAt from cloud
    const updated: Quote = {
      ...normalizeQuote(quote),
      updatedAt: quote.updatedAt || new Date().toISOString(),
    };

    // Recalculate derived fields
    updated.materialSubtotal = calculateMaterialSubtotal(updated.items);
    updated.total = calculateQuoteTotal(updated);

    if (index === -1) {
      allQuotes.push(updated);
    } else {
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
    logError(result.error, "saveQuoteLocally");
    throw result.error;
  }
}

/**
 * Batch save multiple quotes locally WITHOUT triggering cloud upload
 * Much more efficient than calling saveQuoteLocally multiple times
 * Reads storage once, merges all quotes, writes once
 * @internal - Used by sync for efficient batch operations
 */
export async function saveQuotesBatch(quotes: Quote[]): Promise<void> {
  if (quotes.length === 0) return;

  const result = await withErrorHandling(async () => {
    // Read all quotes ONCE
    const allQuotes = await readAllQuotes();
    const quotesMap = new Map(allQuotes.map((q) => [q.id, q]));

    // Merge all incoming quotes
    for (const quote of quotes) {
      const updated: Quote = {
        ...normalizeQuote(quote),
        updatedAt: quote.updatedAt || new Date().toISOString(),
      };

      // Recalculate derived fields
      updated.materialSubtotal = calculateMaterialSubtotal(updated.items);
      updated.total = updated.materialSubtotal + (updated.labor || 0);

      quotesMap.set(quote.id, updated);
    }

    // Write ALL quotes ONCE
    await writeQuotes(Array.from(quotesMap.values()));
  }, ErrorType.STORAGE);

  if (result.success) {
    // Invalidate caches once
    cache.invalidate(CacheKeys.quotes.all());
    for (const quote of quotes) {
      cache.invalidate(CacheKeys.quotes.byId(quote.id));
    }
  } else {
    logError(result.error, "saveQuotesBatch");
    throw result.error;
  }
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
    updated.total = calculateQuoteTotal(updated);

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
 * Update a quote locally WITHOUT triggering cloud upload
 * Used during sync to prevent sync loops
 * @internal - Use updateQuote() for normal user operations
 */
export async function updateQuoteLocally(
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

  return saveQuoteLocally(merged);
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
    const quoteNumber = await generateQuoteNumber();
    const copy: Quote = {
      ...original,
      id: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      quoteNumber, // New quote number
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
 * Uses STAR TOPOLOGY: Base has links to children, children only link to base
 */
export async function unlinkQuote(quoteId: string): Promise<void> {
  const result = await withErrorHandling(async () => {
    const allQuotes = await readAllQuotes();
    const quote = allQuotes.find((q) => q.id === quoteId && !q.deletedAt);

    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    const linkedIds = quote.linkedQuoteIds || [];
    const now = new Date().toISOString();
    const affectedIds: string[] = [];

    // STAR TOPOLOGY: Determine if this is the base or a child
    const isBase = quote.tier === "Base";

    if (isBase) {
      // Unlinking the base: all children become standalone quotes
      for (const childId of linkedIds) {
        const childQuote = allQuotes.find((q) => q.id === childId);
        if (childQuote) {
          delete childQuote.linkedQuoteIds;
          delete childQuote.tier;
          childQuote.updatedAt = now;
          affectedIds.push(childId);
        }
      }

      // Clear the base's links and tier
      delete quote.linkedQuoteIds;
      delete quote.tier;
      quote.updatedAt = now;
    } else {
      // Unlinking a child: remove from base's linkedQuoteIds
      // In star topology, a child's linkedQuoteIds[0] is the base
      const baseId = linkedIds[0];
      const baseQuote = allQuotes.find((q) => q.id === baseId);

      if (baseQuote && baseQuote.linkedQuoteIds) {
        baseQuote.linkedQuoteIds = baseQuote.linkedQuoteIds.filter((id) => id !== quoteId);

        // If no children remain, clear base's tier info too
        if (baseQuote.linkedQuoteIds.length === 0) {
          delete baseQuote.linkedQuoteIds;
          delete baseQuote.tier;
        }
        baseQuote.updatedAt = now;
        affectedIds.push(baseId);
      }

      // Clear this child's links and tier
      delete quote.linkedQuoteIds;
      delete quote.tier;
      quote.updatedAt = now;
    }

    await writeQuotes(allQuotes);
    return affectedIds;
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
 * Optimized to read all quotes once instead of N+1 queries
 */
export async function getLinkedQuotes(quoteId: string): Promise<Quote[]> {
  // Get all quotes in a single read
  const allQuotes = await listQuotes();

  // Find the target quote
  const quote = allQuotes.find((q) => q.id === quoteId);
  if (!quote) return [];

  const linkedIds = quote.linkedQuoteIds || [];
  if (linkedIds.length === 0) return [quote]; // Just the original if no links

  // Create a Set for O(1) lookup
  const allIds = new Set([quoteId, ...linkedIds]);

  // Filter quotes by IDs (single pass through array)
  const quotes = allQuotes.filter((q) => allIds.has(q.id));

  // Sort by price (low to high) - matches portal behavior
  return quotes.sort((a, b) => {
    return (a.total || 0) - (b.total || 0);
  });
}

/**
 * Create a new tier by duplicating an existing quote and linking them
 * Uses STAR TOPOLOGY: Base quote links to all children, children only link to base
 * @param sourceQuoteId - The quote to duplicate
 * @param tierName - Name for the new tier (e.g., "Better", "Best", "With Generator")
 * @returns The newly created quote
 */
export async function createTierFromQuote(
  sourceQuoteId: string,
  tierName: string
): Promise<Quote | null> {
  const result = await withErrorHandling(async () => {
    const source = await getQuoteById(sourceQuoteId);
    if (!source) {
      throw new Error(`Quote ${sourceQuoteId} not found`);
    }

    const now = new Date().toISOString();
    const quoteNumber = await generateQuoteNumber();
    const allQuotes = await readAllQuotes();

    // STAR TOPOLOGY: Find the base quote
    // If source has no links or is the base, it becomes/stays the base
    // If source is a child, find the actual base
    let baseQuote = source;
    let baseQuoteId = source.id;

    if (source.linkedQuoteIds && source.linkedQuoteIds.length > 0 && source.tier !== "Base") {
      // Source is a child - find the base (first entry in linkedQuoteIds for star topology)
      const potentialBaseId = source.linkedQuoteIds[0];
      const potentialBase = allQuotes.find((q) => q.id === potentialBaseId && !q.deletedAt);
      if (potentialBase) {
        baseQuote = potentialBase;
        baseQuoteId = potentialBase.id;
      }
    }

    // Create a copy with new ID - copy items from source (what user clicked on)
    const newQuote: Quote = {
      ...source,
      id: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      quoteNumber,
      name: baseQuote.name, // Use base's project name
      tier: tierName,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      pinned: false,
      notes: null, // Don't copy notes - each tier typically has different scope
      linkedQuoteIds: [baseQuoteId], // Star topology: only link to base
    };

    // Set base's tier if not already set
    if (!baseQuote.tier) {
      baseQuote.tier = "Base";
    }

    // Add new quote ID to base's links only
    const baseLinks = baseQuote.linkedQuoteIds || [];
    baseQuote.linkedQuoteIds = [...baseLinks, newQuote.id];
    baseQuote.updatedAt = now;

    // In star topology, we don't update other children - they only link to base

    // Update base in allQuotes
    const baseIndex = allQuotes.findIndex((q) => q.id === baseQuoteId);
    if (baseIndex !== -1) {
      allQuotes[baseIndex] = baseQuote;
    }

    // Add new quote
    allQuotes.push(newQuote);
    await writeQuotes(allQuotes);

    // Track analytics
    trackEvent(AnalyticsEvents.QUOTE_DUPLICATED, {
      originalItemCount: source.items.length,
      originalTotal: source.total,
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
