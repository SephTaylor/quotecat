import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getQuoteById, saveQuote } from "@/lib/quotes";
import { useProducts } from "@/modules/catalog";
import { BottomBar, Button } from "@/modules/core/ui";
import {
  MaterialsPicker,
  transformSelectionToItems,
  useSelection,
} from "@/modules/materials";
import { mergeById } from "@/modules/quotes/merge";
import type { Product } from "@/modules/catalog/seed";
import { useTheme } from "@/contexts/ThemeContext";
import { Text, View, StyleSheet, Pressable, Alert, RefreshControl, Modal, TouchableOpacity, TouchableWithoutFeedback, Keyboard, ScrollView, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { QuoteItem, PricebookItem } from "@/lib/types";
import { trackProductUsage } from "@/lib/analytics";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { getPricebookItems, getPricebookCategories } from "@/lib/pricebook";
import { listAssemblies } from "@/modules/assemblies/storage";
import type { Assembly } from "@/modules/assemblies/types";
import { getUserState } from "@/lib/user";
import { canAccessPricebook, canAccessAssemblies } from "@/lib/features";

export type SourceType = "catalog" | "pricebook" | "assemblies";

export default function QuoteMaterials() {
  const { id, coMode } = useLocalSearchParams<{ id?: string; coMode?: string }>();
  const isCoMode = coMode === "true";
  const router = useRouter();
  const { theme } = useTheme();

  // Memoize styles to avoid recreating StyleSheet on every render
  const themedStyles = useMemo(() => createStyles(theme), [theme]);

  const { products, categories, loading, syncing, lastSync, refresh } = useProducts();
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [initialSelectionLoaded, setInitialSelectionLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Source toggle state
  const [activeSource, setActiveSource] = useState<SourceType>("catalog");
  const [hasPricebookAccess, setHasPricebookAccess] = useState(false);
  const [hasAssembliesAccess, setHasAssembliesAccess] = useState(false);

  // Pricebook data
  const [pricebookItems, setPricebookItems] = useState<PricebookItem[]>([]);
  const [pricebookCategories, setPricebookCategories] = useState<string[]>([]);
  const [pricebookLoading, setPricebookLoading] = useState(false);

  // Assemblies data
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [assembliesLoading, setAssembliesLoading] = useState(false);

  // Create initial selection from quote items
  const initialSelection = useMemo(() => {
    if (!initialSelectionLoaded || quoteItems.length === 0) return new Map();

    const map = new Map();
    quoteItems.forEach((item) => {
      const product = products.find((p) => p.id === item.id);
      if (product) {
        map.set(product.id, { product, qty: item.qty });
      }
    });
    return map;
  }, [quoteItems, products, initialSelectionLoaded]);

  const { selection, inc, dec, clear, units, setSelection, setQty, getSelection } = useSelection(initialSelection);

  // Filter state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]); // empty = all suppliers

  const supplierOptions = [
    { id: "lowes", name: "Lowe's" },
    { id: "homedepot", name: "Home Depot" },
    { id: "menards", name: "Menards" },
  ];

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(s => s !== supplierId)
        : [...prev, supplierId]
    );
  };

  const clearFilters = () => {
    setSelectedSuppliers([]);
  };

  const activeFilterCount = selectedSuppliers.length;

  // Load quote items function
  const loadQuote = useCallback(async () => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (q) {
      const items = q.items ?? [];
      setQuoteItems(items);

      // Pre-populate selection with existing items
      if (items.length > 0 && products.length > 0 && !initialSelectionLoaded) {
        const map = new Map();
        items.forEach((item) => {
          const product = products.find((p) => p.id === item.id);
          if (product) {
            map.set(product.id, { product, qty: item.qty });
          }
        });
        setSelection(map);
        setInitialSelectionLoaded(true);
      }
    }
  }, [id, products, initialSelectionLoaded, setSelection]);

  // Load on mount
  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  // Check user tier access on mount
  useEffect(() => {
    const checkAccess = async () => {
      const user = await getUserState();
      setHasPricebookAccess(canAccessPricebook(user));
      setHasAssembliesAccess(canAccessAssemblies(user));
    };
    checkAccess();
  }, []);

  // Load pricebook items when switching to pricebook tab
  useEffect(() => {
    if (activeSource === "pricebook" && hasPricebookAccess) {
      const loadPricebook = async () => {
        setPricebookLoading(true);
        try {
          const [items, cats] = await Promise.all([
            getPricebookItems(),
            getPricebookCategories(),
          ]);
          setPricebookItems(items);
          setPricebookCategories(cats);
        } catch (error) {
          console.error("Failed to load pricebook:", error);
        } finally {
          setPricebookLoading(false);
        }
      };
      loadPricebook();
    }
  }, [activeSource, hasPricebookAccess]);

  // Load assemblies when switching to assemblies tab
  useEffect(() => {
    if (activeSource === "assemblies" && hasAssembliesAccess) {
      const loadAssembliesData = async () => {
        setAssembliesLoading(true);
        try {
          const data = await listAssemblies();
          setAssemblies(data);
        } catch (error) {
          console.error("Failed to load assemblies:", error);
        } finally {
          setAssembliesLoading(false);
        }
      };
      loadAssembliesData();
    }
  }, [activeSource, hasAssembliesAccess]);


  // Reload when returning from edit-items screen
  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        if (!id) return;
        const q = await getQuoteById(id);
        if (q) {
          const items = q.items ?? [];
          setQuoteItems(items);

          // Don't reload selection on focus - let it stay cleared after "Add items"
          // Selection will only be populated when user manually clicks +/-
          // This gives clean UI for accumulate mode

          setInitialSelectionLoaded(true);
        }
      };
      refresh();
    }, [id])
  );

  // Group products by category for MaterialsPicker (with supplier filter)
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};

    // Filter by supplier if any selected
    const filteredProducts = selectedSuppliers.length > 0
      ? products.filter(p => p.supplierId && selectedSuppliers.includes(p.supplierId))
      : products;

    filteredProducts.forEach((product) => {
      if (!grouped[product.categoryId]) {
        grouped[product.categoryId] = [];
      }
      grouped[product.categoryId].push(product);
    });

    return grouped;
  }, [products, selectedSuppliers]);

  // Convert pricebook items to Product format for the picker
  const pricebookAsProducts = useMemo((): Product[] => {
    return pricebookItems.map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unitType || "ea",
      unitPrice: item.unitPrice,
      categoryId: item.category || "custom",
    }));
  }, [pricebookItems]);

  // Group pricebook products by category
  const pricebookByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    pricebookAsProducts.forEach((product) => {
      if (!grouped[product.categoryId]) {
        grouped[product.categoryId] = [];
      }
      grouped[product.categoryId].push(product);
    });
    return grouped;
  }, [pricebookAsProducts]);

  // Get categories for pricebook
  const pricebookCategoryObjects = useMemo(() => {
    return pricebookCategories.map((cat) => ({ id: cat, name: cat }));
  }, [pricebookCategories]);

  // Selection summary calculation
  const selectionSummary = useMemo(() => {
    const selectedItems = Array.from(selection.values());
    const totalItems = selectedItems.reduce((sum, item) => sum + item.qty, 0);
    const totalValue = selectedItems.reduce(
      (sum, item) => sum + item.product.unitPrice * item.qty,
      0
    );
    return { count: totalItems, value: totalValue };
  }, [selection]);

  // Handle source toggle
  const handleSourceChange = useCallback((source: SourceType) => {
    if (source === "pricebook" && !hasPricebookAccess) {
      Alert.alert(
        "Premium Feature",
        "Price Book lets you create and manage your own custom products with your pricing.",
        [
          { text: "OK", style: "cancel" },
          { text: "Learn More", onPress: () => Linking.openURL("https://quotecat.ai/#pricing") },
        ]
      );
      return;
    }
    if (source === "assemblies" && !hasAssembliesAccess) {
      Alert.alert(
        "Pro Feature",
        "Assemblies let you save groups of materials as reusable templates for faster quoting.",
        [
          { text: "OK", style: "cancel" },
          { text: "Learn More", onPress: () => Linking.openURL("https://quotecat.ai/#pricing") },
        ]
      );
      return;
    }
    setActiveSource(source);
  }, [hasPricebookAccess, hasAssembliesAccess, router]);

  // Get current items/categories based on active source
  const currentItemsByCategory = useMemo(() => {
    if (activeSource === "catalog") return productsByCategory;
    if (activeSource === "pricebook") return pricebookByCategory;
    return {};
  }, [activeSource, productsByCategory, pricebookByCategory]);

  const currentCategories = useMemo(() => {
    if (activeSource === "catalog") return categories;
    if (activeSource === "pricebook") return pricebookCategoryObjects;
    return [];
  }, [activeSource, categories, pricebookCategoryObjects]);

  const isCurrentSourceLoading = useMemo(() => {
    if (activeSource === "catalog") return loading;
    if (activeSource === "pricebook") return pricebookLoading;
    if (activeSource === "assemblies") return assembliesLoading;
    return false;
  }, [activeSource, loading, pricebookLoading, assembliesLoading]);

  const saveSelected = useCallback(
    async (goBack: boolean) => {
      // Dismiss keyboard to trigger onBlur and commit any pending quantity edits
      Keyboard.dismiss();

      // Wait for state update to propagate after onBlur commits the quantity
      await new Promise(resolve => setTimeout(resolve, 50));

      if (!id) {
        Alert.alert("Error", "No quote ID found. Please try again.");
        return;
      }

      // Convert current selection to items (use getSelection for latest state)
      const currentSelection = getSelection();
      console.log("saveSelected: selection size =", currentSelection.size, "isCoMode =", isCoMode);
      console.log("saveSelected: selection entries =", Array.from(currentSelection.entries()));
      const newlySelectedItems = transformSelectionToItems(currentSelection);
      console.log("saveSelected: transformed items =", newlySelectedItems);

      // Track usage for analytics (privacy-friendly)
      newlySelectedItems.forEach((item) => {
        trackProductUsage(item.productId || item.id || "", item.qty);
      });

      // In CO mode, pass items back to edit screen without saving
      if (isCoMode) {
        const jsonItems = JSON.stringify(newlySelectedItems);
        console.log("CO mode: returning", newlySelectedItems.length, "items to edit screen");
        console.log("CO mode: JSON payload length =", jsonItems.length);
        // Navigate back with the new items encoded in params
        router.replace({
          pathname: `/quote/${id}/edit` as any,
          params: { newItems: jsonItems },
        });
        return;
      }

      try {
        const q = await getQuoteById(id);
        if (!q) {
          Alert.alert("Error", "Quote not found. Please try again.");
          return;
        }

        // Get current quote items
        const existingItems = q.items ?? [];
        console.log("Newly selected items:", newlySelectedItems);
        console.log("Existing quote items:", existingItems);

        // Merge existing items with newly selected items (accumulate mode)
        const mergedItems = mergeById(existingItems, newlySelectedItems);
        console.log("Merged items:", mergedItems);

        // Save the merged items list
        await saveQuote({ ...q, id, items: mergedItems });
        console.log("Items saved successfully");

        if (goBack) {
          router.back();
        } else {
          // Update the indicator to show all saved items
          setQuoteItems(mergedItems);

          // Clear the selection UI so user can select new items
          clear();
          console.log("Selection cleared. Quote now has", mergedItems.length, "product types");

          // Show success message
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
        }
      } catch (error) {
        console.error("Failed to save materials:", error);
        Alert.alert("Error", "Failed to add materials. Please try again.");
      }
    },
    [id, getSelection, router, clear, isCoMode],
  );

  // Calculate status text for header
  const statusText = React.useMemo(() => {
    if (syncing) return "Syncing";
    if (lastSync) {
      const hoursAgo = Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60));
      if (hoursAgo < 24) return "Online";
      return "Refresh";
    }
    return "Offline";
  }, [syncing, lastSync]);

  const statusMessage = React.useMemo(() => {
    if (syncing) return "Syncing product catalog from cloud...";
    if (lastSync) {
      const hoursAgo = Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60));
      if (hoursAgo < 1) return "Online (Up to date)\n\nProduct catalog is current.";
      if (hoursAgo < 24) return `Online (Updated ${hoursAgo}h ago)\n\nProduct catalog is recent.`;
      const daysAgo = Math.floor(hoursAgo / 24);
      return `Sync recommended\n\nLast updated ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago.\nPull down to refresh.`;
    }
    return "Not synced\n\nPull down to sync product catalog from cloud.";
  }, [syncing, lastSync]);

  const showStatusInfo = () => {
    Alert.alert(
      "Product Catalog Status",
      statusMessage,
      [
        { text: "OK", style: "cancel" },
        {
          text: "Refresh Now",
          onPress: async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          },
        },
      ]
    );
  };

  // Filter button handler
  const handleFilterPress = () => {
    setFilterModalVisible(true);
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Source toggle component
  const SourceToggle = () => (
    <View style={themedStyles.sourceToggle}>
      <Pressable
        style={[
          themedStyles.sourceTab,
          activeSource === "catalog" && themedStyles.sourceTabActive,
        ]}
        onPress={() => handleSourceChange("catalog")}
      >
        <Text
          style={[
            themedStyles.sourceTabText,
            activeSource === "catalog" && themedStyles.sourceTabTextActive,
          ]}
        >
          Catalog
        </Text>
      </Pressable>
      <Pressable
        style={[
          themedStyles.sourceTab,
          activeSource === "pricebook" && themedStyles.sourceTabActive,
          !hasPricebookAccess && themedStyles.sourceTabLocked,
        ]}
        onPress={() => handleSourceChange("pricebook")}
      >
        <Text
          style={[
            themedStyles.sourceTabText,
            activeSource === "pricebook" && themedStyles.sourceTabTextActive,
          ]}
        >
          Pricebook
        </Text>
        {!hasPricebookAccess && (
          <Ionicons name="lock-closed" size={12} color={theme.colors.muted} style={{ marginLeft: 4 }} />
        )}
      </Pressable>
      <Pressable
        style={[
          themedStyles.sourceTab,
          activeSource === "assemblies" && themedStyles.sourceTabActive,
          !hasAssembliesAccess && themedStyles.sourceTabLocked,
        ]}
        onPress={() => handleSourceChange("assemblies")}
      >
        <Text
          style={[
            themedStyles.sourceTabText,
            activeSource === "assemblies" && themedStyles.sourceTabTextActive,
          ]}
        >
          Assemblies
        </Text>
        {!hasAssembliesAccess && (
          <Ionicons name="lock-closed" size={12} color={theme.colors.muted} style={{ marginLeft: 4 }} />
        )}
      </Pressable>
    </View>
  );

  // Assemblies list view
  const AssembliesView = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={themedStyles.assembliesContainer}
    >
      {assembliesLoading ? (
        <Text style={themedStyles.emptyText}>Loading assemblies...</Text>
      ) : assemblies.length === 0 ? (
        <View style={themedStyles.emptyState}>
          <Text style={themedStyles.emptyTitle}>No Assemblies</Text>
          <Text style={themedStyles.emptyText}>
            Create assemblies in Pro Tools to use them here.
          </Text>
        </View>
      ) : (
        assemblies.map((assembly) => (
          <Pressable
            key={assembly.id}
            style={themedStyles.assemblyCard}
            onPress={() => {
              // Navigate to assembly detail or expand it
              router.push({
                pathname: "/assemblies/[id]",
                params: { id: assembly.id, quoteId: id },
              } as any);
            }}
          >
            <View style={themedStyles.assemblyInfo}>
              <Text style={themedStyles.assemblyName}>{assembly.name}</Text>
              <Text style={themedStyles.assemblyItems}>
                {assembly.items.length} item{assembly.items.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );

  if (isCurrentSourceLoading && activeSource === "catalog") {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Add/Edit Materials",
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
            headerRight: () => (
              <Pressable onPress={showStatusInfo} style={{ marginRight: 16, padding: 8 }}>
                <Text style={{ fontSize: 15, color: theme.colors.text }}>{statusText}</Text>
              </Pressable>
            ),
          }}
        />
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <SourceToggle />
          <MaterialsPicker
            categories={currentCategories}
            itemsByCategory={{}}
            selection={selection}
            onInc={inc}
            onDec={dec}
            onSetQty={setQty}
            recentProductIds={[]}
            onFilterPress={handleFilterPress}
            activeFilterCount={activeFilterCount}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.accent}
              />
            }
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Add/Edit Materials",
          headerShown: true,
          headerTitleAlign: 'center', // Center title on all platforms (Android defaults to left)
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerRight: () => (
            <Pressable onPress={showStatusInfo} style={{ marginRight: 16, padding: 8 }}>
              <Text style={{ fontSize: 15, color: theme.colors.text }}>{statusText}</Text>
            </Pressable>
          ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        {quoteItems.length > 0 && (
          <Pressable
            style={themedStyles.quoteItemsIndicator}
            onPress={() => id && router.push(`/quote/${id}/edit-items`)}
          >
            <View style={themedStyles.indicatorContent}>
              <View style={themedStyles.indicatorTextContainer}>
                <Text style={themedStyles.indicatorText}>
                  Quote has {quoteItems.reduce((sum, item) => sum + item.qty, 0)}{" "}
                  item
                  {quoteItems.reduce((sum, item) => sum + item.qty, 0) !== 1
                    ? "s"
                    : ""}{" "}
                  ({quoteItems.length} product
                  {quoteItems.length !== 1 ? "s" : ""})
                </Text>
                <Text style={themedStyles.indicatorSubtext}>
                  Total items cost: $
                  {quoteItems
                    .reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
                    .toFixed(2)}
                </Text>
              </View>
              <View style={themedStyles.editButton}>
                <Text style={themedStyles.editButtonText}>Edit</Text>
              </View>
            </View>
          </Pressable>
        )}

        {showSuccessMessage && (
          <View style={themedStyles.successMessage}>
            <Text style={themedStyles.successText}>✓ Items added to quote!</Text>
          </View>
        )}

        {/* Source Toggle */}
        <SourceToggle />

        {/* Content based on active source */}
        {activeSource === "assemblies" ? (
          <AssembliesView />
        ) : (
          <MaterialsPicker
            categories={currentCategories}
            itemsByCategory={currentItemsByCategory}
            selection={selection}
            onInc={inc}
            onDec={dec}
            onSetQty={setQty}
            recentProductIds={[]}
            onFilterPress={activeSource === "catalog" ? handleFilterPress : undefined}
            activeFilterCount={activeSource === "catalog" ? activeFilterCount : 0}
            refreshControl={
              activeSource === "catalog" ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.accent}
                />
              ) : undefined
            }
          />
        )}
      </View>

      {/* Updated Bottom Bar with selection summary */}
      <View style={themedStyles.bottomBarWrapper}>
        {selectionSummary.count > 0 && (
          <View style={themedStyles.selectionSummary}>
            <Text style={themedStyles.selectionSummaryText}>
              + {selectionSummary.count} selected · ${selectionSummary.value.toFixed(2)}
            </Text>
          </View>
        )}
        <BottomBar>
          <Button
            variant="secondary"
            onPress={() => saveSelected(false)}
            disabled={selectionSummary.count === 0}
          >
            Add Items
          </Button>

          <Button variant="primary" onPress={() => saveSelected(true)}>
            Done
          </Button>
        </BottomBar>
      </View>

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={themedStyles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={themedStyles.modalContent}>
                {/* Handle bar */}
                <View style={themedStyles.modalHandle} />

                {/* Header */}
                <View style={themedStyles.modalHeader}>
                  <Text style={themedStyles.modalTitle}>Filters</Text>
                  {activeFilterCount > 0 && (
                    <TouchableOpacity onPress={clearFilters}>
                      <Text style={themedStyles.clearButton}>Clear All</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Supplier Filter */}
                <View style={themedStyles.filterSection}>
                  <Text style={themedStyles.filterSectionTitle}>Supplier</Text>
                  <View style={themedStyles.filterOptions}>
                    {supplierOptions.map((supplier) => {
                      const isSelected = selectedSuppliers.includes(supplier.id);
                      return (
                        <TouchableOpacity
                          key={supplier.id}
                          style={[
                            themedStyles.filterOption,
                            isSelected && themedStyles.filterOptionSelected,
                          ]}
                          onPress={() => toggleSupplier(supplier.id)}
                        >
                          <Text
                            style={[
                              themedStyles.filterOptionText,
                              isSelected && themedStyles.filterOptionTextSelected,
                            ]}
                          >
                            {supplier.name}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark" size={18} color="#000" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Apply Button */}
                <TouchableOpacity
                  style={themedStyles.applyButton}
                  onPress={() => setFilterModalVisible(false)}
                >
                  <Text style={themedStyles.applyButtonText}>
                    {activeFilterCount > 0 ? `Apply (${activeFilterCount})` : "Done"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    // Source toggle styles
    sourceToggle: {
      flexDirection: "row",
      marginHorizontal: theme.spacing(1.5),
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: 3,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sourceTab: {
      flex: 1,
      paddingVertical: theme.spacing(0.75),
      paddingHorizontal: theme.spacing(1),
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },
    sourceTabActive: {
      backgroundColor: theme.colors.accent,
    },
    sourceTabLocked: {
      opacity: 0.6,
    },
    sourceTabText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    sourceTabTextActive: {
      color: "#000",
    },
    // Assemblies view styles
    assembliesContainer: {
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(8),
    },
    assemblyCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    assemblyInfo: {
      flex: 1,
    },
    assemblyName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 2,
    },
    assemblyItems: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.spacing(6),
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
    },
    // Bottom bar styles
    bottomBarWrapper: {
      backgroundColor: theme.colors.bg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    selectionSummary: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(0.5),
    },
    selectionSummaryText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.accent,
      textAlign: "center",
    },
    quoteItemsIndicator: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginHorizontal: theme.spacing(2),
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    indicatorContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing(2),
    },
    indicatorTextContainer: {
      flex: 1,
    },
    indicatorText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 4,
    },
    indicatorSubtext: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    editButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
    successMessage: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(1.5),
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
      alignItems: "center",
    },
    successText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000", // Black on orange accent (good contrast)
    },
    // Filter modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: theme.spacing(3),
      paddingBottom: theme.spacing(4),
      paddingTop: theme.spacing(1.5),
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: theme.colors.muted,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: theme.spacing(2),
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(3),
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    clearButton: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    filterSection: {
      marginBottom: theme.spacing(3),
    },
    filterSectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: theme.spacing(1.5),
    },
    filterOptions: {
      gap: theme.spacing(1),
    },
    filterOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterOptionSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterOptionText: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
    },
    filterOptionTextSelected: {
      color: "#000",
    },
    applyButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(2),
      borderRadius: theme.radius.lg,
      alignItems: "center",
      marginTop: theme.spacing(1),
    },
    applyButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
