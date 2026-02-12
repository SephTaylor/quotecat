// modules/assemblies/validation.ts
// Validates assemblies against current product catalog and pricebook

import type { Assembly, AssemblyItem } from "./types";
import type { Product } from "../catalog/seed";
import type { PricebookItem } from "@/lib/types";

export type AssemblyValidationResult = {
  isValid: boolean;
  assembly: Assembly;
  errors: AssemblyValidationError[];
};

export type AssemblyValidationError = {
  type: "missing_product" | "invalid_quantity";
  productId: string;
  productName?: string; // If we can still find it
  message: string;
  source?: "catalog" | "pricebook";
};

/**
 * Validate a single assembly against the product catalog and optionally pricebook
 * @param assembly - The assembly to validate
 * @param products - Catalog products to validate against
 * @param pricebookItems - Optional pricebook items for validating pricebook-source items
 */
export function validateAssembly(
  assembly: Assembly,
  products: Product[],
  pricebookItems?: PricebookItem[]
): AssemblyValidationResult {
  const errors: AssemblyValidationError[] = [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const pricebookMap = pricebookItems
    ? new Map(pricebookItems.map((p) => [p.id, p]))
    : new Map<string, PricebookItem>();

  // Check each item in the assembly
  assembly.items.forEach((item) => {
    const source = item.source || "catalog"; // Default to catalog for backwards compatibility

    if (source === "catalog") {
      // Validate against catalog products
      const product = productMap.get(item.productId);

      if (!product) {
        errors.push({
          type: "missing_product",
          productId: item.productId,
          message: `Product "${item.name || item.productId}" no longer exists in catalog`,
          source: "catalog",
        });
        return;
      }

      validateQuantity(item, product.name, errors);
    } else if (source === "pricebook") {
      // Validate against pricebook items
      const pricebookItem = pricebookMap.get(item.productId);

      if (!pricebookItem) {
        // For pricebook items, we're more lenient - just warn, don't block
        // User may have deleted the pricebook item
        errors.push({
          type: "missing_product",
          productId: item.productId,
          productName: item.name,
          message: `Pricebook item "${item.name || item.productId}" not found`,
          source: "pricebook",
        });
        return;
      }

      validateQuantity(item, pricebookItem.name, errors);
    }
  });

  return {
    isValid: errors.length === 0,
    assembly,
    errors,
  };
}

/**
 * Helper to validate quantity for an assembly item
 */
function validateQuantity(
  item: AssemblyItem,
  productName: string,
  errors: AssemblyValidationError[]
): void {
  // Check if quantity is valid (for fixed qty items)
  if ("qty" in item) {
    if (item.qty <= 0 || !isFinite(item.qty)) {
      errors.push({
        type: "invalid_quantity",
        productId: item.productId,
        productName,
        message: `Invalid quantity for "${productName}": ${item.qty}`,
      });
    }
  }

  // For qtyFn, we can't validate without variables
  // But we can check if the function exists
  if ("qtyFn" in item) {
    try {
      // Test the function with empty vars to see if it throws
      const testResult = item.qtyFn({});
      if (!isFinite(testResult) || testResult < 0) {
        errors.push({
          type: "invalid_quantity",
          productId: item.productId,
          productName,
          message: `Quantity function for "${productName}" returns invalid result`,
        });
      }
    } catch (error) {
      errors.push({
        type: "invalid_quantity",
        productId: item.productId,
        productName,
        message: `Quantity function for "${productName}" has errors`,
      });
    }
  }
}

/**
 * Validate all assemblies against the product catalog and pricebook
 * Returns both valid and invalid assemblies
 */
export function validateAllAssemblies(
  assemblies: Assembly[],
  products: Product[],
  pricebookItems?: PricebookItem[]
): {
  valid: Assembly[];
  invalid: AssemblyValidationResult[];
  allValid: boolean;
} {
  const results = assemblies.map((asm) => validateAssembly(asm, products, pricebookItems));

  const valid = results.filter((r) => r.isValid).map((r) => r.assembly);
  const invalid = results.filter((r) => !r.isValid);

  return {
    valid,
    invalid,
    allValid: invalid.length === 0,
  };
}

/**
 * Get a user-friendly summary of validation errors
 */
export function getValidationSummary(
  result: AssemblyValidationResult
): string {
  if (result.isValid) {
    return "Assembly is valid";
  }

  const missingProducts = result.errors.filter(
    (e) => e.type === "missing_product"
  );
  const invalidQty = result.errors.filter((e) => e.type === "invalid_quantity");

  const parts: string[] = [];

  if (missingProducts.length > 0) {
    parts.push(
      `${missingProducts.length} product${missingProducts.length !== 1 ? "s" : ""} no longer available`
    );
  }

  if (invalidQty.length > 0) {
    parts.push(
      `${invalidQty.length} invalid quantit${invalidQty.length !== 1 ? "ies" : "y"}`
    );
  }

  return parts.join(", ");
}

/**
 * Check if an assembly needs review
 * This can be expanded to include other health checks
 */
export function assemblyNeedsReview(
  assembly: Assembly,
  products: Product[],
  pricebookItems?: PricebookItem[]
): boolean {
  const result = validateAssembly(assembly, products, pricebookItems);
  return !result.isValid;
}

/**
 * Auto-fix an assembly by removing invalid items
 * Returns fixed assembly and list of removed items
 */
export function autoFixAssembly(
  assembly: Assembly,
  products: Product[],
  pricebookItems?: PricebookItem[]
): {
  fixed: Assembly;
  removedItems: string[]; // product IDs that were removed
} {
  const validation = validateAssembly(assembly, products, pricebookItems);

  if (validation.isValid) {
    return { fixed: assembly, removedItems: [] };
  }

  // Get IDs of products that have errors
  const errorProductIds = new Set(validation.errors.map((e) => e.productId));

  // Filter out items with errors
  const validItems = assembly.items.filter(
    (item) => !errorProductIds.has(item.productId)
  );

  return {
    fixed: {
      ...assembly,
      items: validItems,
    },
    removedItems: Array.from(errorProductIds),
  };
}
