// app/components/MaterialsPicker.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney } from "../lib/money";
import { CATALOG, type MaterialItem } from "./seed-catalog"; // ✅ use the shared type & data

type Props = {
  visible: boolean;
  currency: string;
  items: MaterialItem[]; // selected items
  onChange: (next: MaterialItem[]) => void;
  onClose: () => void;
};

const CHIP_H = 36;

/** Non-stretching chip row */
function ChipRow({
  categories,
  selected,
  onChange,
}: {
  categories: string[];
  selected: string;
  onChange: (c: string) => void;
}) {
  return (
    <FlatList
      data={categories}
      keyExtractor={(c) => c}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, maxHeight: 48 }}
      contentContainerStyle={{ paddingVertical: 4, alignItems: "center" }}
      ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
      renderItem={({ item }) => {
        const active = item === selected;
        return (
          <Pressable
            onPress={() => onChange(item)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>
              {item}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

export default function MaterialsPicker({
  visible,
  currency,
  items,
  onChange,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  // Build categories from catalog; include "All"
  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    for (const m of CATALOG) if (m.category) set.add(m.category);
    return Array.from(set);
  }, []);

  const [category, setCategory] = useState<string>("All");

  const filteredCatalog = useMemo(() => {
    if (category === "All") return CATALOG;
    return CATALOG.filter((m) => m.category === category);
  }, [category]);

  const addItem = useCallback(
    (m: MaterialItem) => {
      const idx = items.findIndex((x) => x.productId === m.productId);
      const next = [...items];
      if (idx >= 0) {
        const qty = (next[idx].qty ?? 0) + 1;
        next[idx] = { ...next[idx], qty };
      } else {
        next.push({ ...m, qty: 1 });
      }
      onChange(next);
    },
    [items, onChange]
  );

  const removeItem = useCallback(
    (productId: string) => {
      onChange(items.filter((x) => x.productId !== productId));
    },
    [items, onChange]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      {/* Safe areas so header isn't under the notch and bottom isn’t behind the home bar */}
      <SafeAreaView style={styles.saferContainer} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={[styles.headerRow, { paddingHorizontal: 12 }]}>
          <Text style={styles.headerTitle}>Materials</Text>
          <Pressable onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Done</Text>
          </Pressable>
        </View>

        {/* Chips */}
        <View style={{ paddingHorizontal: 12, marginBottom: 8, alignItems: "flex-start" }}>
          <ChipRow categories={categories} selected={category} onChange={setCategory} />
        </View>

        {/* Catalog list */}
        <FlatList
          data={filteredCatalog}
          keyExtractor={(m) => m.productId}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingBottom: insets.bottom + 12, // keep last row above gesture bar
          }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.category && <Text style={styles.cat}>{item.category}</Text>}
              </View>
              <Text style={styles.price}>{formatMoney(item.unitPrice, currency)}</Text>
              <Pressable style={styles.addBtn} onPress={() => addItem(item)}>
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          )}
          ListFooterComponent={<View style={{ height: 8 }} />}
        />

        {/* Selected items (stays above bottom safe area) */}
        {items.length > 0 && (
          <View
            style={{
              padding: 12,
              paddingBottom: 12 + insets.bottom,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: "#eee",
              backgroundColor: "#fff",
            }}
          >
            <Text style={styles.subheader}>Selected</Text>
            {items.map((it) => (
              <View key={it.productId} style={styles.selectedRow}>
                <Text style={{ flex: 1 }}>
                  {it.name} × {it.qty ?? 1}
                </Text>
                <Pressable onPress={() => removeItem(it.productId)}>
                  <Text style={{ color: "#b91c1c", fontWeight: "600" }}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  saferContainer: { flex: 1, backgroundColor: "#fff" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", flex: 1, paddingVertical: 8 },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  headerBtnText: { color: "#fff", fontWeight: "700" },

  chip: {
    minHeight: CHIP_H,
    maxHeight: CHIP_H,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: {
    fontWeight: "600",
    color: "#111827",
    lineHeight: 18,
    includeFontPadding: false as unknown as undefined, // Android: trims extra text padding
  },
  chipTextActive: { color: "#fff" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: { fontWeight: "600", marginBottom: 2 },
  cat: { fontSize: 12, color: "#6b7280" },
  price: { fontWeight: "700", marginRight: 8 },
  addBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: "#fff", fontWeight: "700" },
  subheader: { fontWeight: "700", marginBottom: 8 },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
});
