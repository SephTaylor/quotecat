// app/(main)/assembly-editor/[id].tsx
// Edit custom assembly - add/remove products and set quantities
import { useTheme } from "@/contexts/ThemeContext";
import { getAssemblyById, saveAssembly } from "@/modules/assemblies";
import type { Assembly, AssemblyItem } from "@/modules/assemblies";
import { useProducts } from "@/modules/catalog";
import type { Product } from "@/modules/catalog/seed";
import { BottomBar, Button, FormInput } from "@/modules/core/ui";
import {
  MaterialsPicker,
  useSelection,
} from "@/modules/materials";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Keyboard,
  RefreshControl,
} from "react-native";

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

  const styles = useMemo(() => createStyles(theme), [theme]);

  // Use the same selection hook as quote materials
  const { selection, inc, dec, clear, units, setQty, getSelection } = useSelection(new Map());

  // Load assembly
  useEffect(() => {
    const load = async () => {
      if (!assemblyId) return;
      try {
        const asm = await getAssemblyById(assemblyId);
        if (asm) {
          setAssembly(asm);
          setAssemblyName(asm.name);
        }
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

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

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

    const currentSelection = getSelection();

    if (assembly.items.length === 0 && currentSelection.size === 0) {
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

      // Convert newly selected products to assembly items (all have fixed qty)
      // Store product name for display when product becomes unavailable
      const newlySelectedItems = Array.from(currentSelection.entries()).map(
        ([productId, { qty }]) => {
          const product = products.find((p) => p.id === productId);
          return {
            productId,
            qty,
            name: product?.name,
          };
        }
      );

      // Merge existing items with newly selected items
      const mergedMap = new Map<string, number>();

      // Add existing items
      existingItems.forEach((item) => {
        if ("qty" in item) {
          mergedMap.set(item.productId, item.qty);
        }
      });

      // Merge in newly selected items (add quantities)
      newlySelectedItems.forEach((item) => {
        const current = mergedMap.get(item.productId) || 0;
        mergedMap.set(item.productId, current + item.qty);
      });

      // Convert back to array, preserving names from existing or new items
      const mergedItems: AssemblyItem[] = Array.from(mergedMap.entries()).map(
        ([productId, qty]) => {
          // Try to find name from existing items first, then new items
          const existingItem = existingItems.find((i) => i.productId === productId);
          const newItem = newlySelectedItems.find((i) => i.productId === productId);
          const name = existingItem?.name || newItem?.name;
          return { productId, qty, ...(name && { name }) };
        }
      );

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

        // Clear selection so user can add more
        clear();

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
              const product = products.find((p) => p.id === item.productId);
              const qty = "qty" in item ? item.qty : 0;
              const isLast = index === assembly.items.length - 1;

              // Show missing products with warning
              if (!product) {
                // Use stored name if available, otherwise show generic message
                const displayName = item.name || "Unknown product";
                return (
                  <View key={item.productId} style={[styles.existingItemRow, styles.missingItemRow, isLast && styles.existingItemRowLast]}>
                    <View style={styles.productInfo}>
                      <Text style={styles.missingProductName}>⚠️ {displayName}</Text>
                      <Text style={styles.missingProductMeta}>Unavailable · qty: {qty}</Text>
                    </View>
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => {
                        const updatedItems = assembly.items.filter((i) => i.productId !== item.productId);
                        setAssembly({ ...assembly, items: updatedItems });
                      }}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                );
              }

              return (
                <View key={item.productId} style={[styles.existingItemRow, isLast && styles.existingItemRowLast]}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productMeta}>
                      ${product.unitPrice.toFixed(2)} / {product.unit}
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

        {/* MaterialsPicker - same as quote materials screen */}
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
      </View>

      <BottomBar>
        {units > 0 ? (
          <>
            <Button
              variant="secondary"
              onPress={() => handleSave(false)}
            >
              Add {units} {units === 1 ? 'item' : 'items'}
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
      marginHorizontal: -theme.spacing(2),
      paddingHorizontal: theme.spacing(2),
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
  });
}
