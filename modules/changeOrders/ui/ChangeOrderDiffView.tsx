// modules/changeOrders/ui/ChangeOrderDiffView.tsx
// Visual diff showing what changed in a change order

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ChangeOrderItem } from "../types";
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

type DiffData = {
  items: ChangeOrderItem[];
  laborBefore: number;
  laborAfter: number;
  laborDelta: number;
  netChange: number;
  quoteTotalBefore: number;
  quoteTotalAfter: number;
};

type Props = {
  diff: DiffData;
  theme: Theme;
  /** Compact mode for modals, full mode for detail screen */
  compact?: boolean;
};

export function ChangeOrderDiffView({ diff, theme, compact = false }: Props) {
  const styles = createStyles(theme, compact);

  const addedItems = diff.items.filter((i) => i.qtyBefore === 0);
  const removedItems = diff.items.filter((i) => i.qtyAfter === 0);
  const modifiedItems = diff.items.filter((i) => i.qtyBefore > 0 && i.qtyAfter > 0);

  const formatMoney = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <View style={styles.container}>
      {/* Added Items */}
      {addedItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="add-circle" size={18} color="#22C55E" />
            <Text style={styles.sectionTitle}>Added ({addedItems.length})</Text>
          </View>
          {addedItems.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemQty}>
                  {item.qtyAfter} {item.unit} @ {formatMoney(item.unitPrice)}
                </Text>
              </View>
              <Text style={[styles.itemDelta, styles.deltaPositive]}>
                {formatNetChange(item.lineDelta)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Removed Items */}
      {removedItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="remove-circle" size={18} color="#EF4444" />
            <Text style={styles.sectionTitle}>Removed ({removedItems.length})</Text>
          </View>
          {removedItems.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, styles.strikethrough]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemQty}>
                  {item.qtyBefore} {item.unit} @ {formatMoney(item.unitPrice)}
                </Text>
              </View>
              <Text style={[styles.itemDelta, styles.deltaNegative]}>
                {formatNetChange(item.lineDelta)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Modified Items */}
      {modifiedItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-horizontal" size={18} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Changed ({modifiedItems.length})</Text>
          </View>
          {modifiedItems.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemQty}>
                  {item.qtyBefore} → {item.qtyAfter} {item.unit}
                </Text>
              </View>
              <Text
                style={[
                  styles.itemDelta,
                  item.lineDelta > 0 ? styles.deltaPositive : styles.deltaNegative,
                ]}
              >
                {formatNetChange(item.lineDelta)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Labor Change */}
      {diff.laborDelta !== 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct" size={18} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Labor</Text>
          </View>
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>Labor Cost</Text>
              <Text style={styles.itemQty}>
                {formatMoney(diff.laborBefore)} → {formatMoney(diff.laborAfter)}
              </Text>
            </View>
            <Text
              style={[
                styles.itemDelta,
                diff.laborDelta > 0 ? styles.deltaPositive : styles.deltaNegative,
              ]}
            >
              {formatNetChange(diff.laborDelta)}
            </Text>
          </View>
        </View>
      )}

      {/* Summary */}
      {!compact && (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Original Total</Text>
            <Text style={styles.summaryValue}>{formatMoney(diff.quoteTotalBefore)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Change</Text>
            <Text
              style={[
                styles.summaryValue,
                diff.netChange > 0 ? styles.deltaPositive : styles.deltaNegative,
              ]}
            >
              {formatNetChange(diff.netChange)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>New Total</Text>
            <Text style={styles.summaryTotalValue}>
              {formatMoney(diff.quoteTotalAfter)}
            </Text>
          </View>
        </View>
      )}

      {/* Empty state */}
      {diff.items.length === 0 && diff.laborDelta === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No changes detected</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: Theme, compact: boolean) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing(compact ? 1.5 : 2),
    },
    section: {
      gap: theme.spacing(1),
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    itemRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.bg,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
    },
    itemInfo: {
      flex: 1,
      marginRight: theme.spacing(2),
    },
    itemName: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.text,
    },
    itemQty: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    itemDelta: {
      fontSize: 14,
      fontWeight: "600",
    },
    deltaPositive: {
      color: "#22C55E",
    },
    deltaNegative: {
      color: "#EF4444",
    },
    strikethrough: {
      textDecorationLine: "line-through",
      color: theme.colors.muted,
    },
    summary: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      marginTop: theme.spacing(1),
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: theme.spacing(1),
    },
    summaryLabel: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.text,
    },
    summaryTotal: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing(1),
      marginTop: theme.spacing(0.5),
      marginBottom: 0,
    },
    summaryTotalLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    summaryTotalValue: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyState: {
      padding: theme.spacing(3),
      alignItems: "center",
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.muted,
    },
  });
}
