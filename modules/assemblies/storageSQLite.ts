// modules/assemblies/storageSQLite.ts
// SQLite-based assembly storage - replaces AsyncStorage implementation
// This file has the same API as storage.ts but uses SQLite for efficiency

import type { Assembly } from "./types";
import {
  listAssembliesDB,
  getAssemblyByIdDB,
  saveAssemblyDB,
  saveAssembliesBatchDB,
  deleteAssemblyDB,
  getTombstonesDB,
  deleteTombstoneDB,
  type AssemblyDB,
} from "@/lib/database";

/**
 * Convert SQLite row to Assembly object
 * Parses JSON strings for items and defaults
 */
function dbRowToAssembly(row: AssemblyDB): Assembly {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    items: JSON.parse(row.items || "[]"),
    defaults: row.defaults ? JSON.parse(row.defaults) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Convert Assembly to SQLite row format
 * Stringifies JSON fields for storage
 */
function assemblyToDBRow(assembly: Assembly, userId?: string): AssemblyDB {
  return {
    id: assembly.id,
    name: assembly.name,
    description: assembly.description,
    category: assembly.category,
    items: JSON.stringify(assembly.items || []),
    defaults: assembly.defaults ? JSON.stringify(assembly.defaults) : undefined,
    userId,
    createdAt: assembly.createdAt,
    updatedAt: assembly.updatedAt,
  };
}

/**
 * Load all assemblies from storage.
 * Returns empty array if no assemblies exist.
 */
export async function listAssemblies(): Promise<Assembly[]> {
  try {
    const rows = listAssembliesDB();
    return rows.map(dbRowToAssembly);
  } catch (error) {
    console.error("Failed to load assemblies:", error);
    return [];
  }
}

/**
 * Get a single assembly by ID.
 */
export async function getAssemblyById(
  id: string,
): Promise<Assembly | undefined> {
  try {
    const row = getAssemblyByIdDB(id);
    return row ? dbRowToAssembly(row) : undefined;
  } catch (error) {
    console.error(`Failed to get assembly ${id}:`, error);
    return undefined;
  }
}

/**
 * Save an assembly (create or update) with timestamps.
 */
export async function saveAssembly(assembly: Assembly): Promise<void> {
  const now = new Date().toISOString();
  const existing = getAssemblyByIdDB(assembly.id);

  const assemblyWithTimestamps: Assembly = {
    ...assembly,
    updatedAt: now,
    createdAt: assembly.createdAt || (existing ? existing.createdAt : now) || now,
  };

  saveAssemblyDB(assemblyToDBRow(assemblyWithTimestamps));
}

/**
 * Save an assembly locally without triggering cloud sync.
 * Used by sync module to avoid infinite loops.
 */
export async function saveAssemblyLocally(assembly: Assembly): Promise<void> {
  saveAssemblyDB(assemblyToDBRow(assembly));
}

/**
 * Batch save assemblies locally (efficient for sync).
 */
export async function saveAssembliesBatch(assemblies: Assembly[]): Promise<void> {
  const rows = assemblies.map((a) => assemblyToDBRow(a));
  saveAssembliesBatchDB(rows);
}

/**
 * Delete an assembly by ID (soft delete).
 */
export async function deleteAssembly(id: string): Promise<void> {
  deleteAssemblyDB(id);
}

/**
 * Get locally deleted assembly IDs (for cloud cleanup).
 * Uses tombstones since we now hard delete assemblies.
 */
export async function getLocallyDeletedAssemblyIds(): Promise<string[]> {
  return getTombstonesDB('assembly');
}

/**
 * Clear a specific tombstone after successful cloud deletion.
 */
export async function clearDeletedAssemblyId(id: string): Promise<void> {
  try {
    deleteTombstoneDB(id, 'assembly');
  } catch (error) {
    console.error(`Failed to clear tombstone for assembly ${id}:`, error);
  }
}

/**
 * Clear all assembly tombstones (batch operation).
 * @deprecated Use clearDeletedAssemblyId for individual tombstones
 */
export async function clearDeletedAssemblyIds(): Promise<void> {
  // No-op - tombstones are now cleared individually after successful cloud deletion
  // This function is kept for backwards compatibility
}
