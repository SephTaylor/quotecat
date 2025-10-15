import type { Product } from '@/modules/catalog/seed';
import { useMemo, useState } from 'react';
import type { Selection } from './types';

export function useSelection(initial?: Selection) {
  const [selection, setSelection] = useState<Selection>(initial ?? new Map());

  const setQty = (product: Product, qty: number) => {
    setSelection(prev => {
      const next = new Map(prev);
      const q = Math.max(0, qty | 0);
      if (q === 0) next.delete(product.id);
      else next.set(product.id, { product, qty: q });
      return next;
    });
  };

  const inc = (product: Product, by = 1) =>
    setQty(product, (selection.get(product.id)?.qty ?? 0) + by);

  const dec = (product: Product, by = 1) =>
    setQty(product, (selection.get(product.id)?.qty ?? 0) - by);

  const clear = () => setSelection(new Map());

  const lines = selection.size;
  const units = useMemo(
    () => Array.from(selection.values()).reduce((s, v) => s + v.qty, 0),
    [selection]
  );
  const subtotal = useMemo(
    () => Array.from(selection.values()).reduce((s, v) => s + v.qty * (v.product.unitPrice ?? 0), 0),
    [selection]
  );

  return { selection, setSelection, setQty, inc, dec, clear, lines, units, subtotal };
}
