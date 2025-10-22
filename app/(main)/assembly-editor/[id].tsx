// app/(main)/assembly-editor/[id].tsx
// Edit custom assembly - add/remove products and set quantities
import { useTheme } from "@/contexts/ThemeContext";
import { getAssemblyById, saveAssembly } from "@/modules/assemblies";
import type { Assembly, AssemblyItem } from "@/modules/assemblies";
import { useProducts } from "@/modules/catalog";
import { CATEGORIES } from "@/modules/catalog/seed";
import type { Product } from "@/modules/catalog/seed";
import { BottomBar, Button, FormInput } from "@/modules/core/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/Swipeable";

export default function AssemblyEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const assemblyId = params.id;
  const router = useRouter();
  const { theme } = useTheme();
  const { products, loading: productsLoading } = useProducts();

  const [loading, setLoading] = useState(true);
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [assemblyName, setAssemblyName] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

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

          // Load existing items into selection
          const map = new Map<string, number>();
          asm.items.forEach((item) => {
            if (typeof item.qty === "number") {
              map.set(item.productId, item.qty);
            }
          });
          setSelectedProducts(map);
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
    CATEGORIES.forEach((cat) => {
      grouped[cat.id] = products.filter((p) => p.categoryId === cat.id);
    });
    return grouped;
  }, [products]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(query));
  }, [products, searchQuery]);

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

  const handleRemoveProduct = (productId: string) => {
    const newMap = new Map(selectedProducts);
    newMap.delete(productId);
    setSelectedProducts(newMap);
  };

  const handleSave = async () => {
    if (!assembly) return;

    const trimmedName = assemblyName.trim();
    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter a name for this assembly.");
      return;
    }

    if (selectedProducts.size === 0) {
      Alert.alert(
        "No Products",
        "Please add at least one product to this assembly.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      // Convert selected products to assembly items
      const items: AssemblyItem[] = Array.from(selectedProducts.entries()).map(
        ([productId, qty]) => ({
          productId,
          qty,
        })
      );

      const updatedAssembly: Assembly = {
        ...assembly,
        name: trimmedName,
        items,
      };

      await saveAssembly(updatedAssembly);

      Alert.alert(
        "Assembly Saved",
        `"${trimmedName}" has been saved with ${items.length} products.`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
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

  const selectedProductsList = Array.from(selectedProducts.entries())
    .map(([productId, qty]) => {
      const product = products.find((p) => p.id === productId);
      return product ? { product, qty } : null;
    })
    .filter((item): item is { product: Product; qty: number } => item !== null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Edit Assembly",
          headerShown: true,
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

          <View style={{ height: theme.spacing(3) }} />

          {/* Selected Products with Swipe to Delete */}
          {selectedProductsList.length > 0 && (
            <>
              <Text style={styles.h2}>
                Selected Products ({selectedProductsList.length})
              </Text>
              {selectedProductsList.map(({ product, qty }) => (
                <SelectedProductItem
                  key={product.id}
                  product={product}
                  qty={qty}
                  onIncrement={() => handleIncrement(product)}
                  onDecrement={() => handleDecrement(product)}
                  onDelete={() => handleRemoveProduct(product.id)}
                  theme={theme}
                />
              ))}

              <View style={{ height: theme.spacing(3) }} />
            </>
          )}

          {/* Product Browser by Category */}
          <Text style={styles.h2}>Add Products</Text>
          <FormInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
          />

          <View style={{ height: theme.spacing(2) }} />

          {/* Show filtered search results OR categories */}
          {searchQuery.trim() ? (
            <View style={styles.searchResults}>
              {filteredProducts.map((product) => (
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
          ) : (
            CATEGORIES.map((category) => {
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
          <Button variant="primary" onPress={handleSave}>
            Save Assembly
          </Button>
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

// Selected product item with swipe to delete
function SelectedProductItem({
  product,
  qty,
  onIncrement,
  onDecrement,
  onDelete,
  theme,
}: {
  product: Product;
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onDelete: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const renderRightActions = () => (
    <Pressable style={styles.deleteAction} onPress={onDelete}>
      <Text style={styles.deleteText}>Delete</Text>
    </Pressable>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <View style={styles.selectedProductRow}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productMeta}>{product.unit}</Text>
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
    </Swipeable>
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
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    productRowActive: {
      backgroundColor: theme.colors.accent + "10",
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
    // Selected products with swipe
    selectedProductRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing(2),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing(1.5),
    },
    deleteAction: {
      backgroundColor: theme.colors.danger,
      justifyContent: "center",
      alignItems: "center",
      width: 80,
      borderRadius: theme.radius.md,
      marginBottom: theme.spacing(1.5),
    },
    deleteText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    // Search results
    searchResults: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.muted,
    },
  });
}
