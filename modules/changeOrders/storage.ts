// modules/changeOrders/storage.ts
// AsyncStorage CRUD operations for Change Orders

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChangeOrder, ChangeOrderUpdate } from "./types";
import type { Quote, QuoteItem } from "@/lib/types";

const STORAGE_KEY = "@quotecat/change-orders";

/**
 * Read all change orders from storage
 */
async function readAllChangeOrders(): Promise<Record<string, ChangeOrder[]>> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return {};
    return JSON.parse(json);
  } catch (error) {
    console.error("Failed to read change orders:", error);
    return {};
  }
}

/**
 * Write all change orders to storage
 */
async function writeAllChangeOrders(
  data: Record<string, ChangeOrder[]>
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Get all change orders for a specific quote
 */
export async function getChangeOrdersForQuote(
  quoteId: string
): Promise<ChangeOrder[]> {
  const all = await readAllChangeOrders();
  return all[quoteId] || [];
}

/**
 * Get a single change order by ID
 */
export async function getChangeOrderById(
  quoteId: string,
  changeOrderId: string
): Promise<ChangeOrder | undefined> {
  const cos = await getChangeOrdersForQuote(quoteId);
  return cos.find((co) => co.id === changeOrderId);
}

/**
 * Get the next CO number for a quote
 */
export async function getNextChangeOrderNumber(
  quoteId: string
): Promise<number> {
  const cos = await getChangeOrdersForQuote(quoteId);
  if (cos.length === 0) return 1;
  const maxNumber = Math.max(...cos.map((co) => co.number));
  return maxNumber + 1;
}

/**
 * Save a new change order (auto-assigns CO number)
 * Expects quoteNumber to be passed in from the quote
 */
export async function createChangeOrder(
  changeOrder: ChangeOrder
): Promise<ChangeOrder> {
  const all = await readAllChangeOrders();
  const quoteId = changeOrder.quoteId;

  if (!all[quoteId]) {
    all[quoteId] = [];
  }

  // Auto-assign the next CO number
  const existingCOs = all[quoteId];
  const maxNumber = existingCOs.length > 0
    ? Math.max(...existingCOs.map((co) => co.number))
    : 0;
  const coWithNumber: ChangeOrder = {
    ...changeOrder,
    number: maxNumber + 1,
  };

  all[quoteId].push(coWithNumber);
  await writeAllChangeOrders(all);

  return coWithNumber;
}

/**
 * Update an existing change order
 */
export async function updateChangeOrder(
  quoteId: string,
  update: ChangeOrderUpdate
): Promise<void> {
  const all = await readAllChangeOrders();
  const cos = all[quoteId] || [];

  const idx = cos.findIndex((co) => co.id === update.id);
  if (idx === -1) {
    throw new Error(`Change order ${update.id} not found`);
  }

  cos[idx] = {
    ...cos[idx],
    ...update,
    updatedAt: new Date().toISOString(),
  };

  all[quoteId] = cos;
  await writeAllChangeOrders(all);
}

/**
 * Delete a change order (only allowed for pending status)
 */
export async function deleteChangeOrder(
  quoteId: string,
  changeOrderId: string
): Promise<void> {
  const all = await readAllChangeOrders();
  const cos = all[quoteId] || [];

  const co = cos.find((c) => c.id === changeOrderId);
  if (!co) {
    throw new Error(`Change order ${changeOrderId} not found`);
  }

  if (co.status !== "pending") {
    throw new Error("Only pending change orders can be deleted");
  }

  all[quoteId] = cos.filter((c) => c.id !== changeOrderId);
  await writeAllChangeOrders(all);
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
