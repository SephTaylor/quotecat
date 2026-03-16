// app/(main)/assembly-editor/[id].tsx
// Edit custom assembly - add/remove products and set quantities
import { useTheme } from "@/contexts/ThemeContext";
import { getAssemblyById, saveAssembly } from "@/modules/assemblies";
import type { Assembly, AssemblyItem } from "@/modules/assemblies";
import { useProducts } from "@/modules/catalog";
import type { Product } from "@/modules/catalog/seed";
import { getPricebookItems } from "@/lib/pricebook";
import type { PricebookItem } from "@/lib/types";
import { BottomBar, Button, FormInput } from "@/modules/core/ui";
import {
  MaterialsPicker,
  useSelection,
} from "@/modules/materials";
import { AddItemRow } from "@/components/AddItemRow";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Keyboard,
  RefreshControl,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ItemSource } from "@/modules/assemblies/types";

export default function AssemblyEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const assemblyId = params.id;
  const router = useRouter();
  const { theme } = useTheme();
  const { products, categories, loading: productsLoading, syncing, lastSync, refresh } = useProducts();

  const [loading, setLoading] = useState(true);
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [assemblyName, setAssemblyName] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showExistingItems, setShowExistingItems] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pricebookItems, setPricebookItems] = useState<PricebookItem[]>([]);
  const [activeSource, setActiveSource] = useState<ItemSource>("catalog");
  const [additionalBlankRows, setAdditionalBlankRows] = useState(0);
  const [pricebookSearchQuery, setPricebookSearchQuery] = useState("");

  const styles = useMemo(() => createStyles(theme), [theme]);

  // Use the same selection hook as quote materials - separate for catalog and pricebook
  const { selection, inc, dec, clear, units, setQty, getSelection } = useSelection(new Map());
  const {
    selection: pricebookSelection,
    inc: pricebookInc,
    dec: pricebookDec,
    clear: pricebookClear,
    units: pricebookUnits,
    setQty: pricebookSetQty,
    getSelection: getPricebookSelection
  } = useSelection(new Map());

  // Load assembly and pricebook items
  useEffect(() => {
    const load = async () => {
      if (!assemblyId) return;
      try {
        // Load assembly and pricebook items in parallel
        const [asm, pbItems] = await Promise.all([
          getAssemblyById(assemblyId),
          getPricebookItems(),
        ]);
        if (asm) {
          setAssembly(asm);
          setAssemblyName(asm.name);
        }
        setPricebookItems(pbItems);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assemblyId]);

  // Group products by category for MaterialsPicker
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products.forEach((product) => {
      if (!grouped[product.categoryId]) {
        grouped[product.categoryId] = [];
      }
      grouped[product.categoryId].push(product);
    });
    return grouped;
  }, [products]);

  // Convert pricebook items to Product format for the picker
  const pricebookAsProducts = useMemo((): Product[] => {
    return pricebookItems.map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unitType || "ea",
      unitPrice: item.unitPrice,
      categoryId: item.category || "Custom",
    }));
  }, [pricebookItems]);

  // Filter pricebook products by search query
  const filteredPricebookProducts = useMemo(() => {
    if (!pricebookSearchQuery.trim()) return pricebookAsProducts;
    const query = pricebookSearchQuery.toLowerCase();
    return pricebookAsProducts.filter((p) =>
      p.name.toLowerCase().includes(query)
    );
  }, [pricebookAsProducts, pricebookSearchQuery]);

  // Group pricebook products by category
  const pricebookByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    filteredPricebookProducts.forEach((product) => {
      const cat = product.categoryId || "Custom";
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(product);
    });
    return grouped;
  }, [filteredPricebookProducts]);

  // Get unique pricebook categories
  const pricebookCategories = useMemo(() => {
    const cats = new Set<string>();
    pricebookItems.forEach((item) => cats.add(item.category || "Custom"));
    return Array.from(cats)
      .sort()
      .map((cat) => ({ id: cat, name: cat }));
  }, [pricebookItems]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Handle adding custom line item to assembly
  const handleAddCustomItem = (name: string, qty: number, price: number) => {
    if (!assembly) return;

    // Generate a unique ID for the custom item
    const customId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newItem: AssemblyItem = {
      productId: customId,
      source: "pricebook" as ItemSource, // Custom items are treated like pricebook items
      qty,
      name, // Store the name since custom items aren't in any lookup
    };

    // Add to assembly items immediately
    const updatedItems = [...assembly.items, newItem];
    setAssembly({ ...assembly, items: updatedItems });

    // Show existing items so user can see the added item
    setShowExistingItems(true);
  };

  const handleSave = async (goBack: boolean) => {
    // Dismiss keyboard to trigger onBlur and commit any pending quantity edits
    Keyboard.dismiss();

    // Wait for state update to propagate
    await new Promise(resolve => setTimeout(resolve, 50));

    if (!assembly) return;

    const trimmedName = assemblyName.trim();
    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter a name for this assembly.");
      return;
    }

    const catalogSelection = getSelection();
    const pbSelection = getPricebookSelection();

    if (assembly.items.length === 0 && catalogSelection.size === 0 && pbSelection.size === 0) {
      Alert.alert(
        "No Products",
        "Please add at least one product to this assembly.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      // Get existing assembly items
      const existingItems = assembly.items || [];

      // Convert newly selected catalog products to assembly items
      const newCatalogItems: AssemblyItem[] = Array.from(catalogSelection.entries()).map(
        ([productId, { qty }]) => {
          const product = products.find((p) => p.id === productId);
          return {
            productId,
            source: "catalog" as ItemSource,
            qty,
            name: product?.name,
          };
        }
      );

      // Convert newly selected pricebook items to assembly items
      const newPricebookItems: AssemblyItem[] = Array.from(pbSelection.entries()).map(
        ([productId, { qty }]) => {
          const pbItem = pricebookItems.find((p) => p.id === productId);
          return {
            productId,
            source: "pricebook" as ItemSource,
            qty,
            name: pbItem?.name,
          };
        }
      );

      // Create a map for merging: key is "source:productId" to handle same ID in different sources
      const mergedMap = new Map<string, { productId: string; source?: ItemSource; qty: number; name?: string }>();

      // Add existing items (preserve their source)
      existingItems.forEach((item) => {
        if ("qty" in item) {
          const key = `${item.source || "catalog"}:${item.productId}`;
          mergedMap.set(key, {
            productId: item.productId,
            source: item.source,
            qty: item.qty,
            name: item.name,
          });
        }
      });

      // Merge in newly selected catalog items (add quantities)
      newCatalogItems.forEach((item) => {
        if ("qty" in item) {
          const key = `catalog:${item.productId}`;
          const existing = mergedMap.get(key);
          if (existing) {
            mergedMap.set(key, { ...existing, qty: existing.qty + item.qty });
          } else {
            mergedMap.set(key, {
              productId: item.productId,
              source: "catalog",
              qty: item.qty,
              name: item.name,
            });
          }
        }
      });

      // Merge in newly selected pricebook items (add quantities)
      newPricebookItems.forEach((item) => {
        if ("qty" in item) {
          const key = `pricebook:${item.productId}`;
          const existing = mergedMap.get(key);
          if (existing) {
            mergedMap.set(key, { ...existing, qty: existing.qty + item.qty });
          } else {
            mergedMap.set(key, {
              productId: item.productId,
              source: "pricebook",
              qty: item.qty,
              name: item.name,
            });
          }
        }
      });

      // Convert back to array
      const mergedItems: AssemblyItem[] = Array.from(mergedMap.values()).map((item) => ({
        productId: item.productId,
        ...(item.source && { source: item.source }),
        qty: item.qty,
        ...(item.name && { name: item.name }),
      }));

      const updatedAssembly: Assembly = {
        ...assembly,
        name: trimmedName,
        items: mergedItems,
      };

      await saveAssembly(updatedAssembly);

      if (goBack) {
        router.back();
      } else {
        // Update local assembly state
        setAssembly(updatedAssembly);

        // Clear selections so user can add more
        clear();
        pricebookClear();

        // Show success message
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save assembly:", error);
      Alert.alert("Error", "Could not save assembly. Please try again.");
    }
  };

  // Calculate status text for header
  const statusText = useMemo(() => {
    if (syncing) return "Syncing";
    if (lastSync) {
      const hoursAgo = Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60));
      if (hoursAgo < 24) return "Online";
      return "Refresh";
    }
    return "Offline";
  }, [syncing, lastSync]);

  const showStatusInfo = () => {
    let message = "Not synced\n\nPull down to sync product catalog from cloud.";
    if (syncing) {
      message = "Syncing product catalog from cloud...";
    } else if (lastSync) {
      const hoursAgo = Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60));
      if (hoursAgo < 1) {
        message = "Online (Up to date)\n\nProduct catalog is current.";
      } else if (hoursAgo < 24) {
        message = `Online (Updated ${hoursAgo}h ago)\n\nProduct catalog is recent.`;
      } else {
        const daysAgo = Math.floor(hoursAgo / 24);
        message = `Sync recommended\n\nLast updated ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago.\nPull down to refresh.`;
      }
    }
    Alert.alert("Product Catalog Status", message);
  };

  if (loading || productsLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Edit Assembly",
            headerShown: true,
            headerTitleAlign: 'center',
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </>
    );
  }

  if (!assembly) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Edit Assembly",
            headerShown: true,
            headerTitleAlign: 'center',
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
          }}
        />
        <View style={styles.center}>
          <Text style={styles.errorText}>Assembly not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Edit Assembly",
          headerShown: true,
          headerTitleAlign: 'center',
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerRight: () => (
            <Pressable onPress={showStatusInfo} style={{ marginRight: 16, padding: 8 }}>
              <Text style={{ fontSize: 15, color: theme.colors.text }}>{statusText}</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.container}>
        {/* Assembly Name Input */}
        <View style={styles.nameSection}>
          <Text style={styles.label}>Assembly Name</Text>
          <FormInput
            value={assemblyName}
            onChangeText={setAssemblyName}
            placeholder="e.g., Bedroom Rough-In"
          />
        </View>

        {/* Assembly Status Indicator */}
        {assembly.items.length > 0 && (
          <Pressable
            style={styles.assemblyIndicator}
            onPress={() => setShowExistingItems(!showExistingItems)}
          >
            <View style={styles.indicatorContent}>
              <View style={styles.indicatorTextContainer}>
                <Text style={styles.indicatorText}>
                  Assembly has {assembly.items.reduce((sum, item) => sum + ("qty" in item ? item.qty : 0), 0)}{" "}
                  item{assembly.items.reduce((sum, item) => sum + ("qty" in item ? item.qty : 0), 0) !== 1 ? "s" : ""}{" "}
                  ({assembly.items.length} product{assembly.items.length !== 1 ? "s" : ""})
                </Text>
              </View>
              <View style={styles.viewButton}>
                <Text style={styles.viewButtonText}>{showExistingItems ? "Hide" : "View"}</Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* Existing Items (collapsible, scrollable) */}
        {showExistingItems && assembly.items.length > 0 && (
          <ScrollView
            style={styles.existingItemsScrollContainer}
            contentContainerStyle={styles.existingItemsContent}
            nestedScrollEnabled
          >
            {assembly.items.map((item, index) => {
              const qty = "qty" in item ? item.qty : 0;
              const isLast = index === assembly.items.length - 1;

              // Check source - pricebook items use pricebookItems, catalog items use products
              const isPricebookItem = item.source === "pricebook";
              const pricebookItem = isPricebookItem
                ? pricebookItems.find((p) => p.id === item.productId)
                : null;
              const catalogProduct = !isPricebookItem
                ? products.find((p) => p.id === item.productId)
                : null;

              // Item is valid if we found it in the appropriate source
              const isValid = isPricebookItem ? !!pricebookItem : !!catalogProduct;
              const displayName = isPricebookItem
                ? (pricebookItem?.name || item.name || "Unknown item")
                : (catalogProduct?.name || item.name || "Unknown product");
              const displayPrice = isPricebookItem
                ? pricebookItem?.unitPrice
                : catalogProduct?.unitPrice;
              const displayUnit = isPricebookItem
                ? (pricebookItem?.unitType || "ea")
                : (catalogProduct?.unit || "ea");

              // Delete handler for swipe
              const handleDelete = () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const updatedItems = assembly.items.filter((i) => i.productId !== item.productId);
                setAssembly({ ...assembly, items: updatedItems });
              };

              // Render right swipe actions
              const renderRightActions = (
                progress: Animated.AnimatedInterpolation<number>,
                dragX: Animated.AnimatedInterpolation<number>
              ) => {
                const translateX = dragX.interpolate({
                  inputRange: [-100, 0],
                  outputRange: [0, 100],
                  extrapolate: "clamp",
                });
                return (
                  <Animated.View style={[styles.swipeActionsContainer, { transform: [{ translateX }] }]}>
                    <Pressable style={styles.swipeDeleteButton} onPress={handleDelete}>
                      <Text style={styles.swipeActionText}>Delete</Text>
                    </Pressable>
                  </Animated.View>
                );
              };

              // Show missing items with warning (only if truly missing from their source)
              if (!isValid) {
                const missingDisplayName = item.name || "Unknown item";
                return (
                  <Swipeable
                    key={item.productId}
                    renderRightActions={renderRightActions}
                    friction={2}
                    overshootRight={false}
                  >
                    <View style={[styles.existingItemRow, styles.missingItemRow, isLast && styles.existingItemRowLast]}>
                      <View style={styles.productInfo}>
                        <Text style={styles.missingProductName}>⚠️ {missingDisplayName}</Text>
                        <Text style={styles.missingProductMeta}>Unavailable · qty: {qty}</Text>
                      </View>
                    </View>
                  </Swipeable>
                );
              }

              return (
                <Swipeable
                  key={item.productId}
                  renderRightActions={renderRightActions}
                  friction={2}
                  overshootRight={false}
                >
                  <View style={[styles.existingItemRow, isLast && styles.existingItemRowLast]}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{displayName}</Text>
                      <Text style={styles.productMeta}>
                        ${displayPrice?.toFixed(2) ?? "0.00"} / {displayUnit}
                      </Text>
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() => {
                          const updatedItems = assembly.items
                            .map((i) =>
                              i.productId === item.productId
                                ? { ...i, qty: ("qty" in i ? i.qty : 0) - 1 }
                                : i
                            )
                            .filter((i) => ("qty" in i ? i.qty : 0) > 0);
                          setAssembly({ ...assembly, items: updatedItems });
                        }}
                      >
                        <Text style={styles.stepperText}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() => {
                          const updatedItems = assembly.items.map((i) =>
                            i.productId === item.productId
                              ? { ...i, qty: ("qty" in i ? i.qty : 0) + 1 }
                              : i
                          );
                          setAssembly({ ...assembly, items: updatedItems });
                        }}
                      >
                        <Text style={styles.stepperText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </Swipeable>
              );
            })}
          </ScrollView>
        )}

        {showSuccessMessage && (
          <View style={styles.successMessage}>
            <Text style={styles.successText}>
              ✓ Products added! Assembly now has {assembly.items.length} product
              {assembly.items.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {/* Source Tabs: Catalog / Pricebook */}
        <View style={styles.sourceTabsContainer}>
          <Pressable
            style={[
              styles.sourceTab,
              activeSource === "catalog" && styles.sourceTabActive,
            ]}
            onPress={() => setActiveSource("catalog")}
          >
            <Text
              style={[
                styles.sourceTabText,
                activeSource === "catalog" && styles.sourceTabTextActive,
              ]}
            >
              Catalog
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.sourceTab,
              activeSource === "pricebook" && styles.sourceTabActive,
            ]}
            onPress={() => setActiveSource("pricebook")}
          >
            <Text
              style={[
                styles.sourceTabText,
                activeSource === "pricebook" && styles.sourceTabTextActive,
              ]}
            >
              Pricebook
            </Text>
          </Pressable>
        </View>

        {/* Catalog Picker */}
        {activeSource === "catalog" && (
          <View style={styles.pickerContainer}>
            <MaterialsPicker
              categories={categories}
              itemsByCategory={productsByCategory}
              selection={selection}
              onInc={inc}
              onDec={dec}
              onSetQty={setQty}
              recentProductIds={[]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.accent}
                />
              }
            />
          </View>
        )}

        {/* Pricebook Picker */}
        {activeSource === "pricebook" && (
          <View style={styles.pickerContainer}>
            {pricebookItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Pricebook Items</Text>
                <Text style={styles.emptyText}>
                  Add custom products to your pricebook in Pro Tools to use them here.
                </Text>
              </View>
            ) : (
              <MaterialsPicker
                categories={pricebookCategories}
                itemsByCategory={pricebookByCategory}
                selection={pricebookSelection}
                onInc={pricebookInc}
                onDec={pricebookDec}
                onSetQty={pricebookSetQty}
                recentProductIds={[]}
              />
            )}

            {/* Custom Item Entry */}
            <View style={styles.customItemsSection}>
              {additionalBlankRows > 0 && (
                <>
                  {Array.from({ length: additionalBlankRows }).map((_, index) => (
                    <AddItemRow
                      key={`blank-${index}`}
                      onAddItem={(name, qty, price) => {
                        handleAddCustomItem(name, qty, price);
                        setAdditionalBlankRows((prev) => Math.max(0, prev - 1));
                      }}
                      isLastItem={index === additionalBlankRows - 1}
                      onDelete={() => setAdditionalBlankRows((prev) => Math.max(0, prev - 1))}
                    />
                  ))}
                </>
              )}
              <View style={styles.addRowContainer}>
                <Pressable
                  onPress={() => setAdditionalBlankRows((prev) => prev + 1)}
                  style={({ pressed }) => [
                    styles.addRowBtn,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                  hitSlop={8}
                >
                  <Ionicons name="add-circle" size={18} color="#34C759" />
                  <Text style={styles.addRowText}>Add custom item</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>

      <BottomBar>
        {(units + pricebookUnits) > 0 ? (
          <>
            <Button
              variant="secondary"
              onPress={() => handleSave(false)}
            >
              Add {units + pricebookUnits} {(units + pricebookUnits) === 1 ? 'item' : 'items'}
            </Button>
            <Button
              variant="primary"
              onPress={() => handleSave(true)}
            >
              Done
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            onPress={() => handleSave(true)}
          >
            Done
          </Button>
        )}
      </BottomBar>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.bg,
    },
    nameSection: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(1),
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    // Assembly status indicator (like quote items indicator)
    assemblyIndicator: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
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
    },
    viewButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.md,
    },
    viewButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
    // Existing items section (scrollable)
    existingItemsScrollContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
      maxHeight: 250,
    },
    existingItemsContent: {
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(2),
    },
    existingItemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    existingItemRowLast: {
      borderBottomWidth: 0,
    },
    productInfo: {
      flex: 1,
    },
    productName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    productMeta: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    stepperButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    stepperText: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    qtyText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      minWidth: 32,
      textAlign: "center",
    },
    // Success message
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
      color: "#000",
    },
    // Picker container
    pickerContainer: {
      flex: 1,
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    // Missing product styles
    missingItemRow: {
      backgroundColor: "#FFF3CD",
    },
    missingProductName: {
      fontSize: 14,
      fontWeight: "600",
      color: "#856404",
    },
    missingProductMeta: {
      fontSize: 12,
      color: "#856404",
      marginTop: 2,
    },
    removeButton: {
      backgroundColor: "#DC3545",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.md,
    },
    removeButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#FFF",
    },
    // Swipe actions
    swipeActionsContainer: {
      flexDirection: "row",
    },
    swipeDeleteButton: {
      backgroundColor: "#FF3B30",
      justifyContent: "center",
      alignItems: "center",
      width: 100,
    },
    swipeActionText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
    // Source tabs
    sourceTabsContainer: {
      flexDirection: "row",
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
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
    sourceTabText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    sourceTabTextActive: {
      color: "#000",
    },
    // Empty state
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(4),
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
    // Custom items section
    customItemsSection: {
      marginTop: theme.spacing(2),
      marginHorizontal: theme.spacing(2),
    },
    addRowContainer: {
      paddingVertical: theme.spacing(1),
    },
    addRowBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(0.5),
    },
    addRowText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#34C759",
    },
  });
}
