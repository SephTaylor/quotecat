// modules/review/LineItemRow.tsx
import { theme } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/modules/settings';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  name: string;
  quantity: number;
  unitPrice: number;
  currency?: CurrencyCode;   // default USD via formatter
  decimals?: number;         // default 2
  mutedNote?: string;        // optional right-aligned note (e.g., unit)
};

/**
 * LineItemRow
 * - Shows: Name   qty × unit = subtotal
 * - Purely presentational; money formatting centralized
 */
export default function LineItemRow({
  name,
  quantity,
  unitPrice,
  currency,
  decimals = 2,
  mutedNote,
}: Props) {
  const subtotal = quantity * unitPrice;
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {quantity} × {formatMoney(unitPrice, { currency, decimals })}
        </Text>
      </View>
      <View style={styles.right}>
        {mutedNote ? <Text style={styles.note}>{mutedNote}</Text> : null}
        <Text style={styles.value}>
          {formatMoney(subtotal, { currency, decimals })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  left: { flexShrink: 1, paddingRight: theme.spacing(2) },
  right: { alignItems: 'flex-end' },
  name: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  note: { color: theme.colors.muted, fontSize: 12, marginBottom: 2 },
  value: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
});

export { LineItemRow };

