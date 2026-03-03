// components/SwipeableLaborEntry.tsx
import React, { useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, Pressable, TextInput } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { LaborEntry, computeLaborEntryTotal } from "@/lib/types";

type SwipeableLaborEntryProps = {
  entry: LaborEntry;
  onDelete: () => void;
  onEdit: () => void;
  onHoursChange?: (hours: number) => void;
  isLastItem: boolean;
};

export const SwipeableLaborEntry = React.memo(
  ({ entry, onDelete, onEdit, onHoursChange, isLastItem }: SwipeableLaborEntryProps) => {
    const { theme, mode } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);
    const isDark = mode === "dark";
    const styles = React.useMemo(
      () => createStyles(theme, isDark),
      [theme, isDark]
    );

    // Inline hours editing state
    const [isEditingHours, setIsEditingHours] = useState(false);
    const [editHoursValue, setEditHoursValue] = useState("");

    const total = computeLaborEntryTotal(entry);
    const isFlat = entry.flatAmount !== undefined && entry.flatAmount > 0;

    const handleStartEditHours = () => {
      if (isFlat || !onHoursChange) return;
      setEditHoursValue("");
      setIsEditingHours(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleFinishEditHours = () => {
      setIsEditingHours(false);
      const parsed = parseFloat(editHoursValue);
      if (!isNaN(parsed) && parsed >= 0 && onHoursChange) {
        onHoursChange(parsed);
      }
      // If invalid/empty, just close without changing
    };

    const handleHoursTextChange = (text: string) => {
      // Allow digits and one decimal point
      const cleaned = text.replace(/[^0-9.]/g, "");
      // Prevent multiple decimal points
      const parts = cleaned.split(".");
      if (parts.length > 2) return;
      setEditHoursValue(cleaned);
    };

    const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>
    ) => {
      const translateX = dragX.interpolate({
        inputRange: [-160, 0],
        outputRange: [0, 160],
        extrapolate: "clamp",
      });

      const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        swipeableRef.current?.close();
        onDelete();
      };

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
        <Pressable
          style={[styles.itemRow, isLastItem && { borderBottomWidth: 0 }]}
          onPress={onEdit}
        >
          <View style={styles.itemInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.itemName}>{entry.name || "Labor"}</Text>
              {entry.role && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{entry.role}</Text>
                </View>
              )}
            </View>
            {isFlat ? (
              <Text style={styles.itemDetail}>Flat rate</Text>
            ) : (
              <Text style={styles.itemRate}>
                ${(entry.rate || 0).toFixed(2)}/hr
              </Text>
            )}
          </View>

          <View style={styles.itemControls}>
            {!isFlat && (
              <View style={styles.hoursContainer}>
                {isEditingHours ? (
                  <TextInput
                    style={styles.hoursInput}
                    value={editHoursValue}
                    onChangeText={handleHoursTextChange}
                    onBlur={handleFinishEditHours}
                    keyboardType="decimal-pad"
                    autoFocus
                    selectTextOnFocus
                    placeholder={(entry.hours || 0).toString()}
                    placeholderTextColor={theme.colors.muted}
                  />
                ) : (
                  <Pressable onPress={handleStartEditHours} hitSlop={8}>
                    <View style={styles.hoursCell}>
                      <Text style={styles.hoursText}>{entry.hours || 0}</Text>
                    </View>
                  </Pressable>
                )}
                <Text style={styles.hrsLabel}>hrs</Text>
              </View>
            )}
            <Text style={styles.itemTotal}>
              $
              {total.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        </Pressable>
      </Swipeable>
    );
  }
);

SwipeableLaborEntry.displayName = "SwipeableLaborEntry";

function createStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  isDark: boolean = false
) {
  return StyleSheet.create({
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    itemInfo: {
      flex: 1,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      marginBottom: 2,
    },
    itemName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    roleBadge: {
      backgroundColor: isDark ? "#2B4B7A" : "#E8F4FF",
      paddingHorizontal: theme.spacing(1),
      paddingVertical: 2,
      borderRadius: theme.radius.sm,
    },
    roleText: {
      fontSize: 11,
      fontWeight: "500",
      color: isDark ? "#8CB4E8" : "#2563EB",
    },
    itemDetail: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    itemRate: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    itemControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
    },
    hoursContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    hoursCell: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minWidth: 48,
      alignItems: "center",
    },
    hoursText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    hoursInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      minWidth: 48,
      textAlign: "center",
    },
    hrsLabel: {
      fontSize: 12,
      color: theme.colors.muted,
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
    editButton: {
      backgroundColor: "#007AFF",
      justifyContent: "center",
      alignItems: "center",
      width: 80,
    },
    deleteButton: {
      backgroundColor: "#FF3B30",
      justifyContent: "center",
      alignItems: "center",
      width: 80,
    },
    actionText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
