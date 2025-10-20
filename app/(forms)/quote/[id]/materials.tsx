import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";

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

export default function QuoteMaterials() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const { products, loading } = useProducts();
  const { selection, inc, dec, clear, units, subtotal } = useSelection();

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

      const adds = transformSelectionToItems(selection);
      console.log("Adding items:", adds);
      const merged = mergeById(q.items ?? [], adds);

      await saveQuote({ ...q, id, items: merged });
      console.log("Items saved successfully");

      if (goBack) {
        router.back();
      } else {
        // Clear selection after adding without going back
        clear();
        console.log("Items added and selection cleared, staying on screen");
      }
    },
    [id, selection, router, clear],
  );

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Add Materials",
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
          title: "Add Materials",
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
          Done {units > 0 ? `(+${subtotal.toFixed(2)})` : ""}
        </Button>
      </BottomBar>
    </>
  );
}
