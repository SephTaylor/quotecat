// app/materials/index.tsx
import { colors as themeColors } from '@/constants/theme';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, PRODUCTS_SEED, type Product } from '../../lib/products';
import { getQuoteById, recalc, saveQuote, upsertItem } from '../../lib/quotes';

// Minimal, flexible quote shape to avoid TS mismatches
type QuoteShape = {
  id: string;
  name: string;
  items: any[];     // keep flexible; recalc/upsertItem know the real shape
  labor?: number;
};

// Theme fallbacks so missing keys won't error
const c = {
  bg: (themeColors as any)?.bg ?? '#F4F6FA',
  text: (themeColors as any)?.text ?? '#0B1220',
  border: (themeColors as any)?.border ?? '#E5E7EB',
  brand: (themeColors as any)?.brand ?? '#111827',
};

export default function MaterialsScreen() {
  const insets = useSafeAreaInsets();

  // Normalize quoteId: string | string[] | undefined -> string | undefined
  const params = useLocalSearchParams<{ quoteId?: string | string[] }>();
  const qid = Array.isArray(params.quoteId) ? params.quoteId[0] : params.quoteId;

  const [quote, setQuote] = useState<QuoteShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingQtyById, setPendingQtyById] = useState<Record<string, number>>({});

  // Load the current quote once
  useEffect(() => {
    (async () => {
      try {
        const existing = qid ? await getQuoteById(qid) : null;
        setQuote(
          (existing as any as QuoteShape) ??
            ({ id: qid ?? 'temp', name: '', items: [], labor: 0 } as QuoteShape)
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [qid]);

  const sections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? PRODUCTS_SEED.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term)
        )
      : PRODUCTS_SEED;

    return CATEGORIES.map((cat) => ({
      title: cat,
      data: base.filter((p) => p.category === cat),
    })).filter((sec) => sec.data.length > 0);
  }, [search]);

  const setQty = (id: string, n: number) =>
    setPendingQtyById((s) => ({ ...s, [id]: Math.max(1, Math.round(n || 1)) }));

  const onAdd = async (p: Product) => {
    if (!quote) return;
    const qty = pendingQtyById[p.id] ?? 1;

    const nextItems = upsertItem(quote.items as any, {
      productId: p.id,
      name: p.name,
      unitPrice: p.unitPrice,
      qty,
      // if your Product lacks these, casts keep TS happy and runtime safe
      unit: (p as any).unit,
      vendor: (p as any).vendor,
    } as any);

    const nextQuote = recalc({ ...(quote as any), items: nextItems } as any) as any as QuoteShape;

    setPendingQtyById((s) => ({ ...s, [p.id]: 1 })); // reset row qty
    setQuote(nextQuote);
    await saveQuote(nextQuote as any); // persist immediately
  };

  const onDone = async () => {
    if (quote) await saveQuote(recalc(quote as any) as any);
    router.back();
  };

  const materialSubtotal =
    quote?.items?.reduce((sum: number, i: any) => sum + i.unitPrice * i.qty, 0) ?? 0;

  const FOOTER_H = 72;

  return (
    <>
      {/* Native header (below the notch) with Done on the right */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Materials',
          headerRight: () => (
            <Pressable onPress={onDone} style={styles.headerDoneBtn}>
              <Text style={styles.headerDoneText}>Done</Text>
            </Pressable>
          ),
        }}
      />

      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['bottom', 'left', 'right']}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: 'padding', android: undefined })}
            style={{ flex: 1 }}
          >
            {/* Search (no custom top bar) */}
            <View style={styles.header}>
              <TextInput
                placeholder="Search by name or category…"
                placeholderTextColor="#9CA3AF"
                value={search}
                onChangeText={setSearch}
                style={styles.search}
              />
            </View>

            {/* List sits under native header automatically */}
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={{ paddingBottom: FOOTER_H + insets.bottom + 16 }}
              renderSectionHeader={({ section }) => (
                <Text style={styles.section}>{section.title}</Text>
              )}
              renderItem={({ item }) => {
                const qty = pendingQtyById[item.id] ?? 1;
                return (
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.price}>
                        ${item.unitPrice.toFixed(2)} / {(item as any).unit}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                      <Pressable style={styles.stepBtn} onPress={() => setQty(item.id, qty - 1)}>
                        <Text>-</Text>
                      </Pressable>
                      <TextInput
                        keyboardType="number-pad"
                        value={String(qty)}
                        onChangeText={(t) => setQty(item.id, parseInt(t, 10))}
                        style={styles.qtyInput}
                      />
                      <Pressable style={styles.stepBtn} onPress={() => setQty(item.id, qty + 1)}>
                        <Text>+</Text>
                      </Pressable>
                    </View>

                    <Pressable style={styles.addBtn} onPress={() => onAdd(item)}>
                      <Text style={styles.addTxt}>Add</Text>
                    </Pressable>
                  </View>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />

            {/* Bottom summary (stays above home indicator) */}
            <View
              style={[
                styles.bottomBar,
                { height: FOOTER_H + insets.bottom, paddingBottom: insets.bottom },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.subtotalLabel}>Materials Subtotal</Text>
                <Text style={styles.subtotalVal}>${materialSubtotal.toFixed(2)}</Text>
              </View>
              <Pressable style={styles.primary} onPress={onDone}>
                <Text style={styles.primaryTxt}>Done</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderColor: c.border,
    backgroundColor: '#fff',
    color: c.text,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    color: c.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  name: { fontSize: 16, fontWeight: '600', color: c.text },
  price: { fontSize: 12, opacity: 0.7, color: c.text },
  stepBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderColor: c.border,
    backgroundColor: '#fff',
  },
  qtyInput: {
    minWidth: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'center',
    marginHorizontal: 6,
    borderColor: c.border,
    backgroundColor: '#fff',
    color: c.text,
  },
  addBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderColor: c.border,
    backgroundColor: '#fff',
  },
  addTxt: { fontWeight: '700', color: c.text },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  subtotalLabel: { fontSize: 12, opacity: 0.7, color: c.text },
  subtotalVal: { fontSize: 18, fontWeight: '700', color: c.text },
  primary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: c.brand,
  },
  primaryTxt: { color: c.text, fontWeight: '700' },
  headerDoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: c.text,
  },
  headerDoneText: { color: '#fff', fontWeight: '700' },
});
