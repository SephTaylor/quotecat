import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const xbyteDir = path.join(process.cwd(), 'xbyte');
const files = fs.readdirSync(xbyteDir).filter(f => f.endsWith('.xlsx'));

// QuoteCat category mapping
const categoryKeywords = {
  'Framing': ['lumber', 'framing', 'studs', 'dimensional lumber', 'structural', 'timber', 'boards', 'plywood', 'osb', 'sheathing'],
  'Fasteners': ['nails', 'screws', 'bolts', 'anchors', 'fasteners', 'connectors', 'brads', 'staples'],
  'Drywall': ['drywall', 'gypsum', 'joint compound', 'sheetrock', 'corner bead'],
  'Electrical': ['electrical', 'wire', 'cable', 'conduit', 'outlets', 'switches', 'thhn'],
  'Plumbing': ['plumbing', 'pipe', 'pex', 'copper', 'fittings', 'valves', 'ballcock', 'supply line'],
  'Roofing': ['roofing', 'shingles', 'underlayment', 'flashing', 'roof'],
  'Masonry': ['masonry', 'concrete', 'brick', 'block', 'cement', 'mortar', 'bagged concrete']
};

const allData: any[] = [];

for (const file of files) {
  const filePath = path.join(xbyteDir, file);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  allData.push(...data);
}

console.log('🔍 UNMAPPED CATEGORY ANALYSIS\n');
console.log('=' .repeat(80));
console.log(`\nTotal Products: ${allData.length}\n`);

// Categorize products
const mappedProducts: { [key: string]: any[] } = {};
const unmappedProducts: any[] = [];

allData.forEach((product: any) => {
  const category = (product['Category'] || '').toLowerCase();
  let mapped = false;

  for (const [quotecatCat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => category.includes(keyword))) {
      if (!mappedProducts[quotecatCat]) mappedProducts[quotecatCat] = [];
      mappedProducts[quotecatCat].push(product);
      mapped = true;
      break;
    }
  }

  if (!mapped) {
    unmappedProducts.push(product);
  }
});

console.log('✅ MAPPED PRODUCTS:\n');
Object.entries(mappedProducts).forEach(([cat, products]) => {
  console.log(`   ${cat}: ${products.length} products`);
});

console.log(`\n⚠️  UNMAPPED PRODUCTS: ${unmappedProducts.length} (${((unmappedProducts.length / allData.length) * 100).toFixed(1)}%)\n`);

// Group unmapped by category
const unmappedByCategory = new Map<string, any[]>();
unmappedProducts.forEach(product => {
  const cat = product['Category'];
  if (!unmappedByCategory.has(cat)) {
    unmappedByCategory.set(cat, []);
  }
  unmappedByCategory.get(cat)!.push(product);
});

console.log('📊 UNMAPPED CATEGORIES (sorted by count):\n');

const sorted = Array.from(unmappedByCategory.entries())
  .sort((a, b) => b[1].length - a[1].length);

sorted.forEach(([category, products]) => {
  const simplifiedCat = category.split('|').pop()?.trim() || category;
  console.log(`\n${products.length} products - ${simplifiedCat}`);
  console.log(`   Full path: ${category}`);
  console.log(`   Sample products:`);
  products.slice(0, 3).forEach(p => {
    console.log(`      • ${p['Product Name']} ($${p['Price (USD)']})`);
  });
});

console.log('\n\n' + '='.repeat(80));
console.log('\n🎯 CATEGORY EXPANSION RECOMMENDATIONS\n');
console.log('=' .repeat(80));

// Analyze unmapped categories and suggest new QuoteCat categories
const categoryGroups = {
  'Insulation': ['insulation', 'foam board', 'batt', 'spray foam'],
  'Painting': ['paint', 'stain', 'primer'],
  'Flooring': ['carpet', 'flooring', 'tile'],
  'HVAC': ['hvac', 'heating', 'cooling', 'ductwork'],
  'Windows & Doors': ['window', 'door'],
  'Hardware': ['hardware', 'hinges', 'locks'],
  'Sealants': ['sealant', 'caulk', 'adhesive', 'foam sealant']
};

console.log('\nSuggested new QuoteCat categories:\n');

Object.entries(categoryGroups).forEach(([newCat, keywords]) => {
  const matching = unmappedProducts.filter(product => {
    const cat = (product['Category'] || '').toLowerCase();
    return keywords.some(keyword => cat.includes(keyword));
  });

  if (matching.length > 0) {
    console.log(`\n📁 ${newCat.toUpperCase()}: ${matching.length} products`);
    console.log(`   Keywords: ${keywords.join(', ')}`);
    console.log(`   Sample products:`);
    matching.slice(0, 3).forEach(p => {
      console.log(`      • ${p['Product Name']} ($${p['Price (USD)']})`);
    });
  }
});

console.log('\n\n' + '='.repeat(80));
console.log('\n💡 RECOMMENDATION:\n');
console.log('=' .repeat(80));

const topUnmappedCategories = sorted.slice(0, 5);
const topCount = topUnmappedCategories.reduce((sum, [_, products]) => sum + products.length, 0);
const percentageOfUnmapped = (topCount / unmappedProducts.length * 100).toFixed(1);

console.log(`\nTop 5 unmapped categories represent ${percentageOfUnmapped}% of unmapped products.`);
console.log('\nOption 1: EXPAND to 11 categories (recommended)');
console.log('   Add: Painting, Insulation, Flooring, Sealants');
console.log('   Pros: Better organization, more accurate quotes');
console.log('   Cons: Need to update UI, more categories to maintain');
console.log(`   Result: ~${((allData.length - unmappedProducts.length) / allData.length * 100).toFixed(0)}% → ~95%+ mapped`);

console.log('\nOption 2: AGGRESSIVE MAPPING to existing 7');
console.log('   Map: Insulation→Framing, Paint→exclude, Flooring→exclude');
console.log('   Pros: No changes needed, simpler');
console.log('   Cons: Less accurate, missing useful products');
console.log(`   Result: ~${((allData.length - unmappedProducts.length) / allData.length * 100).toFixed(0)}% → ~85% mapped`);

console.log('\nOption 3: HYBRID approach');
console.log('   Add: Painting, Insulation only');
console.log('   Exclude: Flooring, decorative items');
console.log('   Pros: Balanced, construction-focused');
console.log('   Cons: Still some unmapped products');
console.log(`   Result: ~${((allData.length - unmappedProducts.length) / allData.length * 100).toFixed(0)}% → ~90% mapped`);

console.log('\n');
