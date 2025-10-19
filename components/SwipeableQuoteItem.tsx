// components/SwipeableQuoteItem.tsx
import React, { useRef } from "react";
import { Animated, StyleSheet, Text, View, Pressable } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Quote } from "@/lib/types";
import { calculateTotal } from "@/lib/validation";
import { theme } from "@/constants/theme";

type SwipeableQuoteItemProps = {
  item: Quote;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin?: () => void;
};

export const SwipeableQuoteItem = React.memo(
  ({ item, onEdit, onDelete, onTogglePin }: SwipeableQuoteItemProps) => {
    const swipeableRef = useRef<Swipeable>(null);
    const total = calculateTotal(item);

    const handlePinToggle = () => {
      if (onTogglePin) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTogglePin();
      }
    };

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

    const renderLeftActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const translateX = dragX.interpolate({
        inputRange: [0, 100],
        outputRange: [-100, 0],
        extrapolate: "clamp",
      });

      const handleEdit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        swipeableRef.current?.close();
        onEdit();
      };

      return (
        <Animated.View
          style={[styles.actionsContainer, { transform: [{ translateX }] }]}
        >
          <Pressable style={styles.editButton} onPress={handleEdit}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
        </Animated.View>
      );
    };

    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
        friction={2}
        overshootRight={false}
        overshootLeft={false}
      >
        <Pressable style={styles.card} onPress={onEdit}>
          <View style={styles.header}>
            <Text style={styles.title}>{item.name || "Untitled project"}</Text>
            {onTogglePin && (
              <Pressable
                style={styles.pinButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handlePinToggle();
                }}
              >
                <Text style={styles.pinIcon}>{item.pinned ? "⭐" : "☆"}</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.sub}>
            {item.clientName ? `Client: ${item.clientName}  •  ` : ""}
            Labor: {item.labor.toFixed(2)}
          </Text>
          <Text style={styles.total}>
            Total: {total.toFixed(2)} {item.currency}
          </Text>
        </Pressable>
      </Swipeable>
    );
  },
);

SwipeableQuoteItem.displayName = "SwipeableQuoteItem";

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    flex: 1,
  },
  pinButton: {
    padding: 4,
    marginLeft: 8,
  },
  pinIcon: {
    fontSize: 20,
  },
  sub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: 8,
  },
  total: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },
  actionsContainer: {
    flexDirection: "row",
    marginBottom: theme.spacing(2),
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 100,
    borderRadius: theme.radius.lg,
  },
  editButton: {
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    width: 100,
    borderRadius: theme.radius.lg,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
