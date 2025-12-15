// modules/quotes/index.ts
// Main entry point for quotes module
// Re-exports storage operations and utilities

// Storage operations (consolidated from old lib/quotes.ts and modules/quotes)
export {
  listQuotes,
  getQuoteById,
  createQuote,
  saveQuote,
  updateQuote,
  deleteQuote,
  duplicateQuote,
  clearAllQuotes,
  // Linked quotes (multi-tier/Good-Better-Best)
  linkQuotes,
  unlinkQuote,
  getLinkedQuotes,
  createTierFromQuote,
} from "./storage";

// Calculation utilities
export { calculateMaterialSubtotal, calculateTotal } from "@/lib/validation";

// Export hooks
export * from "./useQuoteData";
export * from "./useExportQuote";

// Export CSV functionality
export * from "./exportCsv";

// Export merge utility
export * from "./merge";

// Re-export canonical types from lib/types
export type { Quote, QuoteItem, QuoteUpdate, CurrencyCode } from "@/lib/types";

// Legacy export alias for backwards compatibility
// This allows existing code to keep using "StoredQuote" name
export type { Quote as StoredQuote } from "@/lib/types";

// For backwards compatibility with code that imported "createNewQuote"
export { createQuote as createNewQuote } from "./storage";
