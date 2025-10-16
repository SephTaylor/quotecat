// app/(main)/index.tsx
import { theme } from '@/constants/theme';
import {
  createNewQuote,
  deleteQuote,
  listQuotes,
  type Quote,
} from '@/lib/quotes';
import { QuoteCard } from '@/modules/quotes/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function Home() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await listQuotes();
    setQuotes(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onNew = useCallback(async () => {
    const q = await createNewQuote('', '');
    router.push(`/quote/${q.id}/edit`);
  }, [router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const confirmDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete quote?',
      name ? `Delete “${name}”? This can’t be undone.` : 'Delete this quote? This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteQuote(id);
            await load();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={quotes}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <QuoteCard
            quote={item}
            onPress={() => router.push(`/quote/${item.id}/edit`)}
            onLongPress={() => confirmDelete(item.id, item.name)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No quotes yet. Tap + to start.</Text>}
      />

      <Pressable style={styles.fab} onPress={onNew}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  listContent: { padding: theme.spacing(2) },
  empty: { textAlign: 'center', color: theme.colors.muted, marginTop: theme.spacing(4) },
  fab: {
    position: 'absolute',
    right: theme.spacing(2),
    bottom: theme.spacing(2),
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fabText: { fontSize: 28, lineHeight: 28, color: '#000', fontWeight: '800' },
});
