// Use the Category type from seed instead of redefining it
import { CATEGORIES, PRODUCTS_SEED, type Category, type Product } from "./seed";

// Re-export the type for convenience (optional)
export type { Category };

export async function getCategories(): Promise<Category[]> {
  return CATEGORIES;
}

export async function getProductsByCategory(
  categoryId: string,
): Promise<Product[]> {
  return PRODUCTS_SEED[categoryId] ?? [];
}

export async function getItemsByCategory(): Promise<Record<string, Product[]>> {
  return PRODUCTS_SEED;
}
