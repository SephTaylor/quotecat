// modules/materials/transformSelection.ts
import type { QuoteItem } from "@/lib/quotes";
import type { Selection } from "./types";

/**
 * Transform a MaterialsPicker selection into QuoteItem array.
 * Used when adding materials to quotes or creating new quotes.
 */
export function transformSelectionToItems(selection: Selection): QuoteItem[] {
  return Array.from(selection.values()).map(({ product, qty }) => ({
    id: product.id,
    productId: product.id, // Links to catalog product - items without this are custom
    name: product.name,
    unitPrice: product.unitPrice,
    qty: Math.max(0, qty ?? 0),
  }));
}
