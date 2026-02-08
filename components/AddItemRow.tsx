// components/AddItemRow.tsx
// Spreadsheet-style row for adding custom line items
// Matches SwipeableMaterialItem layout with editable fields

import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import {
  searchCustomLineItems,
  upsertCustomLineItem,
} from "@/lib/customLineItems";
import type { CustomLineItem } from "@/lib/types";

type AddItemRowProps = {
  onAddItem: (name: string, qty: number, price: number) => void;
  isLastItem?: boolean;
  onDelete?: () => void; // Optional - shows X button to remove this blank row
};

export const AddItemRow = React.memo(({ onAddItem, isLastItem = true, onDelete }: AddItemRowProps) => {
  const { theme, mode } = useTheme();
  const isDark = mode === "dark";
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  // Input state
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<CustomLineItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Refs
  const nameInputRef = useRef<TextInput>(null);
  const priceInputRef = useRef<TextInput>(null);
  const hasSubmittedRef = useRef(false);

  // Search for suggestions when name changes
  useEffect(() => {
    if (name.length >= 2) {
      const results = searchCustomLineItems(name, 5);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [name]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = (item: CustomLineItem) => {
    setName(item.name);
    setPrice(item.defaultPrice.toFixed(2));
    setSuggestions([]);
    setShowSuggestions(false);
    // Focus price field so user can adjust if needed
    priceInputRef.current?.focus();
  };

  // Handle adding the item
  const handleSubmit = () => {
    // Prevent double submission
    if (hasSubmittedRef.current) return;

    const trimmedName = name.trim();
    const parsedQty = parseInt(qty, 10) || 1;
    const parsedPrice = parseFloat(price) || 0;

    // Need at least a name to add
    if (trimmedName.length === 0) {
      return;
    }

    // Mark as submitted to prevent duplicates
    hasSubmittedRef.current = true;

    // Add the item to the quote
    onAddItem(trimmedName, parsedQty, parsedPrice);

    // Save to custom line items for autocomplete
    upsertCustomLineItem(trimmedName, parsedPrice);
  };

  // Handle blur - auto-save if name is filled
  const handleNameBlur = () => {
    // Small delay to allow suggestion tap to register
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  // Handle row blur - auto-save when user taps off the row
  const handleRowBlur = () => {
    // Small delay to ensure we don't save while user is still interacting with row
    setTimeout(() => {
      if (name.trim().length > 0) {
        handleSubmit();
      }
    }, 300);
  };

  // Handle qty stepper
  const handleQtyDelta = (delta: number) => {
    const current = parseInt(qty, 10) || 1;
    const newQty = Math.max(1, current + delta);
    setQty(newQty.toString());
  };

  // Format price on blur and auto-save
  const handlePriceBlur = () => {
    const parsed = parseFloat(price);
    if (!isNaN(parsed)) {
      setPrice(parsed.toFixed(2));
    }
    // Auto-save when user taps off the price field
    handleRowBlur();
  };

  // Calculate line total
  const parsedQty = parseInt(qty, 10) || 1;
  const parsedPrice = parseFloat(price) || 0;
  const lineTotal = (parsedQty * parsedPrice).toFixed(2);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.itemRow,
          isLastItem && { borderBottomWidth: 0 },
        ]}
      >
        <View style={styles.itemInfo}>
          <TextInput
            ref={nameInputRef}
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            onBlur={handleNameBlur}
            placeholder="Tap to add custom item"
            placeholderTextColor={theme.colors.muted}
            returnKeyType="next"
            onSubmitEditing={() => priceInputRef.current?.focus()}
          />
          <View style={styles.priceRow}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              ref={priceInputRef}
              style={styles.priceInput}
              value={price}
              onChangeText={(text) => {
                // Only allow numbers and one decimal point
                const cleaned = text.replace(/[^0-9.]/g, "");
                // Prevent multiple decimal points
                const parts = cleaned.split(".");
                if (parts.length > 2) {
                  setPrice(parts[0] + "." + parts.slice(1).join(""));
                } else {
                  setPrice(cleaned);
                }
              }}
              onBlur={handlePriceBlur}
              placeholder="price"
              placeholderTextColor={theme.colors.muted}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                // Auto-save when user presses Done
                handleRowBlur();
              }}
            />
            <Text style={styles.eachText}> each</Text>
          </View>
        </View>

        <View style={styles.itemControls}>
          {onDelete && (
            <Pressable
              onPress={onDelete}
              style={styles.deleteBtn}
              hitSlop={4}
            >
              <Ionicons name="close-circle" size={22} color="#FF3B30" />
            </Pressable>
          )}
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => handleQtyDelta(-1)}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <TextInput
              style={styles.qtyInput}
              value={qty}
              onChangeText={(text) => {
                // Only allow numbers
                const cleaned = text.replace(/[^0-9]/g, "");
                setQty(cleaned || "1");
              }}
              keyboardType="number-pad"
              selectTextOnFocus
            />
            <Pressable
              style={styles.stepBtn}
              onPress={() => handleQtyDelta(1)}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.itemTotal}>${lineTotal}</Text>
        </View>
      </View>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((item) => (
            <Pressable
              key={item.id}
              style={styles.suggestionItem}
              onPress={() => handleSelectSuggestion(item)}
            >
              <Text style={styles.suggestionName}>{item.name}</Text>
              <Text style={styles.suggestionPrice}>
                ${item.defaultPrice.toFixed(2)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
});

AddItemRow.displayName = "AddItemRow";

function createStyles(theme: ReturnType<typeof useTheme>["theme"], isDark: boolean) {
  // Tinted background color for custom items (light amber)
  const tintedBg = isDark ? "#3D3020" : "#FFF8E7";

  return StyleSheet.create({
    container: {
      position: "relative",
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: tintedBg,
    },
    itemInfo: {
      flex: 1,
    },
    nameInput: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    dollarSign: {
      fontSize: 12,
      color: theme.colors.text,
      marginRight: 2,
    },
    priceInput: {
      fontSize: 12,
      color: theme.colors.text,
      minWidth: 50,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    },
    eachText: {
      fontSize: 12,
      color: theme.colors.muted,
      marginLeft: 4,
    },
    itemControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
    },
    deleteBtn: {
      padding: 4,
    },
    addBtn: {
      padding: 2,
      minWidth: 70,
      alignItems: "flex-end",
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      overflow: "hidden",
    },
    stepBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.bg,
    },
    stepText: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    qtyInput: {
      width: 40,
      height: 32,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      backgroundColor: tintedBg,
    },
    itemTotal: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
      minWidth: 70,
      textAlign: "right",
    },
    // Autocomplete styles
    suggestionsContainer: {
      position: "absolute",
      top: "100%",
      left: theme.spacing(2),
      right: theme.spacing(2),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
      zIndex: 1000,
    },
    suggestionItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    suggestionName: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
    },
    suggestionPrice: {
      fontSize: 12,
      color: theme.colors.muted,
      marginLeft: theme.spacing(1),
    },
  });
}
