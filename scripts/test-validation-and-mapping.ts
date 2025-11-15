import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { validateProducts, formatValidationResults, getValidProducts } from '../supabase/data-quality-validator';
import { mapProducts, getMappingStats, getUnmappedProducts, CATEGORY_DISPLAY_NAMES } from '../supabase/category-mapping';
import type { XbyteProduct } from '../supabase/data-quality-validator';

const xbyteDir = path.join(process.cwd(), 'xbyte');
const files = fs.readdirSync(xbyteDir).filter(f => f.endsWith('.xlsx'));

console.log('🧪 TESTING DATA QUALITY VALIDATION & CATEGORY MAPPING\n');
console.log('='.repeat(80));

// Load all products
const allProducts: XbyteProduct[] = [];

for (const file of files) {
  const filePath = path.join(xbyteDir, file);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as XbyteProduct[];
  allProducts.push(...data);
}

console.log(`\nLoaded ${allProducts.length} products from ${files.length} files\n`);

// Test 1: Data Quality Validation
console.log('📋 TEST 1: DATA QUALITY VALIDATION\n');
console.log('='.repeat(80));

const validationResult = validateProducts(allProducts);
console.log(formatValidationResults(validationResult));

// Test 2: Category Mapping
console.log('\n📊 TEST 2: CATEGORY MAPPING\n');
console.log('='.repeat(80));

const mappedProducts = mapProducts(allProducts);
const mappingStats = getMappingStats(allProducts);

console.log(`\nMapping Statistics:`);
console.log(`   Total Products: ${mappingStats.total}`);
console.log(`   Mapped: ${mappingStats.mapped} (${mappingStats.mappedPercentage}%)`);
console.log(`   Unmapped: ${mappingStats.unmapped} (${(100 - mappingStats.mappedPercentage).toFixed(1)}%)`);

console.log(`\n   Breakdown by Category:`);
Object.entries(mappingStats.byCategory)
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => {
    const displayName = CATEGORY_DISPLAY_NAMES[category as keyof typeof CATEGORY_DISPLAY_NAMES];
    console.log(`      ${displayName}: ${count} products`);
  });

// Show unmapped products
const unmappedProducts = getUnmappedProducts(allProducts);
if (unmappedProducts.length > 0) {
  console.log(`\n⚠️  Unmapped Products (${unmappedProducts.length}):\n`);

  // Group by retailer category
  const byCategory = new Map<string, XbyteProduct[]>();
  unmappedProducts.forEach(p => {
    const cat = p.Category || 'Unknown';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(p);
  });

  Array.from(byCategory.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .forEach(([category, products]) => {
      const simplified = category.split('|').pop()?.trim() || category;
      console.log(`   ${products.length} products - ${simplified}`);
      products.slice(0, 2).forEach(p => {
        console.log(`      • ${p['Product Name']}`);
      });
    });
}

// Test 3: Combined Pipeline (Validation + Mapping)
console.log('\n\n🔄 TEST 3: COMBINED IMPORT PIPELINE\n');
console.log('='.repeat(80));

const validProducts = getValidProducts(allProducts);
console.log(`\n1. Validation: ${validProducts.length}/${allProducts.length} products passed`);

const mappedValidProducts = mapProducts(validProducts);
const mapped = mappedValidProducts.filter(p => p.quotecatCategory !== null);
console.log(`2. Mapping: ${mapped.length}/${validProducts.length} products mapped`);

const readyToImport = mapped.length;
const percentageReady = ((readyToImport / allProducts.length) * 100).toFixed(1);

console.log(`\n✅ READY TO IMPORT: ${readyToImport}/${allProducts.length} products (${percentageReady}%)`);

// Sample of ready products
console.log(`\n📦 Sample Products Ready to Import:\n`);
mapped.slice(0, 5).forEach((p, i) => {
  const displayCat = CATEGORY_DISPLAY_NAMES[p.quotecatCategory!];
  console.log(`${i + 1}. ${p['Product Name']}`);
  console.log(`   Category: ${displayCat}`);
  console.log(`   Price: $${p['Price (USD)']} per ${p['Unit of Measure']}`);
  console.log(`   Retailer: ${p['Retailer Identifier']}`);
  console.log('');
});

// Final Summary
console.log('='.repeat(80));
console.log('\n📝 SUMMARY\n');
console.log('='.repeat(80));

console.log(`\n✅ Data Quality: ${validationResult.valid ? 'PASSED' : 'FAILED'}`);
console.log(`   • Critical errors: ${validationResult.stats.criticalErrors}`);
console.log(`   • Warnings: ${validationResult.stats.warnings}`);

console.log(`\n✅ Category Mapping: ${mappingStats.mappedPercentage}% coverage`);
console.log(`   • 11 categories defined`);
console.log(`   • ${mappingStats.unmapped} unmapped products`);

console.log(`\n✅ Import Ready: ${readyToImport} products (${percentageReady}%)`);

if (validationResult.valid && mappingStats.mappedPercentage >= 90) {
  console.log('\n🎉 SYSTEM READY: Tools working correctly, data looks good!');
} else if (!validationResult.valid) {
  console.log('\n⚠️  Fix validation errors before production import');
} else {
  console.log('\n⚠️  Consider expanding category mappings for better coverage');
}

console.log('\n');
