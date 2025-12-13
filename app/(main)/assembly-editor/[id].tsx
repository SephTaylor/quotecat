// app/(main)/assembly-editor/[id].tsx
// Edit custom assembly - add/remove products and set quantities
import { useTheme } from "@/contexts/ThemeContext";
import { getAssemblyById, saveAssembly } from "@/modules/assemblies";
import type { Assembly, AssemblyItem } from "@/modules/assemblies";
import { useProducts } from "@/modules/catalog";
import type { Product } from "@/modules/catalog/seed";
import { BottomBar, Button, FormInput } from "@/modules/core/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function AssemblyEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const assemblyId = params.id;
  const router = useRouter();
  const { theme } = useTheme();
  const { products, categories, loading: productsLoading } = useProducts();

  const [loading, setLoading] = useState(true);
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [assemblyName, setAssemblyName] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showExistingItems, setShowExistingItems] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  // Load assembly
  useEffect(() => {
    const load = async () => {
      if (!assemblyId) return;
      try {
        const asm = await getAssemblyById(assemblyId);
        if (asm) {
          setAssembly(asm);
          setAssemblyName(asm.name);

          // Don't populate selectedProducts with existing items
          // selectedProducts should only contain NEW items being added
          // Existing items are stored in assembly.items
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assemblyId]);

  // Group products by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    categories.forEach((cat) => {
      grouped[cat.id] = products.filter((p) => p.categoryId === cat.id);
    });
    return grouped;
  }, [products, categories]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(query));
  }, [products, searchQuery]);

  // Calculate total selected items (must be before early returns)
  const totalSelectedItems = useMemo(() => {
    return Array.from(selectedProducts.values()).reduce((sum, qty) => sum + qty, 0);
  }, [selectedProducts]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleIncrement = (product: Product) => {
    const newMap = new Map(selectedProducts);
    const current = newMap.get(product.id) || 0;
    newMap.set(product.id, current + 1);
    setSelectedProducts(newMap);
  };

  const handleDecrement = (product: Product) => {
    const newMap = new Map(selectedProducts);
    const current = newMap.get(product.id) || 0;
    if (current <= 1) {
      newMap.delete(product.id);
    } else {
      newMap.set(product.id, current - 1);
    }
    setSelectedProducts(newMap);
  };

  const handleSave = async (goBack: boolean) => {
    if (!assembly) return;

    const trimmedName = assemblyName.trim();
    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter a name for this assembly.");
      return;
    }

    if (assembly.items.length === 0 && selectedProducts.size === 0) {
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

      // Convert newly selected products to assembly items
      const newlySelectedItems: AssemblyItem[] = Array.from(selectedProducts.entries()).map(
        ([productId, qty]) => ({
          productId,
          qty,
        })
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
        mergedMap.set(item.productId, current + ("qty" in item ? item.qty : 0));
      });

      // Convert back to array
      const mergedItems: AssemblyItem[] = Array.from(mergedMap.entries()).map(
        ([productId, qty]) => ({ productId, qty })
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
        setSelectedProducts(new Map());

        // Show success message
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save assembly:", error);
      Alert.alert("Error", "Could not save assembly. Please try again.");
    }
  };

  if (loading || productsLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Edit Assembly",
            headerShown: true,
            headerTitleAlign: 'center', // Center title on all platforms (Android defaults to left)
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
            headerTitleAlign: 'center', // Center title on all platforms (Android defaults to left)
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Edit Assembly",
          headerShown: true,
          headerTitleAlign: 'center', // Center title on all platforms (Android defaults to left)
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
        }}
      />
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Assembly Name */}
          <Text style={styles.label}>Assembly Name</Text>
          <FormInput
            value={assemblyName}
            onChangeText={setAssemblyName}
            placeholder="e.g., Bedroom Rough-In"
          />

          <View style={{ height: theme.spacing(2) }} />

          {/* Assembly Status Indicator */}
          {assembly.items.length > 0 && (
            <View style={styles.assemblyIndicator}>
              <View style={styles.indicatorContent}>
                <View style={styles.indicatorTextContainer}>
                  <Text style={styles.indicatorText}>
                    Assembly has {assembly.items.reduce((sum, item) => sum + ("qty" in item ? item.qty : 0), 0)}{" "}
                    item{assembly.items.reduce((sum, item) => sum + ("qty" in item ? item.qty : 0), 0) !== 1 ? "s" : ""}{" "}
                    ({assembly.items.length} product{assembly.items.length !== 1 ? "s" : ""})
                  </Text>
                </View>
              </View>
            </View>
          )}

          {showSuccessMessage && (
            <View style={styles.successMessage}>
              <Text style={styles.successText}>
                ✓ Products added! Assembly now has {assembly.items.length} product
                {assembly.items.length !== 1 ? "s" : ""}
              </Text>
            </View>
          )}

          <View style={{ height: theme.spacing(2) }} />

          {/* Existing Items Section */}
          {assembly.items.length > 0 && (
            <>
              <Pressable
                style={styles.existingItemsHeader}
                onPress={() => setShowExistingItems(!showExistingItems)}
              >
                <Text style={styles.h2}>
                  {showExistingItems ? "▾" : "▸"} Current Products ({assembly.items.length})
                </Text>
              </Pressable>
              {showExistingItems && (
                <View style={styles.existingItemsContainer}>
                {assembly.items.map((item, index) => {
                  const product = products.find((p) => p.id === item.productId);
                  if (!product) return null;

                  const qty = "qty" in item ? item.qty : 0;
                  const isLast = index === assembly.items.length - 1;

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
                            // Decrement or remove from assembly
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
                            // Increment quantity
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
                </View>
              )}
              <View style={{ height: theme.spacing(3) }} />
            </>
          )}

          {/* Product Browser by Category */}
          <Text style={styles.h2}>Add More Products</Text>
          <FormInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
          />

          <View style={{ height: theme.spacing(2) }} />

          {/* Show filtered search results OR categories */}
          {searchQuery.trim() ? (
            <View style={styles.searchResults}>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    qty={selectedProducts.get(product.id) || 0}
                    onIncrement={() => handleIncrement(product)}
                    onDecrement={() => handleDecrement(product)}
                    theme={theme}
                  />
                ))
              ) : (
                <Text style={styles.errorText}>No products found</Text>
              )}
            </View>
          ) : (
            categories.map((category) => {
              const categoryProducts = productsByCategory[category.id] || [];
              const isExpanded = expandedCategories[category.id];

              return (
                <View key={category.id} style={styles.categoryCard}>
                  <Pressable
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <Text style={styles.categoryTitle}>
                      {isExpanded ? "▾" : "▸"} {category.name}
                    </Text>
                    <Text style={styles.categoryCount}>
                      {categoryProducts.length}
                    </Text>
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.categoryProducts}>
                      {categoryProducts.map((product) => (
                        <ProductRow
                          key={product.id}
                          product={product}
                          qty={selectedProducts.get(product.id) || 0}
                          onIncrement={() => handleIncrement(product)}
                          onDecrement={() => handleDecrement(product)}
                          theme={theme}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <BottomBar>
          {selectedProducts.size > 0 ? (
            <>
              <Button
                variant="secondary"
                onPress={() => handleSave(false)}
              >
                Add {totalSelectedItems} {totalSelectedItems === 1 ? 'item' : 'items'}
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
      </View>
    </GestureHandlerRootView>
  );
}

// Product row component with stepper (matches materials picker)
function ProductRow({
  product,
  qty,
  onIncrement,
  onDecrement,
  theme,
}: {
  product: Product;
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const isActive = qty > 0;

  return (
    <View style={[styles.productRow, isActive && styles.productRowActive]}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productMeta}>
          ${product.unitPrice.toFixed(2)} / {product.unit}
        </Text>
      </View>
      <View style={styles.stepper}>
        <Pressable style={styles.stepperButton} onPress={onDecrement}>
          <Text style={styles.stepperText}>−</Text>
        </Pressable>
        <Text style={styles.qtyText}>{qty}</Text>
        <Pressable style={styles.stepperButton} onPress={onIncrement}>
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>
    </View>
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
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing(2),
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    h2: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    // Assembly status indicator
    assemblyIndicator: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1),
    },
    indicatorContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    indicatorTextContainer: {
      flex: 1,
    },
    indicatorText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    // Existing items section
    existingItemsHeader: {
      marginBottom: theme.spacing(1),
    },
    existingItemsContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
    // Selection indicator
    selectionIndicator: {
      backgroundColor: theme.colors.accent + "20",
      borderRadius: theme.radius.sm,
      padding: theme.spacing(1),
      alignItems: "center",
    },
    selectionText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    // Category card (collapsible)
    categoryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing(2),
      overflow: "hidden",
    },
    categoryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing(2),
    },
    categoryTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    categoryCount: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    categoryProducts: {
      paddingHorizontal: theme.spacing(2),
      paddingBottom: theme.spacing(1),
    },
    // Product row with stepper
    productRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(1),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      marginBottom: 2,
    },
    productRowActive: {
      backgroundColor: theme.colors.accent + "20",
      borderBottomColor: theme.colors.accent,
      borderBottomWidth: 2,
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
    // Search results
    searchResults: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(2),
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    // Success message (inline, not absolute)
    successMessage: {
      backgroundColor: "#4CAF50",
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      alignItems: "center",
      marginTop: theme.spacing(1),
    },
    successText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
