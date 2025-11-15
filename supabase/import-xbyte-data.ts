/**
 * Import Xbyte Product Data to Supabase
 *
 * Reads Excel files from Xbyte, validates, maps categories, and imports to Supabase
 * Run with: npx tsx supabase/import-xbyte-data.ts
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  validateProducts,
  formatValidationResults,
  getValidProducts,
  standardizeUnit,
  type XbyteProduct
} from './data-quality-validator';
import {
  mapCategory,
  getMappingStats,
  CATEGORY_DISPLAY_NAMES,
  type QuoteCatCategory
} from './category-mapping';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERROR: Supabase credentials not found in environment');
  console.error('   Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Retailer normalization
const RETAILER_MAP: Record<string, string> = {
  'Homedepot': 'homedepot',
  'Home Depot': 'homedepot',
  'homedepot': 'homedepot',
  'Lowes': 'lowes',
  "Lowe's": 'lowes',
  'lowes': 'lowes',
  'Menards': 'menards',
  'menards': 'menards'
};

// =============================================================================
// TYPES
// =============================================================================

interface ImportProduct {
  id: string;
  category_id: QuoteCatCategory;
  name: string;
  unit: string;
  unit_price: number;
  retailer: string;
  data_source: 'xbyte_api';
  description?: string;
  sku?: string;
  brand?: string;
  in_stock?: boolean;
  product_url?: string;
  last_synced: string;
}

// =============================================================================
// LOAD DATA FROM EXCEL FILES
// =============================================================================

function loadXbyteData(dirPath: string): XbyteProduct[] {
  console.log(`\n📂 Loading data from: ${dirPath}\n`);

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx'));

  if (files.length === 0) {
    console.error('❌ No Excel files found in directory');
    process.exit(1);
  }

  console.log(`Found ${files.length} files:`);
  files.forEach(f => console.log(`   • ${f}`));

  const allProducts: XbyteProduct[] = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as XbyteProduct[];

    console.log(`   ✓ Loaded ${data.length} products from ${file}`);
    allProducts.push(...data);
  }

  console.log(`\n📊 Total products loaded: ${allProducts.length}\n`);
  return allProducts;
}

// =============================================================================
// TRANSFORM DATA
// =============================================================================

function transformProduct(product: XbyteProduct, index: number): ImportProduct | null {
  // Map category
  const quotecatCategory = mapCategory(product.Category || '');
  if (!quotecatCategory) {
    return null; // Skip unmapped products
  }

  // Normalize retailer
  const retailer = RETAILER_MAP[product['Retailer Identifier'] || ''];
  if (!retailer) {
    return null; // Skip products with invalid retailer
  }

  // Standardize unit
  const unit = standardizeUnit(product['Unit of Measure']);
  if (!unit) {
    return null; // Skip products with no unit
  }

  // Generate product ID
  const sku = String(product['Product ID / SKU'] || '');
  const id = sku ? `${retailer}-${sku}` : `${retailer}-gen-${index}`;

  // Parse stock status
  const stockStatus = product['In-Stock Status'] || '';
  const inStock = stockStatus.toLowerCase().includes('in stock') ||
                  stockStatus.toLowerCase().includes('instock');

  // Create import product
  return {
    id,
    category_id: quotecatCategory,
    name: product['Product Name'] || 'Unknown Product',
    unit,
    unit_price: product['Price (USD)'] || 0,
    retailer,
    data_source: 'xbyte_api',
    description: undefined, // Xbyte doesn't provide descriptions in sample
    sku,
    brand: product.Brand,
    in_stock: inStock,
    product_url: product['Product URL'],
    last_synced: new Date().toISOString()
  };
}

// =============================================================================
// IMPORT TO SUPABASE
// =============================================================================

async function importToSupabase(products: ImportProduct[], dryRun: boolean = false) {
  console.log(`\n🚀 ${dryRun ? 'DRY RUN: ' : ''}Importing ${products.length} products to Supabase\n`);

  if (dryRun) {
    console.log('ℹ️  DRY RUN MODE - No data will be written to Supabase\n');
    console.log('Sample products to import:\n');
    products.slice(0, 5).forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Category: ${CATEGORY_DISPLAY_NAMES[p.category_id]}`);
      console.log(`   Price: $${p.unit_price} per ${p.unit}`);
      console.log(`   Retailer: ${p.retailer}`);
      console.log('');
    });
    return { success: true, imported: 0 };
  }

  // Batch insert (Supabase recommends batches of 1000)
  const BATCH_SIZE = 1000;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    console.log(`   Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)} (${batch.length} products)...`);

    const { data, error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`   ❌ Error importing batch: ${error.message}`);
      failed += batch.length;
    } else {
      imported += batch.length;
      console.log(`   ✓ Batch imported successfully`);
    }
  }

  console.log(`\n✅ Import complete: ${imported} products imported, ${failed} failed\n`);

  return { success: failed === 0, imported };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('=' .repeat(80));
  console.log('📦 XBYTE DATA IMPORT TO SUPABASE');
  console.log('='.repeat(80));

  // Get data directory from command line or use default
  const dataDir = process.argv[2] || path.join(process.cwd(), 'xbyte');

  if (!fs.existsSync(dataDir)) {
    console.error(`❌ ERROR: Directory not found: ${dataDir}`);
    process.exit(1);
  }

  // Check for --dry-run flag
  const dryRun = process.argv.includes('--dry-run');

  // Step 1: Load data
  const rawProducts = loadXbyteData(dataDir);

  // Step 2: Validate data
  console.log('🔍 STEP 1: DATA QUALITY VALIDATION\n');
  console.log('-'.repeat(80));

  const validationResult = validateProducts(rawProducts);
  console.log(formatValidationResults(validationResult));

  if (!validationResult.valid) {
    console.error('❌ VALIDATION FAILED: Cannot proceed with import');
    console.error('   Fix critical errors in source data first\n');
    process.exit(1);
  }

  const validProducts = getValidProducts(rawProducts);
  console.log(`✅ Validation passed: ${validProducts.length}/${rawProducts.length} products valid\n`);

  // Step 3: Map categories
  console.log('🗂️  STEP 2: CATEGORY MAPPING\n');
  console.log('-'.repeat(80));

  const mappingStats = getMappingStats(validProducts);
  console.log(`\nMapping Statistics:`);
  console.log(`   Total: ${mappingStats.total}`);
  console.log(`   Mapped: ${mappingStats.mapped} (${mappingStats.mappedPercentage}%)`);
  console.log(`   Unmapped: ${mappingStats.unmapped}\n`);

  Object.entries(mappingStats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      const displayName = CATEGORY_DISPLAY_NAMES[category as QuoteCatCategory];
      console.log(`   ${displayName}: ${count} products`);
    });

  // Step 4: Transform products
  console.log(`\n📝 STEP 3: TRANSFORMING DATA\n`);
  console.log('-'.repeat(80) + '\n');

  const transformedProducts = validProducts
    .map((p, i) => transformProduct(p, i))
    .filter((p): p is ImportProduct => p !== null);

  console.log(`✅ Transformed ${transformedProducts.length}/${validProducts.length} products\n`);

  if (transformedProducts.length === 0) {
    console.error('❌ ERROR: No products to import after transformation\n');
    process.exit(1);
  }

  // Step 5: Import to Supabase
  console.log('💾 STEP 4: IMPORT TO SUPABASE\n');
  console.log('-'.repeat(80));

  const result = await importToSupabase(transformedProducts, dryRun);

  // Summary
  console.log('='.repeat(80));
  console.log('\n📊 IMPORT SUMMARY\n');
  console.log('='.repeat(80) + '\n');

  console.log(`Raw products loaded:      ${rawProducts.length}`);
  console.log(`Validation passed:        ${validProducts.length} (${((validProducts.length / rawProducts.length) * 100).toFixed(1)}%)`);
  console.log(`Category mapping:         ${mappingStats.mapped} (${mappingStats.mappedPercentage}%)`);
  console.log(`Transformed for import:   ${transformedProducts.length}`);
  if (!dryRun) {
    console.log(`Successfully imported:    ${result.imported}`);
  }

  console.log('\n' + '='.repeat(80));

  if (result.success && !dryRun) {
    console.log('\n✅ IMPORT COMPLETE!\n');
    console.log('Next steps:');
    console.log('   1. Open QuoteCat app');
    console.log('   2. Pull to refresh on materials screen');
    console.log('   3. Verify products display correctly\n');
  } else if (dryRun) {
    console.log('\n✅ DRY RUN COMPLETE!\n');
    console.log('Run without --dry-run flag to actually import:\n');
    console.log(`   npx tsx supabase/import-xbyte-data.ts ${dataDir}\n`);
  } else {
    console.log('\n❌ IMPORT FAILED\n');
    console.log('Check error messages above\n');
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});
