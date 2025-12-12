// modules/materials/Picker.tsx
import { useTheme } from "@/contexts/ThemeContext";
import type { Product } from "@/modules/catalog/seed";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView, RefreshControl } from "react-native";
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
  refreshControl?: React.ReactElement<typeof RefreshControl>;
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
  refreshControl,
}: MaterialsPickerProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Selected category state
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Sort categories alphabetically by name
  const sortedCategories = React.useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

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

  // Filter products by category and search query
  const filteredItemsByCategory = React.useMemo(() => {
    let filtered = itemsByCategory;

    // Filter by selected category
    if (selectedCategory !== "all") {
      filtered = { [selectedCategory]: itemsByCategory[selectedCategory] || [] };
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const searchFiltered: Record<string, Product[]> = {};

      Object.entries(filtered).forEach(([catId, products]) => {
        const matches = products.filter(p =>
          p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)
        );
        if (matches.length > 0) {
          searchFiltered[catId] = matches;
        }
      });

      return searchFiltered;
    }

    return filtered;
  }, [itemsByCategory, selectedCategory, searchQuery]);

  // Count total products per category for display
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    Object.entries(itemsByCategory).forEach(([catId, products]) => {
      counts[catId] = products.length;
    });
    return counts;
  }, [itemsByCategory]);

  return (
    <View style={styles.container}>
      {/* Sticky Header: Category Filter Chips */}
      <View style={styles.stickyHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
          style={styles.filterScrollView}
        >
          <Pressable
            style={[styles.filterChip, selectedCategory === "all" && styles.filterChipActive]}
            onPress={() => setSelectedCategory("all")}
          >
            <Text style={[styles.filterChipText, selectedCategory === "all" && styles.filterChipTextActive]}>
              All
            </Text>
          </Pressable>
          {sortedCategories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.filterChip, selectedCategory === cat.id && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.filterChipText, selectedCategory === cat.id && styles.filterChipTextActive]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

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
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={true}
      >
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

      {/* Products List */}
      {Object.entries(filteredItemsByCategory).map(([catId, items]) => {
        if (items.length === 0) return null;
        const category = categories.find(c => c.id === catId);
        const categoryName = category?.name || "Products";

        return (
          <View key={catId} style={styles.catCard}>
            {selectedCategory === "all" && (
              <View style={styles.catHeader}>
                <Text style={styles.catTitle}>{categoryName}</Text>
                <Text style={styles.catCount}>{items.length}</Text>
              </View>
            )}

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
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    stickyHeader: {
      backgroundColor: theme.colors.bg,
      paddingTop: 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    scrollContent: {
      flex: 1,
    },
    scrollContentContainer: {
      paddingBottom: theme.spacing(8),
    },
    filterScrollView: {
      flexGrow: 0,
      flexShrink: 0,
    },
    filterContainer: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
      gap: theme.spacing(1),
    },
    filterChip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(0.75),
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    filterChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    filterChipTextActive: {
      color: "#000",
    },
    h1: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
    helper: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 4,
      marginBottom: 12,
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
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1.5),
      marginHorizontal: theme.spacing(2),
    },

    recentCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      marginBottom: theme.spacing(2),
      marginHorizontal: theme.spacing(2),
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
      marginHorizontal: theme.spacing(2),
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
