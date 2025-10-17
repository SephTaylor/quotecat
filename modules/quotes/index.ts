// modules/quotes/index.ts
// Central quotes barrel: re-export lib/quotes (the actual implementation)
// plus our utility modules.

// Re-export the working quote repository from lib/
export * from "@/lib/quotes";

// Add utility functions
export * from "./calc";
export * from "./draft";
export * from "./merge";

// Note: types.ts (StoredQuote, etc.) is currently unused.
// It represents a better architecture for future migration but is not yet active.
