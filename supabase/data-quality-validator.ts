/**
 * Data Quality Validator for Xbyte Product Data
 *
 * Validates product data before importing to Supabase
 * Ensures data meets QuoteCat quality standards
 */

export interface XbyteProduct {
  'Id'?: number;
  'Product ID / SKU'?: string | number;
  'Product Name'?: string;
  'Price (USD)'?: number;
  'Unit of Measure'?: string;
  'Category'?: string;
  'Retailer Identifier'?: string;
  'Brand'?: string;
  'In-Stock Status'?: string;
  'Product URL'?: string;
  'Last Update Timestamp'?: string;
}

export interface ValidationError {
  severity: 'critical' | 'warning' | 'info';
  field: string;
  message: string;
  productId?: string | number;
  productName?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  stats: {
    total: number;
    passed: number;
    failed: number;
    criticalErrors: number;
    warnings: number;
  };
}

// Valid retailer identifiers
const VALID_RETAILERS = ['homedepot', 'lowes', 'menards', 'Home Depot', 'Lowes', 'Lowe\'s', 'Menards'];

// Unit standardization map
export const UNIT_STANDARDIZATION: Record<string, string> = {
  // Each variants
  'each': 'EA',
  'Each': 'EA',
  'Unit': 'EA',
  'Piece': 'EA',
  'piece': 'EA',
  'Pieces': 'EA',
  'PC': 'EA',

  // Linear foot variants
  'foot': 'LF',
  'Foot': 'LF',
  'Feet': 'LF',
  'Linear Foot': 'LF',
  'FT': 'LF',

  // Square foot variants
  'Sq. Feet': 'SF',
  'Square Foot': 'SF',
  'SQ FT': 'SF',

  // Box variants
  'box': 'BOX',
  'Box': 'BOX',
  'package': 'BOX',
  'Package': 'BOX',
  'pkg': 'BOX',
  'PKG': 'BOX',

  // Other units
  'gallon': 'GAL',
  'Gallon': 'GAL',
  'Gallons': 'GAL',
  'gal': 'GAL',

  'quart': 'QT',
  'Quart': 'QT',
  'Quarts': 'QT',

  'roll': 'ROLL',
  'Roll': 'ROLL',

  'bag': 'BAG',
  'Bag': 'BAG',

  'lbs.': 'LB',
  'lbs': 'LB',
  'Pounds': 'LB',

  'oz.': 'OZ',
  'oz': 'OZ',
  'Ounces': 'OZ',

  'Inches': 'IN',
  'inches': 'IN',

  'Count': 'CT',
  'count': 'CT'
};

/**
 * Standardize unit of measure to QuoteCat format
 */
export function standardizeUnit(unit: string | undefined): string | null {
  if (!unit) return null;

  // Return standardized unit or original if not in map
  return UNIT_STANDARDIZATION[unit] || unit.toUpperCase();
}

/**
 * Validate a single product
 */
export function validateProduct(product: XbyteProduct): ValidationError[] {
  const errors: ValidationError[] = [];
  const productId = product['Product ID / SKU'];
  const productName = product['Product Name'];

  // Critical: Required fields
  if (!productId) {
    errors.push({
      severity: 'critical',
      field: 'Product ID / SKU',
      message: 'Missing product ID/SKU (required)',
      productName
    });
  }

  if (!productName || productName.trim() === '') {
    errors.push({
      severity: 'critical',
      field: 'Product Name',
      message: 'Missing product name (required)',
      productId
    });
  }

  if (product['Price (USD)'] === undefined || product['Price (USD)'] === null) {
    errors.push({
      severity: 'critical',
      field: 'Price (USD)',
      message: 'Missing price (required)',
      productId,
      productName
    });
  }

  if (!product['Unit of Measure']) {
    errors.push({
      severity: 'critical',
      field: 'Unit of Measure',
      message: 'Missing unit of measure (required for production)',
      productId,
      productName
    });
  }

  if (!product['Category']) {
    errors.push({
      severity: 'critical',
      field: 'Category',
      message: 'Missing category (required)',
      productId,
      productName
    });
  }

  if (!product['Retailer Identifier']) {
    errors.push({
      severity: 'critical',
      field: 'Retailer Identifier',
      message: 'Missing retailer identifier (required)',
      productId,
      productName
    });
  }

  // Validation: Data types and values
  const price = product['Price (USD)'];
  if (price !== undefined && price !== null) {
    if (typeof price !== 'number' || isNaN(price)) {
      errors.push({
        severity: 'critical',
        field: 'Price (USD)',
        message: `Invalid price format: ${price}`,
        productId,
        productName
      });
    } else if (price <= 0) {
      errors.push({
        severity: 'warning',
        field: 'Price (USD)',
        message: `Price is zero or negative: $${price}`,
        productId,
        productName
      });
    } else if (price > 10000) {
      errors.push({
        severity: 'warning',
        field: 'Price (USD)',
        message: `Unusually high price: $${price} (review for accuracy)`,
        productId,
        productName
      });
    } else if (price < 0.10) {
      errors.push({
        severity: 'info',
        field: 'Price (USD)',
        message: `Very low price: $${price}`,
        productId,
        productName
      });
    }
  }

  // Validation: Retailer
  const retailer = product['Retailer Identifier'];
  if (retailer && !VALID_RETAILERS.includes(retailer)) {
    errors.push({
      severity: 'warning',
      field: 'Retailer Identifier',
      message: `Unknown retailer: ${retailer}`,
      productId,
      productName
    });
  }

  // Validation: Unit standardization
  const unit = product['Unit of Measure'];
  if (unit) {
    const standardized = standardizeUnit(unit);
    if (!standardized) {
      errors.push({
        severity: 'warning',
        field: 'Unit of Measure',
        message: `Unknown unit: ${unit} (needs manual mapping)`,
        productId,
        productName
      });
    }
  }

  // Info: Missing optional fields
  if (!product['Brand']) {
    errors.push({
      severity: 'info',
      field: 'Brand',
      message: 'Missing brand (optional)',
      productId,
      productName
    });
  }

  if (!product['In-Stock Status']) {
    errors.push({
      severity: 'info',
      field: 'In-Stock Status',
      message: 'Missing stock status (optional)',
      productId,
      productName
    });
  }

  return errors;
}

/**
 * Validate a batch of products
 */
export function validateProducts(products: XbyteProduct[]): ValidationResult {
  const allErrors: ValidationError[] = [];
  const productIds = new Set<string>();
  const duplicateIds: string[] = [];

  // Validate each product
  products.forEach(product => {
    const errors = validateProduct(product);
    allErrors.push(...errors);

    // Check for duplicate IDs within same retailer
    const id = product['Product ID / SKU'];
    const retailer = product['Retailer Identifier'];
    if (id && retailer) {
      const key = `${retailer}:${id}`;
      if (productIds.has(key)) {
        duplicateIds.push(key);
        allErrors.push({
          severity: 'warning',
          field: 'Product ID / SKU',
          message: `Duplicate product ID within retailer: ${id}`,
          productId: id,
          productName: product['Product Name']
        });
      }
      productIds.add(key);
    }
  });

  // Separate by severity
  const critical = allErrors.filter(e => e.severity === 'critical');
  const warnings = allErrors.filter(e => e.severity === 'warning');
  const info = allErrors.filter(e => e.severity === 'info');

  const failed = new Set(critical.map(e => e.productId)).size;
  const passed = products.length - failed;

  return {
    valid: critical.length === 0,
    errors: critical,
    warnings,
    info,
    stats: {
      total: products.length,
      passed,
      failed,
      criticalErrors: critical.length,
      warnings: warnings.length
    }
  };
}

/**
 * Format validation results for console output
 */
export function formatValidationResults(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('\n📊 DATA QUALITY VALIDATION RESULTS\n');
  lines.push('='.repeat(80));

  // Stats
  lines.push(`\nTotal Products: ${result.stats.total}`);
  lines.push(`✅ Passed: ${result.stats.passed} (${((result.stats.passed / result.stats.total) * 100).toFixed(1)}%)`);
  lines.push(`❌ Failed: ${result.stats.failed}`);
  lines.push(`🚨 Critical Errors: ${result.stats.criticalErrors}`);
  lines.push(`⚠️  Warnings: ${result.stats.warnings}`);

  // Critical errors
  if (result.errors.length > 0) {
    lines.push('\n\n🚨 CRITICAL ERRORS (Must Fix):\n');
    lines.push('-'.repeat(80));

    // Group by error type
    const grouped = new Map<string, ValidationError[]>();
    result.errors.forEach(error => {
      const key = `${error.field}: ${error.message}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(error);
    });

    grouped.forEach((errors, key) => {
      lines.push(`\n${key}`);
      lines.push(`   Affected products: ${errors.length}`);
      if (errors.length <= 5) {
        errors.forEach(e => {
          lines.push(`   • ${e.productName || e.productId || 'Unknown'}`);
        });
      } else {
        lines.push(`   • ${errors[0].productName || errors[0].productId || 'Unknown'}`);
        lines.push(`   • ... and ${errors.length - 1} more`);
      }
    });
  }

  // Warnings
  if (result.warnings.length > 0 && result.warnings.length <= 20) {
    lines.push('\n\n⚠️  WARNINGS (Review Recommended):\n');
    lines.push('-'.repeat(80));

    result.warnings.slice(0, 10).forEach(warning => {
      lines.push(`\n${warning.field}: ${warning.message}`);
      lines.push(`   Product: ${warning.productName || warning.productId || 'Unknown'}`);
    });

    if (result.warnings.length > 10) {
      lines.push(`\n... and ${result.warnings.length - 10} more warnings`);
    }
  }

  // Overall result
  lines.push('\n' + '='.repeat(80));
  if (result.valid) {
    lines.push('\n✅ VALIDATION PASSED - Data is ready to import');
  } else {
    lines.push('\n❌ VALIDATION FAILED - Fix critical errors before importing');
  }
  lines.push('\n');

  return lines.join('\n');
}

/**
 * Get products that failed validation (have critical errors)
 */
export function getFailedProducts(products: XbyteProduct[]): XbyteProduct[] {
  return products.filter(product => {
    const errors = validateProduct(product);
    return errors.some(e => e.severity === 'critical');
  });
}

/**
 * Get products that passed validation
 */
export function getValidProducts(products: XbyteProduct[]): XbyteProduct[] {
  return products.filter(product => {
    const errors = validateProduct(product);
    return !errors.some(e => e.severity === 'critical');
  });
}
