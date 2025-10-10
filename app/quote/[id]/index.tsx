// app/quote/[id]/index.tsx
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
// RIGHT (three dots)
import { getQuoteById, Quote } from '../../../lib/quotes';


export default function QuoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!id) return;
      const q = await getQuoteById(String(id));
      if (!ignore) {
        setQuote(q || null);
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={s.center}>
        <Text>Quote not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Stack.Screen options={{ title: `Quote ${quote.id}` }} />
      <Text style={s.h1}>{quote.clientName}</Text>
      <Text style={s.h2}>{quote.projectName}</Text>

      <View style={s.card}>
        <Text style={s.label}>Total</Text>
        <Text style={s.value}>{formatMoney(quote.total || 0)}</Text>
      </View>

      <Link href={{ pathname: '/quote/[id]/edit', params: { id: quote.id } }} style={s.editLink}>
        <Text style={s.editText}>Edit Quote</Text>
      </Link>
    </ScrollView>
  );
}

function formatMoney(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 22, fontWeight: '700' },
  h2: { fontSize: 16, color: '#555', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    padding: 12,
  },
  label: { fontSize: 13, color: '#666' },
  value: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  editLink: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#007BFF',
    borderRadius: 10,
  },
  editText: { color: '#fff', fontWeight: '700' },
});
