// components/SwipeableQuoteItem.tsx
import React, { useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { Swipeable, TouchableOpacity } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Quote } from "@/lib/types";
import { QuoteStatusMeta } from "@/lib/types";
import { calculateQuoteTotal } from "@/lib/calculations";
import { useTheme } from "@/contexts/ThemeContext";
import { generateAndSharePDF } from "@/lib/pdf";
import { loadPreferences } from "@/lib/preferences";
import { getUserState } from "@/lib/user";
import { getCachedLogo } from "@/lib/logo";

type SwipeableQuoteItemProps = {
  item: Quote;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onLongPress?: () => void;
  onCreateTier?: () => void;
  onExportAllTiers?: () => void;
  onUnlink?: () => void;
  /** Number of change orders for this quote */
  changeOrderCount?: number;
};

export const SwipeableQuoteItem = React.memo(
  ({ item, onEdit, onDelete, onDuplicate, onLongPress, onCreateTier, onExportAllTiers, onUnlink, changeOrderCount }: SwipeableQuoteItemProps) => {
    const { theme } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);
    const [isExporting, setIsExporting] = useState(false);
    const total = calculateQuoteTotal(item);
    const styles = React.useMemo(() => createStyles(theme), [theme]);

    const handleExport = () => {
      const hasLinkedQuotes = item.linkedQuoteIds && item.linkedQuoteIds.length > 0;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      swipeableRef.current?.close();

      if (hasLinkedQuotes && onExportAllTiers) {
        // Show action sheet for linked quotes
        Alert.alert(
          "Export Options",
          "What would you like to export?",
          [
            {
              text: "This Option Only",
              onPress: () => exportSinglePDF(),
            },
            {
              text: "All Options",
              onPress: () => onExportAllTiers(),
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
      } else {
        // No linked quotes, export directly
        exportSinglePDF();
      }
    };

    const exportSinglePDF = async () => {
      try {
        setIsExporting(true);

        // Load user state, preferences, and logo
        const [userState, prefs] = await Promise.all([
          getUserState(),
          loadPreferences(),
        ]);

        // Try to load logo (note: in current implementation, logo requires userId from Supabase auth)
        // For now, logo will be null since auth isn't implemented yet
        let logo = null;
        try {
          logo = await getCachedLogo();
        } catch {
          // Logo loading failed, continue without it
        }

        // Generate and share PDF
        // Strip data URL prefix if present - PDF template adds it back
        const rawBase64 = logo?.base64?.replace(/^data:image\/\w+;base64,/, '');
        await generateAndSharePDF(item, {
          includeBranding: userState.tier === "free",
          companyDetails: prefs.company,
          logoBase64: rawBase64,
        });
      } catch (error) {
        Alert.alert(
          "Export Failed",
          error instanceof Error ? error.message : "Failed to export PDF"
        );
      } finally {
        setIsExporting(false);
      }
    };

    const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const actionCount = 1 + (onDuplicate ? 1 : 0);
      const totalWidth = actionCount * 100;

      const translateX = dragX.interpolate({
        inputRange: [-totalWidth, 0],
        outputRange: [0, totalWidth],
        extrapolate: "clamp",
      });

      const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        swipeableRef.current?.close();
        Alert.alert(
          "Delete Quote",
          `Are you sure you want to delete "${item.name || "Untitled"}"?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: onDelete,
            },
          ]
        );
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
          {onDuplicate && (
            <TouchableOpacity style={styles.duplicateButton} onPress={handleDuplicate}>
              <Text style={styles.actionText}>Duplicate</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    };

    const renderLeftActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      // Calculate width based on available actions (Export + optional Create Tier)
      const actionCount = 1 + (onCreateTier ? 1 : 0);
      const totalWidth = actionCount * 100;

      const translateX = dragX.interpolate({
        inputRange: [0, totalWidth],
        outputRange: [-totalWidth, 0],
        extrapolate: "clamp",
      });

      const handleCreateTier = () => {
        if (onCreateTier) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          swipeableRef.current?.close();
          onCreateTier();
        }
      };

      return (
        <Animated.View
          style={[styles.actionsContainer, { transform: [{ translateX }] }]}
        >
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.actionText}>Export</Text>
            )}
          </TouchableOpacity>
          {onCreateTier && (
            <TouchableOpacity style={styles.tierButton} onPress={handleCreateTier}>
              <Text style={styles.actionText}>Create Tier</Text>
            </TouchableOpacity>
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
        leftThreshold={40}
        rightThreshold={40}
        overshootFriction={8}
      >
        <Pressable
          style={styles.card}
          onPress={onEdit}
          onLongPress={onLongPress}
          delayLongPress={400}
          accessibilityLabel={`Quote: ${item.name || "Untitled"}`}
          accessibilityRole="button"
          accessibilityHint="Double tap to edit. Long press to select. Swipe left for export PDF and duplicate. Swipe right to delete."
        >
          {/* Line 1: Title + Tier + Total */}
          <View style={styles.row1}>
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>{item.name || "Untitled project"}</Text>
              {item.tier && (
                <Text style={styles.tierLabel}>{item.tier}</Text>
              )}
            </View>
            <Text style={styles.total}>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>

          {/* Line 2: Status + Client + Indicators */}
          <View style={styles.row2}>
            <View style={styles.row2Left}>
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
              {item.clientName && (
                <Text style={styles.clientName} numberOfLines={1}>{item.clientName}</Text>
              )}
            </View>
            <View style={styles.row2Right}>
              {item.followUpDate && (
                <Text
                  style={[
                    styles.indicator,
                    {
                      color: new Date(item.followUpDate) <= new Date()
                        ? "#FF3B30"
                        : "#FF9500"
                    },
                  ]}
                >
                  {new Date(item.followUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Text>
              )}
              {changeOrderCount !== undefined && changeOrderCount > 0 && (
                <Text style={[styles.indicator, styles.coIndicator]}>
                  {changeOrderCount} CO
                </Text>
              )}
            </View>
          </View>
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
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    row1: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    titleContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      marginRight: theme.spacing(2),
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      flexShrink: 1,
    },
    tierLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    total: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    row2: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    row2Left: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      flex: 1,
    },
    row2Right: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#FFFFFF",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    clientName: {
      fontSize: 13,
      color: theme.colors.muted,
      flex: 1,
    },
    indicator: {
      fontSize: 12,
      fontWeight: "600",
    },
    coIndicator: {
      color: "#8B5CF6",
    },
    actionsContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    actionButton: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: theme.radius.lg,
    },
    deleteButton: {
      backgroundColor: "#FF3B30",
      width: 100,
      paddingVertical: 16,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: theme.radius.lg,
    },
    exportButton: {
      backgroundColor: "#34C759",
      width: 100,
      paddingVertical: 16,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: theme.radius.lg,
    },
    duplicateButton: {
      backgroundColor: theme.colors.accent,
      width: 100,
      paddingVertical: 16,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: theme.radius.lg,
    },
    tierButton: {
      backgroundColor: "#5856D6",
      width: 100,
      paddingVertical: 16,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: theme.radius.lg,
    },
    actionText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
