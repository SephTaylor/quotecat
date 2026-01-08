// modules/quotes/storageSQLite.ts
// SQLite-based quote storage - replaces AsyncStorage implementation
// This file has the same API as storage.ts but uses SQLite for efficiency

import type { Quote } from "@/lib/types";
import { normalizeQuote, calculateMaterialSubtotal } from "@/lib/validation";
import {
  listQuotesDB,
  getQuoteByIdDB,
  saveQuoteDB,
  saveQuotesBatchDB,
  deleteQuoteDB,
  getQuoteCountDB,
} from "@/lib/database";
import { cache, CacheKeys } from "@/lib/cache";
import { trackEvent, AnalyticsEvents } from "@/lib/app-analytics";
import { incrementQuoteCount, decrementQuoteCount } from "@/lib/user";
import { loadPreferences, updateQuoteSettings } from "@/lib/preferences";

/**
 * Safe timestamp extractor
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
 * List all quotes, sorted by most recently updated
 * Filters out soft-deleted quotes (where deletedAt is set)
 * Uses in-memory cache for fast repeated access
 */
export async function listQuotes(options?: { skipCache?: boolean }): Promise<Quote[]> {
  // Check cache first (unless skipCache is true)
  if (!options?.skipCache) {
    const cached = cache.get<Quote[]>(CacheKeys.quotes.all());
    if (cached) {
      return cached;
    }
  }

  // Fetch from SQLite - this is FAST because it doesn't load all into memory
  const quotes = listQuotesDB({ limit: 1000 }); // Reasonable limit

  // Calculate derived fields
  const processed = quotes.map((quote) => ({
    ...quote,
    materialSubtotal: calculateMaterialSubtotal(quote.items),
    total: calculateMaterialSubtotal(quote.items) + (quote.labor || 0),
  }));

  // Sort by most recent (stable sort using id as tiebreaker)
  const sorted = processed.sort(stableSort);

  cache.set(CacheKeys.quotes.all(), sorted);
  return sorted;
}

/**
 * Get a single quote by ID
 */
export async function getQuoteById(id: string): Promise<Quote | null> {
  // Check cache first
  const cacheKey = CacheKeys.quotes.byId(id);
  const cached = cache.get<Quote | null>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const quote = getQuoteByIdDB(id);

  if (quote && !quote.deletedAt) {
    // Calculate derived fields
    const processed = {
      ...quote,
      materialSubtotal: calculateMaterialSubtotal(quote.items),
      total: calculateMaterialSubtotal(quote.items) + (quote.labor || 0),
    };
    cache.set(cacheKey, processed);
    return processed;
  }

  cache.set(cacheKey, null);
  return null;
}

/**
 * Generate next quote number using user preferences
 */
async function generateQuoteNumber(): Promise<string> {
  const prefs = await loadPreferences();
  const { prefix, nextNumber } = prefs.quote;
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

  trackEvent(AnalyticsEvents.QUOTE_CREATED, {
    hasName: Boolean(name),
    hasClient: Boolean(clientName),
  });

  await incrementQuoteCount();

  return normalized;
}

/**
 * Save a quote locally WITHOUT triggering cloud upload
 * Used during sync to prevent sync loops
 */
export async function saveQuoteLocally(quote: Quote): Promise<Quote> {
  const updated: Quote = {
    ...normalizeQuote(quote),
    updatedAt: quote.updatedAt || new Date().toISOString(),
    materialSubtotal: calculateMaterialSubtotal(quote.items),
    total: calculateMaterialSubtotal(quote.items) + (quote.labor || 0),
  };

  saveQuoteDB(updated);

  // Invalidate caches
  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(updated.id));

  return updated;
}

/**
 * Batch save multiple quotes locally WITHOUT triggering cloud upload
 * Much more efficient than individual saves
 */
export async function saveQuotesBatch(quotes: Quote[]): Promise<void> {
  if (quotes.length === 0) return;

  const normalized = quotes.map((quote) => ({
    ...normalizeQuote(quote),
    updatedAt: quote.updatedAt || new Date().toISOString(),
    materialSubtotal: calculateMaterialSubtotal(quote.items),
    total: calculateMaterialSubtotal(quote.items) + (quote.labor || 0),
  }));

  saveQuotesBatchDB(normalized);

  // Invalidate caches once
  cache.invalidate(CacheKeys.quotes.all());
  for (const quote of quotes) {
    cache.invalidate(CacheKeys.quotes.byId(quote.id));
  }
}

/**
 * Save (create or update) a quote
 * Triggers cloud upload for Pro/Premium users
 */
export async function saveQuote(quote: Quote): Promise<Quote> {
  const nowIso = new Date().toISOString();
  const isNew = !getQuoteByIdDB(quote.id);

  const updated: Quote = {
    ...normalizeQuote(quote),
    updatedAt: nowIso,
    materialSubtotal: calculateMaterialSubtotal(quote.items),
    total: calculateMaterialSubtotal(quote.items) + (quote.labor || 0),
  };

  saveQuoteDB(updated);

  // Invalidate caches
  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(updated.id));

  // Track analytics (not for new quotes - that's tracked in createQuote)
  if (!isNew) {
    trackEvent(AnalyticsEvents.QUOTE_UPDATED, {
      itemCount: updated.items.length,
      hasLabor: Boolean(updated.labor),
      total: updated.total,
    });
  }

  // Auto-sync to cloud for Pro/Premium users (non-blocking)
  import("@/lib/quotesSync").then(({ isSyncAvailable, uploadQuote }) => {
    isSyncAvailable().then((available) => {
      if (available) {
        uploadQuote(updated).catch((error) => {
          console.warn("Background cloud sync failed:", error);
        });
      }
    });
  });

  return updated;
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
    id,
  };

  return saveQuoteLocally(merged);
}

/**
 * Delete a quote by ID (soft delete)
 */
export async function deleteQuote(id: string): Promise<void> {
  deleteQuoteDB(id);

  trackEvent(AnalyticsEvents.QUOTE_DELETED);
  await decrementQuoteCount();

  // Delete from cloud for Pro/Premium users
  import("@/lib/quotesSync").then(({ isSyncAvailable, deleteQuoteFromCloud }) => {
    isSyncAvailable().then((available) => {
      if (available) {
        deleteQuoteFromCloud(id).catch((error) => {
          console.warn("Background cloud deletion failed:", error);
        });
      }
    });
  });

  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(id));
}

/**
 * Duplicate a quote
 */
export async function duplicateQuote(id: string): Promise<Quote | null> {
  const original = await getQuoteById(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const quoteNumber = await generateQuoteNumber();

  const copy: Quote = {
    ...original,
    id: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    quoteNumber,
    name: original.name ? `${original.name} (Copy)` : "Untitled (Copy)",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    pinned: false,
  };

  saveQuoteDB(copy);

  trackEvent(AnalyticsEvents.QUOTE_DUPLICATED, {
    originalItemCount: original.items.length,
    originalTotal: original.total,
  });

  await incrementQuoteCount();

  cache.invalidate(CacheKeys.quotes.all());

  return copy;
}

/**
 * Get total quote count
 */
export function getQuoteCount(): number {
  return getQuoteCountDB(false);
}

// ============================================
// Linked Quotes (Multi-Tier/Good-Better-Best)
// ============================================

/**
 * Link multiple quotes together as tiers/options
 */
export async function linkQuotes(quoteIds: string[]): Promise<void> {
  if (quoteIds.length < 2) {
    throw new Error("Need at least 2 quotes to link");
  }

  const quotes = quoteIds.map((id) => getQuoteByIdDB(id)).filter(Boolean) as Quote[];
  if (quotes.length !== quoteIds.length) {
    throw new Error("One or more quotes not found");
  }

  const now = new Date().toISOString();

  for (const quote of quotes) {
    const otherIds = quoteIds.filter((id) => id !== quote.id);
    const existingLinks = quote.linkedQuoteIds || [];
    const allLinks = [...new Set([...existingLinks, ...otherIds])];

    saveQuoteDB({
      ...quote,
      linkedQuoteIds: allLinks,
      updatedAt: now,
    });
  }

  cache.invalidate(CacheKeys.quotes.all());
  for (const id of quoteIds) {
    cache.invalidate(CacheKeys.quotes.byId(id));
  }
}

/**
 * Unlink a quote from its linked group
 */
export async function unlinkQuote(quoteId: string): Promise<void> {
  const quote = getQuoteByIdDB(quoteId);
  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  const linkedIds = quote.linkedQuoteIds || [];
  const now = new Date().toISOString();

  // Remove this quote's ID from all linked quotes
  for (const linkedId of linkedIds) {
    const linkedQuote = getQuoteByIdDB(linkedId);
    if (linkedQuote && linkedQuote.linkedQuoteIds) {
      const newLinks = linkedQuote.linkedQuoteIds.filter((id) => id !== quoteId);
      saveQuoteDB({
        ...linkedQuote,
        linkedQuoteIds: newLinks.length > 0 ? newLinks : undefined,
        updatedAt: now,
      });
    }
  }

  // Clear this quote's links
  saveQuoteDB({
    ...quote,
    linkedQuoteIds: undefined,
    updatedAt: now,
  });

  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(quoteId));
  for (const id of linkedIds) {
    cache.invalidate(CacheKeys.quotes.byId(id));
  }
}

/**
 * Get all quotes linked to a given quote
 */
export async function getLinkedQuotes(quoteId: string): Promise<Quote[]> {
  const quote = await getQuoteById(quoteId);
  if (!quote) return [];

  const linkedIds = quote.linkedQuoteIds || [];
  if (linkedIds.length === 0) return [quote];

  const allIds = new Set([quoteId, ...linkedIds]);
  const quotes = Array.from(allIds)
    .map((id) => getQuoteByIdDB(id))
    .filter(Boolean) as Quote[];

  return quotes.sort((a, b) => {
    if (a.tier && b.tier) return a.tier.localeCompare(b.tier);
    if (a.tier) return -1;
    if (b.tier) return 1;
    return getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
  });
}

/**
 * Create a new tier by duplicating an existing quote and linking them
 */
export async function createTierFromQuote(
  sourceQuoteId: string,
  tierName: string
): Promise<Quote | null> {
  const original = getQuoteByIdDB(sourceQuoteId);
  if (!original) {
    throw new Error(`Quote ${sourceQuoteId} not found`);
  }

  const now = new Date().toISOString();
  const quoteNumber = await generateQuoteNumber();

  const newQuote: Quote = {
    ...original,
    id: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    quoteNumber,
    name: original.name,
    tier: tierName,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    pinned: false,
    linkedQuoteIds: [sourceQuoteId],
  };

  // Set original's tier if not already set
  if (!original.tier) {
    original.tier = "Base";
    original.updatedAt = now;
  }

  // Add new quote ID to original's links
  const originalLinks = original.linkedQuoteIds || [];
  original.linkedQuoteIds = [...originalLinks, newQuote.id];

  // Link to all existing linked quotes
  if (originalLinks.length > 0) {
    newQuote.linkedQuoteIds = [sourceQuoteId, ...originalLinks];

    for (const linkedId of originalLinks) {
      const linkedQuote = getQuoteByIdDB(linkedId);
      if (linkedQuote) {
        linkedQuote.linkedQuoteIds = [...(linkedQuote.linkedQuoteIds || []), newQuote.id];
        linkedQuote.updatedAt = now;
        saveQuoteDB(linkedQuote);
      }
    }
  }

  saveQuoteDB(original);
  saveQuoteDB(newQuote);

  trackEvent(AnalyticsEvents.QUOTE_DUPLICATED, {
    originalItemCount: original.items.length,
    originalTotal: original.total,
    tierName,
  });

  await incrementQuoteCount();

  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(sourceQuoteId));

  return newQuote;
}

// Compatibility exports
export function wasCorruptionDetected(): boolean {
  return false; // SQLite doesn't have the same corruption issues
}

export function clearCorruptionFlag(): void {
  // No-op for SQLite
}

export async function clearAllQuotes(): Promise<void> {
  // Import clearAllDataDB if needed
  const { clearAllDataDB } = await import("@/lib/database");
  clearAllDataDB();
}
