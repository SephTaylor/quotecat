// modules/quotes/exportCsv.ts

export type QuoteExportItem = {
  id?: string;
  name: string;
  qty: number;
  unitPrice: number;
};

export type QuoteExportData = {
  name: string;
  clientName?: string;
  items: QuoteExportItem[];
  labor: number;
  materialSubtotal: number;
  total: number;
  currency?: string;
};

/**
 * Generate CSV content from quote data.
 * Format: Quote header, line items, totals.
 */
export function generateQuoteCsv(data: QuoteExportData): string {
  const lines: string[] = [];

  // Header section
  lines.push("QUOTE");
  lines.push(`Project,${escapeCsvField(data.name)}`);
  if (data.clientName) {
    lines.push(`Client,${escapeCsvField(data.clientName)}`);
  }
  lines.push(""); // Blank line

  // Line items header
  lines.push("Item,Quantity,Unit Price,Line Total");

  // Line items
  data.items.forEach((item) => {
    const lineTotal = (item.unitPrice || 0) * (item.qty || 0);
    lines.push(
      `${escapeCsvField(item.name)},${item.qty},${item.unitPrice.toFixed(2)},${lineTotal.toFixed(2)}`,
    );
  });

  lines.push(""); // Blank line

  // Totals section
  lines.push(
    `Materials Subtotal,,${data.materialSubtotal.toFixed(2)} ${data.currency || "USD"}`,
  );
  lines.push(`Labor,,${data.labor.toFixed(2)} ${data.currency || "USD"}`);
  lines.push(`Total,,${data.total.toFixed(2)} ${data.currency || "USD"}`);

  return lines.join("\n");
}

/**
 * Escape CSV field by wrapping in quotes if needed.
 */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
