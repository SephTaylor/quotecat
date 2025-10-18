// app/(forms)/assembly/[id].tsx
import FormScreenComponent from "@/modules/core/ui/FormScreen";
import { getAssemblyById, useAssemblyCalculator } from "@/modules/assemblies";
import { formatMoney } from "@/modules/settings/money";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Assembly, PricedLine, ProductIndex } from "@/modules/assemblies";
import { getQuoteById, listQuotes, saveQuote } from "@/modules/quotes";
import { mergeById } from "@/modules/quotes/merge";
import { useProducts } from "@/modules/catalog";

/**
 * Convert PricedLine array to QuoteItem array
 */
function pricedLinesToQuoteItems(lines: PricedLine[]): any[] {
  return lines.map((line) => ({
    id: line.id, // Use product id as item id
    productId: line.id,
    name: line.name,
    qty: line.qty,
    unitPrice: line.unitPrice,
  }));
}

export default function AssemblyCalculatorScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const assemblyId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [assembly, setAssembly] = useState<Assembly | null>(null);

  // Load products from Supabase/cache
  const { products: productsList, loading: productsLoading } = useProducts();

  // Build product index for assembly calculator
  const products: ProductIndex = useMemo(() => {
    const index: ProductIndex = {};
    productsList.forEach((p) => {
      index[p.id] = p;
    });
    return index;
  }, [productsList]);

  useEffect(() => {
    (async () => {
      try {
        if (!assemblyId) return;
        const asm = await getAssemblyById(assemblyId);
        setAssembly(asm ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [assemblyId]);

  // Create a dummy assembly for the hook to satisfy rules-of-hooks
  const dummyAssembly: Assembly = {
    id: "dummy",
    name: "Dummy",
    items: [],
  };

  const calculator = useAssemblyCalculator({
    assembly: assembly ?? dummyAssembly,
    products,
  });

  const closeBar = (
    <View style={styles.footer}>
      <Button title="Close" onPress={() => router.back()} />
    </View>
  );

  const handleAddToQuote = async () => {
    if (!assembly || !calculator || calculator.lines.length === 0) {
      Alert.alert(
        "No materials",
        "Calculate materials first before adding to quote",
      );
      return;
    }

    try {
      // Load all quotes
      const quotes = await listQuotes();

      if (quotes.length === 0) {
        // No quotes exist - prompt to create one
        Alert.alert(
          "No quotes found",
          "Create a new quote to add these materials?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Create Quote",
              onPress: async () => {
                const newQuote = {
                  id: String(Math.random()).slice(2),
                  name: `${assembly.name} Quote`,
                  clientName: "",
                  items: pricedLinesToQuoteItems(calculator.lines),
                  labor: 0,
                };
                await saveQuote(newQuote);
                Alert.alert("Success", "New quote created with materials");
                router.back();
              },
            },
          ],
        );
        return;
      }

      // Show quote picker
      const quoteOptions = quotes.map((q, idx) => ({
        text: q.name || `Quote ${idx + 1}`,
        onPress: async () => {
          const existing = await getQuoteById(q.id);
          if (!existing) return;

          const newItems = pricedLinesToQuoteItems(calculator.lines);
          const merged = mergeById((existing.items as any) ?? [], newItems);

          await saveQuote({ ...existing, items: merged as any });
          Alert.alert(
            "Success",
            `Added ${calculator.lines.length} items to "${q.name || "quote"}"`,
          );
          router.back();
        },
      }));

      Alert.alert("Add to Quote", "Select a quote to add these materials:", [
        ...quoteOptions,
        { text: "Cancel", style: "cancel" },
      ]);
    } catch (error) {
      console.error("Failed to add to quote:", error);
      Alert.alert("Error", "Could not add materials to quote");
    }
  };

  const actionBar = (
    <View style={styles.footer}>
      <Button
        title="Add to Quote"
        onPress={handleAddToQuote}
        disabled={!assembly || !calculator || calculator.lines.length === 0}
      />
      <Button title="Cancel" onPress={() => router.back()} />
    </View>
  );

  if (loading || productsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!assemblyId) {
    return (
      <FormScreenComponent
        scroll
        contentStyle={styles.body}
        bottomBar={closeBar}
      >
        <View>
          <Text style={styles.h2}>Missing assembly id</Text>
          <Text>Open an assembly from the library and try again.</Text>
        </View>
      </FormScreenComponent>
    );
  }

  if (!assembly) {
    return (
      <FormScreenComponent
        scroll
        contentStyle={styles.body}
        bottomBar={closeBar}
      >
        <View>
          <Text style={styles.h2}>Assembly not found</Text>
          <Text>
            We couldn&apos;t load that assembly. Try again from the library.
          </Text>
        </View>
      </FormScreenComponent>
    );
  }

  const { vars, updateVar, lines, materialTotal } = calculator;

  return (
    <>
      <Stack.Screen options={{ title: assembly.name }} />
      <FormScreenComponent
        scroll
        contentStyle={styles.body}
        bottomBar={actionBar}
      >
        <ScrollView contentContainerStyle={{ gap: 16 }}>
          {/* Variables Section */}
          <View>
            <Text style={styles.h2}>Parameters</Text>
            {Object.keys(vars).map((key) => (
              <View key={key} style={styles.inputRow}>
                <Text style={styles.label}>{key}:</Text>
                <TextInput
                  style={styles.input}
                  value={String(vars[key])}
                  onChangeText={(text) => {
                    const num = parseFloat(text);
                    updateVar(key, Number.isNaN(num) ? 0 : num);
                  }}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Materials Section */}
          <View>
            <Text style={styles.h2}>Materials</Text>
            {lines.length === 0 ? (
              <Text style={styles.muted}>
                No materials calculated. Adjust parameters above.
              </Text>
            ) : (
              lines.map((line, idx) => (
                <View key={`${line.id}-${idx}`} style={styles.lineRow}>
                  <View style={styles.lineLeft}>
                    <Text style={styles.lineName}>{line.name}</Text>
                    <Text style={styles.lineSub}>
                      {line.qty} {line.unit} × {formatMoney(line.unitPrice)}
                    </Text>
                  </View>
                  <Text style={styles.lineTotal}>
                    {formatMoney(line.qty * line.unitPrice)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.divider} />

          {/* Total Section */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Material Total</Text>
            <Text style={styles.totalValue}>{formatMoney(materialTotal)}</Text>
          </View>
        </ScrollView>
      </FormScreenComponent>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16 },
  h2: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  muted: { color: "#666" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
  },

  divider: { height: 1, backgroundColor: "#e5e5e5", marginVertical: 8 },

  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  lineLeft: { flex: 1 },
  lineName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  lineSub: { fontSize: 12, color: "#666" },
  lineTotal: { fontSize: 14, fontWeight: "600", marginLeft: 12 },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: "#333",
  },
  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalValue: { fontSize: 16, fontWeight: "700" },

  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    backgroundColor: "white",
  },
});
