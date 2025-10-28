// app/(forms)/assembly/[id].tsx
import { getAssemblyById, useAssemblyCalculator, validateAssembly } from "@/modules/assemblies";
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
  getQuoteById,
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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

  // Validate assembly when products are loaded
  useEffect(() => {
    if (assembly && productsList.length > 0) {
      const validation = validateAssembly(assembly, productsList);
      if (!validation.isValid) {
        setValidationErrors(validation.errors.map((e) => e.message));
      } else {
        setValidationErrors([]);
      }
    }
  }, [assembly, productsList]);

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

  const handleCreateQuote = async () => {
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
        // ADD TO EXISTING QUOTE
        const existingQuote = await getQuoteById(quoteId);
        if (!existingQuote) {
          Alert.alert("Error", "Quote not found");
          return;
        }

        // Merge items (add new items to existing)
        const { mergeById } = await import("@/modules/quotes/merge");
        const mergedItems = mergeById(existingQuote.items ?? [], newItems);

        const updatedQuote = {
          ...existingQuote,
          items: mergedItems,
        };
        await saveQuote(updatedQuote);

        Alert.alert(
          "Items Added!",
          `Added ${calculator.lines.length} items from "${assembly.name}" to your quote.`,
          [
            {
              text: "Back to Quote",
              onPress: () => {
                router.back();
                router.back(); // Go back twice (assembly list -> quote edit)
              },
            },
          ],
        );
      } else {
        // CREATE NEW QUOTE
        const newQuote = await createQuote(
          `${assembly.name}`,
          "",
        );
        const withItems = {
          ...newQuote,
          items: newItems,
        };
        await saveQuote(withItems);

        // Navigate directly to the new quote
        router.dismissAll();
        router.push(`/quote/${newQuote.id}/edit` as any);
      }
    } catch (error) {
      console.error("Failed to process quote:", error);
      Alert.alert("Error", "Could not process quote");
    }
  };


  if (loading || productsLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Assembly Calculator",
            headerShown: true,
            headerBackTitle: "Assemblies",
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
            headerBackTitle: "Assemblies",
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
            headerBackTitle: "Assemblies",
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
          headerBackTitle: "Back",
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
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>⚠️ Assembly Needs Review</Text>
              <Text style={styles.errorDescription}>
                This assembly has issues that must be fixed before use:
              </Text>
              {validationErrors.map((error, idx) => (
                <Text key={idx} style={styles.errorItem}>
                  • {error}
                </Text>
              ))}
              <Text style={styles.errorAction}>
                {assembly.id.startsWith("custom-")
                  ? "Edit this assembly to fix the issues."
                  : "This is a built-in assembly. Contact support if this issue persists."}
              </Text>
            </View>
          )}

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
            onPress={handleCreateQuote}
            disabled={
              !assembly ||
              !calculator ||
              calculator.lines.length === 0 ||
              validationErrors.length > 0
            }
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

    errorCard: {
      backgroundColor: "#FFF3CD",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: "#FFC107",
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#856404",
      marginBottom: 8,
    },
    errorDescription: {
      fontSize: 14,
      color: "#856404",
      marginBottom: 8,
    },
    errorItem: {
      fontSize: 13,
      color: "#856404",
      marginBottom: 4,
      marginLeft: 8,
    },
    errorAction: {
      fontSize: 13,
      fontWeight: "600",
      color: "#856404",
      marginTop: 8,
      fontStyle: "italic",
    },

  });
}
