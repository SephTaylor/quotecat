// app/quote/[id]/materials.tsx
import { theme } from '@/constants/theme';
import { getQuoteById, saveQuote, type QuoteItem } from '@/lib/quotes';
import { CATEGORIES, PRODUCTS_SEED, type Product } from '@/modules/catalog/seed';
import { BottomBar, Screen } from '@/modules/core/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Sel = { product: Product; qty: number };
type ExpandState = Record<string, boolean>;

export default function Materials() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  // Lift state to the parent so BottomActions can read it via props (no globals)
  const [expanded, setExpanded] = useState<ExpandState>({});
  const [selected, setSelected] = useState<Map<string, Sel>>(new Map());

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scroll>
        <ScreenBody
          expanded={expanded}
          setExpanded={setExpanded}
          selected={selected}
          setSelected={setSelected}
        />
      </Screen>
      <BottomActions id={id} selected={selected} onDone={() => router.back()} />
    </>
  );
}

function ScreenBody({
  expanded,
  setExpanded,
  selected,
  setSelected,
}: {
  expanded: ExpandState;
  setExpanded: React.Dispatch<React.SetStateAction<ExpandState>>;
  selected: Map<string, Sel>;
  setSelected: React.Dispatch<React.SetStateAction<Map<string, Sel>>>;
}) {
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

  return (
    <View style={styles.content}>
      <Text style={styles.h1}>Add Materials</Text>
      <Text style={styles.helper}>Seed-only catalog. Categories start collapsed.</Text>

      {CATEGORIES.map((cat) => {
        const open = !!expanded[cat.id];
        const items = PRODUCTS_SEED[cat.id] ?? [];
        return (
          <View key={cat.id} style={styles.catCard}>
            <Pressable style={styles.catHeader} onPress={() => toggleCat(cat.id)}>
              <Text style={styles.catTitle}>{open ? '▾' : '▸'} {cat.name}</Text>
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
                        <Text style={styles.itemSub}>{p.unitPrice.toFixed(2)} / {p.unit}</Text>
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
    </View>
  );
}

function BottomActions({
  id,
  selected,
  onDone,
}: {
  id?: string;
  selected: Map<string, Sel>;
  onDone: () => void;
}) {
  const totalQty = useMemo(
    () => Array.from(selected.values()).reduce((s, v) => s + v.qty, 0),
    [selected]
  );

  const materialSubtotal = useMemo(
    () => Array.from(selected.values()).reduce((s, v) => s + v.qty * v.product.unitPrice, 0),
    [selected]
  );

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

    const merged = new Map<string, QuoteItem>();
    for (const it of q.items) merged.set(it.id, { ...it });
    for (const a of adds) {
      const prev = merged.get(a.id);
      if (prev) merged.set(a.id, { ...prev, qty: prev.qty + a.qty, name: a.name, unitPrice: a.unitPrice });
      else merged.set(a.id, a);
    }

    await saveQuote({ id, items: Array.from(merged.values()) });
    if (goBack) onDone();
  };

  return (
    <BottomBar>
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
    </BottomBar>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.spacing(2), paddingTop: theme.spacing(2), paddingBottom: theme.spacing(8) },
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

  // Bottom actions
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
