// app/quote/[id]/index.tsx
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { shareQuotePDF } from '../../../lib/pdf';
import { Quote, getQuoteById } from '../../../lib/quotes';

function formatMoney(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export default function QuoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const q = await getQuoteById(String(id));
      setQuote(q || null);
      setLoading(false);
    })();
  }, [id]);

  const onShare = async () => {
    if (!quote) return;
    try {
      setSharing(true);
      const res = await shareQuotePDF(quote);
      if (typeof res === 'string' && res !== 'shared') {
        // Web or environments without share: show file path
        Alert.alert('PDF Created', `Saved to:\n${res}`);
      }
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={s.center}>
        <Text>Quote not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Quote',
          headerRight: () => (
            <Link href={`/quote/${quote.id}/edit`} asChild>
              <Button title="Edit" onPress={() => router.push(`/quote/${quote.id}/edit`)} />
            </Link>
          ),
        }}
      />
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.card}>
          <Row label="Client" value={quote.clientName} />
          <Row label="Project" value={quote.projectName} />
          <Separator />
          <Row label="Labor" value={formatMoney(quote.labor)} />
          <Row label="Material" value={formatMoney(quote.material)} />
          <Separator />
          <Row label="Total" value={formatMoney(quote.total)} bold big />
        </View>

        <View style={{ height: 12 }} />
        <Button title={sharing ? 'Preparing…' : 'Share PDF'} onPress={onShare} disabled={sharing} />
      </ScrollView>
    </>
  );
}

function Row({ label, value, bold, big }: { label: string; value: string; bold?: boolean; big?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={[s.label, big && s.big]}>{label}</Text>
      <Text style={[s.value, bold && s.bold, big && s.big]}>{value}</Text>
    </View>
  );
}

function Separator() {
  return <View style={s.sep} />;
}

const s = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    padding: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  label: { color: '#666', fontSize: 14 },
  value: { fontSize: 16 },
  bold: { fontWeight: '700' },
  big: { fontSize: 18 },
  sep: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
});
