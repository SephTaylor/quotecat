// components/SwipeableQuoteItem.tsx
import React, { useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Quote } from "@/lib/types";
import { QuoteStatusMeta } from "@/lib/types";
import { calculateTotal } from "@/lib/validation";
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
  onTogglePin?: () => void;
  onLongPress?: () => void;
};

export const SwipeableQuoteItem = React.memo(
  ({ item, onEdit, onDelete, onDuplicate, onTogglePin, onLongPress }: SwipeableQuoteItemProps) => {
    const { theme } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);
    const [isExporting, setIsExporting] = useState(false);
    const total = calculateTotal(item);
    const styles = React.useMemo(() => createStyles(theme), [theme]);

    const handlePinToggle = () => {
      if (onTogglePin) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTogglePin();
      }
    };

    const handleExportPDF = async () => {
      try {
        setIsExporting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        swipeableRef.current?.close();

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
        await generateAndSharePDF(item, {
          includeBranding: userState.tier === "free",
          companyDetails: prefs.company,
          logoBase64: logo?.base64,
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
          <Pressable
            style={styles.exportButton}
            onPress={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.actionText}>Export PDF</Text>
            )}
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
        <Pressable
          style={styles.card}
          onPress={onEdit}
          onLongPress={onLongPress}
          delayLongPress={400}
          accessibilityLabel={`Quote: ${item.name || "Untitled"}`}
          accessibilityRole="button"
          accessibilityHint="Double tap to edit. Long press to select. Swipe left for export PDF and duplicate. Swipe right to delete."
        >
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
            {item.followUpDate && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: new Date(item.followUpDate) <= new Date()
                      ? "#FF3B30" // Red if due/overdue
                      : "#FF8C00" // Orange if upcoming
                  },
                ]}
              >
                <Text style={styles.statusText}>
                  Follow-up {new Date(item.followUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Text>
              </View>
            )}
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
    total: {
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
