import type { QuoteItem } from "@/lib/types";

export type QuoteTotals = {
  materialsSubtotal: number;
  tax: number;
  total: number;
};

/**
 * Calculate the material subtotal from quote items.
 * Used in review screens and quote displays.
 */
export function calculateMaterialSubtotal(items: QuoteItem[]): number {
  return items.reduce((s, it) => s + (it.unitPrice ?? 0) * (it.qty ?? 0), 0);
}

export function calcTotals(
  items: QuoteItem[],
  taxRatePct: number = 0,
): QuoteTotals {
  const materialsSubtotal = calculateMaterialSubtotal(items);
  const tax = materialsSubtotal * (taxRatePct / 100);
  const total = materialsSubtotal + tax;
  return { materialsSubtotal, tax, total };
}
