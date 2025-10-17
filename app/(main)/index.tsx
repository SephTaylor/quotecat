// app/(main)/index.tsx
import { theme } from "@/constants/theme";
import {
  createNewQuote,
  deleteQuote,
  listQuotes,
  type Quote,
} from "@/lib/quotes";
import { Screen } from "@/modules/core/ui";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
} from "react-native";

export default function Home() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await listQuotes();
    setQuotes(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onNew = useCallback(async () => {
    // Blank fields so the edit form starts empty
    const q = await createNewQuote("", "");
    router.push(`/quote/${q.id}/edit`);
  }, [router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const confirmDelete = (id: string, name: string) => {
    Alert.alert(
      "Delete quote?",
      name
        ? `Delete “${name}”? This can’t be undone.`
        : "Delete this quote? This can’t be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteQuote(id);
            await load();
          },
        },
      ],
    );
  };

  return (
    <Screen scroll={false} contentStyle={styles.container}>
      <FlatList
        data={quotes}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <Pressable
            style={styles.assembliesCard}
            onPress={() => router.push("/(main)/assemblies" as any)}
          >
            <Text style={styles.assembliesTitle}>📚 Assemblies Library</Text>
            <Text style={styles.assembliesSub}>
              Pre-built calculators for common tasks
            </Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/quote/${item.id}/edit`)}
            onLongPress={() => confirmDelete(item.id, item.name)}
          >
            <Text style={styles.title}>{item.name || "Untitled project"}</Text>
            <Text style={styles.sub}>
              {item.clientName ? `Client: ${item.clientName}  •  ` : ""}
              Labor: {item.labor.toFixed(2)}
            </Text>
            <Text style={styles.total}>
              Total: {item.total.toFixed(2)} {item.currency}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No quotes yet. Tap + to start.</Text>
        }
      />

      <Pressable style={styles.fab} onPress={onNew}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  listContent: { padding: theme.spacing(2) },
  assembliesCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(3),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  assembliesTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  assembliesSub: {
    fontSize: 13,
    color: "#333",
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 6,
  },
  sub: { fontSize: 12, color: theme.colors.muted, marginBottom: 8 },
  total: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  empty: {
    textAlign: "center",
    color: theme.colors.muted,
    marginTop: theme.spacing(4),
  },
  fab: {
    position: "absolute",
    right: theme.spacing(2),
    bottom: theme.spacing(2),
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fabText: { fontSize: 28, lineHeight: 28, color: "#000", fontWeight: "800" },
});
