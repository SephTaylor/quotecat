// modules/settings/index.ts
// Barrel for app-wide settings + money helpers (named exports only)

import type { CurrencyCode } from './money';

export type AppSettings = {
  currency: CurrencyCode;   // tighten from string → CurrencyCode
  locale: string;
  taxRatePct: number;
};

export function getSettings(): AppSettings {
  // TODO: later read from persistence / profile
  return { currency: 'USD', locale: 'en-US', taxRatePct: 0 };
}

// Re-export money utilities/types
export * from './money';
