// modules/changeOrders/ui/ChangeOrderCard.tsx
// Card component displaying a single change order summary

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ChangeOrder } from "../types";
import { ChangeOrderStatusMeta } from "@/lib/types";
import { formatNetChange } from "../diff";

type Theme = {
  colors: {
    card: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
  };
  spacing: (n: number) => number;
  radius: { md: number };
};

type Props = {
  changeOrder: ChangeOrder;
  theme: Theme;
  onPress?: () => void;
};

export function ChangeOrderCard({ changeOrder, theme, onPress }: Props) {
  const statusMeta = ChangeOrderStatusMeta[changeOrder.status];
  const styles = createStyles(theme);

  const formattedDate = new Date(changeOrder.createdAt).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.coNumber}>CO #{changeOrder.number}</Text>
          <View style={[styles.badge, { backgroundColor: statusMeta.color + "20" }]}>
            <Text style={[styles.badgeText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
      </View>

      {changeOrder.note && (
        <Text style={styles.reason} numberOfLines={2}>
          {changeOrder.note}
        </Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.date}>{formattedDate}</Text>
        <Text
          style={[
            styles.netChange,
            changeOrder.netChange > 0 && styles.netChangePositive,
            changeOrder.netChange < 0 && styles.netChangeNegative,
          ]}
        >
          {formatNetChange(changeOrder.netChange)}
        </Text>
      </View>

      {changeOrder.items.length > 0 && (
        <Text style={styles.itemCount}>
          {changeOrder.items.length} item{changeOrder.items.length !== 1 ? "s" : ""} changed
        </Text>
      )}
    </Pressable>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    cardPressed: {
      opacity: 0.7,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
    },
    coNumber: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    reason: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1.5),
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    date: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    netChange: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    netChangePositive: {
      color: "#22C55E",
    },
    netChangeNegative: {
      color: "#EF4444",
    },
    itemCount: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: theme.spacing(1),
    },
  });
}
