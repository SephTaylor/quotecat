// app/quote/[id]/materials.tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '@/constants/theme';
import { BottomBar, Screen } from '@/modules/core/ui';
import { MaterialsPicker } from '@/modules/materials/Picker';
import type { Selection } from '@/modules/materials/types';
import { useSelection } from '@/modules/materials/useSelection';

import { getQuoteById, saveQuote, type QuoteItem } from '@/lib/quotes';

export default function Materials() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const { selection, inc, dec, units, subtotal } = useSelection();

  const saveSelected = useCallback(async (goBack: boolean) => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (!q) return;

    // Convert selection -> QuoteItem[]
    const adds: QuoteItem[] = Array.from(selection.values()).map(({ product, qty }) => ({
      id: product.id,
      name: product.name,
      unitPrice: product.unitPrice,
      qty,
    }));

    // Merge: one line per product id
    const merged = new Map<string, QuoteItem>();
    for (const it of q.items) merged.set(it.id, { ...it });
    for (const a of adds) {
      const prev = merged.get(a.id);
      merged.set(a.id, prev ? { ...prev, qty: prev.qty + a.qty, name: a.name, unitPrice: a.unitPrice } : a);
    }

    await saveQuote({ ...q, id, items: Array.from(merged.values()) });
    if (goBack) router.back();
  }, [id, selection]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <Screen scroll>
        <MaterialsPicker
          selection={selection as Selection}
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
            Add {units > 0 ? `${units} item${units > 1 ? 's' : ''}` : 'items'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.primaryBtn, units === 0 && styles.primaryIdle]}
          onPress={() => saveSelected(true)}
        >
          <Text style={styles.primaryText}>
            Done {units > 0 ? `(+${subtotal.toFixed(2)})` : ''}
          </Text>
        </Pressable>
      </BottomBar>
    </>
  );
}

const styles = StyleSheet.create({
  secondaryBtn: {
    flex: 1, height: 48, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.card,
  },
  disabled: { opacity: 0.5 },
  secondaryText: { fontWeight: '800', color: theme.colors.text },

  primaryBtn: {
    flex: 1, height: 48, borderRadius: theme.radius.xl,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  primaryIdle: { opacity: 0.95 },
  primaryText: { fontWeight: '800', color: '#000' },
});
