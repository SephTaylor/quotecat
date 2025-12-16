// modules/assemblies/useAssemblies.ts
import { useCallback, useEffect, useState } from "react";
import { listAssemblies } from "./storage";
import type { Assembly } from "./types";

/**
 * Hook for loading and managing user's assemblies.
 */
export function useAssemblies() {
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAssemblies = useCallback(async () => {
    setLoading(true);
    try {
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
