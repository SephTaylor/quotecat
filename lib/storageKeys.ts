// lib/storageKeys.ts
// Centralized registry of all AsyncStorage keys
// This prevents key collisions and makes migrations easier

/**
 * Storage keys for quotes
 * We maintain legacy keys for backwards compatibility (read-only)
 */
export const QUOTE_KEYS = {
  // Primary key (write here)
  PRIMARY: "@quotecat/quotes",
  // Legacy keys (read for migration)
  LEGACY: ["quotes", "qc:quotes:v1"] as const,
} as const;

/**
 * Storage keys for products/catalog
 */
export const PRODUCT_KEYS = {
  CACHE: "@quotecat/products",
  SYNC_TIMESTAMP: "@quotecat/products_sync",
} as const;

/**
 * Storage keys for categories
 */
export const CATEGORY_KEYS = {
  CACHE: "@quotecat/categories",
} as const;

/**
 * Storage keys for location-based pricing
 */
export const PRICE_KEYS = {
  CACHE: "@quotecat/location_prices",
  SYNC_TIMESTAMP: "@quotecat/location_prices_sync",
} as const;

/**
 * Storage keys for assemblies
 */
export const ASSEMBLY_KEYS = {
  CACHE: "@quotecat/assemblies",
} as const;

/**
 * Storage keys for user settings
 */
export const SETTINGS_KEYS = {
  CURRENCY: "@quotecat/settings:currency",
  THEME: "@quotecat/settings:theme",
} as const;

/**
 * All storage keys used in the app
 * Useful for debugging and data export
 */
export const ALL_KEYS = [
  QUOTE_KEYS.PRIMARY,
  ...QUOTE_KEYS.LEGACY,
  PRODUCT_KEYS.CACHE,
  PRODUCT_KEYS.SYNC_TIMESTAMP,
  CATEGORY_KEYS.CACHE,
  PRICE_KEYS.CACHE,
  PRICE_KEYS.SYNC_TIMESTAMP,
  ASSEMBLY_KEYS.CACHE,
  SETTINGS_KEYS.CURRENCY,
  SETTINGS_KEYS.THEME,
] as const;
