import type { QuoteItem } from "./index";

export type QuoteTotals = {
  materialsSubtotal: number;
  tax: number;
  total: number;
};

export function calcTotals(
  items: QuoteItem[],
  taxRatePct: number = 0,
): QuoteTotals {
  const materialsSubtotal = items.reduce(
    (s, it) => s + (it.unitPrice ?? 0) * (it.qty ?? 0),
    0,
  );
  const tax = materialsSubtotal * (taxRatePct / 100);
  const total = materialsSubtotal + tax;
  return { materialsSubtotal, tax, total };
}
