import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";

import { getQuoteById, saveQuote } from "@/lib/quotes";
import { CATEGORIES, PRODUCTS_SEED } from "@/modules/catalog/seed";

import { BottomBar, Button, Screen } from "@/modules/core/ui";

import {
  MaterialsPicker,
  transformSelectionToItems,
  useSelection,
} from "@/modules/materials";
import { mergeById } from "@/modules/quotes/merge";

export default function Materials() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const { selection, inc, dec, units, subtotal } = useSelection();

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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <Screen scroll>
        <MaterialsPicker
          categories={CATEGORIES}
          itemsByCategory={PRODUCTS_SEED}
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
