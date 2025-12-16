import type { Product } from "@/modules/catalog/seed";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import type { Selection } from "./types";

export function useSelection(initial?: Selection) {
  const [selection, setSelection] = useState<Selection>(initial ?? new Map());

  // Keep a ref to the current selection for synchronous access
  const selectionRef = useRef<Selection>(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const setQty = useCallback((product: Product, qty: number) => {
    setSelection((prev) => {
      const next = new Map(prev);
      const q = Math.max(0, qty | 0);
      if (q === 0) next.delete(product.id);
      else next.set(product.id, { product, qty: q });
      return next;
    });
  }, []);

  // Use functional update to avoid stale closure
  const inc = useCallback((product: Product, by = 1) => {
    setSelection((prev) => {
      const currentQty = prev.get(product.id)?.qty ?? 0;
      const next = new Map(prev);
      const newQty = Math.max(0, currentQty + by);
      if (newQty === 0) next.delete(product.id);
      else next.set(product.id, { product, qty: newQty });
      return next;
    });
  }, []);

  // Use functional update to avoid stale closure
  const dec = useCallback((product: Product, by = 1) => {
    setSelection((prev) => {
      const currentQty = prev.get(product.id)?.qty ?? 0;
      const next = new Map(prev);
      const newQty = Math.max(0, currentQty - by);
      if (newQty === 0) next.delete(product.id);
      else next.set(product.id, { product, qty: newQty });
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelection(new Map()), []);

  const lines = selection.size;
  const units = useMemo(
    () => Array.from(selection.values()).reduce((s, v) => s + v.qty, 0),
    [selection],
  );
  const subtotal = useMemo(
    () =>
      Array.from(selection.values()).reduce(
        (s, v) => s + v.qty * (v.product.unitPrice ?? 0),
        0,
      ),
    [selection],
  );

  // Get the current selection (useful for async operations after state updates)
  const getSelection = useCallback(() => selectionRef.current, []);

  return {
    selection,
    setSelection,
    setQty,
    inc,
    dec,
    clear,
    lines,
    units,
    subtotal,
    getSelection,
  };
}
