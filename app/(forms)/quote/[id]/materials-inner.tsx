import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { theme } from "@/constants/theme";
import { getQuoteById, saveQuote, type QuoteItem } from "@/lib/quotes";
import { CATEGORIES, PRODUCTS_SEED } from "@/modules/catalog/seed";

// ⬇️ import directly — do NOT use the barrel
import { BottomBar, Screen } from "@/modules/core/ui";

import { MaterialsPicker, useSelection } from "@/modules/materials";

function mergeById(existing: QuoteItem[], adds: QuoteItem[]): QuoteItem[] {
  const map = new Map(existing.map((i) => [i.id, { ...i }]));
  for (const a of adds) {
    const cur = map.get(a.id);
    if (cur) {
      map.set(a.id, { ...cur, qty: (cur.qty ?? 0) + (a.qty ?? 0) });
    } else {
      map.set(a.id, { ...a });
    }
  }
  return Array.from(map.values());
}

export default function Materials() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const { selection, inc, dec, units, subtotal } = useSelection();

  const saveSelected = useCallback(
    async (goBack: boolean) => {
      if (!id) return;

      const q = await getQuoteById(id);
      if (!q) return;

      const adds: QuoteItem[] = Array.from(selection.values()).map(
        ({ product, qty }) => ({
          id: product.id,
          name: product.name,
          unitPrice: product.unitPrice,
          qty,
        }),
      );

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
        <Pressable
          style={[styles.secondaryBtn, units === 0 && styles.disabled]}
          disabled={units === 0}
          onPress={() => saveSelected(false)}
        >
          <Text style={styles.secondaryText}>
            Add {units > 0 ? `${units} item${units > 1 ? "s" : ""}` : "items"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.primaryBtn, units === 0 && styles.primaryIdle]}
          onPress={() => saveSelected(true)}
        >
          <Text style={styles.primaryText}>
            Done {units > 0 ? `(+${subtotal.toFixed(2)})` : ""}
          </Text>
        </Pressable>
      </BottomBar>
    </>
  );
}

const styles = StyleSheet.create({
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.card,
  },
  disabled: { opacity: 0.5 },
  secondaryText: { fontWeight: "800", color: theme.colors.text },

  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  primaryIdle: { opacity: 0.95 },
  primaryText: { fontWeight: "800", color: "#000" },
});
