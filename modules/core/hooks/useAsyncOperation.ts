// modules/core/hooks/useAsyncOperation.ts
import { useCallback, useState } from "react";

/**
 * Hook for managing async operations with automatic loading state.
 * Useful for refresh handlers, save operations, etc.
 */
export function useAsyncOperation() {
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(async (fn: () => Promise<void>) => {
    setIsLoading(true);
    try {
      await fn();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, execute };
}
