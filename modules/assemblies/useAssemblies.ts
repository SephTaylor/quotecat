// modules/assemblies/useAssemblies.ts
import { useCallback, useEffect, useState } from "react";
import { ASSEMBLIES_SEED } from "./seed";
import { initAssemblies, listAssemblies } from "./storage";
import type { Assembly } from "./types";

/**
 * Hook for loading and managing assemblies list.
 * Automatically initializes with seed data on first load.
 */
export function useAssemblies() {
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAssemblies = useCallback(async () => {
    setLoading(true);
    try {
      // Initialize with seed if empty
      await initAssemblies(ASSEMBLIES_SEED);
      // Load all assemblies
      const all = await listAssemblies();
      setAssemblies(all);
    } catch (error) {
      console.error("Failed to load assemblies:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssemblies();
  }, [loadAssemblies]);

  return {
    assemblies,
    loading,
    reload: loadAssemblies,
  };
}
