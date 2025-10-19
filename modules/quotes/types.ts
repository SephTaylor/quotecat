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
export {
  normalizeQuote,
  normalizeQuoteItem as normalizeItem,
  calculateMaterialSubtotal,
  calculateTotal,
  validateQuote,
  validateQuoteName,
  validateQuoteHasItems,
} from "@/lib/validation";
