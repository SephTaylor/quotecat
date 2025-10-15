import type { QuoteItem } from '@/lib/quotes';

export function mergeQuoteItems(existing: QuoteItem[], adds: QuoteItem[]): QuoteItem[] {
  const map = new Map<string, QuoteItem>(existing.map(i => [i.id, { ...i }]));
  for (const a of adds) {
    const prev = map.get(a.id);
    map.set(
      a.id,
      prev
        ? { ...prev, qty: (prev.qty ?? 0) + (a.qty ?? 0), name: a.name, unitPrice: a.unitPrice }
        : a
    );
  }
  return [...map.values()];
}
