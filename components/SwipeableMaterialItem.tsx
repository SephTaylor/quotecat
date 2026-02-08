// components/SwipeableMaterialItem.tsx
import React, { useRef } from "react";
import { Animated, StyleSheet, Text, View, Pressable, TextInput } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";

type SwipeableMaterialItemProps = {
  item: {
    id: string;
    name: string;
    unitPrice: number;
    qty: number;
    productId?: string; // If no productId, it's a custom item
  };
  onDelete: () => void;
  isLastItem: boolean;
  editingItemId: string | null;
  editingQty: string;
  onStartEditingQty: (itemId: string, qty: number) => void;
  onFinishEditingQty: (itemId: string) => void;
  onQtyChange: (text: string) => void;
  onUpdateQty: (itemId: string, delta: number) => void;
  isNew?: boolean;
  showPricing?: boolean; // Hide pricing for techs without permission
  isCustom?: boolean; // Tinted background for custom items
};

export const SwipeableMaterialItem = React.memo(
  ({
    item,
    onDelete,
    isLastItem,
    editingItemId,
    editingQty,
    onStartEditingQty,
    onFinishEditingQty,
    onQtyChange,
    onUpdateQty,
    isNew = false,
    showPricing = true,
    isCustom,
  }: SwipeableMaterialItemProps) => {
    const { theme, mode } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);
    // Auto-detect custom items: no productId = custom item
    const isCustomItem = isCustom ?? !item.productId;
    const isDark = mode === "dark";
    const styles = React.useMemo(() => createStyles(theme, isCustomItem, isDark), [theme, isCustomItem, isDark]);

    const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const translateX = dragX.interpolate({
        inputRange: [-100, 0],
        outputRange: [0, 100],
        extrapolate: "clamp",
      });

      const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        swipeableRef.current?.close();
        onDelete();
      };

      return (
        <Animated.View
          style={[styles.actionsContainer, { transform: [{ translateX }] }]}
        >
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.actionText}>Delete</Text>
          </Pressable>
        </Animated.View>
      );
    };

    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        friction={2}
        overshootRight={false}
      >
        <View
          style={[
            styles.itemRow,
            isLastItem && { borderBottomWidth: 0 },
          ]}
        >
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            {showPricing && (
              <Text style={styles.itemPrice}>
                ${item.unitPrice.toFixed(2)} each
              </Text>
            )}
          </View>

          <View style={styles.itemControls}>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => onUpdateQty(item.id, -1)}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              {editingItemId === item.id ? (
                <TextInput
                  style={styles.qtyInput}
                  value={editingQty}
                  onChangeText={onQtyChange}
                  onBlur={() => onFinishEditingQty(item.id)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  autoFocus
                />
              ) : (
                <Pressable onPress={() => onStartEditingQty(item.id, item.qty)}>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.stepBtn}
                onPress={() => onUpdateQty(item.id, 1)}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
            {showPricing && (
              <Text style={styles.itemTotal}>
                ${(item.unitPrice * item.qty).toFixed(2)}
              </Text>
            )}
          </View>
        </View>
      </Swipeable>
    );
  },
);

SwipeableMaterialItem.displayName = "SwipeableMaterialItem";

function createStyles(theme: ReturnType<typeof useTheme>["theme"], isCustom: boolean = false, isDark: boolean = false) {
  // Tinted background for custom items (light amber)
  const tintedBg = isDark ? "#3D3020" : "#FFF8E7";
  const rowBg = isCustom ? tintedBg : theme.colors.card;

  return StyleSheet.create({
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: rowBg,
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    itemPrice: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    itemControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
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
      backgroundColor: rowBg,
    },
    qtyText: {
      width: 40,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    itemTotal: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
      minWidth: 70,
      textAlign: "right",
    },
    actionsContainer: {
      flexDirection: "row",
    },
    deleteButton: {
      backgroundColor: "#FF3B30",
      justifyContent: "center",
      alignItems: "center",
      width: 100,
    },
    actionText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
