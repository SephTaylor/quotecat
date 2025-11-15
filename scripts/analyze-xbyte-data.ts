import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const xbyteDir = path.join(process.cwd(), 'xbyte');

// Read all Excel files in xbyte directory
const files = fs.readdirSync(xbyteDir).filter(f => f.endsWith('.xlsx'));

console.log('🔍 Analyzing Xbyte Data Files\n');
console.log('=' .repeat(80));

for (const file of files) {
  const filePath = path.join(xbyteDir, file);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`\n📄 FILE: ${file}`);
  console.log(`   Total Products: ${data.length}`);

  if (data.length > 0) {
    const firstProduct: any = data[0];
    console.log(`\n   📋 Available Fields:`);
    Object.keys(firstProduct).forEach(key => {
      console.log(`      - ${key}`);
    });

    // Check for critical "Unit" field
    const hasUnit = 'Unit' in firstProduct || 'unit' in firstProduct || 'UOM' in firstProduct || 'uom' in firstProduct;
    console.log(`\n   ✅ Has Unit Field: ${hasUnit ? 'YES ✅' : 'NO ❌'}`);

    // Show first 3 products as examples
    console.log(`\n   📦 Sample Products (first 3):`);
    data.slice(0, 3).forEach((product: any, index) => {
      console.log(`\n   ${index + 1}. ${product.Title || product.name || product.Name || 'Unnamed Product'}`);
      console.log(`      Price: $${product.Price || product.price || 'N/A'}`);
      console.log(`      Unit: ${product.Unit || product.unit || product.UOM || product.uom || 'MISSING ❌'}`);
      console.log(`      Category: ${product.Category || product.category || 'N/A'}`);
      console.log(`      SKU: ${product.SKU || product.sku || 'N/A'}`);
    });

    // Check category distribution
    const categories = new Set();
    data.forEach((product: any) => {
      const cat = product.Category || product.category;
      if (cat) categories.add(cat);
    });

    console.log(`\n   📊 Unique Categories: ${categories.size}`);
    if (categories.size <= 20) {
      console.log(`      Categories:`);
      Array.from(categories).forEach(cat => {
        const count = data.filter((p: any) =>
          (p.Category || p.category) === cat
        ).length;
        console.log(`      - ${cat}: ${count} products`);
      });
    }

    // Check units distribution
    const units = new Set();
    data.forEach((product: any) => {
      const unit = product.Unit || product.unit || product.UOM || product.uom;
      if (unit) units.add(unit);
    });

    console.log(`\n   📏 Unique Units: ${units.size}`);
    console.log(`      Units: ${Array.from(units).join(', ')}`);

    // Check for non-construction items (toys, etc.)
    const suspiciousKeywords = ['toy', 'game', 'doll', 'duck', 'ball', 'puzzle'];
    const suspiciousProducts = data.filter((product: any) => {
      const title = (product.Title || product.name || product.Name || '').toLowerCase();
      return suspiciousKeywords.some(keyword => title.includes(keyword));
    });

    if (suspiciousProducts.length > 0) {
      console.log(`\n   ⚠️  Non-Construction Items Found: ${suspiciousProducts.length}`);
      suspiciousProducts.slice(0, 3).forEach((product: any) => {
        console.log(`      - ${product.Title || product.name || product.Name}`);
      });
    } else {
      console.log(`\n   ✅ No obvious non-construction items detected`);
    }

    // Check price range
    const prices = data
      .map((p: any) => parseFloat(p.Price || p.price || '0'))
      .filter(p => p > 0);

    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      console.log(`\n   💰 Price Range:`);
      console.log(`      Min: $${minPrice.toFixed(2)}`);
      console.log(`      Max: $${maxPrice.toFixed(2)}`);
      console.log(`      Avg: $${avgPrice.toFixed(2)}`);
    }
  }

  console.log('\n' + '-'.repeat(80));
}

console.log('\n\n📝 SUMMARY & RECOMMENDATION\n');
console.log('=' .repeat(80));
console.log('\nChecking against QuoteCat requirements:\n');

// Re-read files for summary
let totalProducts = 0;
let hasUnitField = true;
let allRetailers: string[] = [];

for (const file of files) {
  const filePath = path.join(xbyteDir, file);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  totalProducts += data.length;
  allRetailers.push(file.split('_')[0]);

  if (data.length > 0) {
    const firstProduct: any = data[0];
    const hasUnit = 'Unit' in firstProduct || 'unit' in firstProduct || 'UOM' in firstProduct || 'uom' in firstProduct;
    if (!hasUnit) hasUnitField = false;
  }
}

console.log(`1. ✅ Unit field present: ${hasUnitField ? 'YES ✅' : 'NO ❌ BLOCKER'}`);
console.log(`2. ✅ Total products: ${totalProducts} (Target: 100-200+ per retailer)`);
console.log(`3. ✅ Retailers covered: ${allRetailers.length} (${allRetailers.join(', ')})`);
console.log(`4. ⏳ Categories mappable: Check output above`);
console.log(`5. ⏳ Construction-only items: Check warnings above`);

console.log('\n' + '='.repeat(80));

if (hasUnitField && totalProducts >= 100) {
  console.log('\n✅ RECOMMENDATION: This data looks READY for QuoteCat import!');
  console.log('\nNext steps:');
  console.log('1. Review category mappings above');
  console.log('2. Run migration 004 to add retailer field');
  console.log('3. Execute import script: npm run import-xbyte-data');
  console.log('4. Test in app with pull-to-refresh');
} else {
  console.log('\n❌ RECOMMENDATION: NOT READY - Issues found');
  if (!hasUnitField) {
    console.log('   - BLOCKER: Unit field still missing');
  }
  if (totalProducts < 100) {
    console.log('   - WARNING: Sample size too small');
  }
  console.log('\nSend feedback to Xbyte team with specific requirements.');
}

console.log('\n');
