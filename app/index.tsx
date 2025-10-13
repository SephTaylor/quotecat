// app/index.tsx
import { theme } from '@/constants/theme';
import { createNewQuote, listQuotes, Quote } from '@/lib/quotes';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

export default function Home() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    (async () => {
      const data = await listQuotes();
      setQuotes(data);
    })();
  }, []);

  const onNew = async () => {
    const q = await createNewQuote('Untitled project');
    router.push(`/quote/${q.id}/edit`);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={quotes}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/quote/${item.id}/edit`)}
          >
            <Text style={styles.title}>{item.name || 'Untitled project'}</Text>
            <Text style={styles.sub}>
              Material: {item.materialSubtotal.toFixed(2)} • Labor: {item.labor.toFixed(2)}
            </Text>
            <Text style={styles.total}>Total: {item.total.toFixed(2)} {item.currency}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No quotes yet. Tap + to start.</Text>
        }
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
