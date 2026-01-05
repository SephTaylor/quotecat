// modules/quotes/index.ts
// Main entry point for quotes module
// Re-exports storage operations and utilities

// Storage operations - NOW USING SQLITE for memory efficiency
// This fixes the OOM crashes when syncing/loading data
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
  // Internal sync functions
  saveQuoteLocally,
  saveQuotesBatch,
  updateQuoteLocally,
} from "./storageSQLite";

// Calculation utilities
export { calculateMaterialSubtotal, calculateQuoteTotal, calculateQuoteTotals } from "@/lib/calculations";
// Backward compatibility alias
export { calculateQuoteTotal as calculateTotal } from "@/lib/calculations";

// Export hooks
export * from "./useQuoteData";
export * from "./useExportQuote";
export * from "./useQuoteForm";

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
export { createQuote as createNewQuote } from "./storageSQLite";
