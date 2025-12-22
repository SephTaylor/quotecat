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
};

export function ChangeOrderList({ quoteId, theme, limit, onCreateNew }: Props) {
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

  const handleViewCO = (co: ChangeOrder) => {
    router.push(`/(main)/change-order/${co.id}?quoteId=${quoteId}` as never);
  };

  const handleViewAll = () => {
    router.push(`/(main)/change-orders/${quoteId}` as never);
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

  if (changeOrders.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Orders</Text>
        <View style={styles.emptyCard}>
          <Ionicons name="document-text-outline" size={32} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No change orders yet</Text>
          <Text style={styles.emptySubtext}>
            Edit this quote to create a change order
          </Text>
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
      padding: theme.spacing(4),
      alignItems: "center",
    },
    emptyText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
      marginTop: theme.spacing(1.5),
    },
    emptySubtext: {
      fontSize: 13,
      color: theme.colors.muted,
      marginTop: theme.spacing(0.5),
      textAlign: "center",
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
