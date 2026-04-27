// lib/pricebook.ts
// Price book management - USING SQLITE
// Custom products with user-defined pricing that sync with webapp
// Free users: 50 items max, Pro/Premium: unlimited

import type { PricebookItem } from "./types";
import {
  listPricebookItemsDB,
  getPricebookItemByIdDB,
  savePricebookItemDB,
  savePricebookItemsBatchDB,
  deletePricebookItemDB,
  getPricebookItemCountDB,
  getPricebookCategoriesDB,
} from "./database";
import { getUserState, FREE_LIMITS } from "./user";

// Re-export PricebookItem type for convenience
export type { PricebookItem } from "./types";

/**
 * Generate a unique pricebook item ID
 * Uses UUID format to match webapp's Supabase IDs
 */
export function createPricebookItemId(): string {
  // Generate UUID v4 format to match Supabase
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get all pricebook items
 */
export async function getPricebookItems(): Promise<PricebookItem[]> {
  return listPricebookItemsDB({ limit: 1000 });
}

/**
 * Get pricebook items by category
 */
export async function getPricebookItemsByCategory(category: string): Promise<PricebookItem[]> {
  return listPricebookItemsDB({ category, limit: 500 });
}

/**
 * Get all unique categories from pricebook
 */
export async function getPricebookCategories(): Promise<string[]> {
  return getPricebookCategoriesDB();
}

/**
 * Get a pricebook item by ID
 */
export async function getPricebookItemById(id: string): Promise<PricebookItem | null> {
  return getPricebookItemByIdDB(id);
}

/**
 * Save a pricebook item locally WITHOUT triggering cloud upload
 * Used during sync to prevent sync loops
 */
export async function savePricebookItemLocally(item: PricebookItem): Promise<void> {
  const now = new Date().toISOString();
  const savedItem: PricebookItem = {
    ...item,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
  savePricebookItemDB(savedItem);
}

/**
 * Batch save pricebook items (used by sync)
 */
export async function savePricebookItemsBatch(items: PricebookItem[]): Promise<void> {
  if (items.length === 0) return;
  savePricebookItemsBatchDB(items);
}

/**
 * Save a pricebook item (triggers cloud sync for Premium users)
 */
export async function savePricebookItem(item: PricebookItem): Promise<PricebookItem> {
  const now = new Date().toISOString();
  const savedItem: PricebookItem = {
    ...item,
    source: item.source || "custom", // Mark as custom if not specified
    isActive: item.isActive !== false, // Default to active
    createdAt: item.createdAt || now,
    updatedAt: now,
  };

  savePricebookItemDB(savedItem);

  // Auto-sync to cloud for Premium users (non-blocking)
  import("./pricebookSync").then(({ isPricebookSyncAvailable, uploadPricebookItem }) => {
    isPricebookSyncAvailable().then((available: boolean) => {
      if (available) {
        uploadPricebookItem(savedItem).catch((error: Error) => {
          console.warn("Background pricebook cloud sync failed:", error);
        });
      }
    });
  });

  return savedItem;
}

/**
 * Create a new pricebook item
 */
export async function createPricebookItem(
  data: Omit<PricebookItem, "id" | "createdAt" | "updatedAt">
): Promise<PricebookItem> {
  const now = new Date().toISOString();
  const item: PricebookItem = {
    ...data,
    id: createPricebookItemId(),
    source: data.source || "custom",
    isActive: data.isActive !== false,
    createdAt: now,
    updatedAt: now,
  };

  return savePricebookItem(item);
}

/**
 * Update a pricebook item
 */
export async function updatePricebookItem(
  id: string,
  updates: Partial<Omit<PricebookItem, "id" | "createdAt">>
): Promise<PricebookItem | null> {
  const current = await getPricebookItemById(id);
  if (!current) return null;

  const updated: PricebookItem = {
    ...current,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  return savePricebookItem(updated);
}

/**
 * Delete a pricebook item (soft delete)
 */
export async function deletePricebookItem(id: string): Promise<void> {
  deletePricebookItemDB(id);

  // Delete from cloud for Premium users (non-blocking)
  import("./pricebookSync").then(({ isPricebookSyncAvailable, deletePricebookItemFromCloud }) => {
    isPricebookSyncAvailable().then((available: boolean) => {
      if (available) {
        deletePricebookItemFromCloud(id).catch((error: Error) => {
          console.warn("Background pricebook cloud deletion failed:", error);
        });
      }
    });
  });
}

/**
 * Search pricebook items by name, description, or SKU
 */
export async function searchPricebookItems(query: string): Promise<PricebookItem[]> {
  if (!query.trim()) return getPricebookItems();
  return listPricebookItemsDB({ search: query, limit: 100 });
}

/**
 * Get pricebook item count
 */
export function getPricebookItemCount(): number {
  return getPricebookItemCountDB(false);
}

/**
 * Check if user can add more pricebook items
 * Returns { canAdd: boolean, remaining: number, limit: number }
 */
export async function canAddPricebookItem(): Promise<{
  canAdd: boolean;
  remaining: number;
  limit: number;
  currentCount: number;
}> {
  const userState = await getUserState();
  const isPaidTier = userState.tier === "pro" || userState.tier === "premium";

  if (isPaidTier) {
    return { canAdd: true, remaining: Infinity, limit: Infinity, currentCount: getPricebookItemCount() };
  }

  const currentCount = getPricebookItemCount();
  const limit = FREE_LIMITS.pricebookItems;
  const remaining = Math.max(0, limit - currentCount);

  return {
    canAdd: currentCount < limit,
    remaining,
    limit,
    currentCount,
  };
}
