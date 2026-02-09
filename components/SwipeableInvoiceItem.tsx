// components/SwipeableInvoiceItem.tsx
import React, { useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Invoice } from "@/lib/types";
import { InvoiceStatusMeta } from "@/lib/types";
import { calculateInvoiceTotal } from "@/lib/calculations";
import { useTheme } from "@/contexts/ThemeContext";

type SwipeableInvoiceItemProps = {
  item: Invoice;
  onPress: () => void;
  onDelete: () => void;
  onExport: () => void;
  onUpdateStatus: () => void;
  onCopy: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
};

export const SwipeableInvoiceItem = React.memo(
  ({ item, onPress, onDelete, onExport, onUpdateStatus, onCopy, onLongPress, disabled }: SwipeableInvoiceItemProps) => {
    const { theme } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);
    const [isExporting, setIsExporting] = useState(false);
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const statusMeta = InvoiceStatusMeta[item.status];

    // Use centralized calculation (includes markup, tax, and percentage)
    const total = React.useMemo(() => calculateInvoiceTotal(item), [item]);

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
      onUpdateStatus();
    };

    const handleCopy = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      swipeableRef.current?.close();
      onCopy();
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
          <Pressable style={styles.copyButton} onPress={handleCopy}>
            <Text style={styles.actionText}>Copy</Text>
          </Pressable>
        </Animated.View>
      );
    };

    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={disabled ? undefined : renderRightActions}
        renderLeftActions={disabled ? undefined : renderLeftActions}
        friction={2}
        overshootRight={false}
        overshootLeft={false}
        enabled={!disabled}
      >
        <Pressable
          style={styles.card}
          onPress={onPress}
          onLongPress={onLongPress}
          accessibilityLabel={`Invoice: ${item.invoiceNumber}`}
          accessibilityRole="button"
          accessibilityHint="Double tap to view. Swipe left for export and copy. Swipe right to delete."
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{item.name || "Untitled"}</Text>
            </View>
            {item.isPartialInvoice && (
              <View style={styles.partialBadge}>
                <Text style={styles.partialBadgeText}>{item.percentage}%</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <Pressable
              style={[styles.statusBadge, { backgroundColor: statusMeta.color }]}
              onPress={handleStatusUpdate}
            >
              <Text style={styles.statusText}>
                {statusMeta.label}
              </Text>
            </Pressable>
            <Text style={styles.sub}>
              {item.clientName ? `Client: ${item.clientName}  •  ` : ""}
              {item.invoiceNumber}
            </Text>
          </View>

          <Text style={styles.footer}>
            Due {formattedDueDate}  •  ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
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
      borderRadius: theme.radius.lg,
      padding: theme.spacing(1),
      marginBottom: theme.spacing(1),
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
      gap: theme.spacing(1),
      flexWrap: "wrap",
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    partialBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.colors.accent,
      opacity: 0.9,
      marginLeft: 8,
    },
    partialBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#000",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
      gap: theme.spacing(1),
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
    footer: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    actionsContainer: {
      flexDirection: "row",
      marginBottom: theme.spacing(1),
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
    copyButton: {
      backgroundColor: "#007AFF", // Blue for copy action
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
