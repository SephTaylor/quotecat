// modules/quotes/ui/QuoteItemRow.tsx
import { theme } from "@/constants/theme";
import { formatMoney } from "@/modules/settings/money";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type QuoteItemLike = {
  id?: string;
  name: string;
  qty: number;
  unitPrice: number;
};

type QuoteItemRowProps = {
  item: QuoteItemLike;
};

/**
 * Displays a single quote item row with name, quantity, price, and line total.
 * Used in review screens and quote displays.
 */
export default function QuoteItemRow({ item }: QuoteItemRowProps) {
  const lineTotal = (item.unitPrice || 0) * (item.qty || 0);

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemMeta}>
          {item.qty} × {formatMoney(item.unitPrice)}
        </Text>
      </View>
      <Text style={styles.itemTotal}>{formatMoney(lineTotal)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowLeft: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "500", color: theme.colors.text },
  itemMeta: { color: theme.colors.muted, marginTop: 2 },
  itemTotal: { fontWeight: "600", color: theme.colors.text },
});

// Named export for barrel
export { QuoteItemRow };
