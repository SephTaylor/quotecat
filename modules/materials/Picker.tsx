// modules/materials/Picker.tsx
import { useTheme } from "@/contexts/ThemeContext";
import { type Product, SUPPLIER_NAMES } from "@/modules/catalog/seed";
import React, { useState, useRef, useCallback, memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView, RefreshControl, Keyboard, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import type { Selection } from "./types";

export type Category = { id: string; name: string };
export type MaterialsPickerProps = {
  categories: Category[];
  itemsByCategory: Record<string, Product[]>;
  selection: Selection;
  onInc(product: Product): void;
  onDec(product: Product): void;
  onSetQty(product: Product, qty: number): void;
  recentProductIds?: string[];
  lastSync?: Date | null;
  syncing?: boolean;
  refreshControl?: React.ReactElement<typeof RefreshControl>;
  onFilterPress?: () => void;
  activeFilterCount?: number;
};

// List item types for FlashList
type ListItem =
  | { type: "header"; categoryId: string; categoryName: string; count: number }
  | { type: "product"; product: Product };

// Memoized product row - only re-renders when its specific props change
type ProductRowProps = {
  product: Product;
  qty: number;
  isEditing: boolean;
  editingQty: string;
  onInc: () => void;
  onDec: () => void;
  onStartEdit: () => void;
  onQtyChange: (text: string) => void;
  onFinishEdit: () => void;
  styles: ReturnType<typeof createStyles>;
};

const ProductRow = memo(function ProductRow({
  product,
  qty,
  isEditing,
  editingQty,
  onInc,
  onDec,
  onStartEdit,
  onQtyChange,
  onFinishEdit,
  styles,
}: ProductRowProps) {
  const active = qty > 0;

  return (
    <View style={[styles.itemRow, active && styles.itemRowActive]}>
      <View style={styles.itemMeta}>
        <Text style={styles.itemName}>{product.name}</Text>
        <Text style={styles.itemSub}>
          ${product.unitPrice.toFixed(2)}/{product.unit}
          {product.supplierId && SUPPLIER_NAMES[product.supplierId] && ` · ${SUPPLIER_NAMES[product.supplierId]}`}
        </Text>
      </View>

      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={onDec}>
          <Text style={styles.stepText}>–</Text>
        </Pressable>
        {isEditing ? (
          <TextInput
            style={styles.qtyInput}
            value={editingQty}
            onChangeText={onQtyChange}
            onBlur={onFinishEdit}
            onSubmitEditing={onFinishEdit}
            keyboardType="number-pad"
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <Pressable onPress={onStartEdit}>
            <Text style={[styles.qtyText, styles.qtyTextTappable]}>{qty}</Text>
          </Pressable>
        )}
        <Pressable style={styles.stepBtn} onPress={onInc}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
});

// Category header component
const CategoryHeader = memo(function CategoryHeader({
  categoryName,
  count,
  styles,
}: {
  categoryName: string;
  count: number;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.catHeader}>
      <Text style={styles.catTitle}>{categoryName}</Text>
      <Text style={styles.catCount}>{count}</Text>
    </View>
  );
});

function MaterialsPicker({
  categories,
  itemsByCategory,
  selection,
  onInc,
  onDec,
  onSetQty,
  recentProductIds = [],
  refreshControl,
  onFilterPress,
  activeFilterCount = 0,
}: MaterialsPickerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const listRef = useRef<FlashList<ListItem>>(null);

  // Selected category state
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Sort categories alphabetically by name
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  // State for inline editing
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState<string>("");
  const editingProductRef = useRef<Product | null>(null);

  // Handlers for inline quantity editing
  const handleStartEditingQty = useCallback((productId: string, product: Product) => {
    editingProductRef.current = product;
    setEditingQty("");
    setEditingProductId(productId);
  }, []);

  const handleQtyChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setEditingQty(cleaned);
  }, []);

  const handleFinishEditingQty = useCallback((product: Product) => {
    const newQty = parseInt(editingQty, 10);
    if (!isNaN(newQty) && newQty >= 0) {
      onSetQty(product, newQty);
    }
    editingProductRef.current = null;
    setEditingProductId(null);
    setEditingQty("");
    Keyboard.dismiss();
  }, [editingQty, onSetQty]);

  // Find recently used products from all categories
  const recentProducts = useMemo(() => {
    const allProducts = Object.values(itemsByCategory).flat();
    return recentProductIds
      .map((id) => allProducts.find((p) => p.id === id))
      .filter((p): p is Product => p !== undefined)
      .slice(0, 5);
  }, [recentProductIds, itemsByCategory]);

  // Filter products and flatten into list items for FlashList
  const listData = useMemo(() => {
    const items: ListItem[] = [];

    // Determine which categories to show
    const categoriesToShow = selectedCategory === "all"
      ? sortedCategories
      : sortedCategories.filter(c => c.id === selectedCategory);

    for (const cat of categoriesToShow) {
      let products = itemsByCategory[cat.id] || [];

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        products = products.filter(p =>
          p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)
        );
      }

      if (products.length === 0) continue;

      // Add category header (only in "all" view)
      if (selectedCategory === "all") {
        items.push({
          type: "header",
          categoryId: cat.id,
          categoryName: cat.name,
          count: products.length,
        });
      }

      // Add products
      for (const product of products) {
        items.push({ type: "product", product });
      }
    }

    return items;
  }, [itemsByCategory, selectedCategory, searchQuery, sortedCategories]);

  // Render item for FlashList
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === "header") {
      return (
        <CategoryHeader
          categoryName={item.categoryName}
          count={item.count}
          styles={styles}
        />
      );
    }

    const p = item.product;
    const qty = selection.get(p.id)?.qty ?? 0;
    const isEditing = editingProductId === p.id;

    return (
      <ProductRow
        product={p}
        qty={qty}
        isEditing={isEditing}
        editingQty={isEditing ? editingQty : ""}
        onInc={() => onInc(p)}
        onDec={() => onDec(p)}
        onStartEdit={() => handleStartEditingQty(p.id, p)}
        onQtyChange={handleQtyChange}
        onFinishEdit={() => handleFinishEditingQty(p)}
        styles={styles}
      />
    );
  }, [selection, editingProductId, editingQty, onInc, onDec, handleStartEditingQty, handleQtyChange, handleFinishEditingQty, styles]);

  // Key extractor for FlashList
  const keyExtractor = useCallback((item: ListItem) => {
    if (item.type === "header") return `header-${item.categoryId}`;
    return item.product.id;
  }, []);

  // Get item type for FlashList optimization
  const getItemType = useCallback((item: ListItem) => item.type, []);

  // Handle scroll begin to finish editing
  const handleScrollBeginDrag = useCallback(() => {
    if (editingProductId && editingProductRef.current) {
      handleFinishEditingQty(editingProductRef.current);
    }
  }, [editingProductId, handleFinishEditingQty]);

  // Render recent products section (small list, no need for virtualization)
  const renderRecentProducts = useCallback(() => {
    if (recentProducts.length === 0) return null;

    return (
      <View style={styles.recentCard}>
        <Text style={styles.recentTitle}>Recently Used</Text>
        <View style={styles.itemsWrap}>
          {recentProducts.map((p) => {
            const qty = selection.get(p.id)?.qty ?? 0;
            const isEditing = editingProductId === p.id;
            return (
              <ProductRow
                key={p.id}
                product={p}
                qty={qty}
                isEditing={isEditing}
                editingQty={isEditing ? editingQty : ""}
                onInc={() => onInc(p)}
                onDec={() => onDec(p)}
                onStartEdit={() => handleStartEditingQty(p.id, p)}
                onQtyChange={handleQtyChange}
                onFinishEdit={() => handleFinishEditingQty(p)}
                styles={styles}
              />
            );
          })}
        </View>
      </View>
    );
  }, [recentProducts, selection, editingProductId, editingQty, onInc, onDec, handleStartEditingQty, handleQtyChange, handleFinishEditingQty, styles]);

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

        {/* Search Bar with Filter Button */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {onFilterPress && (
            <TouchableOpacity
              style={styles.filterButton}
              onPress={onFilterPress}
              activeOpacity={0.7}
            >
              <Ionicons name="options-outline" size={22} color={theme.colors.text} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Virtualized Product List */}
      <FlashList
        ref={listRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        estimatedItemSize={56}
        ListHeaderComponent={renderRecentProducts}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={handleScrollBeginDrag}
        refreshControl={refreshControl}
        // Performance optimizations
        drawDistance={250}
        overrideItemLayout={(layout, item) => {
          if (item.type === "header") {
            layout.size = 44;
          } else {
            layout.size = 56;
          }
        }}
      />
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
    listContent: {
      paddingBottom: theme.spacing(8),
      paddingHorizontal: theme.spacing(2),
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
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1.5),
      marginHorizontal: theme.spacing(2),
      gap: theme.spacing(1),
    },
    searchInput: {
      flex: 1,
      height: 44,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.text,
      paddingHorizontal: theme.spacing(2),
      fontSize: 16,
      color: theme.colors.text,
    },
    filterButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.card,
      borderWidth: 2,
      borderColor: theme.colors.text,
      alignItems: "center",
      justifyContent: "center",
    },
    filterBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: theme.colors.accent,
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    filterBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#000",
    },

    recentCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      marginBottom: theme.spacing(2),
      marginTop: theme.spacing(2),
      overflow: "hidden",
    },
    recentTitle: {
      fontWeight: "800",
      color: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 14,
    },
    catHeader: {
      paddingVertical: theme.spacing(1.5),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing(2),
      marginTop: theme.spacing(2),
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.colors.border,
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
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 1,
    },
    itemRowActive: {
      backgroundColor: theme.colors.bg,
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

export default MaterialsPicker;
export { MaterialsPicker };
