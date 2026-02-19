// app/(main)/job-calculator-results.tsx
// Job Calculator - Results screen showing matched materials and pricing
import { useTheme } from "@/contexts/ThemeContext";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useMemo } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { Stepper } from "@/modules/core/ui/Stepper";
import {
  type MaterialWithProducts,
  type JobType,
  groupMaterialsByCategory,
  getUnmatchedMaterials,
} from "@/modules/job-calculator";
import { createQuote, updateQuote } from "@/lib/quotes";
import type { QuoteItem } from "@/lib/types";
import { openProductUrl, getStoreName } from "@/lib/browser";

export default function JobCalculatorResults() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{
    jobType: JobType;
    materials: string;
    totalCost: string;
  }>();

  // Parse materials from params
  const initialMaterials = useMemo(() => {
    try {
      return JSON.parse(params.materials || "[]") as MaterialWithProducts[];
    } catch {
      return [];
    }
  }, [params.materials]);

  const [materials, setMaterials] = useState(initialMaterials);
  const [creating, setCreating] = useState(false);
  const [removedCategories, setRemovedCategories] = useState<Set<string>>(new Set());

  // Filter out removed categories
  const visibleMaterials = useMemo(
    () => materials.filter((m) => !removedCategories.has(m.requirement.category)),
    [materials, removedCategories]
  );

  // Handle category deletion
  const handleDeleteCategory = (category: string) => {
    setRemovedCategories((prev) => new Set([...prev, category]));
  };

  // Calculate total from visible materials only
  const totalCost = useMemo(() => {
    return visibleMaterials.reduce((total, m) => {
      if (!m.selectedProductId) return total;
      const product = m.products.find((p) => p.id === m.selectedProductId);
      if (!product) return total;
      return total + product.unitPrice * m.selectedQty;
    }, 0);
  }, [visibleMaterials]);

  // Group visible materials by category
  const groupedMaterials = useMemo(
    () => groupMaterialsByCategory(visibleMaterials),
    [visibleMaterials]
  );

  // Get unmatched materials for warning
  const unmatchedMaterials = useMemo(
    () => getUnmatchedMaterials(visibleMaterials),
    [visibleMaterials]
  );

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Handle product selection
  const handleSelectProduct = (
    category: string,
    name: string,
    productId: string
  ) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.requirement.category === category && m.requirement.name === name) {
          return { ...m, selectedProductId: productId };
        }
        return m;
      })
    );
  };

  // Handle quantity change
  const handleQuantityChange = (category: string, name: string, qty: number) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.requirement.category === category && m.requirement.name === name) {
          return { ...m, selectedQty: Math.max(0, qty) };
        }
        return m;
      })
    );
  };

  // Create quote from materials
  const handleCreateQuote = async () => {
    setCreating(true);
    try {
      // Build quote items from materials with selected products
      const items: QuoteItem[] = materials
        .filter((m) => m.selectedProductId)
        .map((m) => {
          const product = m.products.find((p) => p.id === m.selectedProductId);
          if (!product) return null;
          return {
            productId: product.id,
            name: product.name,
            unitPrice: product.unitPrice,
            qty: m.selectedQty,
          };
        })
        .filter(Boolean) as QuoteItem[];

      // Create the quote
      const jobTypeTitle = params.jobType
        ? params.jobType.charAt(0).toUpperCase() + params.jobType.slice(1)
        : "Job";
      const quoteName = `${jobTypeTitle} - ${new Date().toLocaleDateString()}`;
      const quote = await createQuote(quoteName, "");

      // Add items to the quote
      await updateQuote(quote.id, { items });

      // Navigate to quote edit screen
      router.replace({
        pathname: "/(forms)/quote/[id]/edit",
        params: { id: quote.id },
      } as any);
    } catch (error) {
      Alert.alert("Error", "Failed to create quote. Please try again.");
      setCreating(false);
    }
  };

  // Format price for display
  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  // Category display names
  const categoryLabels: Record<string, string> = {
    posts: "Posts",
    joists: "Joists",
    ledger: "Ledger",
    rim_joists: "Rim Joists",
    deck_boards: "Deck Boards",
    fasteners: "Fasteners",
    hardware: "Hardware",
    concrete: "Concrete",
    stringers: "Stringers",
    treads: "Treads",
    railing_posts: "Railing Posts",
    rails: "Rails",
    balusters: "Balusters",
    flooring: "Flooring",
    underlayment: "Underlayment",
    trim: "Trim",
    adhesive: "Adhesive",
    grout: "Grout",
    supplies: "Supplies",
    sealant: "Sealant",
    finish: "Finish",
    studs: "Studs",
    plates: "Plates",
    headers: "Headers",
    sheathing: "Sheathing",
    wrap: "House Wrap",
    tape: "Tape",
    blocking: "Blocking",
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Materials List",
          headerShown: true,
          headerTitleAlign: "center",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
        }}
      />
      <GradientBackground>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Calculated Materials</Text>
            <Text style={styles.headerSubtitle}>
              Review and adjust quantities before creating quote
            </Text>
          </View>

          {/* Warning for unmatched materials */}
          {unmatchedMaterials.length > 0 && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={20} color="#F59E0B" />
              <Text style={styles.warningText}>
                {unmatchedMaterials.length} material
                {unmatchedMaterials.length > 1 ? "s" : ""} could not be matched
                to products in your catalog
              </Text>
            </View>
          )}

          {/* Materials by category */}
          {Object.entries(groupedMaterials).map(([category, items]) => (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>
                  {categoryLabels[category] || category}
                </Text>
                <Pressable
                  style={styles.categoryDeleteButton}
                  onPress={() => handleDeleteCategory(category)}
                  hitSlop={8}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.colors.muted}
                  />
                </Pressable>
              </View>

              {items.map((material) => (
                <MaterialCard
                  key={`${material.requirement.category}-${material.requirement.name}`}
                  material={material}
                  onSelectProduct={(productId) =>
                    handleSelectProduct(
                      material.requirement.category,
                      material.requirement.name,
                      productId
                    )
                  }
                  onQuantityChange={(qty) =>
                    handleQuantityChange(
                      material.requirement.category,
                      material.requirement.name,
                      qty
                    )
                  }
                  formatPrice={formatPrice}
                  theme={theme}
                />
              ))}
            </View>
          ))}

          {/* Spacer for bottom bar */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom bar with total and create button */}
        <View style={styles.bottomBar}>
          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalAmount}>{formatPrice(totalCost)}</Text>
          </View>

          <Pressable
            style={[styles.createButton, creating && styles.createButtonDisabled]}
            onPress={handleCreateQuote}
            disabled={creating}
          >
            <Ionicons name="document-text-outline" size={20} color="#000" />
            <Text style={styles.createButtonText}>
              {creating ? "Creating..." : "Create Quote"}
            </Text>
          </Pressable>
        </View>
      </GradientBackground>
    </>
  );
}

// Material card component
function MaterialCard({
  material,
  onSelectProduct,
  onQuantityChange,
  formatPrice,
  theme,
}: {
  material: MaterialWithProducts;
  onSelectProduct: (productId: string) => void;
  onQuantityChange: (qty: number) => void;
  formatPrice: (price: number) => string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(false);

  const selectedProduct = material.products.find(
    (p) => p.id === material.selectedProductId
  );

  const lineTotal = selectedProduct
    ? selectedProduct.unitPrice * material.selectedQty
    : 0;

  // No products found
  if (material.products.length === 0) {
    return (
      <View style={[styles.materialCard, styles.materialCardUnmatched]}>
        <View style={styles.materialHeader}>
          <Text style={styles.materialName}>{material.requirement.name}</Text>
          <Text style={styles.unmatchedLabel}>No products found</Text>
        </View>
        <Text style={styles.materialNotes}>{material.requirement.notes}</Text>
      </View>
    );
  }

  return (
    <View style={styles.materialCard}>
      {/* Material header */}
      <Pressable
        style={styles.materialHeader}
        onPress={() => {
          Keyboard.dismiss();
          setExpanded(!expanded);
        }}
      >
        <View style={styles.materialInfo}>
          <Text style={styles.materialName}>{material.requirement.name}</Text>
          {material.requirement.notes && (
            <Text style={styles.materialNotes}>{material.requirement.notes}</Text>
          )}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.colors.muted}
        />
      </Pressable>

      {/* Selected product info */}
      {selectedProduct && (
        <View style={styles.selectedProductRow}>
          <View style={styles.productInfo}>
            <Text
              style={styles.productName}
              numberOfLines={expanded ? undefined : 1}
            >
              {selectedProduct.name}
            </Text>
            <Text style={styles.productPrice}>
              {formatPrice(selectedProduct.unitPrice)} / {selectedProduct.unit}
            </Text>
            {/* Show store link when expanded */}
            {expanded && selectedProduct.productUrl && (
              <Pressable
                style={styles.storeLink}
                onPress={() => openProductUrl(selectedProduct.productUrl!)}
              >
                <Text style={styles.storeLinkText}>
                  View on {getStoreName(selectedProduct.supplierId)} →
                </Text>
              </Pressable>
            )}
          </View>

          {/* Quantity stepper */}
          <View style={styles.quantitySection}>
            <Stepper
              value={material.selectedQty}
              onDec={() => onQuantityChange(Math.max(0, material.selectedQty - 1))}
              onInc={() => onQuantityChange(material.selectedQty + 1)}
              onChange={onQuantityChange}
            />
          </View>

          {/* Line total */}
          <Text style={styles.lineTotal}>{formatPrice(lineTotal)}</Text>
        </View>
      )}

      {/* Expanded product options */}
      {expanded && (
        <View style={styles.productOptions}>
          <Text style={styles.productOptionsLabel}>Alternative Products:</Text>
          {material.products.map((product, index) => (
            <View key={`${product.id}-${index}`} style={styles.productOptionWrapper}>
              <Pressable
                style={[
                  styles.productOption,
                  product.id === material.selectedProductId &&
                    styles.productOptionSelected,
                ]}
                onPress={() => onSelectProduct(product.id)}
              >
                <View style={styles.productOptionInfo}>
                  <Text
                    style={[
                      styles.productOptionName,
                      product.id === material.selectedProductId &&
                        styles.productOptionNameSelected,
                    ]}
                  >
                    {product.name}
                  </Text>
                  <View style={styles.productOptionMeta}>
                    {product.supplierId && (
                      <Text style={styles.productSupplier}>
                        {getStoreName(product.supplierId)}
                      </Text>
                    )}
                    {product.productUrl && (
                      <Pressable
                        onPress={() => openProductUrl(product.productUrl!)}
                        hitSlop={8}
                      >
                        <Text style={styles.productOptionLink}>View →</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                <Text
                  style={[
                    styles.productOptionPrice,
                    product.id === material.selectedProductId &&
                      styles.productOptionPriceSelected,
                  ]}
                >
                  {formatPrice(product.unitPrice)}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    scrollContent: {
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(12),
    },
    header: {
      marginBottom: theme.spacing(2),
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    warningBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FEF3C7",
      borderRadius: theme.radius.sm,
      padding: theme.spacing(1.5),
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2),
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: "#92400E",
    },
    categorySection: {
      marginBottom: theme.spacing(2),
    },
    categoryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing(1),
    },
    categoryTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    categoryDeleteButton: {
      padding: theme.spacing(0.5),
    },
    materialCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing(1),
      overflow: "hidden",
    },
    materialCardUnmatched: {
      opacity: 0.6,
    },
    materialHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing(1.5),
    },
    materialInfo: {
      flex: 1,
    },
    materialName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    materialNotes: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    unmatchedLabel: {
      fontSize: 12,
      color: "#DC2626",
      fontStyle: "italic",
    },
    selectedProductRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing(1.5),
      paddingBottom: theme.spacing(1.5),
      gap: theme.spacing(1),
    },
    productInfo: {
      flex: 1,
    },
    productName: {
      fontSize: 13,
      color: theme.colors.text,
    },
    productPrice: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    storeLink: {
      marginTop: theme.spacing(0.5),
    },
    storeLinkText: {
      fontSize: 13,
      color: theme.colors.accent,
      fontWeight: "600",
    },
    quantitySection: {
      flexDirection: "row",
      alignItems: "center",
    },
    lineTotal: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.accent,
      minWidth: 70,
      textAlign: "right",
    },
    productOptions: {
      backgroundColor: theme.colors.bg,
      padding: theme.spacing(1.5),
      gap: theme.spacing(1),
    },
    productOptionsLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.5),
    },
    productOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1),
    },
    productOptionSelected: {
      borderColor: theme.colors.accent,
      backgroundColor: `${theme.colors.accent}10`,
    },
    productOptionInfo: {
      flex: 1,
    },
    productOptionName: {
      fontSize: 13,
      color: theme.colors.text,
    },
    productOptionNameSelected: {
      fontWeight: "600",
    },
    productSupplier: {
      fontSize: 11,
      color: theme.colors.muted,
    },
    productOptionWrapper: {},
    productOptionMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      marginTop: 2,
    },
    productOptionLink: {
      fontSize: 11,
      color: theme.colors.accent,
      fontWeight: "600",
    },
    productOptionPrice: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    productOptionPriceSelected: {
      color: theme.colors.accent,
    },
    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.card,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(4),
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(2),
    },
    totalSection: {
      flex: 1,
    },
    totalLabel: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    totalAmount: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.text,
    },
    createButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    createButtonDisabled: {
      opacity: 0.6,
    },
    createButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#000",
    },
  });
}
