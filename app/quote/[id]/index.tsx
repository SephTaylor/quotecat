// app/quote/[id]/index.tsx
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from "../../../constants/theme";
import { getQuoteById, saveQuote } from '../../../lib/quotes';


// Local, minimal item type (avoid cross-file type conflicts)
type QuoteItemView = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  unit?: string;
  vendor?: string;
};

type Quote = {
  id: string;
  name: string;
  items: QuoteItemView[];
  labor?: number;
  materialSubtotal?: number;
  total?: number;
  currency?: string;
};

export default function QuoteScreen() {
  const { id: rawId, mode } = useLocalSearchParams<{ id?: string | string[]; mode?: string }>();

  // Normalize id to ALWAYS be a string (no undefined / array)
  const id: string = typeof rawId === 'string' ? rawId : (rawId?.[0] ?? 'temp');
  const isEditModeFromURL = mode === 'edit';

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEdit, setIsEdit] = useState(isEditModeFromURL);

  // Load on first mount & when id changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const q = await getQuoteById(id);
        if (!cancelled) {
          if (q) {
            // Cast the loaded quote to our local view type
            setQuote(q as unknown as Quote);
          } else {
            setQuote({ id, name: '', items: [], labor: 0, materialSubtotal: 0, total: 0 });
          }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setQuote({ id, name: '', items: [], labor: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Keep local isEdit in sync if deep-linked with ?mode=edit
  useEffect(() => {
    setIsEdit(isEditModeFromURL);
  }, [isEditModeFromURL]);

  // Simple money format
  const fmt = useCallback((n: number, c = 'USD') => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n);
    } catch {
      return `$${(n ?? 0).toFixed(2)}`;
    }
  }, []);

  const materialSubtotal = useMemo(
    () => (quote?.items ?? []).reduce((s, i) => s + i.unitPrice * i.qty, 0),
    [quote?.items]
  );
  const labor = quote?.labor ?? 0;
  const total = materialSubtotal + labor;

  const onSave = async () => {
    if (!quote) return;
    try {
      setSaving(true);

      const nextQuote = {
        ...(quote as any),
        materialSubtotal,
        total,
      };

      await saveQuote(nextQuote as any);

      setQuote(nextQuote as Quote);
      setIsEdit(false);

      // Remove ?mode=edit
      router.replace({ pathname: '/quote/[id]', params: { id } });
    } catch (e) {
      console.error(e);
      Alert.alert('Save failed', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    // Reload quote from storage to discard local edits
    router.replace({ pathname: '/quote/[id]', params: { id } });
  };

  if (loading || !quote) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header actions */}
      <View style={styles.headerRow}>
        {!isEdit ? (
          <>
            <Button
              title="Edit"
              onPress={() => router.push({ pathname: '/quote/[id]', params: { id, mode: 'edit' } })}
            />
            <View style={{ width: 8 }} />
            <Button
              title="Add Materials"
              onPress={() => router.push({ pathname: '/materials', params: { quoteId: id } })}
            />
          </>
        ) : (
          <>
            <Button title="Cancel" onPress={onCancel} />
            <View style={{ width: 8 }} />
            <Button title={saving ? 'Saving…' : 'Save'} onPress={onSave} />
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Quote Name */}
        <Text style={styles.label}>Project / Quote Name</Text>
        {isEdit ? (
          <TextInput
            value={quote.name}
            onChangeText={(t) => setQuote((q) => ({ ...(q as Quote), name: t }))}
            placeholder="e.g., Interior wall build-out"
            style={styles.input}
          />
        ) : (
          <Text style={styles.value}>{quote.name || '—'}</Text>
        )}

        {/* Labor */}
        <Text style={styles.label}>Labor</Text>
        {isEdit ? (
          <TextInput
            value={String(labor ?? 0)}
            onChangeText={(t) => {
              const v = Number.parseFloat(t) || 0;
              setQuote((q) => ({ ...(q as Quote), labor: v }));
            }}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        ) : (
          <Text style={styles.value}>{fmt(labor, quote.currency)}</Text>
        )}

        {/* Items */}
        <Text style={[styles.label, { marginTop: 12 }]}>Materials</Text>
        {quote.items.length === 0 ? (
          <Text style={styles.valueDim}>No materials yet. Tap “Add Materials”.</Text>
        ) : (
          <View style={styles.card}>
            {quote.items.map((it) => (
              <View key={it.productId} style={styles.itemRow}>
                <Text style={{ flex: 1 }}>
                  {it.name}  × {it.qty}
                </Text>
                <Text>{fmt(it.unitPrice * it.qty, quote.currency)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <View style={styles.totRow}>
            <Text style={styles.dim}>Materials</Text>
            <Text style={styles.dim}>{fmt(materialSubtotal, quote.currency)}</Text>
          </View>
          <View style={styles.totRow}>
            <Text style={styles.dim}>Labor</Text>
            <Text style={styles.dim}>{fmt(labor, quote.currency)}</Text>
          </View>
          <View
            style={[
              styles.totRow,
              { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 8, borderTopColor: '#E6EAF2' },
            ]}
          >
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalVal}>{fmt(total, quote.currency)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  label: { fontSize: 12, fontWeight: '600', opacity: 0.7, marginTop: 8 },
  value: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  valueDim: { fontSize: 16, opacity: 0.7, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    backgroundColor: '#fff',
    borderColor: '#E6EAF2', // subtle theme border
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderColor: '#E6EAF2', // subtle theme border
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dim: { opacity: 0.75 },
  totalLabel: { fontWeight: '700' },
  totalVal: { fontWeight: '700' },
});
