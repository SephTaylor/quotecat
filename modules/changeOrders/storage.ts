// modules/changeOrders/storage.ts
// AsyncStorage CRUD operations for Change Orders

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChangeOrder, ChangeOrderUpdate } from "./types";

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
 * Save a new change order
 */
export async function createChangeOrder(
  changeOrder: ChangeOrder
): Promise<void> {
  const all = await readAllChangeOrders();
  const quoteId = changeOrder.quoteId;

  if (!all[quoteId]) {
    all[quoteId] = [];
  }

  all[quoteId].push(changeOrder);
  await writeAllChangeOrders(all);
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
