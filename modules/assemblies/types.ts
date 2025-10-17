import type { Product } from "@/modules/catalog/seed";

export type AssemblyVarBag = Record<string, number | string | boolean>;

export type AssemblyItem =
  | { productId: string; qty: number } // fixed qty
  | { productId: string; qtyFn: (vars: AssemblyVarBag) => number }; // computed

export type Assembly = {
  id: string;
  name: string;
  // flat list; grouping is a UI concern
  items: AssemblyItem[];
  // optional default variables (e.g., roomLengthFt)
  defaults?: AssemblyVarBag;
};

export type PricedLine = {
  id: string; // product id
  name: string;
  unit: string;
  unitPrice: number;
  qty: number;
};

// Helper lookup shape for pricing
export type ProductIndex = Record<string, Product>;
