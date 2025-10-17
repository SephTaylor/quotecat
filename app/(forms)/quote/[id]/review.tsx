// app/(forms)/quote/[id]/review.tsx
import { getQuoteById } from '@/lib/quotes';
import FormScreen from '@/modules/core/ui/FormScreen';
import { formatMoney } from '@/modules/settings/money';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';

type QuoteItem = { id?: string; name: string; qty: number; unitPrice: number; currency?: string };
type StoredQuote = { id: string; name: string; clientName?: string; items: QuoteItem[]; labor: number };

export default function QuoteReviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const qid = Array.isArray(params.id) ? params.id[0] : params.id ?? null;

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<StoredQuote | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!qid) return;
        const q = await getQuoteById(qid);
        setQuote((q as StoredQuote) ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [qid]);

  const items: QuoteItem[] = useMemo(() => quote?.items ?? [], [quote]);
  const materialSubtotal = useMemo(
    () => items.reduce((sum, it) => sum + (it.unitPrice || 0) * (it.qty || 0), 0),
    [items]
  );
  const labor = quote?.labor ?? 0;
  const grandTotal = materialSubtotal + labor;

  const closeBar = (
    <View style={styles.footer}>
      <Button title="Close" onPress={() => router.back()} />
    </View>
  );

  const doneBar = (
    <View style={styles.footer}>
      <Button title="Done" onPress={() => router.back()} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!qid) {
    return (
      <FormScreen scroll contentStyle={styles.body} bottomBar={closeBar}>
        <View>
          <Text style={styles.h2}>Missing quote id</Text>
          <Text>Open a quote from Home and try again.</Text>
        </View>
      </FormScreen>
    );
  }

  if (!quote) {
    return (
      <FormScreen scroll contentStyle={styles.body} bottomBar={closeBar}>
        <View>
          <Text style={styles.h2}>Quote not found</Text>
          <Text>We couldn't load that quote. Try again from the Home screen.</Text>
        </View>
      </FormScreen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Review' }} />
      <FormScreen scroll contentStyle={styles.body} bottomBar={doneBar}>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <Text style={styles.h2}>Line items</Text>

          {items.length === 0 ? (
            <Text style={styles.muted}>No items yet.</Text>
          ) : (
            items.map((it, idx) => (
              <View key={`${it.id ?? it.name}-${idx}`} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  <Text style={styles.itemMeta}>
                    {it.qty} × {formatMoney(it.unitPrice)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  {formatMoney((it.unitPrice || 0) * (it.qty || 0))}
                </Text>
              </View>
            ))
          )}

          <View style={styles.divider} />

          <Text style={styles.h2}>Totals</Text>
          <View style={styles.totalsRow}>
            <Text style={styles.label}>Materials</Text>
            <Text style={styles.value}>{formatMoney(materialSubtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.label}>Labor</Text>
            <Text style={styles.value}>{formatMoney(labor)}</Text>
          </View>
          <View style={styles.totalsRowGrand}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{formatMoney(grandTotal)}</Text>
          </View>
        </ScrollView>
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16 },
  h2: { fontSize: 18, fontWeight: '600' },
  muted: { color: '#666' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5'
  },
  rowLeft: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '500' },
  itemMeta: { color: '#666', marginTop: 2 },
  itemTotal: { fontWeight: '600' },

  divider: { height: 16 },

  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  label: { color: '#333' },
  value: { fontWeight: '600' },

  totalsRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
    marginTop: 6
  },
  grandLabel: { fontSize: 16, fontWeight: '700' },
  grandValue: { fontSize: 16, fontWeight: '700' },

  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
    backgroundColor: 'white'
  }
});
