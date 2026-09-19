// modules/changeOrders/storageSQLite.ts
// SQLite-based change order storage - replaces AsyncStorage implementation
// This file has the same API as storage.ts but uses SQLite for efficiency

import type { ChangeOrder, ChangeOrderUpdate } from "@/lib/types";
import {
  listChangeOrdersDB,
  listChangeOrdersForContractDB,
  getChangeOrderByIdDB,
  saveChangeOrderDB,
  deleteChangeOrderDB,
  getNextChangeOrderNumberDB,
  type ChangeOrderDB,
} from "@/lib/database";
import {
  isChangeOrderSyncAvailable,
  uploadChangeOrder,
  deleteChangeOrderFromCloud,
} from "@/lib/changeOrdersSync";
import { composeChangeOrderNumber } from "@/lib/changeOrderNumbering";

/**
 * Convert SQLite row to ChangeOrder object
 * Parses JSON strings for items
 */
function dbRowToChangeOrder(row: ChangeOrderDB): ChangeOrder {
  return {
    id: row.id,
    contractId: row.contractId,
    quoteId: row.quoteId,
    quoteNumber: row.quoteNumber,
    number: row.number,
    parentChangeOrderId: row.parentChangeOrderId,
    displayNumber: row.displayNumber,
    description: row.description,
    completedAt: row.completedAt,
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
    contractId: co.contractId,
    quoteId: co.quoteId,
    quoteNumber: co.quoteNumber,
    number: co.number,
    parentChangeOrderId: co.parentChangeOrderId,
    displayNumber: co.displayNumber,
    description: co.description,
    completedAt: co.completedAt,
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
 * Every change order raised against a contract.
 *
 * The contract-side equivalent of getChangeOrdersForQuote. New change orders
 * hang off contracts; the quote version stays for pre-January rows.
 */
export async function getChangeOrdersForContract(
  contractId: string
): Promise<ChangeOrder[]> {
  try {
    return listChangeOrdersForContractDB(contractId).map(dbRowToChangeOrder);
  } catch (error) {
    console.error(`Failed to get change orders for contract ${contractId}:`, error);
    return [];
  }
}

/**
 * Get a single change order by ID
 */
/**
 * A change order id is unique, so no parent is needed to find one.
 *
 * This used to take a quoteId and reject the row if it did not match, which is
 * a leftover from when a change order was a diff on a quote. A contract-
 * parented change order has no quoteId at all, so that check rejected every
 * one of them and the caller saw "not found".
 */
export async function getChangeOrderById(
  changeOrderId: string
): Promise<ChangeOrder | undefined> {
  try {
    const row = getChangeOrderByIdDB(changeOrderId);
    if (!row) return undefined;
    return dbRowToChangeOrder(row);
  } catch (error) {
    console.error(`Failed to get change order ${changeOrderId}:`, error);
    return undefined;
  }
}

/**
 * Get the next CO number for a quote
 */
export async function getNextChangeOrderNumber(parent: {
  contractId?: string;
  quoteId?: string;
  parentChangeOrderId?: string;
}): Promise<number> {
  return getNextChangeOrderNumberDB(parent);
}

/**
 * Save a change order locally without triggering cloud upload
 * Used by sync to avoid sync loops
 */
export async function saveChangeOrderLocally(
  changeOrder: ChangeOrder
): Promise<void> {
  saveChangeOrderDB(changeOrderToDBRow(changeOrder));
}

/**
 * Save a new change order (auto-assigns CO number)
 * Expects quoteNumber to be passed in from the quote
 */
export async function createChangeOrder(
  changeOrder: ChangeOrder,
  options?: {
    /**
     * The parent's number: the contract number ("CTR-001") for a top-level
     * change order, or the parent change order's displayNumber when nesting.
     *
     * Passed in rather than looked up because contracts are cloud-only and
     * never land in SQLite, so this layer cannot read one synchronously. The
     * screen creating the change order already has the contract in hand.
     *
     * Omit it and displayNumber stays null, which is correct for a draft
     * contract that has not been numbered yet.
     */
    parentNumber?: string;
  }
): Promise<ChangeOrder> {
  const now = new Date().toISOString();

  // Auto-assign the next CO number
  // Scoped to this change order's own parent: the contract it modifies, or
  // the change order it modifies, or a legacy quote.
  const nextNumber = getNextChangeOrderNumberDB({
    contractId: changeOrder.contractId,
    quoteId: changeOrder.quoteId,
    parentChangeOrderId: changeOrder.parentChangeOrderId,
  });

  const coWithNumber: ChangeOrder = {
    ...changeOrder,
    number: nextNumber,
    displayNumber:
      changeOrder.displayNumber ||
      composeChangeOrderNumber(options?.parentNumber, nextNumber),
    createdAt: changeOrder.createdAt || now,
    updatedAt: changeOrder.updatedAt || now,
  };

  saveChangeOrderDB(changeOrderToDBRow(coWithNumber));

  // Trigger cloud upload for Pro+ (non-blocking)
  isChangeOrderSyncAvailable().then((available) => {
    if (available) {
      uploadChangeOrder(coWithNumber).catch((error) =>
        console.error("Failed to upload new change order:", error)
      );
    }
  });

  return coWithNumber;
}

/**
 * Update an existing change order
 */
export async function updateChangeOrder(
  update: ChangeOrderUpdate
): Promise<void> {
  const existing = getChangeOrderByIdDB(update.id);
  if (!existing) {
    throw new Error(`Change order ${update.id} not found`);
  }

  const now = new Date().toISOString();
  const existingCO = dbRowToChangeOrder(existing);

  const updated: ChangeOrder = {
    ...existingCO,
    ...update,
    updatedAt: now,
  };

  saveChangeOrderDB(changeOrderToDBRow(updated));

  // Trigger cloud upload for Pro+ (non-blocking)
  isChangeOrderSyncAvailable().then((available) => {
    if (available) {
      uploadChangeOrder(updated).catch((error) =>
        console.error("Failed to upload updated change order:", error)
      );
    }
  });
}

/**
 * Delete a change order (only allowed for pending status)
 */
export async function deleteChangeOrder(
  changeOrderId: string
): Promise<void> {
  const row = getChangeOrderByIdDB(changeOrderId);
  if (!row) {
    throw new Error(`Change order ${changeOrderId} not found`);
  }

  const co = dbRowToChangeOrder(row);
  if (co.status !== "draft") {
    throw new Error("Only draft change orders can be deleted. Once it has been sent, decline it instead.");
  }

  deleteChangeOrderDB(changeOrderId);

  // Trigger cloud soft delete for Pro+ (non-blocking)
  isChangeOrderSyncAvailable().then((available) => {
    if (available) {
      deleteChangeOrderFromCloud(changeOrderId).catch((error) =>
        console.error("Failed to delete change order from cloud:", error)
      );
    }
  });
}

/**
 * Get count of change orders for a quote (excluding cancelled)
 */
export async function getActiveChangeOrderCount(
  quoteId: string
): Promise<number> {
  const cos = await getChangeOrdersForQuote(quoteId);
  return cos.filter((co) => co.status !== "declined").length;
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
    .filter((co) => co.status !== "declined")
    .reduce((sum, co) => sum + co.netChange, 0);
}
