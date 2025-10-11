// app/quote/[id]/index.tsx
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { formatMoney } from '../../../lib/money';
import { shareQuotePDF } from '../../../lib/pdf';
import { Quote, getQuoteById } from '../../../lib/quotes';
import { getCurrency } from '../../../lib/settings';

export default function QuoteDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [currency, setCurrency] = useState<string>('USD');

  useEffect(() => {
    getCurrency().then(setCurrency).catch(() => setCurrency('USD'));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    if (!id) {
      setQuote(null);
      setLoading(false);
      return;
    }
    const q = await getQuoteById(String(id));
    setQuote(q ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      // keep the callback sync; call the async loader inside
      void load();
      return;
    }, [load])
  );

  const onShare = async () => {
    if (!quote) return;
    try {
      setSharing(true);
      const res = await shareQuotePDF(quote);
      if (typeof res === 'string' && res !== 'shared') {
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
            <Button title="Edit" onPress={() => router.push(`/quote/${quote.id}/edit`)} />
          ),
        }}
      />

      <ScrollView contentContainerStyle={s.container}>
        <View style={s.card}>
          <Row label="Client" value={quote.clientName ?? '—'} />
          <Row label="Project" value={quote.projectName ?? '—'} />
          <Separator />
          <Row label="Labor" value={formatMoney(quote.labor, currency)} />
          <Row label="Material" value={formatMoney(quote.material, currency)} />
          <Row label="Total" value={formatMoney(quote.total, currency)} bold big />
        </View>

        <View style={{ height: 12 }} />
        <Button title={sharing ? 'Preparing…' : 'Share PDF'} onPress={onShare} disabled={sharing} />
      </ScrollView>
    </>
  );
}

function Row({
  label,
  value,
  bold,
  big,
}: {
  label: string;
  value: React.ReactNode; // (fix) allow string/number/elements
  bold?: boolean;
  big?: boolean;
}) {
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
