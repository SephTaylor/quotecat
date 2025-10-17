import type { Product } from "@/modules/catalog/seed";

export type SelectionEntry = { product: Product; qty: number };
export type Selection = Map<string, SelectionEntry>;
