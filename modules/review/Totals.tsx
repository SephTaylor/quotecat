// modules/review/Totals.tsx
import { theme } from "@/constants/theme";
import { formatMoney, type CurrencyCode } from "@/modules/settings";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  materialsSubtotal: number;
  labor: number;
  currency?: CurrencyCode; // default 'USD'
  decimals?: number; // default 2
};

/**
 * Totals
 * - Shows Materials, Labor, and Total rows with consistent formatting
 * - Purely presentational
 */
export default function Totals({
  materialsSubtotal,
  labor,
  currency,
  decimals = 2,
}: Props) {
  const total = materialsSubtotal + labor;
  return (
    <View style={styles.container}>
      <Row
        label="Materials"
        value={formatMoney(materialsSubtotal, { currency, decimals })}
      />
      <Row label="Labor" value={formatMoney(labor, { currency, decimals })} />
      <Row
        label="Total"
        value={formatMoney(total, { currency, decimals })}
        bold
      />
    </View>
  );
}

function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(1.5),
    marginTop: theme.spacing(1.5),
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  label: { color: theme.colors.muted, fontSize: 13 },
  value: { color: theme.colors.text, fontSize: 14 },
  bold: { fontWeight: "700", color: theme.colors.text },
});

export { Totals };
