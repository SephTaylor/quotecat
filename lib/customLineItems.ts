// lib/customLineItems.ts
// Storage layer for Quick Custom Items feature
// Provides fuzzy search for autocomplete and usage tracking

import { getDatabase } from "./database";
import type { CustomLineItem } from "./types";

/**
 * Convert database row to CustomLineItem object
 */
function rowToCustomLineItem(row: any): CustomLineItem {
  return {
    id: row.id,
    name: row.name,
    defaultPrice: row.default_price || 0,
    timesUsed: row.times_used || 1,
    firstAdded: row.first_added,
    lastUsed: row.last_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || undefined,
  };
}

/**
 * Generate a unique ID for new items
 */
function generateId(): string {
  return `cli_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Search for custom line items by name (for autocomplete)
 * Returns items sorted by times_used (most used first)
 * Supports fuzzy matching - "fan install" matches "Ceiling Fan Installation"
 */
export function searchCustomLineItems(
  query: string,
  limit: number = 5
): CustomLineItem[] {
  try {
    const database = getDatabase();
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.length < 2) {
      return [];
    }

    // Get all non-deleted items that might match
    const rows = database.getAllSync(
      `SELECT * FROM custom_line_items
       WHERE deleted_at IS NULL
       AND LOWER(name) LIKE ?
       ORDER BY times_used DESC
       LIMIT ?`,
      [`%${normalizedQuery}%`, limit * 3] // Get extra for fuzzy filtering
    );

    // Fuzzy filter and rank
    const items = rows
      .map(rowToCustomLineItem)
      .filter((item) => fuzzyMatch(normalizedQuery, item.name.toLowerCase()))
      .slice(0, limit);

    return items;
  } catch (error) {
    console.error("Failed to search custom line items:", error);
    return [];
  }
}

/**
 * Fuzzy match - checks if query words appear in target (in any order)
 * "fan install" matches "Ceiling Fan Installation"
 * "install fan" matches "Ceiling Fan Installation"
 */
function fuzzyMatch(query: string, target: string): boolean {
  const queryWords = query.split(/\s+/).filter((w) => w.length > 0);
  const targetLower = target.toLowerCase();

  // Every query word must appear somewhere in target
  return queryWords.every((word) => targetLower.includes(word));
}

/**
 * Upsert a custom line item
 * If name already exists (case-insensitive), updates usage stats and price
 * Otherwise creates a new item
 */
export function upsertCustomLineItem(
  name: string,
  price: number
): CustomLineItem {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();
    const normalizedName = name.trim();

    // Check if exists (case-insensitive)
    const existing = database.getFirstSync<any>(
      `SELECT * FROM custom_line_items
       WHERE LOWER(name) = LOWER(?)
       AND deleted_at IS NULL`,
      [normalizedName]
    );

    if (existing) {
      // Update existing: bump times_used, update price and last_used
      database.runSync(
        `UPDATE custom_line_items
         SET times_used = times_used + 1,
             default_price = ?,
             last_used = ?,
             updated_at = ?
         WHERE id = ?`,
        [price, now, now, existing.id]
      );

      return {
        ...rowToCustomLineItem(existing),
        timesUsed: existing.times_used + 1,
        defaultPrice: price,
        lastUsed: now,
        updatedAt: now,
      };
    } else {
      // Create new
      const id = generateId();
      database.runSync(
        `INSERT INTO custom_line_items
         (id, name, default_price, times_used, first_added, last_used, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
        [id, normalizedName, price, now, now, now, now]
      );

      return {
        id,
        name: normalizedName,
        defaultPrice: price,
        timesUsed: 1,
        firstAdded: now,
        lastUsed: now,
        createdAt: now,
        updatedAt: now,
      };
    }
  } catch (error) {
    console.error("Failed to upsert custom line item:", error);
    throw error;
  }
}

/**
 * Get frequently used items (for suggestions when input is empty or short)
 * Returns top N items by times_used
 */
export function getFrequentCustomLineItems(limit: number = 5): CustomLineItem[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      `SELECT * FROM custom_line_items
       WHERE deleted_at IS NULL
       ORDER BY times_used DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map(rowToCustomLineItem);
  } catch (error) {
    console.error("Failed to get frequent custom line items:", error);
    return [];
  }
}

/**
 * Find exact match by name (case-insensitive)
 * Used for deduplication checks
 */
export function findCustomLineItemByName(
  name: string
): CustomLineItem | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync<any>(
      `SELECT * FROM custom_line_items
       WHERE LOWER(name) = LOWER(?)
       AND deleted_at IS NULL`,
      [name.trim()]
    );
    return row ? rowToCustomLineItem(row) : null;
  } catch (error) {
    console.error("Failed to find custom line item by name:", error);
    return null;
  }
}

/**
 * Get all custom line items (for debugging/admin)
 */
export function listAllCustomLineItems(): CustomLineItem[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      `SELECT * FROM custom_line_items
       WHERE deleted_at IS NULL
       ORDER BY times_used DESC`
    );
    return rows.map(rowToCustomLineItem);
  } catch (error) {
    console.error("Failed to list custom line items:", error);
    return [];
  }
}

/**
 * Soft delete a custom line item
 */
export function deleteCustomLineItem(id: string): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();
    database.runSync(
      `UPDATE custom_line_items
       SET deleted_at = ?, updated_at = ?
       WHERE id = ?`,
      [now, now, id]
    );
  } catch (error) {
    console.error("Failed to delete custom line item:", error);
    throw error;
  }
}
