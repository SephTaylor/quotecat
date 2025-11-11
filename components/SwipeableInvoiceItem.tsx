// components/SwipeableInvoiceItem.tsx
import React, { useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Invoice } from "@/lib/types";
import { InvoiceStatusMeta } from "@/lib/types";
import { useTheme } from "@/contexts/ThemeContext";

type SwipeableInvoiceItemProps = {
  item: Invoice;
  onPress: () => void;
  onDelete: () => void;
  onExport: () => void;
  onUpdateStatus: () => void;
};

export const SwipeableInvoiceItem = React.memo(
  ({ item, onPress, onDelete, onExport, onUpdateStatus }: SwipeableInvoiceItemProps) => {
    const { theme } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);
    const [isExporting, setIsExporting] = useState(false);
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const statusMeta = InvoiceStatusMeta[item.status];

    // Calculate total (memoized to prevent recalculation on every render)
    const total = React.useMemo(() => {
      const itemsTotal = item.items.reduce(
        (sum, lineItem) => sum + lineItem.unitPrice * lineItem.qty,
        0,
      );
      const subtotal = itemsTotal + item.labor + (item.materialEstimate || 0) + (item.overhead || 0);
      const markup = item.markupPercent ? subtotal * (item.markupPercent / 100) : 0;
      return subtotal + markup;
    }, [item.items, item.labor, item.materialEstimate, item.overhead, item.markupPercent]);

    // Format due date
    const dueDate = new Date(item.dueDate);
    const formattedDueDate = dueDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const handleExportPDF = async () => {
      try {
        setIsExporting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        swipeableRef.current?.close();
        await onExport();
      } catch (error) {
        Alert.alert(
          "Export Failed",
          error instanceof Error ? error.message : "Failed to export PDF"
        );
      } finally {
        setIsExporting(false);
      }
    };

    const handleStatusUpdate = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      swipeableRef.current?.close();
      onUpdateStatus();
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

    const renderLeftActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const translateX = dragX.interpolate({
        inputRange: [0, 200],
        outputRange: [-200, 0],
        extrapolate: "clamp",
      });

      return (
        <Animated.View
          style={[styles.actionsContainer, { transform: [{ translateX }] }]}
        >
          <Pressable
            style={styles.exportButton}
            onPress={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.actionText}>Export</Text>
            )}
          </Pressable>
          <Pressable style={styles.statusButton} onPress={handleStatusUpdate}>
            <Text style={styles.actionText}>Status</Text>
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
        <Pressable
          style={styles.card}
          onPress={onPress}
          accessibilityLabel={`Invoice: ${item.invoiceNumber}`}
          accessibilityRole="button"
          accessibilityHint="Double tap to view. Swipe left for export and status. Swipe right to delete."
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
              {item.isPartialInvoice && (
                <View style={styles.partialBadge}>
                  <Text style={styles.partialBadgeText}>{item.percentage}%</Text>
                </View>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}20` }]}>
              <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          <Text style={styles.invoiceName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.clientName && (
            <Text style={styles.clientName} numberOfLines={1}>
              {item.clientName}
            </Text>
          )}

          <View style={styles.cardFooter}>
            <Text style={styles.dueDate}>Due {formattedDueDate}</Text>
            <Text style={styles.total}>${total.toFixed(2)}</Text>
          </View>
        </Pressable>
      </Swipeable>
    );
  },
);

SwipeableInvoiceItem.displayName = "SwipeableInvoiceItem";

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    invoiceNumber: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    partialBadge: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(0.75),
      paddingVertical: 2,
      borderRadius: theme.radius.sm,
    },
    partialBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#000",
    },
    statusBadge: {
      paddingHorizontal: theme.spacing(1),
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: "700",
    },
    invoiceName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    clientName: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1),
    },
    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: theme.spacing(1),
      paddingTop: theme.spacing(1),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    dueDate: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    total: {
      fontSize: 18,
      fontWeight: "700",
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
    exportButton: {
      backgroundColor: "#34C759", // Green for export action
      justifyContent: "center",
      alignItems: "center",
      width: 100,
      borderRadius: theme.radius.lg,
    },
    statusButton: {
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
