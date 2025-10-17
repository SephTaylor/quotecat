import { formatMoney } from '@/modules/settings/money';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type QuoteItem = { qty: number; unitPrice: number };
type Quote = { id: string; name: string; items: QuoteItem[]; labor: number };

type Props = {
  quote: Quote;
  /** Optional: override tap behavior */
  onPress?: (quote: Quote) => void;
  /** Optional: override long-press behavior (e.g., delete) */
  onLongPress?: (quote: Quote) => void;
};

export default function QuoteListItem({ quote, onPress, onLongPress }: Props) {
  const material = quote.items.reduce(
    (s, it) => s + (it.qty || 0) * (it.unitPrice || 0),
    0
  );
  const total = material + (quote.labor || 0);

  const handlePress = () => {
    if (onPress) return onPress(quote);
    router.push(`/quote/${quote.id}/edit`);
  };

  const handleLongPress = () => {
    if (onLongPress) return onLongPress(quote);
    // default: no-op; caller can pass a handler to show a menu/delete, etc.
  };

  return (
    <Pressable
      style={styles.card}
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={`Open quote ${quote.name || 'Untitled'}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{quote.name || 'Untitled quote'}</Text>
        <Text style={styles.sub}>{quote.items.length} items</Text>
      </View>
      <Text style={styles.total}>{formatMoney(total)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    backgroundColor: 'white',
    gap: 8
  },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { color: '#666' },
  total: { fontWeight: '700' }
});
