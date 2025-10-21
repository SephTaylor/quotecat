// components/SwipeableQuoteItem.tsx
import React, { useRef } from "react";
import { Animated, StyleSheet, Text, View, Pressable } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Quote } from "@/lib/types";
import { QuoteStatusMeta } from "@/lib/types";
import { calculateTotal } from "@/lib/validation";
import { useTheme } from "@/contexts/ThemeContext";

type SwipeableQuoteItemProps = {
  item: Quote;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onTogglePin?: () => void;
};

export const SwipeableQuoteItem = React.memo(
  ({ item, onEdit, onDelete, onDuplicate, onTogglePin }: SwipeableQuoteItemProps) => {
    const { theme } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);
    const total = calculateTotal(item);
    const styles = React.useMemo(() => createStyles(theme), [theme]);

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
        inputRange: [0, onDuplicate ? 200 : 100],
        outputRange: [onDuplicate ? -200 : -100, 0],
        extrapolate: "clamp",
      });

      const handleEdit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        swipeableRef.current?.close();
        onEdit();
      };

      const handleDuplicate = () => {
        if (onDuplicate) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          swipeableRef.current?.close();
          onDuplicate();
        }
      };

      return (
        <Animated.View
          style={[styles.actionsContainer, { transform: [{ translateX }] }]}
        >
          <Pressable style={styles.editButton} onPress={handleEdit}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          {onDuplicate && (
            <Pressable style={styles.duplicateButton} onPress={handleDuplicate}>
              <Text style={styles.actionText}>Duplicate</Text>
            </Pressable>
          )}
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
            <View style={styles.titleRow}>
              <Text style={styles.title}>{item.name || "Untitled project"}</Text>
              {item.tier && (
                <View style={styles.tierBadge}>
                  <Text style={styles.tierText}>{item.tier}</Text>
                </View>
              )}
            </View>
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
          <View style={styles.metaRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: QuoteStatusMeta[item.status || "draft"].color },
              ]}
            >
              <Text style={styles.statusText}>
                {QuoteStatusMeta[item.status || "draft"].label}
              </Text>
            </View>
            <Text style={styles.sub}>
              {item.clientName ? `Client: ${item.clientName}  •  ` : ""}
              Labor: {item.labor.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.total}>
            Total: {total.toFixed(2)} {item.currency}
          </Text>
        </Pressable>
      </Swipeable>
    );
  },
);

SwipeableQuoteItem.displayName = "SwipeableQuoteItem";

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
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
    titleRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    tierBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.colors.accent,
      opacity: 0.9,
    },
    tierText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#000",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    pinButton: {
      padding: 4,
      marginLeft: 8,
    },
    pinIcon: {
      fontSize: 20,
      color: theme.colors.accent,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
      gap: 8,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      alignSelf: "flex-start",
    },
    statusText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#FFFFFF",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    sub: {
      fontSize: 12,
      color: theme.colors.muted,
      flex: 1,
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
    duplicateButton: {
      backgroundColor: theme.colors.accent,
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
}
