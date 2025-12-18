// modules/changeOrders/diff.ts
// Logic for snapshotting quotes and calculating diffs

import type { Quote, QuoteItem, ChangeOrderItem } from "@/lib/types";
import type { QuoteSnapshot } from "./types";

/**
 * Calculate the total for a quote (materials + labor)
 */
function calculateQuoteTotal(quote: Quote | QuoteSnapshot): number {
  const materialTotal =
    "items" in quote
      ? quote.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
      : 0;
  return materialTotal + (quote.labor || 0);
}

/**
 * Create a snapshot of quote state for later comparison
 */
export function createSnapshot(quote: Quote): QuoteSnapshot {
  return {
    items: quote.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      unit: item.unit || "ea",
      unitPrice: item.unitPrice,
      qty: item.qty,
    })),
    labor: quote.labor || 0,
    total: calculateQuoteTotal(quote),
  };
}

/**
 * Compare two quote states and return the diff
 */
export function calculateDiff(
  before: QuoteSnapshot,
  after: Quote
): {
  items: ChangeOrderItem[];
  laborBefore: number;
  laborAfter: number;
  laborDelta: number;
  netChange: number;
  quoteTotalBefore: number;
  quoteTotalAfter: number;
  hasMaterialChanges: boolean;
} {
  const itemChanges: ChangeOrderItem[] = [];

  // Build lookup maps by productId or name (for manual items)
  const beforeMap = new Map<string, QuoteSnapshot["items"][0]>();
  before.items.forEach((item) => {
    const key = item.productId || `manual:${item.name}`;
    beforeMap.set(key, item);
  });

  const afterMap = new Map<string, QuoteItem>();
  after.items.forEach((item) => {
    const key = item.productId || `manual:${item.name}`;
    afterMap.set(key, item);
  });

  // Find added and modified items
  afterMap.forEach((afterItem, key) => {
    const beforeItem = beforeMap.get(key);

    if (!beforeItem) {
      // Newly added item
      itemChanges.push({
        productId: afterItem.productId,
        name: afterItem.name,
        unit: afterItem.unit || "ea",
        unitPrice: afterItem.unitPrice,
        qtyBefore: 0,
        qtyAfter: afterItem.qty,
        qtyDelta: afterItem.qty,
        lineDelta: afterItem.unitPrice * afterItem.qty,
      });
    } else if (beforeItem.qty !== afterItem.qty) {
      // Quantity changed
      const qtyDelta = afterItem.qty - beforeItem.qty;
      itemChanges.push({
        productId: afterItem.productId,
        name: afterItem.name,
        unit: afterItem.unit || "ea",
        unitPrice: afterItem.unitPrice,
        qtyBefore: beforeItem.qty,
        qtyAfter: afterItem.qty,
        qtyDelta,
        lineDelta: afterItem.unitPrice * qtyDelta,
      });
    }
    // Note: Price changes on existing items are ignored for now
    // (price comes from catalog, shouldn't change mid-quote)
  });

  // Find removed items
  beforeMap.forEach((beforeItem, key) => {
    if (!afterMap.has(key)) {
      // Item was removed
      itemChanges.push({
        productId: beforeItem.productId,
        name: beforeItem.name,
        unit: beforeItem.unit || "ea",
        unitPrice: beforeItem.unitPrice,
        qtyBefore: beforeItem.qty,
        qtyAfter: 0,
        qtyDelta: -beforeItem.qty,
        lineDelta: -(beforeItem.unitPrice * beforeItem.qty),
      });
    }
  });

  // Calculate labor diff
  const laborBefore = before.labor || 0;
  const laborAfter = after.labor || 0;
  const laborDelta = laborAfter - laborBefore;

  // Calculate totals
  const quoteTotalBefore = before.total;
  const quoteTotalAfter = calculateQuoteTotal(after);
  const netChange = quoteTotalAfter - quoteTotalBefore;

  // Check if there are material changes (items or labor)
  const hasMaterialChanges = itemChanges.length > 0 || laborDelta !== 0;

  return {
    items: itemChanges,
    laborBefore,
    laborAfter,
    laborDelta,
    netChange,
    quoteTotalBefore,
    quoteTotalAfter,
    hasMaterialChanges,
  };
}

/**
 * Format a net change amount for display
 * Returns "+$500.00" or "-$200.00" or "$0.00"
 */
export function formatNetChange(amount: number): string {
  const formatted = Math.abs(amount).toFixed(2);
  if (amount > 0) return `+$${formatted}`;
  if (amount < 0) return `-$${formatted}`;
  return `$${formatted}`;
}
