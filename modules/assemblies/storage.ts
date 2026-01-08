// modules/assemblies/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Assembly } from "./types";
import { ASSEMBLY_KEYS } from "@/lib/storageKeys";

const STORAGE_KEY = ASSEMBLY_KEYS.CACHE;
const DELETED_IDS_KEY = "@quotecat/assemblies_deleted_ids";

/**
 * Load all assemblies from storage.
 * Returns seed data if storage is empty.
 */
export async function listAssemblies(): Promise<Assembly[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      // Return empty array - seed will be loaded separately
      return [];
    }
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
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
  const all = await listAssemblies();
  return all.find((a) => a.id === id);
}

/**
 * Save an assembly (create or update) with timestamps.
 */
export async function saveAssembly(assembly: Assembly): Promise<void> {
  const all = await listAssemblies();
  const idx = all.findIndex((a) => a.id === assembly.id);
  const now = new Date().toISOString();

  const assemblyWithTimestamps: Assembly = {
    ...assembly,
    updatedAt: now,
    createdAt: assembly.createdAt || (idx === -1 ? now : all[idx]?.createdAt || now),
  };

  if (idx === -1) {
    all.push(assemblyWithTimestamps);
  } else {
    all[idx] = assemblyWithTimestamps;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Save an assembly locally without triggering cloud sync.
 * Used by sync module to avoid infinite loops.
 */
export async function saveAssemblyLocally(assembly: Assembly): Promise<void> {
  const all = await listAssemblies();
  const idx = all.findIndex((a) => a.id === assembly.id);

  if (idx === -1) {
    all.push(assembly);
  } else {
    all[idx] = assembly;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Batch save assemblies locally (efficient for sync).
 */
export async function saveAssembliesBatch(assemblies: Assembly[]): Promise<void> {
  const all = await listAssemblies();
  const existingMap = new Map(all.map((a) => [a.id, a]));

  for (const assembly of assemblies) {
    existingMap.set(assembly.id, assembly);
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(existingMap.values())));
}

/**
 * Delete an assembly by ID (tracks for cloud sync).
 */
export async function deleteAssembly(id: string): Promise<void> {
  const all = await listAssemblies();
  const next = all.filter((a) => a.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  // Track deleted ID for sync
  await trackDeletedAssemblyId(id);
}

/**
 * Track a deleted assembly ID for cloud sync cleanup.
 */
async function trackDeletedAssemblyId(id: string): Promise<void> {
  try {
    const json = await AsyncStorage.getItem(DELETED_IDS_KEY);
    const ids: string[] = json ? JSON.parse(json) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      await AsyncStorage.setItem(DELETED_IDS_KEY, JSON.stringify(ids));
    }
  } catch (error) {
    console.error("Failed to track deleted assembly ID:", error);
  }
}

/**
 * Get locally deleted assembly IDs (for cloud cleanup).
 */
export async function getLocallyDeletedAssemblyIds(): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(DELETED_IDS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

/**
 * Clear the deleted assembly IDs list (after cloud cleanup).
 */
export async function clearDeletedAssemblyIds(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DELETED_IDS_KEY);
  } catch (error) {
    console.error("Failed to clear deleted assembly IDs:", error);
  }
}

