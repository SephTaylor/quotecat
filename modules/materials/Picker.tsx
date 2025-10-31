// modules/materials/Picker.tsx
import { useTheme } from "@/contexts/ThemeContext";
import type { Product } from "@/modules/catalog/seed";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { Selection } from "./types";

export type Category = { id: string; name: string };
export type MaterialsPickerProps = {
  categories: Category[];
  itemsByCategory: Record<string, Product[]>;
  selection: Selection;
  onInc(product: Product): void;
  onDec(product: Product): void;
  onSetQty(product: Product, qty: number): void; // New: direct quantity setter
  recentProductIds?: string[]; // Optional: IDs of recently used products
};

function MaterialsPicker({
  categories,
  itemsByCategory,
  selection,
  onInc,
  onDec,
  onSetQty,
  recentProductIds = [],
}: MaterialsPickerProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  // collapsed by default
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (catId: string) =>
    setExpanded((e) => ({ ...e, [catId]: !e[catId] }));

  // Handler to prompt user for quantity input
  const promptQuantity = (product: Product, currentQty: number) => {
    Alert.prompt(
      "Enter Quantity",
      `How many ${product.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set",
          onPress: (value) => {
            const qty = parseInt(value || "0", 10);
            if (!isNaN(qty) && qty >= 0) {
              onSetQty(product, qty);
            }
          },
        },
      ],
      "plain-text",
      currentQty.toString(),
      "numeric"
    );
  };

  // Find recently used products from all categories
  const recentProducts = React.useMemo(() => {
    const allProducts = Object.values(itemsByCategory).flat();
    return recentProductIds
      .map((id) => allProducts.find((p) => p.id === id))
      .filter((p): p is Product => p !== undefined)
      .slice(0, 5); // Show max 5 recent products
  }, [recentProductIds, itemsByCategory]);

  return (
    <View style={styles.content}>
      <Text style={styles.h1}>Add Materials</Text>
      <Text style={styles.helper}>
        Seed-only catalog. Categories start collapsed.
      </Text>

      {/* Recently Used Section */}
      {recentProducts.length > 0 && (
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>⚡ Recently Used</Text>
          <View style={styles.itemsWrap}>
            {recentProducts.map((p) => {
              const q = selection.get(p.id)?.qty ?? 0;
              const active = q > 0;
              return (
                <View
                  key={p.id}
                  style={[styles.itemRow, active && styles.itemRowActive]}
                >
                  <View style={styles.itemMeta}>
                    <Text style={styles.itemName}>{p.name}</Text>
                    <Text style={styles.itemSub}>
                      {p.unitPrice.toFixed(2)} / {p.unit}
                    </Text>
                  </View>

                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => onDec(p)}
                    >
                      <Text style={styles.stepText}>–</Text>
                    </Pressable>
                    <Pressable onPress={() => promptQuantity(p, q)}>
                      <Text style={[styles.qtyText, styles.qtyTextTappable]}>{q}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => onInc(p)}
                    >
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {categories.map((cat) => {
        const open = !!expanded[cat.id];
        const items = itemsByCategory[cat.id] ?? [];
        return (
          <View key={cat.id} style={styles.catCard}>
            <Pressable style={styles.catHeader} onPress={() => toggle(cat.id)}>
              <Text style={styles.catTitle}>
                {open ? "▾" : "▸"} {cat.name}
              </Text>
              <Text style={styles.catCount}>{items.length}</Text>
            </Pressable>

            {open && (
              <View style={styles.itemsWrap}>
                {items.map((p) => {
                  const q = selection.get(p.id)?.qty ?? 0;
                  const active = q > 0;
                  return (
                    <View
                      key={p.id}
                      style={[styles.itemRow, active && styles.itemRowActive]}
                    >
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemName}>{p.name}</Text>
                        <Text style={styles.itemSub}>
                          {p.unitPrice.toFixed(2)} / {p.unit}
                        </Text>
                      </View>

                      <View style={styles.stepper}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => onDec(p)}
                        >
                          <Text style={styles.stepText}>–</Text>
                        </Pressable>
                        <Pressable onPress={() => promptQuantity(p, q)}>
                          <Text style={[styles.qtyText, styles.qtyTextTappable]}>{q}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => onInc(p)}
                        >
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

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(8),
    },
    h1: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
    helper: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 4,
      marginBottom: 12,
    },

    recentCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      marginBottom: theme.spacing(2),
      overflow: "hidden",
    },
    recentTitle: {
      fontWeight: "800",
      color: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 14,
    },
    catCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing(2),
      overflow: "hidden",
    },
    catHeader: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    catTitle: { fontWeight: "800", color: theme.colors.text },
    catCount: { color: theme.colors.muted },

    itemsWrap: {
      paddingHorizontal: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },
    itemRow: {
      paddingHorizontal: theme.spacing(1),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    itemRowActive: {
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    itemMeta: { flexShrink: 1, paddingRight: theme.spacing(1) },
    itemName: { color: theme.colors.text, fontWeight: "600" },
    itemSub: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },

    stepper: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
    stepBtn: {
      height: 32,
      width: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.card,
    },
    stepText: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
    qtyText: {
      minWidth: 28,
      textAlign: "center",
      color: theme.colors.text,
      fontWeight: "700",
    },
    qtyTextTappable: {
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
  });
}

export default MaterialsPicker; // default export (back-compat)
export { MaterialsPicker }; // named export (barrel-friendly)
