import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getQuoteById, saveQuote } from "@/lib/quotes";
import { CATEGORIES } from "@/modules/catalog/seed";
import { useProducts } from "@/modules/catalog";
import { BottomBar, Button, Screen } from "@/modules/core/ui";
import {
  MaterialsPicker,
  transformSelectionToItems,
  useSelection,
} from "@/modules/materials";
import { mergeById } from "@/modules/quotes/merge";
import type { Product } from "@/modules/catalog/seed";
import { useTheme } from "@/contexts/ThemeContext";
import { Text, View, StyleSheet, Pressable } from "react-native";
import type { QuoteItem } from "@/lib/types";

export default function QuoteMaterials() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const { products, loading } = useProducts();
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [initialSelectionLoaded, setInitialSelectionLoaded] = useState(false);

  // Create initial selection from quote items
  const initialSelection = useMemo(() => {
    if (!initialSelectionLoaded || quoteItems.length === 0) return new Map();

    const map = new Map();
    quoteItems.forEach((item) => {
      const product = products.find((p) => p.id === item.id);
      if (product) {
        map.set(product.id, { product, qty: item.qty });
      }
    });
    return map;
  }, [quoteItems, products, initialSelectionLoaded]);

  const { selection, inc, dec, clear, units, setSelection } = useSelection(initialSelection);

  // Load quote items function
  const loadQuote = useCallback(async () => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (q) {
      const items = q.items ?? [];
      setQuoteItems(items);

      // Pre-populate selection with existing items
      if (items.length > 0 && products.length > 0 && !initialSelectionLoaded) {
        const map = new Map();
        items.forEach((item) => {
          const product = products.find((p) => p.id === item.id);
          if (product) {
            map.set(product.id, { product, qty: item.qty });
          }
        });
        setSelection(map);
        setInitialSelectionLoaded(true);
      }
    }
  }, [id, products, initialSelectionLoaded, setSelection]);

  // Load on mount
  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  // Reload when returning from edit-items screen
  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        if (!id) return;
        const q = await getQuoteById(id);
        if (q) {
          const items = q.items ?? [];
          setQuoteItems(items);

          // Don't reload selection on focus - let it stay cleared after "Add items"
          // Selection will only be populated when user manually clicks +/-
          // This gives clean UI for accumulate mode

          setInitialSelectionLoaded(true);
        }
      };
      refresh();
    }, [id])
  );

  // Group products by category for MaterialsPicker
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};

    products.forEach((product) => {
      if (!grouped[product.categoryId]) {
        grouped[product.categoryId] = [];
      }
      grouped[product.categoryId].push(product);
    });

    return grouped;
  }, [products]);

  const saveSelected = useCallback(
    async (goBack: boolean) => {
      if (!id) {
        console.log("No quote ID");
        return;
      }

      const q = await getQuoteById(id);
      if (!q) {
        console.log("Quote not found");
        return;
      }

      // Get current quote items
      const existingItems = q.items ?? [];

      // Convert current selection to items
      const newlySelectedItems = transformSelectionToItems(selection);
      console.log("Newly selected items:", newlySelectedItems);
      console.log("Existing quote items:", existingItems);

      // Merge existing items with newly selected items (accumulate mode)
      const mergedItems = mergeById(existingItems, newlySelectedItems);
      console.log("Merged items:", mergedItems);

      // Save the merged items list
      await saveQuote({ ...q, id, items: mergedItems });
      console.log("Items saved successfully");

      if (goBack) {
        router.back();
      } else {
        // Update the indicator to show all saved items
        setQuoteItems(mergedItems);

        // Clear the selection UI so user can select new items
        clear();
        console.log("Selection cleared. Quote now has", mergedItems.length, "product types");

        // Show success message
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
    },
    [id, selection, router, clear],
  );

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Add/Edit Materials",
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
        <Screen scroll>
          <MaterialsPicker
            categories={CATEGORIES}
            itemsByCategory={{}}
            selection={selection}
            onInc={inc}
            onDec={dec}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Add/Edit Materials",
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

      <Screen scroll>
        {quoteItems.length > 0 && (
          <View style={styles(theme).quoteItemsIndicator}>
            <View style={styles(theme).indicatorContent}>
              <View style={styles(theme).indicatorTextContainer}>
                <Text style={styles(theme).indicatorText}>
                  Quote has {quoteItems.reduce((sum, item) => sum + item.qty, 0)}{" "}
                  item
                  {quoteItems.reduce((sum, item) => sum + item.qty, 0) !== 1
                    ? "s"
                    : ""}{" "}
                  ({quoteItems.length} product
                  {quoteItems.length !== 1 ? "s" : ""})
                </Text>
                <Text style={styles(theme).indicatorSubtext}>
                  Total items cost: $
                  {quoteItems
                    .reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
                    .toFixed(2)}
                </Text>
              </View>
              <Pressable
                style={styles(theme).editButton}
                onPress={() => id && router.push(`/quote/${id}/edit-items`)}
              >
                <Text style={styles(theme).editButtonText}>Edit</Text>
              </Pressable>
            </View>
          </View>
        )}

        {showSuccessMessage && (
          <View style={styles(theme).successMessage}>
            <Text style={styles(theme).successText}>✓ Items added to quote!</Text>
          </View>
        )}

        <MaterialsPicker
          categories={CATEGORIES}
          itemsByCategory={productsByCategory}
          selection={selection}
          onInc={inc}
          onDec={dec}
        />
      </Screen>

      <BottomBar>
        <Button
          variant="secondary"
          disabled={units === 0}
          onPress={() => saveSelected(false)}
        >
          Add {units > 0 ? `${units} item${units > 1 ? "s" : ""}` : "items"}
        </Button>

        <Button variant="primary" onPress={() => saveSelected(true)}>
          Done
        </Button>
      </BottomBar>
    </>
  );
}

const styles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    quoteItemsIndicator: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginHorizontal: theme.spacing(2),
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    indicatorContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing(2),
    },
    indicatorTextContainer: {
      flex: 1,
    },
    indicatorText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 4,
    },
    indicatorSubtext: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    editButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
    successMessage: {
      backgroundColor: "#34C759",
      borderRadius: theme.radius.lg,
      padding: theme.spacing(1.5),
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
      alignItems: "center",
    },
    successText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
