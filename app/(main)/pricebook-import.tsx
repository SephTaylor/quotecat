// app/(main)/pricebook-import.tsx
// Pro+ feature: bulk-import pricebook items from CSV or XLSX files
// (e.g., supplier catalog extracts from Kendall, Graybar, Home Depot Pro, etc.)
//
// Five-step flow: tier-check → file pick → column mapping → preview → submit.

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Stack, useRouter } from "expo-router";
// xlsx is ~600KB+ and is only needed for .xls/.xlsx files. CSV path doesn't
// touch it. Loaded dynamically inside handlePickFile when the extension matches.
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import { useTechContext } from "@/contexts/TechContext";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import {
  savePricebookItemsBatch,
  createPricebookItemId,
  type PricebookItem,
} from "@/lib/pricebook";
import { presentPaywallAndSync } from "@/lib/revenuecat";

type Step = "picking" | "mapping" | "preview" | "submitting" | "done";

type TargetField = "name" | "unitPrice" | "sku" | "unitType" | "category" | "description";

type Mapping = Record<TargetField, string | null>;

type ParseResult = {
  headers: string[];
  rows: Record<string, string>[];
};

const TARGET_FIELDS: { key: TargetField; label: string; required: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "unitPrice", label: "Price", required: true },
  { key: "sku", label: "SKU", required: false },
  { key: "unitType", label: "Unit", required: false },
  { key: "category", label: "Category", required: false },
  { key: "description", label: "Description", required: false },
];

// Auto-detect target field given common header naming patterns from major supplier catalogs.
function autoMap(headers: string[]): Mapping {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (...candidates: string[]): string | null => {
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h === c);
      if (idx >= 0) return headers[idx];
    }
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h.includes(c));
      if (idx >= 0) return headers[idx];
    }
    return null;
  };
  return {
    name: find("name", "description", "item description", "item", "product"),
    unitPrice: find("price", "net price", "unit price", "cost", "your price"),
    sku: find("sku", "item #", "item number", "item no", "code", "part number", "part #", "catalog #"),
    unitType: find("unit", "uom", "u/m", "u of m", "measure"),
    category: find("category", "group", "class", "section"),
    description: find("notes", "details", "long description", "comments"),
  };
}

// Minimal CSV parser — handles quoted values, escaped quotes ("" inside quoted fields),
// and CRLF/LF line endings. Not RFC 4180 perfect but covers every supplier export I've seen.
function parseCSV(text: string): ParseResult {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.some((c) => c.length > 0)) rows.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows: dataRows };
}

function parseXLSX(XLSX: typeof import("xlsx"), base64: string): ParseResult {
  const workbook = XLSX.read(base64, { type: "base64" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return { headers: [], rows: [] };
  const rows: Record<string, string | number>[] = XLSX.utils.sheet_to_json(firstSheet, {
    defval: "",
    raw: false,
  });
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(rows[0]).map((h) => h.trim());
  const dataRows = rows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h) => {
      const v = r[h];
      obj[h] = v === undefined || v === null ? "" : String(v).trim();
    });
    return obj;
  });
  return { headers, rows: dataRows };
}

const UNIT_NORMALIZATIONS: Record<string, string> = {
  ea: "each", "each": "each",
  hr: "hour", hrs: "hour", hour: "hour", hours: "hour",
  sf: "sq ft", "sq ft": "sq ft", sqft: "sq ft", "square foot": "sq ft", "square feet": "sq ft",
  lf: "linear ft", "linear ft": "linear ft", "linear foot": "linear ft", "linear feet": "linear ft",
  day: "day", days: "day",
  gal: "gallon", gallon: "gallon", gallons: "gallon",
  lb: "pound", lbs: "pound", pound: "pound", pounds: "pound",
  box: "box", boxes: "box",
  bag: "bag", bags: "bag",
  sheet: "sheet", sheets: "sheet",
  bundle: "bundle", bundles: "bundle",
};

function normalizeUnit(raw: string): string {
  const k = raw.toLowerCase().trim();
  return UNIT_NORMALIZATIONS[k] || "each";
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) || n < 0 ? null : n;
}

export default function PricebookImportScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { effectiveTier } = useTechContext();
  const isPaidTier = effectiveTier === "pro" || effectiveTier === "premium";

  const [step, setStep] = useState<Step>("picking");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Mapping>({
    name: null, unitPrice: null, sku: null, unitType: null, category: null, description: null,
  });
  const [parsing, setParsing] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  // Free → paywall fire and bounce
  useEffect(() => {
    if (!isPaidTier) {
      presentPaywallAndSync();
      router.back();
    }
  }, [isPaidTier, router]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) {
        Alert.alert("Error", "Could not read the selected file.");
        return;
      }

      setFileName(file.name);
      setParsing(true);

      const isXLSX = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");

      let parsed: ParseResult;
      if (isXLSX) {
        // Dynamic import — xlsx is ~600KB+ and CSV imports don't need it.
        const XLSX = await import("xlsx");
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        parsed = parseXLSX(XLSX, base64);
      } else {
        const text = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        parsed = parseCSV(text);
      }

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        Alert.alert("Empty File", "We couldn't find any rows in that file. Make sure the first row is column headers.");
        setParsing(false);
        return;
      }

      setParseResult(parsed);
      setMapping(autoMap(parsed.headers));
      setStep("mapping");
    } catch (err) {
      console.error("File pick error:", err);
      Alert.alert("Error", "Could not read the file. Please try again.");
    } finally {
      setParsing(false);
    }
  };

  const cycleMapping = (target: TargetField) => {
    if (!parseResult) return;
    const current = mapping[target];
    const options = [null, ...parseResult.headers];
    const idx = options.findIndex((o) => o === current);
    const next = options[(idx + 1) % options.length];
    setMapping({ ...mapping, [target]: next });
  };

  const previewItems = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.rows.slice(0, 10).map((row) => ({
      name: mapping.name ? row[mapping.name] : "",
      unitPrice: mapping.unitPrice ? row[mapping.unitPrice] : "",
      sku: mapping.sku ? row[mapping.sku] : "",
      unitType: mapping.unitType ? row[mapping.unitType] : "",
      category: mapping.category ? row[mapping.category] : "",
      description: mapping.description ? row[mapping.description] : "",
    }));
  }, [parseResult, mapping]);

  const validationSummary = useMemo(() => {
    if (!parseResult || !mapping.name || !mapping.unitPrice) return null;
    let valid = 0;
    let invalid = 0;
    for (const row of parseResult.rows) {
      const name = (row[mapping.name] ?? "").trim();
      const price = parsePrice(row[mapping.unitPrice] ?? "");
      if (name && price !== null) valid++;
      else invalid++;
    }
    return { valid, invalid, total: parseResult.rows.length };
  }, [parseResult, mapping]);

  const canMapToPreview = !!mapping.name && !!mapping.unitPrice;

  const handleSubmit = async () => {
    if (!parseResult || !mapping.name || !mapping.unitPrice) return;
    setStep("submitting");

    const now = new Date().toISOString();
    const items: PricebookItem[] = [];
    let skipped = 0;

    for (const row of parseResult.rows) {
      const name = (row[mapping.name] ?? "").trim();
      const price = parsePrice(row[mapping.unitPrice] ?? "");
      if (!name || price === null) {
        skipped++;
        continue;
      }
      const item: PricebookItem = {
        id: createPricebookItemId(),
        name,
        unitPrice: price,
        unitType: mapping.unitType ? normalizeUnit(row[mapping.unitType] ?? "") : "each",
        sku: mapping.sku ? (row[mapping.sku] ?? "").trim() || undefined : undefined,
        category: mapping.category ? (row[mapping.category] ?? "").trim() || undefined : undefined,
        description: mapping.description ? (row[mapping.description] ?? "").trim() || undefined : undefined,
        source: "import",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      items.push(item);
    }

    try {
      await savePricebookItemsBatch(items);
      setImportedCount(items.length);
      setSkippedCount(skipped);
      setStep("done");
    } catch (err) {
      console.error("Import save error:", err);
      Alert.alert("Import Failed", "Something went wrong saving the items. Please try again.");
      setStep("preview");
    }
  };

  const styles = createStyles(theme);

  // ============ Step rendering ============

  if (!isPaidTier) return null; // useEffect bounces them, but render nothing in the gap

  return (
    <>
      <Stack.Screen
        options={{
          title: "Import Pricebook",
          headerShown: true,
          headerTitleAlign: "center",
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {step === "picking" && (
          <View style={styles.section}>
            <Text style={styles.title}>Import from CSV or Excel</Text>
            <Text style={styles.body}>
              Pull pricing items from a supplier catalog or your own spreadsheet. We support CSV, XLS, and XLSX files up to 1,000 rows per import.
            </Text>
            <Text style={styles.body}>
              The file needs a header row with column names. The columns we look for: Name, Price, SKU, Unit, Category, Description. You'll be able to map them to the right fields in the next step.
            </Text>
            <Pressable style={styles.primaryButton} onPress={handlePickFile} disabled={parsing}>
              {parsing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-attach-outline" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Choose File</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {step === "mapping" && parseResult && (
          <View style={styles.section}>
            <Text style={styles.title}>Map your columns</Text>
            <Text style={styles.body}>
              {fileName} — {parseResult.rows.length} row{parseResult.rows.length === 1 ? "" : "s"} detected
            </Text>
            <Text style={styles.helper}>Tap a row to cycle through your file's columns. Name and Price are required.</Text>

            <View style={styles.mappingList}>
              {TARGET_FIELDS.map((field) => (
                <Pressable
                  key={field.key}
                  style={styles.mappingRow}
                  onPress={() => cycleMapping(field.key)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mappingLabel}>
                      {field.label}
                      {field.required && <Text style={styles.required}> *</Text>}
                    </Text>
                  </View>
                  <View style={styles.mappingValue}>
                    <Text style={styles.mappingValueText}>
                      {mapping[field.key] || "(not mapped)"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
                  </View>
                </Pressable>
              ))}
            </View>

            {validationSummary && (
              <Text style={styles.helper}>
                {validationSummary.valid} of {validationSummary.total} rows ready to import
                {validationSummary.invalid > 0 ? ` (${validationSummary.invalid} will be skipped — empty name or invalid price)` : ""}
              </Text>
            )}

            <Pressable
              style={[styles.primaryButton, !canMapToPreview && styles.disabledButton]}
              onPress={() => setStep("preview")}
              disabled={!canMapToPreview}
            >
              <Text style={styles.primaryButtonText}>Preview Import</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setStep("picking")}>
              <Text style={styles.secondaryButtonText}>Choose Different File</Text>
            </Pressable>
          </View>
        )}

        {step === "preview" && parseResult && (
          <View style={styles.section}>
            <Text style={styles.title}>Preview</Text>
            <Text style={styles.body}>
              First {Math.min(10, previewItems.length)} of {validationSummary?.valid ?? 0} rows that will be imported.
            </Text>

            <View style={styles.previewTable}>
              {previewItems.map((item, idx) => {
                const valid = item.name.trim() && parsePrice(item.unitPrice) !== null;
                return (
                  <View key={idx} style={[styles.previewRow, !valid && styles.previewRowInvalid]}>
                    <Text style={styles.previewName} numberOfLines={1}>
                      {item.name || "(no name)"}
                    </Text>
                    <Text style={styles.previewPrice}>
                      {parsePrice(item.unitPrice) !== null ? `$${parsePrice(item.unitPrice)?.toFixed(2)}` : "—"}
                    </Text>
                    {item.sku ? <Text style={styles.previewSku}>SKU: {item.sku}</Text> : null}
                  </View>
                );
              })}
            </View>

            <Pressable style={styles.primaryButton} onPress={handleSubmit}>
              <Text style={styles.primaryButtonText}>
                Import {validationSummary?.valid ?? 0} items
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setStep("mapping")}>
              <Text style={styles.secondaryButtonText}>Back to Mapping</Text>
            </Pressable>
          </View>
        )}

        {step === "submitting" && (
          <View style={[styles.section, styles.centered]}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.body}>Importing items…</Text>
          </View>
        )}

        {step === "done" && (
          <View style={[styles.section, styles.centered]}>
            <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
            <Text style={styles.title}>Imported {importedCount} items</Text>
            {skippedCount > 0 && (
              <Text style={styles.body}>{skippedCount} rows were skipped — empty name or invalid price.</Text>
            )}
            <Pressable style={styles.primaryButton} onPress={() => router.back()}>
              <Text style={styles.primaryButtonText}>Back to Pricebook</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    content: {
      padding: 16,
      paddingBottom: 64,
    },
    section: {
      gap: 12,
    },
    centered: {
      alignItems: "center",
      paddingTop: 32,
      gap: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text,
    },
    helper: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    secondaryButton: {
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: theme.colors.accent,
      fontSize: 15,
    },
    disabledButton: {
      opacity: 0.4,
    },
    mappingList: {
      borderWidth: 1,
      borderColor: theme.colors.border ?? "#e5e5e5",
      borderRadius: 10,
      marginTop: 8,
      overflow: "hidden",
    },
    mappingRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border ?? "#e5e5e5",
    },
    mappingLabel: {
      fontSize: 15,
      color: theme.colors.text,
      fontWeight: "500",
    },
    required: {
      color: "#EF4444",
    },
    mappingValue: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    mappingValueText: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    previewTable: {
      borderWidth: 1,
      borderColor: theme.colors.border ?? "#e5e5e5",
      borderRadius: 10,
      marginTop: 8,
      overflow: "hidden",
    },
    previewRow: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border ?? "#e5e5e5",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    previewRowInvalid: {
      backgroundColor: "#FEF2F2",
    },
    previewName: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "500",
    },
    previewPrice: {
      fontSize: 14,
      color: theme.colors.text,
    },
    previewSku: {
      fontSize: 12,
      color: theme.colors.muted,
      width: "100%",
      marginTop: 2,
    },
  });
}
