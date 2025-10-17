import type {
  Assembly,
  AssemblyVarBag,
  PricedLine,
  ProductIndex,
} from "./types";

export function expandAssembly(
  asm: Assembly,
  products: ProductIndex,
  vars: AssemblyVarBag = {},
): PricedLine[] {
  const env: AssemblyVarBag = { ...(asm.defaults ?? {}), ...vars };

  return asm.items
    .map((it) => {
      const product = products[it.productId];
      if (!product) return undefined;

      const qty =
        "qty" in it
          ? Math.max(0, Number(it.qty) || 0)
          : Math.max(0, Number(it.qtyFn(env)) || 0);

      if (qty <= 0) return undefined;

      return {
        id: product.id,
        name: product.name,
        unit: product.unit,
        unitPrice: product.unitPrice,
        qty,
      } as PricedLine;
    })
    .filter(Boolean) as PricedLine[];
}
