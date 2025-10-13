// app/materials/index.tsx
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/theme";
import { CATEGORIES, Product, PRODUCTS_SEED } from "../../lib/products";
import { QuoteItem, recalc, upsertItem } from "../../lib/quotes";

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
  // Hide any parent header for a true full-screen page
  const navigation = useNavigation();
  useEffect(() => {
    // @ts-ignore
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  const { quoteId } = useLocalSearchParams<{ quoteId?: string }>();

  const [quote, setQuote] = useState<Quote>({
    id: quoteId ?? "temp",
    name: "",
    items: [],
    labor: 0,
  });

  const [search, setSearch] = useState("");
  const [pendingQtyById, setPendingQtyById] = useState<Record<string, number>>({});
  const insets = useSafeAreaInsets();

  const sections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? PRODUCTS_SEED.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term),
        )
      : PRODUCTS_SEED;

    return CATEGORIES.map((cat) => ({
      title: cat,
      data: base.filter((p) => p.category === cat),
    })).filter((sec) => sec.data.length > 0);
  }, [search]);

  const setQty = (id: string, n: number) =>
    setPendingQtyById((s) => ({ ...s, [id]: Math.max(1, Math.round(n || 1)) }));

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
    setPendingQtyById((s) => ({ ...s, [p.id]: 1 })); // reset row qty
    setQuote((q) => recalc({ ...q, items: nextItems }));
  };

  const materialSubtotal = quote.items.reduce(
    (sum, i) => sum + i.unitPrice * i.qty,
    0,
  );

  // Footer height we keep space for
  const FOOTER_H = 72;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.select({
          ios: 0, // SafeAreaView already accounts for top
          android: 0,
        }) as number}
      >
        {/* Header (inside safe area) */}
        <View style={styles.header}>
          <Text style={styles.title}>Materials</Text>
          <TextInput
            placeholder="Search by name or category…"
            value={search}
            onChangeText={setSearch}
            style={styles.search}
          />
        </View>

        {/* List (pad bottom so it never hides behind footer) */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: FOOTER_H + insets.bottom + 16,
          }}
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
                    ${item.unitPrice.toFixed(2)} / {item.unit}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginRight: 8,
                  }}
                >
                  <Pressable
                    style={styles.stepBtn}
                    onPress={() => setQty(item.id, qty - 1)}
                  >
                    <Text>-</Text>
                  </Pressable>
                  <TextInput
                    keyboardType="number-pad"
                    value={String(qty)}
                    onChangeText={(t) => setQty(item.id, parseInt(t, 10))}
                    style={styles.qtyInput}
                  />
                  <Pressable
                    style={styles.stepBtn}
                    onPress={() => setQty(item.id, qty + 1)}
                  >
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

        {/* Fixed bottom summary bar — always above the home indicator */}
        <View
          style={[
            styles.bottomBar,
            {
              height: FOOTER_H + insets.bottom,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.subtotalLabel}>Materials Subtotal</Text>
            <Text style={styles.subtotalVal}>
              ${materialSubtotal.toFixed(2)}
            </Text>
          </View>
          <Pressable
            style={styles.primary}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.primaryTxt}>Done</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },

  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderColor: colors.border,   // was #E6EAF2
    backgroundColor: "#fff",
    color: colors.text,
  },

  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.6,
    color: colors.text,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },

  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  price: { fontSize: 12, opacity: 0.7, color: colors.text },

  stepBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderColor: colors.border,   // was #E6EAF2
    backgroundColor: "#fff",
  },

  qtyInput: {
    minWidth: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: "center",
    marginHorizontal: 6,
    borderColor: colors.border,   // was #E6EAF2
    backgroundColor: "#fff",
    color: colors.text,
  },

  addBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderColor: colors.border,   // was #E6EAF2
    backgroundColor: "#fff",
  },
  addTxt: { fontWeight: "700", color: colors.text },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",      // could be colors.bg if you prefer
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border, // was #E6EAF2
  },

  subtotalLabel: { fontSize: 12, opacity: 0.7, color: colors.text },
  subtotalVal: { fontSize: 18, fontWeight: "700", color: colors.text },

  primary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.brand, // was #2563eb
  },
  primaryTxt: { color: colors.text, fontWeight: "700" },
});
