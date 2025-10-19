// modules/settings/money.ts
// Money formatting and parsing utilities

import type { CurrencyCode } from "@/lib/types";

export type { CurrencyCode } from "@/lib/types";

export type FormatMoneyOptions = {
  currency?: CurrencyCode; // default 'USD'
  decimals?: number; // default 2
  withSymbol?: boolean; // default false (keeps current UI unchanged)
};

/**
 * formatMoney
 * - Centralized, predictable formatting
 * - Defaults keep current UI stable (2 decimals, no currency symbol)
 * - When ready, set withSymbol: true to show locale symbol
 */
export function formatMoney(
  value: number,
  opts: FormatMoneyOptions = {},
): string {
  const { currency = "USD", decimals = 2, withSymbol = false } = opts;

  if (!Number.isFinite(value)) return (0).toFixed(decimals);

  if (withSymbol) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  // Symbol-less numeric format (keeps current UI stable)
  return value.toFixed(decimals);
}

/** Safe parser for user-entered money text (e.g., "1,234.50" or "12,34") */
export function parseMoney(input: string): number {
  const cleaned = input.replace(",", ".").replace(/[^\d.]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
