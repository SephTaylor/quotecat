// modules/quotes/merge.ts
import type { QuoteItem } from "@/lib/quotes";

/**
 * Merge two QuoteItem arrays by id, summing quantities for duplicates.
 * @param existing - Base items
 * @param adds - Items to merge in
 * @returns Merged array with summed quantities
 */
export function mergeById(
  existing: QuoteItem[],
  adds: QuoteItem[],
): QuoteItem[] {
  const map = new Map(existing.map((i) => [i.id, { ...i }]));
  for (const a of adds) {
    const cur = map.get(a.id);
    if (cur) {
      map.set(a.id, { ...cur, qty: (cur.qty ?? 0) + (a.qty ?? 0) });
    } else {
      map.set(a.id, { ...a });
    }
  }
  return Array.from(map.values());
}
