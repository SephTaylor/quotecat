// modules/materials/Picker.tsx
import { useTheme } from "@/contexts/ThemeContext";
import type { Product } from "@/modules/catalog/seed";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  lastSync?: Date | null; // Last sync timestamp from Supabase
  syncing?: boolean; // Is currently syncing
};

function MaterialsPicker({
  categories,
  itemsByCategory,
  selection,
  onInc,
  onDec,
  onSetQty,
  recentProductIds = [],
  lastSync = null,
  syncing = false,
}: MaterialsPickerProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  // collapsed by default
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (catId: string) =>
    setExpanded((e) => ({ ...e, [catId]: !e[catId] }));

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // State for inline editing
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState<string>("");

  // Handlers for inline quantity editing
  const handleStartEditingQty = (productId: string) => {
    setEditingQty(""); // Start empty
    setEditingProductId(productId);
  };

  const handleQtyChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setEditingQty(cleaned);
  };

  const handleFinishEditingQty = (product: Product) => {
    const newQty = parseInt(editingQty, 10);
    if (!isNaN(newQty) && newQty >= 0) {
      onSetQty(product, newQty);
    }
    setEditingProductId(null);
    setEditingQty("");
  };

  // Find recently used products from all categories
  const recentProducts = React.useMemo(() => {
    const allProducts = Object.values(itemsByCategory).flat();
    return recentProductIds
      .map((id) => allProducts.find((p) => p.id === id))
      .filter((p): p is Product => p !== undefined)
      .slice(0, 5); // Show max 5 recent products
  }, [recentProductIds, itemsByCategory]);

  // Filter products by search query
  const filteredItemsByCategory = React.useMemo(() => {
    if (!searchQuery.trim()) return itemsByCategory;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, Product[]> = {};

    Object.entries(itemsByCategory).forEach(([catId, products]) => {
      const matches = products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
      );
      if (matches.length > 0) {
        filtered[catId] = matches;
      }
    });

    return filtered;
  }, [itemsByCategory, searchQuery]);

  // Generate status message
  const statusMessage = React.useMemo(() => {
    if (syncing) return { text: "Syncing...", icon: "🔄", color: theme.colors.accent };
    if (lastSync) {
      const hoursAgo = Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60));
      if (hoursAgo < 1) return { text: "Online (Up to date)", icon: "✅", color: theme.colors.success || "#4ade80" };
      if (hoursAgo < 24) return { text: `Online (Updated ${hoursAgo}h ago)`, icon: "✅", color: theme.colors.success || "#4ade80" };
      return { text: `Pull down to sync (${Math.floor(hoursAgo / 24)}d ago)`, icon: "⚠️", color: theme.colors.warning || "#fbbf24" };
    }
    return { text: "Pull down to sync", icon: "📱", color: theme.colors.muted };
  }, [syncing, lastSync, theme]);

  return (
    <View style={styles.content}>
      {/* Status Indicator */}
      <View style={styles.statusBadge}>
        <Text style={[styles.statusText, { color: statusMessage.color }]}>
          {statusMessage.icon} {statusMessage.text}
        </Text>
      </View>

      {/* Search Bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search products..."
        placeholderTextColor={theme.colors.muted}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

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
                    {editingProductId === p.id ? (
                      <TextInput
                        style={styles.qtyInput}
                        value={editingQty}
                        onChangeText={handleQtyChange}
                        onBlur={() => handleFinishEditingQty(p)}
                        keyboardType="number-pad"
                        autoFocus
                      />
                    ) : (
                      <Pressable onPress={() => handleStartEditingQty(p.id)}>
                        <Text style={[styles.qtyText, styles.qtyTextTappable]}>{q}</Text>
                      </Pressable>
                    )}
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
        const open = !!expanded[cat.id] || searchQuery.trim().length > 0; // Auto-expand when searching
        const items = filteredItemsByCategory[cat.id] ?? [];
        if (items.length === 0) return null; // Hide empty categories when searching
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
                        {editingProductId === p.id ? (
                          <TextInput
                            style={styles.qtyInput}
                            value={editingQty}
                            onChangeText={handleQtyChange}
                            onBlur={() => handleFinishEditingQty(p)}
                            keyboardType="number-pad"
                            autoFocus
                          />
                        ) : (
                          <Pressable onPress={() => handleStartEditingQty(p.id)}>
                            <Text style={[styles.qtyText, styles.qtyTextTappable]}>{q}</Text>
                          </Pressable>
                        )}
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
      paddingTop: 0,
      paddingBottom: theme.spacing(8),
    },
    h1: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
    helper: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 4,
      marginBottom: 12,
    },
    statusBadge: {
      marginTop: theme.spacing(0.5),
      marginBottom: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.75),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignSelf: "center",
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
    },
    searchInput: {
      height: 44,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.text,
      paddingHorizontal: theme.spacing(2),
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
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
    qtyInput: {
      minWidth: 40,
      height: 36,
      textAlign: "center",
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 16,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      paddingHorizontal: 4,
      paddingVertical: 0,
      textAlignVertical: "center",
    },
  });
}

export default MaterialsPicker; // default export (back-compat)
export { MaterialsPicker }; // named export (barrel-friendly)
