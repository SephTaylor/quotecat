import { theme } from '@/constants/theme';
import type { Quote } from '@/lib/quotes';
import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

type Props = {
  quote: Quote;
  style?: ViewStyle;
  onPress?: () => void;
  onLongPress?: () => void;
};

/**
 * Presentational card for a Quote.
 * - Default export stays `QuoteListItem`
 * - We also export a *named alias* `QuoteCard` for barrels/call sites
 *   to avoid eslint-plugin-import's no-named-as-default warning.
 */
export default function QuoteListItem({ quote, style, onPress, onLongPress }: Props) {
  return (
    <Pressable style={[styles.card, style]} onPress={onPress} onLongPress={onLongPress}>
      <Text style={styles.title}>{quote.name || 'Untitled project'}</Text>
      <Text style={styles.sub}>
        {quote.clientName ? `Client: ${quote.clientName}  •  ` : ''}
        Labor: {quote.labor.toFixed(2)}
      </Text>
      <Text style={styles.total}>
        Total: {quote.total.toFixed(2)} {quote.currency}
      </Text>
    </Pressable>
  );
}

// 👇 named alias used by the barrel
export { QuoteListItem as QuoteCard };

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  sub: { fontSize: 12, color: theme.colors.muted, marginBottom: 8 },
  total: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
});
