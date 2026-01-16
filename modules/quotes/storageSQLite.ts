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
 * Uses STAR TOPOLOGY: Base has links to children, children only link to base
 */
export async function unlinkQuote(quoteId: string): Promise<void> {
  const quote = getQuoteByIdDB(quoteId);
  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  const linkedIds = quote.linkedQuoteIds || [];
  const now = new Date().toISOString();

  // STAR TOPOLOGY: Determine if this is the base or a child
  const isBase = quote.tier === "Base";

  if (isBase) {
    // Unlinking the base: all children become standalone quotes
    for (const childId of linkedIds) {
      const childQuote = getQuoteByIdDB(childId);
      if (childQuote) {
        saveQuoteDB({
          ...childQuote,
          linkedQuoteIds: undefined,
          tier: undefined,
          updatedAt: now,
        });
        cache.invalidate(CacheKeys.quotes.byId(childId));
      }
    }

    // Clear the base's links and tier
    saveQuoteDB({
      ...quote,
      linkedQuoteIds: undefined,
      tier: undefined,
      updatedAt: now,
    });
  } else {
    // Unlinking a child: remove from base's linkedQuoteIds
    // In star topology, a child's linkedQuoteIds[0] is the base
    const baseId = linkedIds[0];
    const baseQuote = getQuoteByIdDB(baseId);

    if (baseQuote && baseQuote.linkedQuoteIds) {
      const updatedBaseLinks = baseQuote.linkedQuoteIds.filter((id) => id !== quoteId);

      // If no children remain, clear base's tier info too
      if (updatedBaseLinks.length === 0) {
        saveQuoteDB({
          ...baseQuote,
          linkedQuoteIds: undefined,
          tier: undefined,
          updatedAt: now,
        });
      } else {
        saveQuoteDB({
          ...baseQuote,
          linkedQuoteIds: updatedBaseLinks,
          updatedAt: now,
        });
      }
      cache.invalidate(CacheKeys.quotes.byId(baseId));
    }

    // Clear this child's links and tier
    saveQuoteDB({
      ...quote,
      linkedQuoteIds: undefined,
      tier: undefined,
      updatedAt: now,
    });
  }

  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(quoteId));
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

  // Sort by price (low to high) - matches portal behavior
  return quotes.sort((a, b) => {
    return (a.total || 0) - (b.total || 0);
  });
}

/**
 * Create a new tier by duplicating an existing quote and linking them
 * Uses STAR TOPOLOGY: Base quote links to all children, children only link to base
 */
export async function createTierFromQuote(
  sourceQuoteId: string,
  tierName: string
): Promise<Quote | null> {
  const source = getQuoteByIdDB(sourceQuoteId);
  if (!source) {
    throw new Error(`Quote ${sourceQuoteId} not found`);
  }

  const now = new Date().toISOString();
  const quoteNumber = await generateQuoteNumber();

  // STAR TOPOLOGY: Find the base quote
  // If source has no links or is the base, it becomes/stays the base
  // If source is a child, find the actual base
  let baseQuote = source;
  let baseQuoteId = source.id;

  if (source.linkedQuoteIds && source.linkedQuoteIds.length > 0 && source.tier !== "Base") {
    // Source is a child - find the base (first entry in linkedQuoteIds for star topology)
    const potentialBaseId = source.linkedQuoteIds[0];
    const potentialBase = getQuoteByIdDB(potentialBaseId);
    if (potentialBase) {
      baseQuote = potentialBase;
      baseQuoteId = potentialBase.id;
    }
  }

  const newQuote: Quote = {
    ...source, // Copy from source (what user clicked on) for items/pricing
    id: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    quoteNumber,
    name: baseQuote.name, // Use base's project name
    tier: tierName,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    pinned: false,
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

  saveQuoteDB(baseQuote);
  saveQuoteDB(newQuote);

  trackEvent(AnalyticsEvents.QUOTE_DUPLICATED, {
    originalItemCount: source.items.length,
    originalTotal: source.total,
    tierName,
  });

  await incrementQuoteCount();

  cache.invalidate(CacheKeys.quotes.all());
  cache.invalidate(CacheKeys.quotes.byId(sourceQuoteId));
  cache.invalidate(CacheKeys.quotes.byId(baseQuoteId));

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
