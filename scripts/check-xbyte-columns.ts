import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'xbyte', 'Lowes_sample_13112025.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('First product - ALL fields and values:\n');
console.log(JSON.stringify(data[0], null, 2));

console.log('\n\nSecond product:\n');
console.log(JSON.stringify(data[1], null, 2));
