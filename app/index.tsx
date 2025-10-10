// app/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSession } from '../hooks/useSession';
import { exportQuotesCSV } from '../lib/export';
import { Quote, deleteQuote, getAllQuotes } from '../lib/quotes';
import { supabase } from '../lib/supabase';

const TIP_KEY = 'quotecat:floatingTipSeen:v2';

export default function Home() {
  // === Auth gate ===
  const { session, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!session && !sessionLoading) {
      router.replace('/auth/sign-in');
    }
  }, [session, sessionLoading]);

  if (sessionLoading || !session) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    );
  }
  // === /Auth gate ===

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tipSeen, setTipSeen] = useState<boolean>(false);
  const [tipLoaded, setTipLoaded] = useState<boolean>(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const tipOpacity = useRef(new Animated.Value(0)).current;
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const data = await getAllQuotes();
    setQuotes(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(TIP_KEY);
      setTipSeen(!!raw);
      setTipLoaded(true);
    })();
  }, []);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (quotes.length === 0) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
          Animated.delay(500),
        ])
      );
      loop.start();
    } else {
      pulse.stopAnimation(() => pulse.setValue(1));
    }
    return () => { if (loop) loop.stop(); };
  }, [quotes.length, pulse]);

  useEffect(() => {
    if (!tipLoaded) return;

    const shouldShow = quotes.length === 0 && !tipSeen;

    Animated.timing(tipOpacity, {
      toValue: shouldShow ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();

    if (shouldShow) {
      tipTimer.current = setTimeout(async () => {
        Animated.timing(tipOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        await AsyncStorage.setItem(TIP_KEY, '1');
        setTipSeen(true);
      }, 5000);
    } else if (tipTimer.current) {
      clearTimeout(tipTimer.current);
      tipTimer.current = null;
    }

    return () => {
      if (tipTimer.current) {
        clearTimeout(tipTimer.current);
        tipTimer.current = null;
      }
    };
  }, [tipLoaded, tipSeen, quotes.length, tipOpacity]);

  const confirmDelete = (id: string) => {
    Alert.alert('Delete quote?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteQuote(id); load(); } },
    ]);
  };

  const Item = ({ item }: { item: Quote }) => (
    <Pressable
      onPress={() => router.push(`/quote/${item.id}`)}
      onLongPress={() => confirmDelete(item.id)}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.9 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{item.clientName}</Text>
        <Text style={styles.itemSubtitle}>{item.projectName}</Text>
      </View>
      <Text style={styles.itemAmount}>{formatMoney(item.total)}</Text>
    </Pressable>
  );

  const onFabPress = async () => {
    if (!tipSeen) {
      await AsyncStorage.setItem(TIP_KEY, '1');
      Animated.timing(tipOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      setTipSeen(true);
    }
    router.push('/new-quote');
  };

  // === Summary numbers ===
  const quoteCount = quotes.length;
  const totalAmount = useMemo(
    () => quotes.reduce((sum, q) => sum + (q.total || 0), 0),
    [quotes]
  );

  const fabOpacity = pulse.interpolate({
    inputRange: [1, 1.08],
    outputRange: [1, 0.92],
  });

  const handleExport = async () => {
    try {
      const result = await exportQuotesCSV(quotes);
      if (typeof result === 'string') {
        // Sharing not available: show where the file is
        Alert.alert('Exported', `CSV saved here:\n${result}`);
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Please try again.');
    }
  };

  // === Sign out handler (Supabase) ===
  const onSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/auth/sign-in');
    } catch (e: any) {
      Alert.alert('Sign out failed', e?.message || 'Try again.');
    }
  };

  // Header component for the list (shows only when there are quotes)
  const SummaryHeader = quoteCount > 0 ? (
    <View style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Quotes</Text>
        <Text style={styles.summaryValue}>{quoteCount}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Total</Text>
        <Text style={styles.summaryValue}>{formatMoney(totalAmount)}</Text>
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      {/* Top bar with title + Export + Sign out */}
      <View style={styles.topBar}>
        <Text style={styles.header}>🏠 QuoteCat</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {quoteCount > 0 && (
            <Pressable onPress={handleExport} style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.8 }]}>
              <Text style={styles.exportText}>Export</Text>
            </Pressable>
          )}
          <Pressable onPress={onSignOut} style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.8 }]}>
            <Text style={styles.exportText}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      {quoteCount === 0 ? (
        <Text style={styles.empty}>
          No quotes yet. Tap the <Text style={{ fontWeight: '700' }}>＋</Text> to create one.
        </Text>
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(q) => q.id}
          renderItem={Item}
          ListHeaderComponent={SummaryHeader}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Tooltip bubble (above the FAB) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tooltipWrap,
          {
            opacity: tipOpacity,
            transform: [{
              translateY: tipOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            }],
          },
        ]}
      >
        <View style={styles.tooltipBox}>
          <Text style={styles.tooltipText}>Create Quote</Text>
        </View>
        <View style={styles.tooltipArrow} />
      </Animated.View>

      {/* Animated FAB */}
      <Animated.View style={[styles.fabWrap, { transform: [{ scale: pulse }], opacity: fabOpacity }]}>
        <Pressable style={styles.fab} onPress={onFabPress}>
          <Text style={styles.fabText}>＋</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function formatMoney(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f7f7f7' },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  header: { fontSize: 22, fontWeight: '700' },
  exportBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#ccc',
  },
  exportText: { fontSize: 14, fontWeight: '700', color: '#007BFF' },

  // Empty state text
  empty: { textAlign: 'center', marginTop: 24, color: '#666' },

  // Summary card
  summaryCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    marginBottom: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 16, fontWeight: '700' },

  // List items
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemSubtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  itemAmount: { fontSize: 16, fontWeight: '700', marginLeft: 12 },

  // FAB
  fabWrap: { position: 'absolute', right: 16, bottom: 16, zIndex: 5 },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#007BFF',
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.2,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 30, marginTop: -2 },

  // Tooltip
  tooltipWrap: {
    position: 'absolute',
    right: 16,
    bottom: 16 + 56 + 10,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  tooltipBox: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#111', borderRadius: 8 },
  tooltipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tooltipArrow: {
    width: 0, height: 0, marginTop: 4,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#111',
  },
});
