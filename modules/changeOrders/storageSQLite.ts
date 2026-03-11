// modules/changeOrders/storageSQLite.ts
// SQLite-based change order storage - replaces AsyncStorage implementation
// This file has the same API as storage.ts but uses SQLite for efficiency

import type { ChangeOrder, ChangeOrderUpdate, Quote, QuoteItem } from "@/lib/types";
import {
  listChangeOrdersDB,
  getChangeOrderByIdDB,
  saveChangeOrderDB,
  deleteChangeOrderDB,
  getNextChangeOrderNumberDB,
  type ChangeOrderDB,
} from "@/lib/database";

/**
 * Convert SQLite row to ChangeOrder object
 * Parses JSON strings for items
 */
function dbRowToChangeOrder(row: ChangeOrderDB): ChangeOrder {
  return {
    id: row.id,
    quoteId: row.quoteId,
    quoteNumber: row.quoteNumber,
    number: row.number,
    items: JSON.parse(row.items || "[]"),
    laborBefore: row.laborBefore,
    laborAfter: row.laborAfter,
    laborDelta: row.laborDelta,
    netChange: row.netChange,
    quoteTotalBefore: row.quoteTotalBefore,
    quoteTotalAfter: row.quoteTotalAfter,
    note: row.note,
    status: row.status as ChangeOrder["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Convert ChangeOrder to SQLite row format
 * Stringifies JSON fields for storage
 */
function changeOrderToDBRow(co: ChangeOrder): ChangeOrderDB {
  return {
    id: co.id,
    quoteId: co.quoteId,
    quoteNumber: co.quoteNumber,
    number: co.number,
    items: JSON.stringify(co.items || []),
    laborBefore: co.laborBefore,
    laborAfter: co.laborAfter,
    laborDelta: co.laborDelta,
    netChange: co.netChange,
    quoteTotalBefore: co.quoteTotalBefore,
    quoteTotalAfter: co.quoteTotalAfter,
    note: co.note,
    status: co.status,
    createdAt: co.createdAt,
    updatedAt: co.updatedAt,
  };
}

/**
 * Get all change orders for a specific quote
 */
export async function getChangeOrdersForQuote(
  quoteId: string
): Promise<ChangeOrder[]> {
  try {
    const rows = listChangeOrdersDB(quoteId);
    return rows.map(dbRowToChangeOrder);
  } catch (error) {
    console.error(`Failed to get change orders for quote ${quoteId}:`, error);
    return [];
  }
}

/**
 * Get a single change order by ID
 */
export async function getChangeOrderById(
  quoteId: string,
  changeOrderId: string
): Promise<ChangeOrder | undefined> {
  try {
    const row = getChangeOrderByIdDB(changeOrderId);
    if (!row) return undefined;
    // Verify it belongs to the right quote
    if (row.quoteId !== quoteId) return undefined;
    return dbRowToChangeOrder(row);
  } catch (error) {
    console.error(`Failed to get change order ${changeOrderId}:`, error);
    return undefined;
  }
}

/**
 * Get the next CO number for a quote
 */
export async function getNextChangeOrderNumber(
  quoteId: string
): Promise<number> {
  return getNextChangeOrderNumberDB(quoteId);
}

/**
 * Save a new change order (auto-assigns CO number)
 * Expects quoteNumber to be passed in from the quote
 */
export async function createChangeOrder(
  changeOrder: ChangeOrder
): Promise<ChangeOrder> {
  const now = new Date().toISOString();

  // Auto-assign the next CO number
  const nextNumber = getNextChangeOrderNumberDB(changeOrder.quoteId);

  const coWithNumber: ChangeOrder = {
    ...changeOrder,
    number: nextNumber,
    createdAt: changeOrder.createdAt || now,
    updatedAt: changeOrder.updatedAt || now,
  };

  saveChangeOrderDB(changeOrderToDBRow(coWithNumber));

  return coWithNumber;
}

/**
 * Update an existing change order
 */
export async function updateChangeOrder(
  quoteId: string,
  update: ChangeOrderUpdate
): Promise<void> {
  const existing = getChangeOrderByIdDB(update.id);
  if (!existing) {
    throw new Error(`Change order ${update.id} not found`);
  }

  if (existing.quoteId !== quoteId) {
    throw new Error(`Change order ${update.id} does not belong to quote ${quoteId}`);
  }

  const now = new Date().toISOString();
  const existingCO = dbRowToChangeOrder(existing);

  const updated: ChangeOrder = {
    ...existingCO,
    ...update,
    updatedAt: now,
  };

  saveChangeOrderDB(changeOrderToDBRow(updated));
}

/**
 * Delete a change order (only allowed for pending status)
 */
export async function deleteChangeOrder(
  quoteId: string,
  changeOrderId: string
): Promise<void> {
  const row = getChangeOrderByIdDB(changeOrderId);
  if (!row) {
    throw new Error(`Change order ${changeOrderId} not found`);
  }

  if (row.quoteId !== quoteId) {
    throw new Error(`Change order ${changeOrderId} does not belong to quote ${quoteId}`);
  }

  const co = dbRowToChangeOrder(row);
  if (co.status !== "pending") {
    throw new Error("Only pending change orders can be deleted");
  }

  deleteChangeOrderDB(changeOrderId);
}

/**
 * Get count of change orders for a quote (excluding cancelled)
 */
export async function getActiveChangeOrderCount(
  quoteId: string
): Promise<number> {
  const cos = await getChangeOrdersForQuote(quoteId);
  return cos.filter((co) => co.status !== "cancelled").length;
}

/**
 * Check if a quote has any change orders
 */
export async function quoteHasChangeOrders(quoteId: string): Promise<boolean> {
  const cos = await getChangeOrdersForQuote(quoteId);
  return cos.length > 0;
}

/**
 * Calculate net change from all non-cancelled COs for a quote
 */
export async function getNetChangeForQuote(quoteId: string): Promise<number> {
  const cos = await getChangeOrdersForQuote(quoteId);
  return cos
    .filter((co) => co.status !== "cancelled")
    .reduce((sum, co) => sum + co.netChange, 0);
}

/**
 * Approve a change order and apply the changes to the quote
 * This is the ONLY place where quote modifications happen for COs
 *
 * @param quoteId - The quote ID
 * @param changeOrderId - The change order ID to approve
 * @param getQuoteById - Function to get current quote (injected to avoid circular deps)
 * @param updateQuote - Function to update the quote (injected to avoid circular deps)
 */
export async function approveChangeOrder(
  quoteId: string,
  changeOrderId: string,
  getQuoteById: (id: string) => Promise<Quote | null>,
  updateQuote: (id: string, patch: Partial<Quote>) => Promise<Quote | null>
): Promise<void> {
  // Get the change order
  const co = await getChangeOrderById(quoteId, changeOrderId);
  if (!co) {
    throw new Error(`Change order ${changeOrderId} not found`);
  }

  if (co.status !== "pending") {
    throw new Error("Only pending change orders can be approved");
  }

  // Get the current quote
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  // Apply the changes to the quote
  // Build new items array based on CO diff
  const newItems: QuoteItem[] = [];

  // Start with current items
  const itemsMap = new Map<string, QuoteItem>();
  for (const item of quote.items) {
    const key = item.productId || item.name;
    itemsMap.set(key, { ...item });
  }

  // Apply CO item changes
  for (const coItem of co.items) {
    const key = coItem.productId || coItem.name;

    if (coItem.qtyAfter === 0) {
      // Item was removed
      itemsMap.delete(key);
    } else if (coItem.qtyBefore === 0) {
      // Item was added
      itemsMap.set(key, {
        productId: coItem.productId,
        name: coItem.name,
        unitPrice: coItem.unitPrice,
        qty: coItem.qtyAfter,
      });
    } else {
      // Item quantity changed
      const existing = itemsMap.get(key);
      if (existing) {
        existing.qty = coItem.qtyAfter;
      }
    }
  }

  // Convert map back to array
  for (const item of itemsMap.values()) {
    newItems.push(item);
  }

  // Update the quote with new items and labor
  await updateQuote(quoteId, {
    items: newItems,
    labor: co.laborAfter,
  });

  // Mark the CO as approved
  await updateChangeOrder(quoteId, {
    id: changeOrderId,
    status: "approved",
  });
}
