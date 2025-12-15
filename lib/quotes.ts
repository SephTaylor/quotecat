// lib/quotes.ts
// Legacy file - now re-exports from modules/quotes for backwards compatibility
// All new code should import from @/modules/quotes instead

export {
  listQuotes,
  getQuoteById,
  createQuote,
  createQuote as createNewQuote, // Alias for backwards compatibility
  saveQuote,
  updateQuote,
  deleteQuote,
  duplicateQuote,
  // Linked quotes (multi-tier)
  linkQuotes,
  unlinkQuote,
  getLinkedQuotes,
  createTierFromQuote,
} from "@/modules/quotes";

export type {
  Quote,
  QuoteItem,
  Quote as StoredQuote, // Alias for backwards compatibility
} from "@/lib/types";
