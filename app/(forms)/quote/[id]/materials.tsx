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

export default function QuoteMaterials() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const { products, loading } = useProducts();
  const { selection, inc, dec, units, subtotal } = useSelection();

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
      if (!id) return;

      const q = await getQuoteById(id);
      if (!q) return;

      const adds = transformSelectionToItems(selection);
      const merged = mergeById(q.items ?? [], adds);

      await saveQuote({ ...q, id, items: merged });
      if (goBack) router.back();
    },
    [id, selection, router],
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Add Materials" }} />
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
      <Stack.Screen options={{ title: "Add Materials" }} />

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
