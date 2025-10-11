// app/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

import type { Quote as LibQuote } from '../lib/quotes';
import { deleteQuote, getAllQuotes } from '../lib/quotes';
import { supabase } from '../lib/supabase';

// Local list item type used by this screen
type QuoteItem = {
  id: string;
  title: string;
  total?: number;
};

const TIP_KEY = 'qc_tip_seen_v1';

export default function Home() {
  const router = useRouter();

  // ---------- AUTH (unconditional hooks) ----------
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ---------- STATE ----------
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tipSeen, setTipSeen] = useState(false);
  const [tipLoaded, setTipLoaded] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const tipOpacity = useRef(new Animated.Value(0)).current;
  const tipTimer = useRef<NodeJS.Timeout | null>(null);

  const toItem = (q: LibQuote): QuoteItem => ({
    id: q.id,
    title: `${q.clientName ?? 'Client'} — ${q.projectName ?? 'Project'}`,
    total: q.total,
  });

  const load = useCallback(async () => {
    const data = await getAllQuotes(); // newest first (per your lib)
    setQuotes((data as LibQuote[]).map(toItem));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // read one-time tip flag
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(TIP_KEY);
      setTipSeen(!!raw);
      setTipLoaded(true);
    })();
  }, []);

  // pulse animation when list is empty (applied to FAB below)
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
    return () => {
      if (loop) loop.stop();
    };
  }, [quotes.length, pulse]);

  // show one-time tooltip text
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

  // ---------- AUTH redirect AFTER hooks ----------
  useEffect(() => {
    if (!session && !sessionLoading) {
      router.replace('/auth/sign-in');
    }
  }, [session, sessionLoading, router]);

  const waitingOnAuth = sessionLoading || !session;

  // ---------- ACTIONS ----------
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    router.replace('/auth/sign-in');
  };

  const confirmDelete = (q: QuoteItem) => {
    Alert.alert(
      'Delete quote?',
      `This will remove “${q.title}”.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteQuote(q.id);
            await load();
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ---------- RENDER ----------
  if (waitingOnAuth) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Top bar with Sign out */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>QuoteCat</Text>
        <TouchableOpacity
          onPress={signOut}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: '#ef4444' }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={quotes}
        keyExtractor={(q) => q.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 32 }}>
            {/* Just the tip text now — no extra New Quote button */}
            <Animated.View style={{ opacity: tipOpacity }}>
              <Text style={{ color: '#6b7280', textAlign: 'center' }}>
                Tip: Tap the blue ＋ to create your first quote. Long-press a quote to delete it.
              </Text>
            </Animated.View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/quote/[id]', params: { id: item.id } })
            }
            onLongPress={() => confirmDelete(item)}
            delayLongPress={350}
            style={{
              padding: 16,
              marginBottom: 12,
              borderRadius: 16,
              backgroundColor: '#fff',
              elevation: 2,
            }}
          >
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{item.title}</Text>
            {item.total != null && <Text style={{ color: '#6b7280' }}>Total: {item.total}</Text>}
            <Text style={{ color: '#9ca3af', marginTop: 4, fontSize: 12 }}>Long-press to delete</Text>
          </TouchableOpacity>
        )}
      />

      {/* Floating ＋ button (only entry point to add) with pulse */}
      <Animated.View style={{ position: 'absolute', right: 20, bottom: 28, transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          onPress={() => router.push('/new-quote')}  // <- make sure this screen exists
          style={{
            width: 64,
            height: 64,
            borderRadius: 9999,
            backgroundColor: '#2563eb',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 5,
          }}
        >
          <Text style={{ color: 'white', fontSize: 32, lineHeight: 32 }}>＋</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
