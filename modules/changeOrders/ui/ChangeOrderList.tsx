// modules/changeOrders/ui/ChangeOrderList.tsx
// List component for displaying change orders on a quote

import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import type { ChangeOrder } from "../types";
import { useChangeOrders } from "../hooks";
import { ChangeOrderCard } from "./ChangeOrderCard";
import { formatNetChange } from "../diff";

type Theme = {
  colors: {
    card: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    bg: string;
  };
  spacing: (n: number) => number;
  radius: { md: number };
};

type Props = {
  quoteId: string;
  theme: Theme;
  /** Show only this many COs, with "View All" link */
  limit?: number;
  /** Called when user wants to create a new CO */
  onCreateNew?: () => void;
  /** Quote status. When 'approved' or 'completed' and there are no COs,
   *  we render an empty state so the feature is discoverable — otherwise
   *  it disappears entirely and Pro users can't find what they paid for.
   *  Draft/sent quotes still render nothing here (COs are meaningless
   *  before approval). */
  quoteStatus?: string;
};

export function ChangeOrderList({ quoteId, theme, limit, onCreateNew, quoteStatus }: Props) {
  const router = useRouter();
  const { changeOrders, loading, netChange, refresh } = useChangeOrders(quoteId);
  const styles = createStyles(theme);

  // Refresh when screen comes into focus (e.g., returning from CO detail screen)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const displayCOs = limit ? changeOrders.slice(0, limit) : changeOrders;
  const hasMore = limit && changeOrders.length > limit;
  const canHaveChangeOrders =
    quoteStatus === "approved" || quoteStatus === "completed";

  const handleViewCO = (co: ChangeOrder) => {
    router.push(`/(main)/change-order/${co.id}?quoteId=${quoteId}` as never);
  };

  const handleViewAll = () => {
    router.push(`/(main)/change-orders/${quoteId}` as never);
  };

  const handleAddChange = () => {
    if (onCreateNew) {
      onCreateNew();
      return;
    }
    // Fall-through to the edit screen so the current auto-detect flow
    // still works. The manual "+ New CO from scratch" flow is planned
    // per the Billing Workflow (v2) plan Mike approved but not built yet.
    router.push(`/quote/${quoteId}/edit` as never);
  };

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Orders</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  // Draft / sent / declined quotes don't render this section at all —
  // change orders only make sense once the quote is approved. On approved
  // quotes with zero COs we render an explicit empty state so Pro users
  // can discover the feature. Previously we returned null unconditionally,
  // which made the whole feature invisible on first use.
  if (changeOrders.length === 0) {
    if (!canHaveChangeOrders) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Orders</Text>
        <View style={styles.emptyCard}>
          <Ionicons name="git-branch-outline" size={28} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No change orders yet</Text>
          <Text style={styles.emptySubtext}>
            When you edit this approved quote, changes to materials, labor, or
            scope will be tracked here as change orders you can send for
            re-approval.
          </Text>
          <Pressable style={styles.emptyPrimaryBtn} onPress={handleAddChange}>
            <Ionicons name="create-outline" size={16} color="#000" />
            <Text style={styles.emptyPrimaryText}>Edit quote to add a change</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Change Orders</Text>
        <Text
          style={[
            styles.netTotal,
            netChange > 0 && styles.netPositive,
            netChange < 0 && styles.netNegative,
          ]}
        >
          Net: {formatNetChange(netChange)}
        </Text>
      </View>

      <View style={styles.list}>
        {displayCOs.map((co) => (
          <ChangeOrderCard
            key={co.id}
            changeOrder={co}
            theme={theme}
            onPress={() => handleViewCO(co)}
          />
        ))}
      </View>

      {hasMore && (
        <Pressable style={styles.viewAllButton} onPress={handleViewAll}>
          <Text style={styles.viewAllText}>
            View all {changeOrders.length} change orders
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.accent} />
        </Pressable>
      )}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      marginBottom: theme.spacing(3),
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    netTotal: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    netPositive: {
      color: "#22C55E",
    },
    netNegative: {
      color: "#EF4444",
    },
    list: {
      gap: theme.spacing(1.5),
    },
    loadingContainer: {
      padding: theme.spacing(4),
      alignItems: "center",
    },
    emptyCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(3),
      alignItems: "center",
    },
    emptyText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
      marginTop: theme.spacing(1),
    },
    emptySubtext: {
      fontSize: 13,
      color: theme.colors.muted,
      marginTop: theme.spacing(0.5),
      textAlign: "center",
      lineHeight: 18,
      maxWidth: 340,
    },
    emptyPrimaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.25),
      borderRadius: theme.radius.md,
      marginTop: theme.spacing(2),
    },
    emptyPrimaryText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
    viewAllButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: theme.spacing(1.5),
      marginTop: theme.spacing(1),
    },
    viewAllText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.accent,
    },
  });
}
