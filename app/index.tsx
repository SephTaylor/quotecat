// app/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

import { getAllQuotes } from '../lib/quotes';
import { supabase } from '../lib/supabase';

// ---------- Local types (safe even if lib/quotes uses a different shape) ----------
type Quote = {
  id: string;
  title: string;     // we’ll normalize to ensure this is always present
  total?: number;
};

// ---------- Constants ----------
const TIP_KEY = 'qc_tip_seen_v1';

export default function Home() {
  const router = useRouter();

  // ---------- AUTH (do NOT return early; just gather state) ----------
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

  // ---------- YOUR STATE (all hooks at top-level, no conditions) ----------
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tipSeen, setTipSeen] = useState<boolean>(false);
  const [tipLoaded, setTipLoaded] = useState<boolean>(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const tipOpacity = useRef(new Animated.Value(0)).current;
  const tipTimer = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    const data = await getAllQuotes();
    // Normalize to our local Quote type so "title" is guaranteed
    const normalized: Quote[] = (data as any[]).map((q) => ({
      id: String(q.id),
      title: (q.title ?? q.name ?? 'Untitled Quote') as string,
      total: q.total as number | undefined,
    }));
    setQuotes(normalized);
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

  // read tip-seen flag once
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(TIP_KEY);
      setTipSeen(!!raw);
      setTipLoaded(true);
    })();
  }, []);

  // pulse animation for + button when list is empty
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

  // show one-time tooltip when empty list
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

  // ---------- AUTH redirect AFTER all hooks are declared ----------
  useEffect(() => {
    if (!session && !sessionLoading) {
      router.replace('/auth/sign-in');
    }
  }, [session, sessionLoading, router]);

  const waitingOnAuth = sessionLoading || !session;

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
      <FlatList
        data={quotes}
        keyExtractor={(q) => q.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 48 }}>
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <TouchableOpacity
                onPress={() => router.push('/quote/new')}
                style={{
                  backgroundColor: '#2563eb',
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderRadius: 9999,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>New Quote</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ opacity: tipOpacity, marginTop: 12 }}>
              <Text style={{ color: '#6b7280' }}>Tap the blue button to create your first quote.</Text>
            </Animated.View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/quote/${item.id}`)}
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
          </TouchableOpacity>
        )}
      />

      {/* Floating + button */}
      <TouchableOpacity
        onPress={() => router.push('/quote/new')}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 28,
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
    </View>
  );
}
