// modules/job-calculator/searchProducts.ts
// Product matching logic for job calculator material requirements

import { searchProducts as searchProductsFTS } from '@/modules/catalog/productService';
import type { MaterialRequirement, MatchedProduct, MaterialWithProducts } from './types';

/**
 * Search for products matching a material requirement.
 * Tries each search term until results are found.
 */
async function findProductsForMaterial(
  requirement: MaterialRequirement,
  maxResults: number = 3
): Promise<MatchedProduct[]> {
  // Try each search term until we get results
  for (const term of requirement.searchTerms) {
    const products = await searchProductsFTS(term);

    if (products.length > 0) {
      // Map to MatchedProduct format, taking top results
      return products.slice(0, maxResults).map((p) => ({
        id: p.id,
        name: p.name,
        unitPrice: p.unitPrice,
        unit: p.unit,
        supplierId: p.supplierId,
      }));
    }
  }

  // No products found for any search term
  return [];
}

/**
 * Match all material requirements to products from the catalog.
 * Returns materials with matched products and selection state.
 */
export async function matchProductsToMaterials(
  requirements: MaterialRequirement[]
): Promise<MaterialWithProducts[]> {
  const results = await Promise.all(
    requirements.map(async (requirement) => {
      const products = await findProductsForMaterial(requirement);

      return {
        requirement,
        products,
        // Auto-select the first product if available (cheapest is usually first)
        selectedProductId: products.length > 0 ? products[0].id : null,
        selectedQty: requirement.qty,
      };
    })
  );

  return results;
}

/**
 * Calculate total cost for matched materials.
 * Only counts materials with a selected product.
 */
export function calculateTotalCost(materials: MaterialWithProducts[]): number {
  return materials.reduce((total, material) => {
    if (!material.selectedProductId) return total;

    const selectedProduct = material.products.find(
      (p) => p.id === material.selectedProductId
    );

    if (!selectedProduct) return total;

    return total + selectedProduct.unitPrice * material.selectedQty;
  }, 0);
}

/**
 * Update the selected product for a material.
 */
export function selectProduct(
  materials: MaterialWithProducts[],
  requirementCategory: string,
  requirementName: string,
  productId: string
): MaterialWithProducts[] {
  return materials.map((m) => {
    if (
      m.requirement.category === requirementCategory &&
      m.requirement.name === requirementName
    ) {
      return { ...m, selectedProductId: productId };
    }
    return m;
  });
}

/**
 * Update the quantity for a material.
 */
export function updateQuantity(
  materials: MaterialWithProducts[],
  requirementCategory: string,
  requirementName: string,
  newQty: number
): MaterialWithProducts[] {
  return materials.map((m) => {
    if (
      m.requirement.category === requirementCategory &&
      m.requirement.name === requirementName
    ) {
      return { ...m, selectedQty: Math.max(0, newQty) };
    }
    return m;
  });
}

/**
 * Get unmatched materials (no products found).
 * Useful for showing a warning to the user.
 */
export function getUnmatchedMaterials(
  materials: MaterialWithProducts[]
): MaterialWithProducts[] {
  return materials.filter((m) => m.products.length === 0);
}

/**
 * Group materials by category for display.
 */
export function groupMaterialsByCategory(
  materials: MaterialWithProducts[]
): Record<string, MaterialWithProducts[]> {
  return materials.reduce(
    (groups, material) => {
      const category = material.requirement.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(material);
      return groups;
    },
    {} as Record<string, MaterialWithProducts[]>
  );
}
