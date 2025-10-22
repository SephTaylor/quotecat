// modules/assemblies/validation.ts
// Validates assemblies against current product catalog

import type { Assembly } from "./types";
import type { Product } from "../catalog/seed";

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
};

/**
 * Validate a single assembly against the product catalog
 */
export function validateAssembly(
  assembly: Assembly,
  products: Product[]
): AssemblyValidationResult {
  const errors: AssemblyValidationError[] = [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Check each item in the assembly
  assembly.items.forEach((item) => {
    const product = productMap.get(item.productId);

    // Check if product exists
    if (!product) {
      errors.push({
        type: "missing_product",
        productId: item.productId,
        message: `Product "${item.productId}" no longer exists in catalog`,
      });
      return;
    }

    // Check if quantity is valid (for fixed qty items)
    if (typeof item.qty === "number") {
      if (item.qty <= 0 || !isFinite(item.qty)) {
        errors.push({
          type: "invalid_quantity",
          productId: item.productId,
          productName: product.name,
          message: `Invalid quantity for "${product.name}": ${item.qty}`,
        });
      }
    }

    // For qtyFn, we can't validate without variables
    // But we can check if the function exists
    if (typeof item.qtyFn === "function") {
      try {
        // Test the function with empty vars to see if it throws
        const testResult = item.qtyFn({});
        if (!isFinite(testResult) || testResult < 0) {
          errors.push({
            type: "invalid_quantity",
            productId: item.productId,
            productName: product.name,
            message: `Quantity function for "${product.name}" returns invalid result`,
          });
        }
      } catch (error) {
        errors.push({
          type: "invalid_quantity",
          productId: item.productId,
          productName: product.name,
          message: `Quantity function for "${product.name}" has errors`,
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    assembly,
    errors,
  };
}

/**
 * Validate all assemblies against the product catalog
 * Returns both valid and invalid assemblies
 */
export function validateAllAssemblies(
  assemblies: Assembly[],
  products: Product[]
): {
  valid: Assembly[];
  invalid: AssemblyValidationResult[];
  allValid: boolean;
} {
  const results = assemblies.map((asm) => validateAssembly(asm, products));

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
  products: Product[]
): boolean {
  const result = validateAssembly(assembly, products);
  return !result.isValid;
}

/**
 * Auto-fix an assembly by removing invalid items
 * Returns fixed assembly and list of removed items
 */
export function autoFixAssembly(
  assembly: Assembly,
  products: Product[]
): {
  fixed: Assembly;
  removedItems: string[]; // product IDs that were removed
} {
  const validation = validateAssembly(assembly, products);

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
