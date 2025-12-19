// components/SwipeableContractItem.tsx
import React, { useRef } from "react";
import { Animated, StyleSheet, Text, View, Pressable } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Contract } from "@/lib/types";
import { ContractStatusMeta } from "@/lib/types";
import { useTheme } from "@/contexts/ThemeContext";

type SwipeableContractItemProps = {
  item: Contract;
  onPress: () => void;
  onDelete: () => void;
};

export const SwipeableContractItem = React.memo(
  ({ item, onPress, onDelete }: SwipeableContractItemProps) => {
    const { theme } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const statusMeta = ContractStatusMeta[item.status];

    const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const translateX = dragX.interpolate({
        inputRange: [-100, 0],
        outputRange: [0, 100],
        extrapolate: "clamp",
      });

      const handleDeletePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        swipeableRef.current?.close();
        onDelete();
      };

      return (
        <Animated.View
          style={[styles.actionsContainer, { transform: [{ translateX }] }]}
        >
          <Pressable style={styles.deleteButton} onPress={handleDeletePress}>
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
        <Pressable
          style={styles.card}
          onPress={onPress}
          accessibilityLabel={`Contract: ${item.contractNumber}`}
          accessibilityRole="button"
          accessibilityHint="Double tap to view. Swipe left to delete."
        >
          <View style={styles.header}>
            <Text style={styles.contractNumber}>{item.contractNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
              <Text style={[styles.statusText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          <Text style={styles.projectName} numberOfLines={1}>
            {item.projectName || "Untitled"}
          </Text>
          <Text style={styles.clientName} numberOfLines={1}>
            {item.clientName || "No client"}
          </Text>

          <View style={styles.footer}>
            <Text style={styles.totalAmount}>${item.total.toFixed(2)}</Text>
            <Text style={styles.dateText}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </Pressable>
      </Swipeable>
    );
  },
);

SwipeableContractItem.displayName = "SwipeableContractItem";

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
      marginBottom: theme.spacing(1),
    },
    contractNumber: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing(1),
      paddingVertical: 4,
      borderRadius: 9999,
      gap: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
    },
    projectName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 2,
    },
    clientName: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1.5),
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: theme.spacing(1.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    totalAmount: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    dateText: {
      fontSize: 12,
      color: theme.colors.muted,
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
    actionText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
