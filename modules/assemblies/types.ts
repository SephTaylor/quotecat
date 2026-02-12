import type { Product } from "@/modules/catalog/seed";

export type AssemblyVarBag = Record<string, number | string | boolean>;

/**
 * Source of the product reference in an assembly item
 * - "catalog": References a product from the built-in catalog (real-time pricing from suppliers)
 * - "pricebook": References a user's custom pricebook item
 */
export type ItemSource = "catalog" | "pricebook";

export type AssemblyItem =
  | { productId: string; source?: ItemSource; qty: number; name?: string } // fixed qty
  | { productId: string; source?: ItemSource; qtyFn: (vars: AssemblyVarBag) => number; name?: string }; // computed

export type Assembly = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  // flat list; grouping is a UI concern
  items: AssemblyItem[];
  // optional default variables (e.g., roomLengthFt)
  defaults?: AssemblyVarBag;
  // timestamps for cloud sync
  createdAt?: string;
  updatedAt?: string;
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
