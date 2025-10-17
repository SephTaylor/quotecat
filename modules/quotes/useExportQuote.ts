// modules/quotes/useExportQuote.ts
import type { QuoteItem } from "@/lib/quotes";
import { useCallback, useState } from "react";
import { Alert, Share } from "react-native";
import { generateQuoteCsv, type QuoteExportData } from "./exportCsv";

type QuoteForExport = {
  id?: string;
  name?: string;
  clientName?: string;
  items?: Array<{
    id?: string;
    name: string;
    qty: number;
    unitPrice: number;
  }>;
  labor?: number;
  currency?: string;
};

/**
 * Hook for exporting quotes to CSV.
 * Handles file creation and sharing via native share sheet.
 */
export function useExportQuote() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCsv = useCallback(async (quote: QuoteForExport) => {
    setIsExporting(true);
    try {
      const items = quote.items || [];
      const materialSubtotal = items.reduce(
        (s, it) => s + (it.unitPrice || 0) * (it.qty || 0),
        0,
      );
      const total = materialSubtotal + (quote.labor || 0);

      const exportData: QuoteExportData = {
        name: quote.name || "Untitled Quote",
        clientName: quote.clientName,
        items,
        labor: quote.labor || 0,
        materialSubtotal,
        total,
        currency: quote.currency || "USD",
      };

      const csvContent = generateQuoteCsv(exportData);

      // Share CSV content
      const fileName = `quote-${quote.name || quote.id}.csv`;
      await Share.share({
        message: csvContent,
        title: `Export: ${fileName}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert(
        "Export Failed",
        error instanceof Error ? error.message : "Could not export quote",
      );
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToCsv, isExporting };
}
