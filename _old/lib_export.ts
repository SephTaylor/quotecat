// lib/export.ts
import * as FileSystem from "expo-file-system/legacy"; // legacy shim for writeAsStringAsync
import * as Sharing from "expo-sharing";
import { Quote } from "./quotes";

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  const needsQuotes = s.includes(",") || s.includes('"') || s.includes("\n");
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toCSV(quotes: Quote[]) {
  const header = [
    "id",
    "clientName",
    "projectName",
    "labor",
    "material",
    "total",
    "createdAtISO",
  ];
  const rows = quotes.map((q) => [
    q.id,
    q.clientName,
    q.projectName,
    q.labor,
    q.material,
    q.total,
    new Date(q.createdAt).toISOString(),
  ]);

  const lines = [header, ...rows].map((cols) => cols.map(csvEscape).join(","));
  return lines.join("\n");
}

export async function exportQuotesCSV(quotes: Quote[]) {
  if (!quotes.length) {
    throw new Error("No quotes to export.");
  }

  const csv = toCSV(quotes);

  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const fileName = `quotecat_quotes_${y}-${m}-${d}.csv`;

  const fileUri = FileSystem.cacheDirectory + fileName;

  // UTF-8 write (works across SDKs with legacy shim)
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: "utf8" });

  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "text/csv",
      dialogTitle: "Export Quotes CSV",
      UTI: "public.comma-separated-values-text", // iOS
    });
    return;
  }

  // Fallback: return path if sharing isn't available (e.g., web)
  return fileUri;
}
