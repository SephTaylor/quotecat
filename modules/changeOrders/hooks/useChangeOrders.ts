// modules/changeOrders/hooks/useChangeOrders.ts
// Hook for managing change orders state and CRUD operations

import { useState, useCallback, useEffect } from "react";
import type { ChangeOrder, ChangeOrderUpdate } from "../types";
import {
  getChangeOrdersForQuote,
  createChangeOrder,
  updateChangeOrder,
  deleteChangeOrder,
  getNextChangeOrderNumber,
  getNetChangeForQuote,
} from "../storage";

type UseChangeOrdersReturn = {
  changeOrders: ChangeOrder[];
  loading: boolean;
  error: string | null;
  netChange: number;
  refresh: () => Promise<void>;
  create: (co: Omit<ChangeOrder, "number">) => Promise<ChangeOrder>;
  update: (update: ChangeOrderUpdate) => Promise<void>;
  remove: (coId: string) => Promise<void>;
};

/**
 * Hook for managing change orders for a specific quote
 */
export function useChangeOrders(quoteId: string): UseChangeOrdersReturn {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [netChange, setNetChange] = useState(0);

  const refresh = useCallback(async () => {
    if (!quoteId) return;

    setLoading(true);
    setError(null);

    try {
      const [cos, net] = await Promise.all([
        getChangeOrdersForQuote(quoteId),
        getNetChangeForQuote(quoteId),
      ]);

      // Sort by number descending (most recent first)
      setChangeOrders(cos.sort((a, b) => b.number - a.number));
      setNetChange(net);
    } catch (err) {
      console.error("Failed to load change orders:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  // Load on mount and when quoteId changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (coData: Omit<ChangeOrder, "number">): Promise<ChangeOrder> => {
      const number = await getNextChangeOrderNumber(quoteId);
      const co: ChangeOrder = {
        ...coData,
        number,
      };

      await createChangeOrder(co);
      await refresh();
      return co;
    },
    [quoteId, refresh]
  );

  const update = useCallback(
    async (updateData: ChangeOrderUpdate): Promise<void> => {
      await updateChangeOrder(quoteId, updateData);
      await refresh();
    },
    [quoteId, refresh]
  );

  const remove = useCallback(
    async (coId: string): Promise<void> => {
      await deleteChangeOrder(quoteId, coId);
      await refresh();
    },
    [quoteId, refresh]
  );

  return {
    changeOrders,
    loading,
    error,
    netChange,
    refresh,
    create,
    update,
    remove,
  };
}
