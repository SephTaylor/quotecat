// modules/quotes/types.ts
// Re-exports canonical types from lib/types
// Kept for backwards compatibility

export type {
  Quote,
  Quote as StoredQuote, // Alias
  QuoteItem,
  QuoteUpdate,
  CurrencyCode,
} from "@/lib/types";

// Re-export validation functions
// (calculateTotal removed June 2026 — it pointed at lib/validation's
//  stranded duplicate of the math, which used different rules than
//  lib/calculations.ts. The canonical calculateQuoteTotal lives at
//  lib/calculations.ts:74 and is re-exported by modules/quotes/index.ts
//  under the name `calculateTotal` for callers that want that name.)
export {
  normalizeQuote,
  normalizeQuoteItem as normalizeItem,
  calculateMaterialSubtotal,
  validateQuote,
  validateQuoteName,
  validateQuoteHasItems,
} from "@/lib/validation";
