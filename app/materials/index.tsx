// app/materials/index.tsx
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView, Platform,
    Pressable,
    SectionList,
    StyleSheet,
    Text, TextInput,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, Product, PRODUCTS_SEED } from '../../lib/products';
import { QuoteItem, recalc, upsertItem } from '../../lib/quotes';

// Minimal Quote type so this screen compiles without touching other files
type Quote = {
  id: string;
  name: string;
  items: QuoteItem[];
  labor?: number;
  materialSubtotal?: number;
  total?: number;
};

export default function MaterialsScreen() {

const navigation = useNavigation();
React.useEffect(() => {
  // Force override any parent Stack settings
  // This hides the iOS header that was showing “Done” in the notch area.
  // @ts-ignore - setOptions is available on native stack
  navigation.setOptions?.({ headerShown: false });
}, [navigation]);

  const { quoteId } = useLocalSearchParams<{ quoteId?: string }>();

  // TODO: replace this with your real getQuoteById/save when ready.
  const [quote, setQuote] = useState<Quote>({
    id: quoteId ?? 'temp',
    name: '',
    items: [],
    labor: 0,
  });

  const [search, setSearch] = useState('');
  const [pendingQtyById, setPendingQtyById] = useState<Record<string, number>>({});
  const insets = useSafeAreaInsets();

  const sections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? PRODUCTS_SEED.filter(
          p =>
            p.name.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term)
        )
      : PRODUCTS_SEED;

    return CATEGORIES.map(cat => ({
      title: cat,
      data: base.filter(p => p.category === cat),
    })).filter(sec => sec.data.length > 0);
  }, [search]);

  const setQty = (id: string, n: number) =>
    setPendingQtyById(s => ({ ...s, [id]: Math.max(1, Math.round(n || 1)) }));

  const onAdd = (p: Product) => {
    const qty = pendingQtyById[p.id] ?? 1;
    const nextItems = upsertItem(quote.items, {
      productId: p.id,
      name: p.name,
      unitPrice: p.unitPrice,
      qty,
      unit: p.unit,
      vendor: p.vendor,
    });
    setPendingQtyById(s => ({ ...s, [p.id]: 1 })); // reset row qty
    setQuote(q => recalc({ ...q, items: nextItems }));
  };

  const materialSubtotal = quote.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
    <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.select({ ios: insets.top, android: 0 }) as number}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Materials</Text>
          <TextInput
            placeholder="Search by name or category…"
            value={search}
            onChangeText={setSearch}
            style={styles.search}
          />
        </View>

        {/* List */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderSectionHeader={({ section }) => (
            <Text style={styles.section}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const qty = pendingQtyById[item.id] ?? 1;
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.price}>${item.unitPrice.toFixed(2)} / {item.unit}</Text>
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
        />

        {/* Fixed bottom summary bar */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subtotalLabel}>Materials Subtotal</Text>
            <Text style={styles.subtotalVal}>${materialSubtotal.toFixed(2)}</Text>
          </View>
          <Pressable style={styles.primary} onPress={() => router.back()}>
            <Text style={styles.primaryTxt}>Done</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  section: { paddingHorizontal: 16, paddingTop: 16, fontSize: 12, fontWeight: '600', opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  name: { fontSize: 16, fontWeight: '600' },
  price: { fontSize: 12, opacity: 0.7 },
  stepBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  qtyInput: { minWidth: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center', marginHorizontal: 6 },
  addBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  addTxt: { fontWeight: '700' },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: 'white', borderTopWidth: StyleSheet.hairlineWidth,
  },
  subtotalLabel: { fontSize: 12, opacity: 0.7 },
  subtotalVal: { fontSize: 18, fontWeight: '700' },
  primary: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#2563eb' },
  primaryTxt: { color: 'white', fontWeight: '700' },
});
