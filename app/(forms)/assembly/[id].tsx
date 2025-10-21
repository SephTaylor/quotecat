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
import {
  getQuoteById,
  listQuotes,
  saveQuote,
  createQuote,
} from "@/modules/quotes";
import { mergeById } from "@/modules/quotes/merge";
import { useProducts } from "@/modules/catalog";
import { useTheme } from "@/contexts/ThemeContext";

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
  const { theme } = useTheme();

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

  const styles = useMemo(() => createStyles(theme), [theme]);

  const closeBar = (
    <View style={styles.footer}>
      <Button title="Close" onPress={() => router.back()} color={theme.colors.accent} />
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
                const newQuote = await createQuote(
                  `${assembly.name} Quote`,
                  "",
                );
                const withItems = {
                  ...newQuote,
                  items: pricedLinesToQuoteItems(calculator.lines),
                };
                await saveQuote(withItems);
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
        color={theme.colors.accent}
      />
      <Button title="Cancel" onPress={() => router.back()} color={theme.colors.accent} />
    </View>
  );

  if (loading || productsLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Assembly Calculator",
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </>
    );
  }

  if (!assemblyId) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Assembly Calculator",
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          }}
        />
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
      </>
    );
  }

  if (!assembly) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Assembly Calculator",
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          }}
        />
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
      </>
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

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    body: { padding: 16 },
    h2: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 12,
      color: theme.colors.text,
    },
    muted: { color: theme.colors.muted },

    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    label: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 6,
      padding: 8,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.card,
    },

    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 8,
    },

    lineRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    lineLeft: { flex: 1 },
    lineName: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 2,
      color: theme.colors.text,
    },
    lineSub: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    lineTotal: {
      fontSize: 14,
      fontWeight: "600",
      marginLeft: 12,
      color: theme.colors.text,
    },

    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderTopWidth: 2,
      borderTopColor: theme.colors.text,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    totalValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },

    footer: {
      flexDirection: "row",
      gap: 12,
      padding: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
  });
}
