// lib/spreadsheet.ts
// Spreadsheet export utility (CSV format - works in Excel, Google Sheets, Numbers, etc.)

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Quote } from './types';

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSVField(field: string | number): string {
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV content for the quote
 */
function generateQuoteCSV(quote: Quote): string {
  const lines: string[] = [];

  // Header Information
  lines.push('QUOTE DETAILS');
  lines.push(`Project Name,${escapeCSVField(quote.name || 'Untitled Quote')}`);
  if (quote.clientName) {
    lines.push(`Client Name,${escapeCSVField(quote.clientName)}`);
  }
  lines.push(`Date,${new Date(quote.createdAt).toLocaleDateString()}`);
  lines.push(`Status,${escapeCSVField(quote.status || 'draft')}`);
  lines.push(''); // Empty line

  // Line Items
  if (quote.items && quote.items.length > 0) {
    lines.push('MATERIALS');
    lines.push('Item,Quantity,Unit Price,Total');

    quote.items.forEach(item => {
      const total = item.unitPrice * item.qty;
      lines.push(
        `${escapeCSVField(item.name)},` +
        `${item.qty},` +
        `${item.unitPrice.toFixed(2)},` +
        `${total.toFixed(2)}`
      );
    });
    lines.push(''); // Empty line
  }

  // Calculate totals
  const materialsFromItems = quote.items?.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  ) ?? 0;
  const materialEstimate = quote.materialEstimate ?? 0;
  const labor = quote.labor ?? 0;
  const markupPercent = quote.markupPercent ?? 0;
  // Apply markup to materials only (not labor)
  const totalMaterials = materialsFromItems + materialEstimate;
  const markupAmount = (totalMaterials * markupPercent) / 100;
  const materialsWithMarkup = totalMaterials + markupAmount;
  const subtotal = materialsWithMarkup + labor;
  const grandTotal = subtotal;

  // Cost Breakdown
  lines.push('COST BREAKDOWN');
  lines.push('Description,Amount');

  if (materialsFromItems > 0) {
    lines.push(`Materials,${materialsFromItems.toFixed(2)}`);
  }
  if (materialEstimate > 0) {
    lines.push(`Materials (Estimate),${materialEstimate.toFixed(2)}`);
  }
  if (labor > 0) {
    lines.push(`Labor,${labor.toFixed(2)}`);
  }

  lines.push(`Subtotal,${subtotal.toFixed(2)}`);

  if (markupAmount > 0) {
    lines.push(`Markup (${markupPercent}%),${markupAmount.toFixed(2)}`);
  }

  lines.push(`TOTAL,${grandTotal.toFixed(2)}`);

  return lines.join('\n');
}

/**
 * Generate and share a CSV spreadsheet of the quote
 */
export async function generateAndShareSpreadsheet(quote: Quote): Promise<void> {
  try {
    // Generate CSV content
    const csvContent = generateQuoteCSV(quote);

    // Create descriptive file name: "ProjectName - ClientName - YYYY-MM-DD-HHMMSS.csv"
    const sanitize = (str: string) => str.replace(/[^a-z0-9_\-\s]/gi, '_');
    const projectPart = sanitize(quote.name || 'Quote');
    const clientPart = quote.clientName ? ` - ${sanitize(quote.clientName)}` : '';
    const now = new Date();
    const datePart = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timePart = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
    const fileName = `${projectPart}${clientPart} - ${datePart}-${timePart}.csv`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    // Write CSV file (encoding defaults to utf8)
    await FileSystem.writeAsStringAsync(fileUri, csvContent);

    // Share CSV file
    if (await Sharing.isAvailableAsync()) {
      try {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: fileName,
          UTI: 'public.comma-separated-values-text',
        });
      } finally {
        // Clean up temporary file regardless of share success/cancel
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (cleanupError) {
          console.warn('Failed to clean up CSV file:', cleanupError);
          // Don't throw - cleanup errors shouldn't affect user experience
        }
      }
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error generating spreadsheet:', error);
    throw error;
  }
}
