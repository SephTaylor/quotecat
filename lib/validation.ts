// lib/validation.ts
// Input validation and normalization utilities

import type { Quote, QuoteItem, CurrencyCode, QuoteStatus } from "./types";

/**
 * Known quote item fields (for forward compatibility)
 */
const KNOWN_ITEM_KEYS = new Set([
  "id",
  "productId",
  "name",
  "unitPrice",
  "qty",
  "currency",
]);

/**
 * Known quote fields (for forward compatibility)
 */
const KNOWN_QUOTE_KEYS = new Set([
  "id",
  "name",
  "clientName",
  "items",
  "labor",
  "materialEstimate",
  "overhead",
  "markupPercent",
  "currency",
  "status",
  "pinned",
  "tier",
  "createdAt",
  "updatedAt",
  "materialSubtotal",
  "total",
]);

/**
 * Extract extra fields not in the known set
 * This allows forward compatibility with future schema changes
 */
function extractExtras(obj: any, knownKeys: Set<string>): Record<string, any> {
  const extras: Record<string, any> = {};
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (!knownKeys.has(key)) {
        extras[key] = obj[key];
      }
    }
  }
  return extras;
}

/**
 * Validate and normalize a currency code
 */
export function normalizeCurrency(raw: any): CurrencyCode {
  const validCurrencies: CurrencyCode[] = ["USD", "CRC", "CAD", "EUR"];
  if (
    typeof raw === "string" &&
    validCurrencies.includes(raw as CurrencyCode)
  ) {
    return raw as CurrencyCode;
  }
  return "USD"; // Default fallback
}

/**
 * Validate and normalize a quote status
 */
export function normalizeStatus(raw: any): QuoteStatus {
  const validStatuses: QuoteStatus[] = [
    "draft",
    "sent",
    "approved",
    "declined",
    "completed",
    "archived",
  ];

  // Migrate legacy "active" status to "draft"
  if (raw === "active") {
    return "draft";
  }

  if (typeof raw === "string" && validStatuses.includes(raw as QuoteStatus)) {
    return raw as QuoteStatus;
  }
  return "draft"; // Default fallback
}

/**
 * Validate and normalize a quote item
 * Ensures all required fields exist with proper types
 */
export function normalizeQuoteItem(raw: any): QuoteItem {
  const base: QuoteItem = {
    id: typeof raw?.id === "string" ? raw.id : undefined,
    productId: typeof raw?.productId === "string" ? raw.productId : undefined,
    name: typeof raw?.name === "string" ? raw.name : "",
    unitPrice: Number.isFinite(raw?.unitPrice) ? Number(raw.unitPrice) : 0,
    qty: Number.isFinite(raw?.qty) ? Number(raw.qty) : 0,
    currency: raw?.currency ? normalizeCurrency(raw.currency) : undefined,
  };

  // Preserve any extra fields for forward compatibility
  const extras = extractExtras(raw, KNOWN_ITEM_KEYS);
  return { ...base, ...extras };
}

/**
 * Validate and normalize a quote
 * Ensures all required fields exist with proper types
 * Generates IDs and timestamps if missing
 */
export function normalizeQuote(raw: any): Quote {
  const nowIso = new Date().toISOString();
  const itemsArray: any[] = Array.isArray(raw?.items) ? raw.items : [];

  const base: Quote = {
    id:
      typeof raw?.id === "string" && raw.id
        ? raw.id
        : `quote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: typeof raw?.name === "string" ? raw.name : "",
    clientName:
      typeof raw?.clientName === "string" ? raw.clientName : undefined,
    items: itemsArray.map(normalizeQuoteItem),
    labor: Number.isFinite(raw?.labor) ? Number(raw.labor) : 0,
    materialEstimate: Number.isFinite(raw?.materialEstimate) ? Number(raw.materialEstimate) : undefined,
    overhead: Number.isFinite(raw?.overhead) ? Number(raw.overhead) : undefined,
    markupPercent: Number.isFinite(raw?.markupPercent) ? Number(raw.markupPercent) : undefined,
    currency: normalizeCurrency(raw?.currency),
    status: normalizeStatus(raw?.status),
    pinned: typeof raw?.pinned === "boolean" ? raw.pinned : false,
    tier: typeof raw?.tier === "string" && raw.tier ? raw.tier : undefined,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : nowIso,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : nowIso,
  };

  // Preserve extras but remove computed fields
  const extras = extractExtras(raw, KNOWN_QUOTE_KEYS);
  const normalized: Quote = { ...base, ...extras };

  // Never trust stored totals - they're computed on demand
  delete normalized.materialSubtotal;
  delete normalized.total;

  return normalized;
}

/**
 * Get a stable ID for a quote item
 * Falls back to generating a temporary ID if both productId and id are missing
 */
export function getItemId(item: QuoteItem): string {
  return item.productId || item.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Calculate material subtotal from quote items
 */
export function calculateMaterialSubtotal(items: QuoteItem[]): number {
  return items.reduce((sum, item) => {
    const itemTotal = (item.unitPrice || 0) * (item.qty || 0);
    return sum + itemTotal;
  }, 0);
}

// NOTE: calculateQuoteTotals and calculateTotal previously lived here as a
// stranded duplicate of lib/calculations.ts's versions, with different math
// (no tax handling, markup applied to labor + estimate + a non-existent
// "overhead" field). The December 2025 consolidation moved the canonical
// implementation to lib/calculations.ts. Both functions had zero callers
// project-wide (verified by exhaustive grep including dynamic imports, star
// imports, re-export facades, and edge functions) and were removed in
// June 2026 to eliminate the future-bug risk where a developer (or
// auto-import) could grab the wrong version and silently produce wrong
// totals. The canonical functions live at lib/calculations.ts:25 and 74.

/**
 * Validate quote name is not empty
 */
export function validateQuoteName(name: string): boolean {
  return typeof name === "string" && name.trim().length > 0;
}

/**
 * Validate quote has at least one item
 */
export function validateQuoteHasItems(quote: Quote): boolean {
  return Array.isArray(quote.items) && quote.items.length > 0;
}

/**
 * Comprehensive quote validation
 */
export function validateQuote(quote: Quote): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!quote.id || typeof quote.id !== "string") {
    errors.push("Quote ID is required");
  }

  if (!validateQuoteName(quote.name)) {
    errors.push("Quote name is required");
  }

  if (!Array.isArray(quote.items)) {
    errors.push("Quote items must be an array");
  }

  if (!Number.isFinite(quote.labor) || quote.labor < 0) {
    errors.push("Labor must be a non-negative number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
