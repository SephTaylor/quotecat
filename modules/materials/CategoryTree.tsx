// modules/materials/CategoryTree.tsx
// Expandable/collapsible category tree for filter modal
import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Category } from "@/modules/catalog/seed";

type Theme = {
  colors: {
    text: string;
    muted: string;
    accent: string;
    bg: string;
    border: string;
    card: string;
  };
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number };
};

type CategoryTreeProps = {
  categories: Category[];
  selectedCategories: string[];
  expandedCategories: string[];
  productCounts: Record<string, number>;
  onToggleCategory: (categoryId: string) => void;
  onToggleExpanded: (categoryId: string) => void;
  theme: Theme;
};

type CategoryNode = Category & {
  children: CategoryNode[];
  productCount: number;
};

export function CategoryTree({
  categories,
  selectedCategories,
  expandedCategories,
  productCounts,
  onToggleCategory,
  onToggleExpanded,
  theme,
}: CategoryTreeProps) {
  // Build tree structure from flat categories
  const categoryTree = useMemo(() => {
    const parentMap = new Map<string, CategoryNode>();
    const leafMap = new Map<string, CategoryNode>();

    // First pass: create all nodes
    categories.forEach((cat) => {
      const node: CategoryNode = {
        ...cat,
        children: [],
        productCount: productCounts[cat.id] || 0,
      };

      if (cat.level === 0 || !cat.parentId) {
        parentMap.set(cat.id, node);
      } else {
        leafMap.set(cat.id, node);
      }
    });

    // Second pass: attach children to parents
    leafMap.forEach((leaf) => {
      if (leaf.parentId && parentMap.has(leaf.parentId)) {
        parentMap.get(leaf.parentId)!.children.push(leaf);
      }
    });

    // Calculate parent product counts (sum of children)
    parentMap.forEach((parent) => {
      if (parent.children.length > 0) {
        parent.productCount = parent.children.reduce(
          (sum, child) => sum + child.productCount,
          0
        );
      }
    });

    // Sort parents by product count (descending), then alphabetically
    const sorted = Array.from(parentMap.values())
      .filter((p) => p.productCount > 0) // Only show categories with products
      .sort((a, b) => {
        // Sort by product count descending
        if (b.productCount !== a.productCount) {
          return b.productCount - a.productCount;
        }
        // Then alphabetically
        return a.name.localeCompare(b.name);
      });

    // Sort children within each parent
    sorted.forEach((parent) => {
      parent.children.sort((a, b) => {
        if (b.productCount !== a.productCount) {
          return b.productCount - a.productCount;
        }
        return a.name.localeCompare(b.name);
      });
    });

    return sorted;
  }, [categories, productCounts]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const isParentSelected = useCallback(
    (parent: CategoryNode) => {
      // Parent is selected if ALL its children are selected (or parent itself is selected if no children)
      if (parent.children.length === 0) {
        return selectedCategories.includes(parent.id);
      }
      return parent.children.every((child) =>
        selectedCategories.includes(child.id)
      );
    },
    [selectedCategories]
  );

  const isParentPartial = useCallback(
    (parent: CategoryNode) => {
      // Parent is partial if SOME (but not all) children are selected
      if (parent.children.length === 0) return false;
      const selectedCount = parent.children.filter((child) =>
        selectedCategories.includes(child.id)
      ).length;
      return selectedCount > 0 && selectedCount < parent.children.length;
    },
    [selectedCategories]
  );

  const handleParentPress = useCallback(
    (parent: CategoryNode) => {
      if (parent.children.length === 0) {
        // No children - just toggle this category
        onToggleCategory(parent.id);
      } else {
        // Has children - toggle all children
        const allSelected = isParentSelected(parent);
        parent.children.forEach((child) => {
          const isSelected = selectedCategories.includes(child.id);
          // If all selected, deselect all. Otherwise, select all unselected.
          if (allSelected && isSelected) {
            onToggleCategory(child.id);
          } else if (!allSelected && !isSelected) {
            onToggleCategory(child.id);
          }
        });
      }
    },
    [selectedCategories, onToggleCategory, isParentSelected]
  );

  const renderParent = (parent: CategoryNode) => {
    const isExpanded = expandedCategories.includes(parent.id);
    const hasChildren = parent.children.length > 0;
    const parentSelected = isParentSelected(parent);
    const parentPartial = isParentPartial(parent);

    return (
      <View key={parent.id} style={styles.parentContainer}>
        <TouchableOpacity
          style={styles.parentRow}
          onPress={() => hasChildren && onToggleExpanded(parent.id)}
          activeOpacity={0.7}
        >
          {/* Expand/collapse arrow */}
          {hasChildren ? (
            <Ionicons
              name={isExpanded ? "chevron-down" : "chevron-forward"}
              size={18}
              color={theme.colors.muted}
              style={styles.expandIcon}
            />
          ) : (
            <View style={styles.expandIconPlaceholder} />
          )}

          {/* Checkbox */}
          <TouchableOpacity
            style={[
              styles.checkbox,
              parentSelected && styles.checkboxSelected,
              parentPartial && styles.checkboxPartial,
            ]}
            onPress={() => handleParentPress(parent)}
          >
            {parentSelected && (
              <Ionicons name="checkmark" size={14} color="#000" />
            )}
            {parentPartial && !parentSelected && (
              <View style={styles.partialIndicator} />
            )}
          </TouchableOpacity>

          {/* Category name and count */}
          <Text style={styles.parentName} numberOfLines={1}>
            {parent.name}
          </Text>
          <Text style={styles.productCount}>[{parent.productCount}]</Text>
        </TouchableOpacity>

        {/* Children */}
        {hasChildren && isExpanded && (
          <View style={styles.childrenContainer}>
            {parent.children.map((child) => {
              const isSelected = selectedCategories.includes(child.id);
              return (
                <TouchableOpacity
                  key={child.id}
                  style={styles.childRow}
                  onPress={() => onToggleCategory(child.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.expandIconPlaceholder} />
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#000" />
                    )}
                  </View>
                  <Text style={styles.childName} numberOfLines={1}>
                    {child.name}
                  </Text>
                  <Text style={styles.productCount}>[{child.productCount}]</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  if (categoryTree.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No categories available</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
    >
      {categoryTree.map(renderParent)}
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      maxHeight: 280,
    },
    contentContainer: {
      paddingBottom: theme.spacing(1),
    },
    emptyContainer: {
      padding: theme.spacing(2),
      alignItems: "center",
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    parentContainer: {
      marginBottom: theme.spacing(0.5),
    },
    parentRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(1),
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.sm,
    },
    childrenContainer: {
      marginLeft: theme.spacing(3),
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border,
      paddingLeft: theme.spacing(1),
    },
    childRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing(0.75),
      paddingHorizontal: theme.spacing(1),
    },
    expandIcon: {
      width: 20,
      marginRight: theme.spacing(0.5),
    },
    expandIconPlaceholder: {
      width: 20,
      marginRight: theme.spacing(0.5),
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.colors.border,
      marginRight: theme.spacing(1),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.bg,
    },
    checkboxSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    checkboxPartial: {
      borderColor: theme.colors.accent,
    },
    partialIndicator: {
      width: 10,
      height: 10,
      backgroundColor: theme.colors.accent,
      borderRadius: 2,
    },
    parentName: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    childName: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
    },
    productCount: {
      fontSize: 13,
      color: theme.colors.muted,
      marginLeft: theme.spacing(1),
    },
  });
