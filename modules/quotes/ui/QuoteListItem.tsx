import { formatMoney } from '@/modules/settings/money';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type QuoteItem = { qty: number; unitPrice: number };
type Quote = { id: string; name: string; items: QuoteItem[]; labor: number };

type Props = { quote: Quote };

export default function QuoteListItem({ quote }: Props) {
  const material = quote.items.reduce((s, it) => s + (it.qty || 0) * (it.unitPrice || 0), 0);
  const total = material + (quote.labor || 0);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/quote/${quote.id}/edit`)}>
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
