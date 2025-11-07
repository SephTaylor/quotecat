// Script to import retailer data from RetailGators (CSV or JSON)
// Run with: npx tsx supabase/import_retailer_data.ts <file_path>

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Category mapping: RetailGators categories -> Our category IDs
const CATEGORY_MAP: Record<string, string> = {
  // Lumber variations
  'lumber': 'framing',
  'dimensional lumber': 'framing',
  'framing lumber': 'framing',
  'plywood': 'framing',
  'osb': 'framing',
  'engineered lumber': 'framing',

  // Fasteners
  'nails': 'fasteners',
  'screws': 'fasteners',
  'bolts': 'fasteners',
  'anchors': 'fasteners',
  'adhesives': 'fasteners',
  'construction adhesive': 'fasteners',

  // Drywall
  'drywall': 'drywall',
  'gypsum': 'drywall',
  'joint compound': 'drywall',
  'drywall tape': 'drywall',

  // Electrical
  'electrical': 'electrical',
  'wire': 'electrical',
  'cable': 'electrical',
  'conduit': 'electrical',
  'outlets': 'electrical',
  'switches': 'electrical',
  'breakers': 'electrical',
  'electrical boxes': 'electrical',

  // Plumbing
  'plumbing': 'plumbing',
  'pipe': 'plumbing',
  'fittings': 'plumbing',
  'fixtures': 'plumbing',
  'valves': 'plumbing',
  'pex': 'plumbing',
  'pvc': 'plumbing',
  'copper pipe': 'plumbing',

  // Roofing
  'roofing': 'roofing',
  'shingles': 'roofing',
  'underlayment': 'roofing',
  'flashing': 'roofing',
  'gutters': 'roofing',
  'downspouts': 'roofing',

  // Masonry
  'masonry': 'masonry',
  'concrete': 'masonry',
  'cement': 'masonry',
  'mortar': 'masonry',
  'blocks': 'masonry',
  'bricks': 'masonry',
  'rebar': 'masonry',

  // HVAC
  'hvac': 'hvac',
  'heating': 'hvac',
  'cooling': 'hvac',
  'ductwork': 'hvac',
  'vents': 'hvac',
  'furnaces': 'hvac',
  'air conditioning': 'hvac',

  // Insulation
  'insulation': 'insulation',
  'batt insulation': 'insulation',
  'spray foam': 'insulation',
  'rigid foam': 'insulation',
  'vapor barrier': 'insulation',

  // Flooring
  'flooring': 'flooring',
  'hardwood': 'flooring',
  'laminate': 'flooring',
  'vinyl': 'flooring',
  'tile': 'flooring',
  'carpet': 'flooring',

  // Painting
  'paint': 'painting',
  'painting': 'painting',
  'primer': 'painting',
  'stain': 'painting',
  'painting supplies': 'painting',
};

// Unit standardization: Retailer units -> Our standard units
const UNIT_MAP: Record<string, string> = {
  'each': 'EA',
  'unit': 'EA',
  'piece': 'EA',
  'pc': 'EA',
  'ea': 'EA',

  'linear foot': 'LF',
  'foot': 'LF',
  'ft': 'LF',
  'linear feet': 'LF',
  'lf': 'LF',

  'square foot': 'SF',
  'sq ft': 'SF',
  'square feet': 'SF',
  'sf': 'SF',

  'box': 'BOX',
  'package': 'BOX',
  'pkg': 'BOX',
  'carton': 'BOX',

  'sheet': 'SHEET',
  'panel': 'SHEET',

  'roll': 'ROLL',

  'gallon': 'GAL',
  'gal': 'GAL',

  'bucket': 'BUCKET',
  'pail': 'BUCKET',

  'bag': 'BAG',
  'sack': 'BAG',

  'bundle': 'BUNDLE',
};

// Retailer name normalization
const RETAILER_MAP: Record<string, string> = {
  'home depot': 'homedepot',
  'homedepot': 'homedepot',
  'the home depot': 'homedepot',

  'lowes': 'lowes',
  'lowe\'s': 'lowes',
  "lowe's": 'lowes',

  'menards': 'menards',
  'menard\'s': 'menards',
  "menard's": 'menards',
};

// =============================================================================
// TYPES
// =============================================================================

type RawProduct = {
  product_id: string;
  name: string;
  price: string | number;
  unit: string;
  category: string;
  retailer: string;
  description?: string;
  sku?: string;
  in_stock?: string | boolean;
  [key: string]: any; // Allow extra fields
};

type ImportedProduct = {
  id: string;
  category_id: string;
  name: string;
  unit: string;
  unit_price: number;
  retailer: string;
  data_source: 'retailer_scraped';
  description?: string;
  sku?: string;
  in_stock?: boolean;
};

type ValidationResult = {
  valid: ImportedProduct[];
  invalid: Array<{ product: RawProduct; errors: string[] }>;
  warnings: Array<{ product: ImportedProduct; warnings: string[] }>;
  stats: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
};

// =============================================================================
// CATEGORY MAPPING
// =============================================================================

function mapCategory(rawCategory: string): string | null {
  const normalized = rawCategory.toLowerCase().trim();
  return CATEGORY_MAP[normalized] || null;
}

// =============================================================================
// UNIT MAPPING
// =============================================================================

function mapUnit(rawUnit: string): string {
  const normalized = rawUnit.toLowerCase().trim();
  return UNIT_MAP[normalized] || rawUnit.toUpperCase();
}

// =============================================================================
// RETAILER MAPPING
// =============================================================================

function mapRetailer(rawRetailer: string): string | null {
  const normalized = rawRetailer.toLowerCase().trim();
  return RETAILER_MAP[normalized] || normalized;
}

// =============================================================================
// PRODUCT ID GENERATION
// =============================================================================

function generateProductId(product: RawProduct, index: number): string {
  // If product_id exists and looks valid, use it
  if (product.product_id && product.product_id.trim().length > 0) {
    return product.product_id.trim();
  }

  // Otherwise generate: retailer-sku or retailer-index
  const retailer = mapRetailer(product.retailer) || 'unknown';
  const sku = product.sku?.trim() || `product-${index}`;
  return `${retailer}-${sku}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateProduct(raw: RawProduct, index: number): { product: ImportedProduct | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!raw.name || raw.name.trim().length === 0) {
    errors.push('Missing product name');
  }

  if (!raw.price || isNaN(parseFloat(String(raw.price)))) {
    errors.push('Missing or invalid price');
  }

  const price = parseFloat(String(raw.price));
  if (price < 0) {
    errors.push('Price cannot be negative');
  }
  if (price === 0) {
    warnings.push('Price is $0 - may be discontinued');
  }
  if (price > 10000) {
    warnings.push('Price is very high - verify accuracy');
  }

  if (!raw.unit || raw.unit.trim().length === 0) {
    errors.push('Missing unit');
  }

  if (!raw.category || raw.category.trim().length === 0) {
    errors.push('Missing category');
  }

  const mappedCategory = mapCategory(raw.category);
  if (!mappedCategory) {
    errors.push(`Unknown category: "${raw.category}" - needs mapping`);
  }

  if (!raw.retailer || raw.retailer.trim().length === 0) {
    errors.push('Missing retailer');
  }

  const mappedRetailer = mapRetailer(raw.retailer);
  if (!mappedRetailer) {
    errors.push(`Unknown retailer: "${raw.retailer}"`);
  }

  // If any errors, return early
  if (errors.length > 0) {
    return { product: null, errors, warnings };
  }

  // Build valid product
  const product: ImportedProduct = {
    id: generateProductId(raw, index),
    category_id: mappedCategory!,
    name: raw.name.trim(),
    unit: mapUnit(raw.unit),
    unit_price: price,
    retailer: mappedRetailer!,
    data_source: 'retailer_scraped',
  };

  // Optional fields
  if (raw.description && raw.description.trim().length > 0) {
    product.description = raw.description.trim();
  }

  if (raw.sku && raw.sku.trim().length > 0) {
    product.sku = raw.sku.trim();
  }

  if (raw.in_stock !== undefined) {
    if (typeof raw.in_stock === 'boolean') {
      product.in_stock = raw.in_stock;
    } else if (typeof raw.in_stock === 'string') {
      product.in_stock = raw.in_stock.toLowerCase() === 'true' || raw.in_stock === '1';
    }
  }

  return { product, errors, warnings };
}

// =============================================================================
// IMPORT FROM CSV
// =============================================================================

function importFromCSV(filePath: string): RawProduct[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records as RawProduct[];
}

// =============================================================================
// IMPORT FROM JSON
// =============================================================================

function importFromJSON(filePath: string): RawProduct[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(fileContent);

  // Handle different JSON structures
  if (Array.isArray(data)) {
    return data;
  } else if (data.products && Array.isArray(data.products)) {
    return data.products;
  } else if (data.data && Array.isArray(data.data)) {
    return data.data;
  } else {
    throw new Error('Unknown JSON structure - expected array or { products: [] }');
  }
}

// =============================================================================
// VALIDATE ALL PRODUCTS
// =============================================================================

function validateAll(rawProducts: RawProduct[]): ValidationResult {
  const valid: ImportedProduct[] = [];
  const invalid: Array<{ product: RawProduct; errors: string[] }> = [];
  const warnings: Array<{ product: ImportedProduct; warnings: string[] }> = [];

  rawProducts.forEach((raw, index) => {
    const result = validateProduct(raw, index);

    if (result.errors.length > 0) {
      invalid.push({ product: raw, errors: result.errors });
    } else if (result.product) {
      valid.push(result.product);

      if (result.warnings.length > 0) {
        warnings.push({ product: result.product, warnings: result.warnings });
      }
    }
  });

  return {
    valid,
    invalid,
    warnings,
    stats: {
      total: rawProducts.length,
      valid: valid.length,
      invalid: invalid.length,
      warnings: warnings.length,
    },
  };
}

// =============================================================================
// GENERATE SQL INSERT STATEMENTS
// =============================================================================

function generateSQL(products: ImportedProduct[]): string {
  const statements: string[] = [];

  statements.push('-- =============================================================================');
  statements.push('-- RETAILER PRODUCT IMPORT');
  statements.push(`-- Generated: ${new Date().toISOString()}`);
  statements.push(`-- Total Products: ${products.length}`);
  statements.push('-- =============================================================================');
  statements.push('');

  // Group by retailer for organization
  const byRetailer = products.reduce((acc, p) => {
    if (!acc[p.retailer]) acc[p.retailer] = [];
    acc[p.retailer].push(p);
    return acc;
  }, {} as Record<string, ImportedProduct[]>);

  Object.entries(byRetailer).forEach(([retailer, products]) => {
    statements.push(`-- ${retailer.toUpperCase()} (${products.length} products)`);
    statements.push('');

    products.forEach(p => {
      const escapedName = p.name.replace(/'/g, "''");
      const escapedDesc = p.description?.replace(/'/g, "''") || '';
      const escapedSku = p.sku?.replace(/'/g, "''") || '';

      const values = [
        `'${p.id}'`,
        `'${p.category_id}'`,
        `'${escapedName}'`,
        `'${p.unit}'`,
        p.unit_price,
        `'${p.retailer}'`,
        `'${p.data_source}'`,
      ];

      const columns = [
        'id',
        'category_id',
        'name',
        'unit',
        'unit_price',
        'retailer',
        'data_source',
      ];

      if (p.description) {
        columns.push('description');
        values.push(`'${escapedDesc}'`);
      }

      if (p.sku) {
        columns.push('sku');
        values.push(`'${escapedSku}'`);
      }

      if (p.in_stock !== undefined) {
        columns.push('in_stock');
        values.push(p.in_stock ? 'true' : 'false');
      }

      statements.push(
        `INSERT INTO products (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO UPDATE SET unit_price = EXCLUDED.unit_price, updated_at = NOW();`
      );
    });

    statements.push('');
  });

  return statements.join('\n');
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx supabase/import_retailer_data.ts <file_path>');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx supabase/import_retailer_data.ts data/homedepot_products.csv');
    console.error('  npx tsx supabase/import_retailer_data.ts data/menards_products.json');
    process.exit(1);
  }

  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Reading file: ${filePath}`);
  console.log('');

  // Determine file type and import
  const ext = path.extname(filePath).toLowerCase();
  let rawProducts: RawProduct[];

  try {
    if (ext === '.csv') {
      console.log('📊 Parsing CSV...');
      rawProducts = importFromCSV(filePath);
    } else if (ext === '.json') {
      console.log('📋 Parsing JSON...');
      rawProducts = importFromJSON(filePath);
    } else {
      console.error(`Error: Unsupported file type: ${ext}`);
      console.error('Supported formats: .csv, .json');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error parsing file:', error);
    process.exit(1);
  }

  console.log(`✅ Found ${rawProducts.length} raw products`);
  console.log('');

  // Validate
  console.log('🔍 Validating products...');
  const validation = validateAll(rawProducts);

  console.log('');
  console.log('📊 Validation Results:');
  console.log(`  Total:    ${validation.stats.total}`);
  console.log(`  Valid:    ${validation.stats.valid} ✅`);
  console.log(`  Invalid:  ${validation.stats.invalid} ❌`);
  console.log(`  Warnings: ${validation.stats.warnings} ⚠️`);
  console.log('');

  // Show errors
  if (validation.invalid.length > 0) {
    console.log('❌ Validation Errors:');
    validation.invalid.slice(0, 10).forEach(({ product, errors }) => {
      console.log(`  Product: ${product.name || 'Unknown'}`);
      errors.forEach(err => console.log(`    - ${err}`));
    });
    if (validation.invalid.length > 10) {
      console.log(`  ... and ${validation.invalid.length - 10} more errors`);
    }
    console.log('');
  }

  // Show warnings
  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    validation.warnings.slice(0, 5).forEach(({ product, warnings }) => {
      console.log(`  Product: ${product.name}`);
      warnings.forEach(warn => console.log(`    - ${warn}`));
    });
    if (validation.warnings.length > 5) {
      console.log(`  ... and ${validation.warnings.length - 5} more warnings`);
    }
    console.log('');
  }

  // Generate SQL
  if (validation.valid.length === 0) {
    console.error('❌ No valid products to import!');
    process.exit(1);
  }

  console.log('✨ Generating SQL...');
  const sql = generateSQL(validation.valid);

  // Write to output file
  const outputPath = filePath.replace(/\.(csv|json)$/i, '_import.sql');
  fs.writeFileSync(outputPath, sql);

  console.log(`✅ SQL written to: ${outputPath}`);
  console.log('');
  console.log('📋 Next Steps:');
  console.log('  1. Review the generated SQL file');
  console.log('  2. Open Supabase SQL Editor');
  console.log('  3. Copy and paste the SQL');
  console.log('  4. Run the import');
  console.log('');
  console.log(`🎉 Ready to import ${validation.valid.length} products!`);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { validateAll, generateSQL, importFromCSV, importFromJSON };
