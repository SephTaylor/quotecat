// lib/pricebookMatching.ts
// Smart matching of shared assembly items to user's pricebook

import type { PricebookItem, SharedAssemblyItem, ItemMatchResult } from "./types";
import { getPricebookItems } from "./pricebook";

// Thresholds for match confidence
const EXACT_MATCH_THRESHOLD = 95;
const HIGH_CONFIDENCE_THRESHOLD = 80;
const FUZZY_THRESHOLD = 70; // Raised from 50 - require stronger word overlap

// =============================================================================
// MAIN MATCHING FUNCTION
// =============================================================================

/**
 * Match shared assembly items against user's pricebook
 * Returns match results for each item with suggestions
 *
 * TODO: Performance optimization for large pricebooks (1000+ items)
 * - Consider caching normalized pricebook in memory with TTL
 * - Could index by first word/trigrams for faster fuzzy lookup
 * - Current O(n*m) is fine for typical pricebooks (<500 items)
 */
export async function matchItemsToPricebook(
  sharedItems: SharedAssemblyItem[]
): Promise<ItemMatchResult[]> {
  // Load all pricebook items once
  const pricebookItems = await getPricebookItems();

  // Pre-compute normalized names for faster matching
  const normalizedPricebook = pricebookItems.map((item) => ({
    item,
    normalizedName: normalizeName(item.name),
    normalizedSku: item.sku ? item.sku.toLowerCase().trim() : null,
  }));

  // Match each shared item
  const results: ItemMatchResult[] = [];

  for (const sharedItem of sharedItems) {
    const result = matchSingleItem(sharedItem, normalizedPricebook);
    results.push(result);
  }

  return results;
}

/**
 * Match a single shared item against the pricebook
 */
function matchSingleItem(
  sharedItem: SharedAssemblyItem,
  pricebook: Array<{
    item: PricebookItem;
    normalizedName: string;
    normalizedSku: string | null;
  }>
): ItemMatchResult {
  const normalizedSharedName = normalizeName(sharedItem.name);
  const normalizedSharedSku = sharedItem.sku?.toLowerCase().trim() || null;

  // 1. Try exact SKU match first (highest priority)
  if (normalizedSharedSku) {
    const skuMatch = pricebook.find((p) => p.normalizedSku === normalizedSharedSku);
    if (skuMatch) {
      return {
        sharedItem,
        matchType: "exact",
        confidence: 100,
        matchedPricebookItem: skuMatch.item,
      };
    }
  }

  // 2. Try exact name match
  const exactMatch = pricebook.find((p) => p.normalizedName === normalizedSharedName);
  if (exactMatch) {
    return {
      sharedItem,
      matchType: "exact",
      confidence: 100,
      matchedPricebookItem: exactMatch.item,
    };
  }

  // 3. Calculate fuzzy scores for all items
  const scored = pricebook
    .map((p) => ({
      item: p.item,
      score: fuzzyScore(normalizedSharedName, p.normalizedName),
    }))
    .filter((s) => s.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  // 4. Check for high-confidence match
  if (scored.length > 0 && scored[0].score >= HIGH_CONFIDENCE_THRESHOLD) {
    return {
      sharedItem,
      matchType: scored[0].score >= EXACT_MATCH_THRESHOLD ? "exact" : "fuzzy",
      confidence: scored[0].score,
      matchedPricebookItem: scored[0].item,
      suggestedMatches: scored.slice(1, 3).map((s) => s.item), // Show max 2 alternatives
    };
  }

  // 5. Low-confidence fuzzy match
  if (scored.length > 0) {
    return {
      sharedItem,
      matchType: "fuzzy",
      confidence: scored[0].score,
      matchedPricebookItem: scored[0].item,
      suggestedMatches: scored.slice(1, 3).map((s) => s.item), // Show max 2 alternatives
    };
  }

  // 6. No match found
  return {
    sharedItem,
    matchType: "none",
    confidence: 0,
    suggestedMatches: [],
  };
}

// =============================================================================
// SCORING FUNCTIONS
// =============================================================================

/**
 * Normalize a name for comparison
 * - Lowercase
 * - Remove extra whitespace
 * - Remove common punctuation
 * - Remove common filler words
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['"`,.\-\/\\()[\]{}]/g, " ") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Calculate fuzzy match score (0-100)
 * Based on word overlap, order, and partial matches
 */
function fuzzyScore(query: string, target: string): number {
  const queryWords = query.split(/\s+/).filter((w) => w.length > 1);
  const targetWords = target.split(/\s+/).filter((w) => w.length > 1);

  if (queryWords.length === 0 || targetWords.length === 0) return 0;

  let exactWordMatches = 0;
  let partialMatches = 0;
  let orderBonus = 0;
  let lastMatchIndex = -1;

  for (const qWord of queryWords) {
    // Check for exact word match
    const exactIndex = targetWords.indexOf(qWord);
    if (exactIndex !== -1) {
      exactWordMatches++;
      // Bonus for matching in order
      if (exactIndex > lastMatchIndex) {
        orderBonus += 0.5;
        lastMatchIndex = exactIndex;
      }
      continue;
    }

    // Check for partial match (starts with or contains)
    const partialIndex = targetWords.findIndex(
      (tWord) =>
        tWord.startsWith(qWord) ||
        qWord.startsWith(tWord) ||
        (tWord.length > 3 && qWord.includes(tWord)) ||
        (qWord.length > 3 && tWord.includes(qWord))
    );

    if (partialIndex !== -1) {
      partialMatches++;
      if (partialIndex > lastMatchIndex) {
        orderBonus += 0.25;
        lastMatchIndex = partialIndex;
      }
    }
  }

  // Calculate base score
  const exactScore = (exactWordMatches / queryWords.length) * 60;
  const partialScore = (partialMatches / queryWords.length) * 25;
  const orderScore = Math.min(orderBonus, 10);

  // Penalty for very different lengths
  const lengthRatio = Math.min(queryWords.length, targetWords.length) /
    Math.max(queryWords.length, targetWords.length);
  const lengthPenalty = (1 - lengthRatio) * 10;

  const totalScore = exactScore + partialScore + orderScore - lengthPenalty;

  return Math.round(Math.max(0, Math.min(100, totalScore)));
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a new pricebook item from a shared assembly item
 * Used when no match is found and user wants to add to their pricebook
 */
export function createPricebookEntryFromSharedItem(
  sharedItem: SharedAssemblyItem,
  price: number = 0
): Omit<PricebookItem, "id" | "createdAt" | "updatedAt"> {
  return {
    name: sharedItem.name,
    sku: sharedItem.sku,
    unitPrice: price,
    unitType: sharedItem.unit || "ea",
    isActive: true,
    source: "shared_import",
  };
}

/**
 * Get summary stats for match results
 */
export function getMatchSummary(results: ItemMatchResult[]): {
  total: number;
  matched: number;
  fuzzy: number;
  unmatched: number;
  matchPercent: number;
} {
  const matched = results.filter((r) => r.matchType === "exact").length;
  const fuzzy = results.filter((r) => r.matchType === "fuzzy").length;
  const unmatched = results.filter((r) => r.matchType === "none").length;

  return {
    total: results.length,
    matched,
    fuzzy,
    unmatched,
    matchPercent: results.length > 0 ? Math.round(((matched + fuzzy) / results.length) * 100) : 0,
  };
}

/**
 * Sort match results to show unmatched first (needing user attention)
 */
export function sortMatchResultsByPriority(
  results: ItemMatchResult[]
): ItemMatchResult[] {
  return [...results].sort((a, b) => {
    // Unmatched items first
    if (a.matchType === "none" && b.matchType !== "none") return -1;
    if (b.matchType === "none" && a.matchType !== "none") return 1;

    // Then fuzzy matches
    if (a.matchType === "fuzzy" && b.matchType === "exact") return -1;
    if (b.matchType === "fuzzy" && a.matchType === "exact") return 1;

    // Then by confidence (lower first for fuzzy)
    if (a.matchType === "fuzzy" && b.matchType === "fuzzy") {
      return a.confidence - b.confidence;
    }

    // Keep exact matches in original order
    return 0;
  });
}
