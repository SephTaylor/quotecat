// app/quote/[id]/materials.tsx
import { CATEGORIES, PRODUCTS_SEED, type Product } from '@/constants/seed/products';
import { theme } from '@/constants/theme';
import { getQuoteById, saveQuote, type QuoteItem } from '@/lib/quotes';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Sel = { product: Product; qty: number };

export default function Materials() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Hide top header per your preference; sticky bottom bar handles actions
  // (header caused notch collisions before)
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenBody id={id} bottomInset={insets.bottom} onDone={() => router.back()} />
    </>
  );
}

function ScreenBody({
  id,
  bottomInset,
  onDone,
}: {
  id?: string;
  bottomInset: number;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // collapsed by default
  const [selected, setSelected] = useState<Map<string, Sel>>(new Map());

  const totalQty = useMemo(
    () => Array.from(selected.values()).reduce((s, v) => s + v.qty, 0),
    [selected]
  );
  const materialSubtotal = useMemo(
    () =>
      Array.from(selected.values()).reduce((s, v) => s + v.qty * v.product.unitPrice, 0),
    [selected]
  );

  const toggleCat = (catId: string) =>
    setExpanded((e) => ({ ...e, [catId]: !e[catId] }));

  const addQty = (p: Product, delta: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(p.id);
      const qty = Math.max(0, (cur?.qty ?? 0) + delta);
      if (qty === 0) next.delete(p.id);
      else next.set(p.id, { product: p, qty });
      return next;
    });
  };

  const saveSelected = async (goBack: boolean) => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (!q) return;

    const adds: QuoteItem[] = Array.from(selected.values()).map(({ product, qty }) => ({
      id: product.id,
      name: product.name,
      unitPrice: product.unitPrice,
      qty,
    }));

    // merge by id (sum qty; keep latest unitPrice/name)
    const mergedMap = new Map<string, QuoteItem>();
    for (const it of q.items) mergedMap.set(it.id, { ...it });
    for (const a of adds) {
      const prev = mergedMap.get(a.id);
      if (prev) mergedMap.set(a.id, { ...prev, qty: prev.qty + a.qty, unitPrice: a.unitPrice, name: a.name });
      else mergedMap.set(a.id, a);
    }

    await saveQuote({ id, items: Array.from(mergedMap.values()) });
    if (goBack) onDone();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Add Materials</Text>
        <Text style={styles.helper}>Seed-only catalog. Categories start collapsed.</Text>

        {CATEGORIES.map((cat) => {
          const open = !!expanded[cat.id];
          const items = PRODUCTS_SEED[cat.id] ?? [];
          return (
            <View key={cat.id} style={styles.catCard}>
              <Pressable style={styles.catHeader} onPress={() => toggleCat(cat.id)}>
                <Text style={styles.catTitle}>
                  {open ? '▾' : '▸'} {cat.name}
                </Text>
                <Text style={styles.catCount}>{items.length}</Text>
              </Pressable>

              {open && (
                <View style={styles.itemsWrap}>
                  {items.map((p) => {
                    const sel = selected.get(p.id)?.qty ?? 0;
                    const active = sel > 0;
                    return (
                      <View key={p.id} style={[styles.itemRow, active && styles.itemRowActive]}>
                        <View style={styles.itemMeta}>
                          <Text style={styles.itemName}>{p.name}</Text>
                          <Text style={styles.itemSub}>
                            {p.unitPrice.toFixed(2)} {/**/}/{p.unit}
                          </Text>
                        </View>

                        <View style={styles.stepper}>
                          <Pressable style={styles.stepBtn} onPress={() => addQty(p, -1)}>
                            <Text style={styles.stepText}>–</Text>
                          </Pressable>
                          <Text style={styles.qtyText}>{sel}</Text>
                          <Pressable style={styles.stepBtn} onPress={() => addQty(p, +1)}>
                            <Text style={styles.stepText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(bottomInset, theme.spacing(2)) },
        ]}
      >
        <View style={styles.bottomRow}>
          <Pressable
            style={[styles.secondaryBtn, totalQty === 0 && styles.disabled]}
            disabled={totalQty === 0}
            onPress={() => saveSelected(false)}
          >
            <Text style={styles.secondaryText}>
              Add {totalQty > 0 ? `${totalQty} item${totalQty > 1 ? 's' : ''}` : 'items'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, totalQty === 0 && styles.primaryIdle]}
            onPress={() => saveSelected(true)}
          >
            <Text style={styles.primaryText}>
              Done {totalQty > 0 ? `(+${materialSubtotal.toFixed(2)})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), paddingBottom: theme.spacing(8) },
  h1: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  helper: { color: theme.colors.muted, fontSize: 12, marginTop: 4, marginBottom: 12 },

  catCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing(2),
    overflow: 'hidden',
  },
  catHeader: {
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catTitle: { fontWeight: '800', color: theme.colors.text },
  catCount: { color: theme.colors.muted },

  itemsWrap: { paddingHorizontal: theme.spacing(1), paddingBottom: theme.spacing(1) },
  itemRow: {
    paddingHorizontal: theme.spacing(1),
    paddingVertical: theme.spacing(1),
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemRowActive: { backgroundColor: '#fffbe6', borderWidth: 1, borderColor: theme.colors.border },
  itemMeta: { flexShrink: 1, paddingRight: theme.spacing(1) },
  itemName: { color: theme.colors.text, fontWeight: '600' },
  itemSub: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
  },
  stepText: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  qtyText: { minWidth: 20, textAlign: 'center', color: theme.colors.text, fontWeight: '700' },

  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingTop: theme.spacing(1.5),
    paddingHorizontal: theme.spacing(2),
  },
  bottomRow: { flexDirection: 'row', gap: theme.spacing(1) },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
  },
  disabled: { opacity: 0.5 },
  secondaryText: { fontWeight: '800', color: theme.colors.text },

  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  primaryIdle: { opacity: 0.95 },
  primaryText: { fontWeight: '800', color: '#000' },
});
