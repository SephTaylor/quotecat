// modules/materials/Picker.tsx
import { useTheme } from "@/contexts/ThemeContext";
import { type Product, SUPPLIER_NAMES } from "@/modules/catalog/seed";
import React, { useState, useRef, useCallback, memo, useMemo, useEffect } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView, RefreshControlProps, Keyboard, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import type { Selection } from "./types";
import { searchProductsFTS } from "@/lib/database";
import { openProductSearch, getStoreName } from "@/lib/browser";
import { searchOrama, isOramaReady, onOramaReady, type OramaFacets } from "@/lib/oramaSearch";

export type Category = {
  id: string;
  name: string;
  parentId?: string;
  level?: number;
};
// Extended product type with optional location price flag
export type ProductWithPrice = Product & { _hasLocationPrice?: boolean };

export type ActiveFilter = {
  type: "category" | "supplier" | "location";
  id: string;
  label: string;
};

// Facet counts for Amazon-style refinement
export type FacetCounts = {
  suppliers: Record<string, number>;
  categories: Record<string, number>;
};

export type MaterialsPickerProps = {
  categories: Category[];
  itemsByCategory: Record<string, ProductWithPrice[]>;
  selection: Selection;
  onInc(product: Product): void;
  onDec(product: Product): void;
  onSetQty(product: Product, qty: number): void;
  recentProductIds?: string[];
  lastSync?: Date | null;
  syncing?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  onFilterPress?: () => void;
  activeFilters?: ActiveFilter[];
  onRemoveFilter?: (filter: ActiveFilter) => void;
  // Faceted search props
  allProducts?: ProductWithPrice[];
  selectedSuppliers?: string[];
  selectedCategories?: string[];
  onSupplierToggle?: (supplierId: string) => void;
  onCategoryToggle?: (categoryId: string) => void;
};

// List item types for FlashList
type ListItem =
  | { type: "header"; categoryId: string; categoryName: string; count: number }
  | { type: "product"; product: ProductWithPrice };

// Memoized product row - only re-renders when its specific props change
type ProductRowProps = {
  product: ProductWithPrice;
  qty: number;
  isEditing: boolean;
  editingQty: string;
  expanded: boolean;
  onInc: () => void;
  onDec: () => void;
  onStartEdit: () => void;
  onQtyChange: (text: string) => void;
  onFinishEdit: () => void;
  onToggleExpand: () => void;
  styles: ReturnType<typeof createStyles>;
  accentColor: string;
  mutedColor: string;
};

const ProductRow = memo(function ProductRow({
  product,
  qty,
  isEditing,
  editingQty,
  expanded,
  onInc,
  onDec,
  onStartEdit,
  onQtyChange,
  onFinishEdit,
  onToggleExpand,
  styles,
  accentColor,
  mutedColor,
}: ProductRowProps) {
  const active = qty > 0;

  return (
    <View style={[styles.itemRow, active && styles.itemRowActive]}>
      <Pressable style={styles.itemMeta} onPress={onToggleExpand}>
        <View style={styles.itemNameRow}>
          <Text style={styles.itemName} numberOfLines={expanded ? undefined : 1}>
            {product.name}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={mutedColor}
            style={styles.expandIcon}
          />
        </View>
        <Text style={styles.itemSub}>
          ${product.unitPrice.toFixed(2)}/{product.unit}
          {product._hasLocationPrice && <Text style={{ color: accentColor }}> (local)</Text>}
          {product.supplierId && SUPPLIER_NAMES[product.supplierId] && ` · ${SUPPLIER_NAMES[product.supplierId]}`}
        </Text>
        {product.coverageSqft && (
          <Text style={[styles.itemSub, { color: accentColor }]}>
            {product.coverageSqft} sq ft / {product.unit === 'case' ? 'case' : product.unit === 'piece' ? 'piece' : 'carton'}
          </Text>
        )}
        {expanded && product.supplierId && (
          <Pressable
            style={styles.storeLink}
            onPress={() => openProductSearch(product.name, product.supplierId)}
          >
            <Text style={styles.storeLinkText}>
              View on {getStoreName(product.supplierId)} →
            </Text>
          </Pressable>
        )}
      </Pressable>

      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => { Keyboard.dismiss(); onDec(); }}>
          <Text style={styles.stepText}>–</Text>
        </Pressable>
        {isEditing ? (
          <TextInput
            style={styles.qtyInput}
            value={editingQty}
            onChangeText={onQtyChange}
            onBlur={onFinishEdit}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            // Hide the iOS keyboard accessory bar with "Done" button
            inputAccessoryViewID=""
          />
        ) : (
          <Pressable onPress={onStartEdit}>
            <Text style={[styles.qtyText, styles.qtyTextTappable]}>{qty}</Text>
          </Pressable>
        )}
        <Pressable style={styles.stepBtn} onPress={() => { Keyboard.dismiss(); onInc(); }}>
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

// Helper to extract category from product
// Uses categoryId to match the filter modal's category system
function getProductCategory(p: ProductWithPrice): string {
  return p.categoryId || 'Other';
}

// Facet chip component for Amazon-style refinement
const FacetChip = memo(function FacetChip({
  label,
  count,
  selected,
  onPress,
  styles,
  accentColor,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  accentColor: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.facetChip, selected && styles.facetChipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.facetChipText, selected && styles.facetChipTextSelected]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
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
  activeFilters = [],
  onRemoveFilter,
  // Faceted search props
  allProducts = [],
  selectedSuppliers = [],
  selectedCategories = [],
  onSupplierToggle,
  onCategoryToggle,
}: MaterialsPickerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const listRef = useRef<FlashListRef<ListItem>>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [ftsMatchIds, setFtsMatchIds] = useState<Set<string> | null>(null);
  const [oramaReady, setOramaReady] = useState(isOramaReady());
  const [oramaFacets, setOramaFacets] = useState<OramaFacets | null>(null);

  // Subscribe to Orama ready state changes
  useEffect(() => {
    const unsubscribe = onOramaReady((ready) => {
      setOramaReady(ready);
    });
    return unsubscribe;
  }, []);

  // Search effect - tries Orama first (typo tolerance), falls back to FTS5
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFtsMatchIds(null);
      setOramaFacets(null);
      return;
    }

    // Debounce search by 150ms
    const timer = setTimeout(async () => {
      const query = searchQuery.trim();

      // Try Orama first if ready (has typo tolerance)
      if (oramaReady) {
        try {
          const oramaResult = await searchOrama(query, {
            limit: 500,
            supplierFilter: selectedSuppliers.length > 0 ? selectedSuppliers : undefined,
            categoryFilter: selectedCategories.length > 0 ? selectedCategories : undefined,
          });

          if (oramaResult) {
            setFtsMatchIds(new Set(oramaResult.hits.map(p => p.id)));
            setOramaFacets(oramaResult.facets);
            console.log(`[Picker] Orama search "${query}": ${oramaResult.hits.length} results in ${oramaResult.elapsed}ms`);
            return;
          }
        } catch (error) {
          console.warn("[Picker] Orama search failed, falling back to FTS5:", error);
        }
      }

      // Fall back to FTS5 (SQLite)
      try {
        const results = searchProductsFTS(query, 500);
        setFtsMatchIds(new Set(results.map(p => p.id)));
        setOramaFacets(null); // No native facets from FTS5
        console.log(`[Picker] FTS5 search "${query}": ${results.length} results`);
      } catch (error) {
        console.error("FTS search error:", error);
        setFtsMatchIds(null);
        setOramaFacets(null);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, oramaReady, selectedSuppliers, selectedCategories]);

  // Sort categories alphabetically by name
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  // Compute facet counts - uses Orama native facets when available, falls back to manual computation
  const facetCounts = useMemo((): FacetCounts => {
    // Only compute facets when actively searching
    if (!searchQuery.trim() || ftsMatchIds === null) {
      return { suppliers: {}, categories: {} };
    }

    // Use Orama's native facets if available (more accurate with typo tolerance)
    if (oramaFacets) {
      return {
        suppliers: oramaFacets.supplierId,
        categories: oramaFacets.categoryId,
      };
    }

    // Fall back to manual computation for FTS5 results
    let matchingProducts = allProducts.filter(p => ftsMatchIds.has(p.id));

    // For supplier counts: filter by selected categories first (so counts are accurate)
    let productsForSupplierCounts = matchingProducts;
    if (selectedCategories.length > 0) {
      productsForSupplierCounts = matchingProducts.filter(p =>
        selectedCategories.includes(getProductCategory(p))
      );
    }

    // For category counts: filter by selected suppliers first (so counts are accurate)
    let productsForCategoryCounts = matchingProducts;
    if (selectedSuppliers.length > 0) {
      productsForCategoryCounts = matchingProducts.filter(p =>
        selectedSuppliers.includes(p.supplierId || '')
      );
    }

    // Count by supplier (considering category filters)
    const suppliers: Record<string, number> = {};
    productsForSupplierCounts.forEach(p => {
      const supplierId = p.supplierId || 'unknown';
      suppliers[supplierId] = (suppliers[supplierId] || 0) + 1;
    });

    // Count by category (considering supplier filters)
    const cats: Record<string, number> = {};
    productsForCategoryCounts.forEach(p => {
      const cat = getProductCategory(p);
      cats[cat] = (cats[cat] || 0) + 1;
    });

    return { suppliers, categories: cats };
  }, [searchQuery, ftsMatchIds, oramaFacets, allProducts, selectedSuppliers, selectedCategories]);

  // Get sorted facets for display (by count descending)
  const sortedSupplierFacets = useMemo(() => {
    return Object.entries(facetCounts.suppliers)
      .sort((a, b) => b[1] - a[1]);
  }, [facetCounts.suppliers]);

  const sortedCategoryFacets = useMemo(() => {
    return Object.entries(facetCounts.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); // Show top 8 categories
  }, [facetCounts.categories]);

  // State for inline editing
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState<string>("");
  const editingProductRef = useRef<Product | null>(null);
  const editingQtyRef = useRef<string>("");

  // State for expanded product (show full name + store link)
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const handleToggleExpand = useCallback((productId: string) => {
    setExpandedProductId((prev) => (prev === productId ? null : productId));
  }, []);

  // State for scroll-to-top button visibility
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(offsetY > 300);
  }, []);

  const handleScrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // Handlers for inline quantity editing
  const handleStartEditingQty = useCallback((productId: string, product: Product) => {
    editingProductRef.current = product;
    editingQtyRef.current = "";
    setEditingQty("");
    setEditingProductId(productId);
  }, []);

  const handleQtyChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    editingQtyRef.current = cleaned;
    setEditingQty(cleaned);
  }, []);

  const handleFinishEditingQty = useCallback(() => {
    const product = editingProductRef.current;
    const qty = editingQtyRef.current;
    if (product && qty) {
      const newQty = parseInt(qty, 10);
      if (!isNaN(newQty) && newQty >= 0) {
        onSetQty(product, newQty);
      }
    }
    editingProductRef.current = null;
    editingQtyRef.current = "";
    setEditingProductId(null);
    setEditingQty("");
    Keyboard.dismiss();
  }, [onSetQty]);

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

    // Show all categories that have products (filtering done by parent component)
    for (const cat of sortedCategories) {
      let products = itemsByCategory[cat.id] || [];

      // Filter by FTS search results
      if (searchQuery.trim() && ftsMatchIds !== null) {
        products = products.filter(p => ftsMatchIds.has(p.id));
      }

      // Filter by selected supplier facets (when searching)
      if (selectedSuppliers.length > 0 && searchQuery.trim()) {
        products = products.filter(p => selectedSuppliers.includes(p.supplierId || ''));
      }

      // Filter by selected category facets (when searching)
      if (selectedCategories.length > 0 && searchQuery.trim()) {
        products = products.filter(p => selectedCategories.includes(getProductCategory(p)));
      }

      if (products.length === 0) continue;

      items.push({
        type: "header",
        categoryId: cat.id,
        categoryName: cat.name,
        count: products.length,
      });

      for (const product of products) {
        items.push({ type: "product", product });
      }
    }

    return items;
  }, [itemsByCategory, searchQuery, ftsMatchIds, sortedCategories, selectedSuppliers, selectedCategories]);

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
    const isExpanded = expandedProductId === p.id;

    return (
      <ProductRow
        product={p}
        qty={qty}
        isEditing={isEditing}
        editingQty={isEditing ? editingQty : ""}
        expanded={isExpanded}
        onInc={() => onInc(p)}
        onDec={() => onDec(p)}
        onStartEdit={() => handleStartEditingQty(p.id, p)}
        onQtyChange={handleQtyChange}
        onFinishEdit={handleFinishEditingQty}
        onToggleExpand={() => handleToggleExpand(p.id)}
        styles={styles}
        accentColor={theme.colors.accent}
        mutedColor={theme.colors.muted}
      />
    );
  }, [selection, editingProductId, editingQty, expandedProductId, onInc, onDec, handleStartEditingQty, handleQtyChange, handleFinishEditingQty, handleToggleExpand, styles, theme.colors.accent, theme.colors.muted]);

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
      handleFinishEditingQty();
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
            const isExpanded = expandedProductId === p.id;
            return (
              <ProductRow
                key={p.id}
                product={p}
                qty={qty}
                isEditing={isEditing}
                editingQty={isEditing ? editingQty : ""}
                expanded={isExpanded}
                onInc={() => onInc(p)}
                onDec={() => onDec(p)}
                onStartEdit={() => handleStartEditingQty(p.id, p)}
                onQtyChange={handleQtyChange}
                onFinishEdit={handleFinishEditingQty}
                onToggleExpand={() => handleToggleExpand(p.id)}
                styles={styles}
                accentColor={theme.colors.accent}
                mutedColor={theme.colors.muted}
              />
            );
          })}
        </View>
      </View>
    );
  }, [recentProducts, selection, editingProductId, editingQty, expandedProductId, onInc, onDec, handleStartEditingQty, handleQtyChange, handleFinishEditingQty, handleToggleExpand, styles, theme.colors.accent, theme.colors.muted]);

  // Dismiss editing when tapping outside the input
  const handleContainerPress = useCallback(() => {
    if (editingProductId) {
      handleFinishEditingQty();
    }
  }, [editingProductId, handleFinishEditingQty]);

  return (
    <View style={styles.container}>
      {/* Sticky Header: Search + Filters */}
      <View style={styles.stickyHeader}>
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
              style={[styles.filterButton, activeFilters.length > 0 && styles.filterButtonActive]}
              onPress={onFilterPress}
              activeOpacity={0.7}
            >
              <Ionicons name="options-outline" size={22} color={activeFilters.length > 0 ? "#000" : theme.colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Active Filters Row - Amazon style dismissible chips */}
        {activeFilters.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFiltersContainer}
            keyboardShouldPersistTaps="handled"
          >
            {activeFilters.map((filter) => (
              <TouchableOpacity
                key={`${filter.type}-${filter.id}`}
                style={styles.activeFilterChip}
                onPress={() => onRemoveFilter?.(filter)}
                activeOpacity={0.7}
              >
                <Text style={styles.activeFilterText}>{filter.label}</Text>
                <Ionicons name="close" size={14} color={theme.colors.text} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Amazon-style Facet Bar - shows when searching with results */}
        {searchQuery.trim() && (sortedSupplierFacets.length > 0 || sortedCategoryFacets.length > 0) && (
          <View style={styles.facetBarContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.facetBarContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Supplier facets */}
              {sortedSupplierFacets.map(([supplierId, count]) => (
                <FacetChip
                  key={`supplier-${supplierId}`}
                  label={SUPPLIER_NAMES[supplierId] || supplierId}
                  count={count}
                  selected={selectedSuppliers.includes(supplierId)}
                  onPress={() => onSupplierToggle?.(supplierId)}
                  styles={styles}
                  accentColor={theme.colors.accent}
                />
              ))}

              {/* Divider between suppliers and categories */}
              {sortedSupplierFacets.length > 0 && sortedCategoryFacets.length > 0 && (
                <View style={styles.facetDivider} />
              )}

              {/* Category facets */}
              {sortedCategoryFacets.map(([category, count]) => (
                <FacetChip
                  key={`cat-${category}`}
                  label={category}
                  count={count}
                  selected={selectedCategories.includes(category)}
                  onPress={() => onCategoryToggle?.(category)}
                  styles={styles}
                  accentColor={theme.colors.accent}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Virtualized Product List - wrapped in View for proper FlashList layout */}
      <View style={styles.listWrapper}>
        <FlashList
          ref={listRef}
          data={listData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          estimatedItemSize={56}
          ListHeaderComponent={renderRecentProducts}
          ListEmptyComponent={
            searchQuery.trim() ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={theme.colors.muted} />
                <Text style={styles.emptyTitle}>No results for "{searchQuery}"</Text>
                <Text style={styles.emptyHint}>Try these tips:</Text>
                <View style={styles.emptyTips}>
                  <Text style={styles.emptyTip}>• Use dimensions like "2x4" instead of "2 x 4"</Text>
                  <Text style={styles.emptyTip}>• Try simpler terms (e.g., "lumber" instead of "framing lumber")</Text>
                  <Text style={styles.emptyTip}>• Check spelling</Text>
                  <Text style={styles.emptyTip}>• Clear filters above if active</Text>
                </View>
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={handleScrollBeginDrag}
          onTouchStart={handleContainerPress}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          refreshControl={refreshControl}
          drawDistance={250}
        />

        {/* Scroll to top button */}
        {showScrollTop && (
          <Pressable style={styles.scrollTopButton} onPress={handleScrollToTop}>
            <Ionicons name="chevron-up" size={24} color="#000" />
          </Pressable>
        )}
      </View>
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
      paddingTop: theme.spacing(1),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    listWrapper: {
      flex: 1,
    },
    listContent: {
      paddingBottom: theme.spacing(8),
      paddingHorizontal: theme.spacing(2),
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing(1),
      marginHorizontal: theme.spacing(1.5),
      gap: theme.spacing(0.75),
    },
    searchInput: {
      flex: 1,
      height: 40,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 2,
      borderColor: theme.colors.text,
      paddingHorizontal: theme.spacing(1.5),
      fontSize: 15,
      color: theme.colors.text,
    },
    filterButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: 2,
      borderColor: theme.colors.text,
      alignItems: "center",
      justifyContent: "center",
    },
    filterButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    activeFiltersContainer: {
      paddingHorizontal: theme.spacing(1.5),
      paddingBottom: theme.spacing(1),
      gap: theme.spacing(0.5),
    },
    activeFilterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(0.5),
      paddingHorizontal: theme.spacing(1),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    activeFilterText: {
      fontSize: 13,
      color: theme.colors.text,
    },

    // Facet bar styles (Amazon-style refinement chips)
    facetBarContainer: {
      paddingBottom: theme.spacing(1),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      marginTop: theme.spacing(0.5),
    },
    facetBarContent: {
      paddingHorizontal: theme.spacing(1.5),
      paddingTop: theme.spacing(1),
      gap: theme.spacing(0.5),
      flexDirection: "row",
      alignItems: "center",
    },
    facetChip: {
      paddingHorizontal: theme.spacing(1.25),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    facetChipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    facetChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    facetChipTextSelected: {
      color: "#000",
    },
    facetDivider: {
      width: 1,
      height: 20,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing(0.5),
    },

    // Empty state styles
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.spacing(6),
      paddingHorizontal: theme.spacing(4),
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    emptyHint: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: theme.spacing(1),
    },
    emptyTips: {
      alignItems: "flex-start",
    },
    emptyTip: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.5),
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
    itemNameRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 4,
    },
    itemName: { color: theme.colors.text, fontWeight: "600", flex: 1 },
    expandIcon: { marginTop: 2 },
    itemSub: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
    storeLink: { marginTop: 6 },
    storeLinkText: {
      fontSize: 13,
      color: theme.colors.accent,
      fontWeight: "600",
    },

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
    scrollTopButton: {
      position: "absolute",
      bottom: 80,
      right: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
  });
}

export default MaterialsPicker;
export { MaterialsPicker };
