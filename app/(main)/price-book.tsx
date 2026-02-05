// app/(main)/price-book.tsx
// Pro/Premium tool for managing custom products in price book
import { useTheme } from "@/contexts/ThemeContext";
import { getUserState } from "@/lib/user";
import {
  getPricebookItems,
  savePricebookItem,
  deletePricebookItem,
  createPricebookItemId,
  getPricebookCategories,
  type PricebookItem,
} from "@/lib/pricebook";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Ionicons } from "@expo/vector-icons";
import { HeaderBackButton } from "@/components/HeaderBackButton";

const UNIT_OPTIONS = [
  { value: "each", label: "Each" },
  { value: "linear ft", label: "Linear Ft" },
  { value: "sq ft", label: "Sq Ft" },
  { value: "sheet", label: "Sheet" },
  { value: "box", label: "Box" },
  { value: "bag", label: "Bag" },
  { value: "bundle", label: "Bundle" },
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
];

export default function PriceBookManager() {
  const { theme } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<PricebookItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PricebookItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitType, setUnitType] = useState("each");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const loadItems = useCallback(async () => {
    const data = await getPricebookItems();
    // Sort by name
    data.sort((a, b) => a.name.localeCompare(b.name));
    setItems(data);

    // Load categories
    const cats = await getPricebookCategories();
    setCategories(cats);
  }, []);

  // Load Premium status and items
  React.useEffect(() => {
    const load = async () => {
      const user = await getUserState();
      setIsPremium(user.tier === "pro" || user.tier === "premium");
    };
    load();
  }, []);

  // Reload items when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const filteredItems = React.useMemo(() => {
    let filtered = items;

    // Filter by category if selected
    if (selectedCategory) {
      filtered = filtered.filter(i => i.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.sku?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [items, searchQuery, selectedCategory]);

  const resetForm = () => {
    setName("");
    setUnitPrice("");
    setUnitType("each");
    setCategory("");
    setDescription("");
    setEditingItem(null);
  };

  // Format price input
  const formatPrice = (text: string): string => {
    // Remove non-numeric except decimal
    const cleaned = text.replace(/[^0-9.]/g, "");
    // Only allow one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + "." + parts[1].slice(0, 2);
    }
    return cleaned;
  };

  const handlePriceChange = (text: string) => {
    setUnitPrice(formatPrice(text));
  };

  const handleAddItem = () => {
    if (!isPremium) {
      Alert.alert(
        "Pro Feature",
        "Price Book lets you create and manage your own custom products with your pricing.",
        [
          { text: "OK", style: "cancel" },
          { text: "Learn More", onPress: () => Linking.openURL("https://quotecat.ai/#pricing") },
        ]
      );
      return;
    }
    resetForm();
    setShowModal(true);
  };

  const handleEditItem = (item: PricebookItem) => {
    setEditingItem(item);
    setName(item.name);
    setUnitPrice(item.unitPrice.toString());
    setUnitType(item.unitType || "each");
    setCategory(item.category || "");
    setDescription(item.description || "");
    setShowModal(true);
  };

  const handleSaveItem = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter a product name.");
      return;
    }

    const price = parseFloat(unitPrice) || 0;
    if (price <= 0) {
      Alert.alert("Price Required", "Please enter a valid price.");
      return;
    }

    try {
      const item: PricebookItem = {
        id: editingItem?.id || createPricebookItemId(),
        name: trimmedName,
        unitPrice: price,
        unitType: unitType || "each",
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        isActive: true,
        source: "custom",
        createdAt: editingItem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await savePricebookItem(item);
      setShowModal(false);
      resetForm();
      await loadItems();
    } catch (error) {
      console.error("Failed to save pricebook item:", error);
      Alert.alert("Error", "Failed to save product. Please try again.");
    }
  };

  const handleDeleteItem = (item: PricebookItem) => {
    Alert.alert(
      "Delete Product",
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePricebookItem(item.id);
              await loadItems();
            } catch {
              Alert.alert("Error", "Failed to delete product.");
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (item: PricebookItem) => (
    <View style={styles.swipeActions}>
      <Pressable
        style={styles.editAction}
        onPress={() => handleEditItem(item)}
      >
        <Text style={styles.editText}>Edit</Text>
      </Pressable>
      <Pressable
        style={styles.deleteAction}
        onPress={() => handleDeleteItem(item)}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: PricebookItem }) => (
    <Swipeable renderRightActions={() => renderRightActions(item)}>
      <Pressable
        style={styles.itemCard}
        onPress={() => handleEditItem(item)}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemPrice}>
            ${item.unitPrice.toFixed(2)} / {item.unitType || "each"}
          </Text>
          {item.category && (
            <Text style={styles.itemCategory}>{item.category}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
      </Pressable>
    </Swipeable>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Price Book",
          headerShown: true,
          headerTitleAlign: "center",
          headerBackTitle: "Back",
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
        }}
      />

      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>
              Create custom products with your own pricing
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor={theme.colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Category Filter */}
          {categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryFilter}
              contentContainerStyle={styles.categoryFilterContent}
            >
              <Pressable
                style={[
                  styles.categoryChip,
                  !selectedCategory && styles.categoryChipSelected,
                ]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    !selectedCategory && styles.categoryChipTextSelected,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat && styles.categoryChipSelected,
                  ]}
                  onPress={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === cat && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Items Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Products ({filteredItems.length})
              </Text>
              <Pressable
                style={styles.createButton}
                onPress={handleAddItem}
              >
                <Text style={styles.createButtonText}>+ New</Text>
              </Pressable>
            </View>

            {/* Item List */}
            {filteredItems.length === 0 ? (
              <View style={styles.emptyStateSimple}>
                <Text style={styles.emptyTextSimple}>
                  {searchQuery
                    ? `No products match "${searchQuery}"`
                    : isPremium
                    ? "No products yet. Tap + New to add your first product."
                    : "Price Book is a Pro feature."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </ScrollView>
      </View>

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowModal(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalOverlayInner}
            onPress={() => {
              setShowModal(false);
              resetForm();
            }}
          >
            <Pressable style={styles.modalContent} onPress={() => Keyboard.dismiss()}>
              <Text style={styles.modalTitle}>
                {editingItem ? "Edit Product" : "New Product"}
              </Text>
              <Text style={styles.modalDescription}>
                {editingItem ? "Update product details" : "Enter product details"}
              </Text>

              <ScrollView
                style={styles.formScroll}
                showsVerticalScrollIndicator={false}
              >
                {/* Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Product name"
                    placeholderTextColor={theme.colors.muted}
                    autoCapitalize="words"
                    autoFocus={!editingItem}
                  />
                </View>

                {/* Price */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Unit Price *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={unitPrice}
                    onChangeText={handlePriceChange}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Unit Type */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Unit Type</Text>
                  <Pressable
                    style={styles.formInput}
                    onPress={() => setShowUnitPicker(true)}
                  >
                    <Text style={styles.pickerText}>
                      {UNIT_OPTIONS.find(u => u.value === unitType)?.label || unitType}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={theme.colors.muted} />
                  </Pressable>
                </View>

                {/* Category */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Category</Text>
                  <TextInput
                    style={styles.formInput}
                    value={category}
                    onChangeText={setCategory}
                    placeholder="e.g., Framing, Electrical, Plumbing"
                    placeholderTextColor={theme.colors.muted}
                    autoCapitalize="words"
                  />
                </View>

                {/* Description */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description</Text>
                  <TextInput
                    style={[styles.formInput, styles.formInputMultiline]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Optional description..."
                    placeholderTextColor={theme.colors.muted}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </ScrollView>

              {/* Buttons */}
              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalSaveBtn}
                  onPress={handleSaveItem}
                >
                  <Text style={styles.modalSaveText}>
                    {editingItem ? "Save" : "Add"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Unit Type Picker Modal */}
      <Modal
        visible={showUnitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitPicker(false)}
      >
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setShowUnitPicker(false)}
        >
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Unit Type</Text>
            {UNIT_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.pickerOption,
                  unitType === option.value && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  setUnitType(option.value);
                  setShowUnitPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    unitType === option.value && styles.pickerOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {unitType === option.value && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.accent} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </GestureHandlerRootView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    content: {
      padding: theme.spacing(3),
    },
    descriptionContainer: {
      paddingBottom: theme.spacing(1.5),
    },
    description: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
    },
    searchContainer: {
      position: "relative",
      marginBottom: theme.spacing(2),
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      paddingRight: 40,
    },
    clearButton: {
      position: "absolute",
      right: 12,
      top: 12,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.muted,
      justifyContent: "center",
      alignItems: "center",
    },
    clearButtonText: {
      color: theme.colors.bg,
      fontSize: 14,
      fontWeight: "700",
    },
    categoryFilter: {
      marginBottom: theme.spacing(2),
    },
    categoryFilterContent: {
      gap: theme.spacing(1),
    },
    categoryChip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(0.75),
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categoryChipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    categoryChipText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    categoryChipTextSelected: {
      color: "#000",
      fontWeight: "600",
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    createButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(0.75),
      borderRadius: theme.radius.md,
    },
    createButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
    emptyStateSimple: {
      paddingVertical: theme.spacing(3),
      alignItems: "center",
    },
    emptyTextSimple: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    itemCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    itemPrice: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: "600",
    },
    itemCategory: {
      fontSize: 13,
      color: theme.colors.muted,
      marginTop: 2,
    },
    swipeActions: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
    },
    editAction: {
      backgroundColor: theme.colors.accent,
      justifyContent: "center",
      alignItems: "center",
      width: 70,
      borderRadius: theme.radius.lg,
      marginLeft: theme.spacing(1),
    },
    editText: {
      color: "#000",
      fontWeight: "700",
      fontSize: 14,
    },
    deleteAction: {
      backgroundColor: theme.colors.danger,
      justifyContent: "center",
      alignItems: "center",
      width: 70,
      borderRadius: theme.radius.lg,
      marginLeft: theme.spacing(1),
    },
    deleteText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
    },
    modalOverlayInner: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      padding: theme.spacing(3),
      width: "90%",
      maxWidth: 420,
      maxHeight: "85%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    modalDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1.5),
    },
    formScroll: {
      flexGrow: 0,
    },
    formGroup: {
      marginBottom: theme.spacing(2),
    },
    formLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.75),
    },
    formInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    formInputMultiline: {
      minHeight: 60,
      textAlignVertical: "top",
    },
    pickerText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    modalButtons: {
      flexDirection: "row",
      gap: theme.spacing(1.5),
      marginTop: theme.spacing(2),
    },
    modalCancelBtn: {
      flex: 1,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    modalCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modalSaveBtn: {
      flex: 1,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
    },
    modalSaveText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    // Unit picker styles
    pickerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    pickerContent: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      padding: theme.spacing(2),
      width: "80%",
      maxWidth: 320,
    },
    pickerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
      textAlign: "center",
    },
    pickerOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderRadius: theme.radius.md,
    },
    pickerOptionSelected: {
      backgroundColor: theme.colors.bg,
    },
    pickerOptionText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    pickerOptionTextSelected: {
      fontWeight: "600",
      color: theme.colors.accent,
    },
  });
}
