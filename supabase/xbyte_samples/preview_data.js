// Quick script to preview Xbyte xlsx files
const XLSX = require('xlsx');
const path = require('path');

const files = [
  'Homedepot_sample_10112025.xlsx',
  'Lowes_sample_10112025.xlsx',
  'Menards_sample_10112025.xlsx'
];

files.forEach(file => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FILE: ${file}`);
  console.log('='.repeat(60));

  const workbook = XLSX.readFile(path.join(__dirname, file));
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`\nSheet: ${sheetName}`);
  console.log(`Total Rows: ${data.length}`);

  if (data.length > 0) {
    console.log(`\nColumns:`, Object.keys(data[0]).join(', '));
    console.log(`\nFirst 3 rows:`);
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
  }
});
