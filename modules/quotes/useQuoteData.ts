// modules/quotes/useQuoteData.ts
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { getQuoteById, type StoredQuote } from "./index";

/**
 * Hook for loading quote data with automatic refetch on screen focus.
 * Handles loading state, error handling, and refetch logic.
 */
export function useQuoteData(id?: string) {
  const [quote, setQuote] = useState<StoredQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setQuote(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const q = await getQuoteById(id);
      setQuote(q);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load on mount
  useEffect(() => {
    load();
  }, [load]);

  // Refetch on screen focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { quote, loading, error, refetch: load };
}
