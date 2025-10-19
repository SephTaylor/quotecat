// modules/assemblies/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Assembly } from "./types";
import { ASSEMBLY_KEYS } from "@/lib/storageKeys";

const STORAGE_KEY = ASSEMBLY_KEYS.CACHE;

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
 * Save an assembly (create or update).
 */
export async function saveAssembly(assembly: Assembly): Promise<void> {
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
 * Delete an assembly by ID.
 */
export async function deleteAssembly(id: string): Promise<void> {
  const all = await listAssemblies();
  const next = all.filter((a) => a.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/**
 * Initialize storage with seed data if empty.
 */
export async function initAssemblies(seed: Assembly[]): Promise<void> {
  const existing = await listAssemblies();
  if (existing.length === 0) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  }
}
