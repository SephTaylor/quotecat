// modules/assemblies/helpers.ts
import type { Product } from "@/modules/catalog/seed";
import { PRODUCTS_SEED } from "@/modules/catalog/seed";
import type { ProductIndex } from "./types";

/**
 * Build a product lookup index from seed data.
 */
export function buildProductIndex(): ProductIndex {
  const index: ProductIndex = {};

  // Flatten all products from all categories
  Object.values(PRODUCTS_SEED).forEach((products) => {
    products.forEach((product) => {
      index[product.id] = product;
    });
  });

  return index;
}
