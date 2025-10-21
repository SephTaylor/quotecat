// app/(forms)/assembly/[id].tsx
import { getAssemblyById, useAssemblyCalculator } from "@/modules/assemblies";
import { formatMoney } from "@/modules/settings/money";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Assembly, PricedLine, ProductIndex } from "@/modules/assemblies";
import {
  saveQuote,
  createQuote,
} from "@/modules/quotes";
import { useProducts } from "@/modules/catalog";
import { useTheme } from "@/contexts/ThemeContext";
import { BottomBar, Button } from "@/modules/core/ui";

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
  const params = useLocalSearchParams<{ id?: string | string[]; quoteId?: string | string[] }>();
  const assemblyId = Array.isArray(params.id) ? params.id[0] : params.id;
  const quoteId = Array.isArray(params.quoteId) ? params.quoteId[0] : params.quoteId;
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

  const handleAddToQuote = async () => {
    if (!assembly || !calculator || calculator.lines.length === 0) {
      Alert.alert(
        "No materials",
        "Calculate materials first",
      );
      return;
    }

    try {
      const newItems = pricedLinesToQuoteItems(calculator.lines);

      if (quoteId) {
        // ADD to existing quote
        const { getQuoteById } = await import("@/modules/quotes");
        const existing = await getQuoteById(quoteId);
        if (!existing) {
          Alert.alert("Error", "Quote not found");
          return;
        }

        const { mergeById } = await import("@/modules/quotes/merge");
        const mergedItems = mergeById(existing.items ?? [], newItems);

        await saveQuote({
          ...existing,
          items: mergedItems,
        });

        // Go back to materials picker
        router.back();
        router.back(); // Back to quote materials screen
      } else {
        // CREATE new quote
        const newQuote = await createQuote(
          `${assembly.name}`,
          "",
        );
        const withItems = {
          ...newQuote,
          items: newItems,
        };
        await saveQuote(withItems);

        Alert.alert(
          "Quote Created!",
          `"${assembly.name}" quote created with ${calculator.lines.length} items.`,
          [
            {
              text: "View Quote",
              onPress: () => {
                router.back();
                router.push(`/quote/${newQuote.id}/edit` as any);
              },
            },
            {
              text: "Done",
              onPress: () => router.back(),
              style: "cancel",
            },
          ],
        );
      }
    } catch (error) {
      console.error("Failed to add materials:", error);
      Alert.alert("Error", "Could not add materials");
    }
  };


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
        <View style={styles.container}>
          <View style={styles.center}>
            <Text style={styles.h2}>Missing assembly id</Text>
            <Text style={styles.muted}>Open an assembly from the library and try again.</Text>
          </View>
        </View>
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
        <View style={styles.container}>
          <View style={styles.center}>
            <Text style={styles.h2}>Assembly not found</Text>
            <Text style={styles.muted}>
              We couldn&apos;t load that assembly. Try again from the library.
            </Text>
          </View>
        </View>
      </>
    );
  }

  const { vars, updateVar, lines, materialTotal} = calculator;

  return (
    <>
      <Stack.Screen
        options={{
          title: assembly.name,
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
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.body}>
          {/* Variables Section */}
          {Object.keys(vars).length > 0 && (
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
          )}

          {Object.keys(vars).length > 0 && <View style={styles.divider} />}

          {/* Materials Section */}
          <View>
            <Text style={styles.h2}>Materials</Text>
            {lines.length === 0 ? (
              <Text style={styles.muted}>
                {Object.keys(vars).length > 0
                  ? "No materials calculated. Adjust parameters above."
                  : "This assembly has no materials."}
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

        <BottomBar>
          <Button
            variant="primary"
            onPress={handleAddToQuote}
            disabled={!assembly || !calculator || calculator.lines.length === 0}
          >
            {quoteId ? "Add to Quote" : "Create Quote"}
          </Button>
        </BottomBar>
      </View>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    body: { padding: 16, paddingBottom: 100 },
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

  });
}
