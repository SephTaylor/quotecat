// app/index.tsx
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../constants/theme";

type Quote = {
  id: string;
  name: string;
  total?: number;
};

// ⚠️ ALL HOOKS MUST BE DECLARED UNCONDITIONALLY (NO early returns above them)
export default function Home() {
  // 1) All state/hooks FIRST — top-level, no conditions
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // 2) Load data in an effect; do NOT guard the effect itself,
  //    guard the body.
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // TODO: Replace with your real loading logic.
        // Example (Supabase):
        // const { data, error } = await supabase.from("quotes").select("*").order("id", { ascending: false });
        // if (error) throw error;
        // if (!alive) return;
        // setQuotes(data ?? []);

        // TEMP stub while wiring:
        if (!alive) return;
        setQuotes((prev) => prev); // no-op; keep your real fetch here
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []); // ← effect itself is always called

  // 3) Memo/derived values are fine; keep them unconditional
  const sortedQuotes = useMemo(
    () => [...quotes].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [quotes]
  );

  // 5) Render (safe background + safe FAB)
  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: "#b91c1c", fontWeight: "600" }}>Error: {error}</Text>
        <Pressable
          onPress={() => {
            setLoading(true);
            setError(null);
            // trigger refetch: e.g., set a refresh key
          }}
        >
          <Text style={{ color: "#2563eb", marginTop: 10 }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={sortedQuotes}
        keyExtractor={(q) => String(q.id)}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={s.center}>
            <Text>No quotes yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/quote/${item.id}`)} style={s.card}>
            <Text style={s.title}>{item.name}</Text>
            {!!item.total && <Text style={s.sub}>Total: ${item.total.toFixed(2)}</Text>}
          </Pressable>
        )}
      />

      {/* FAB sits above the home indicator now */}
      <Pressable style={[s.fab, { bottom: insets.bottom + 24 }]} onPress={() => router.push("/new-quote")}>
        <Text style={{ color: "#fff", fontWeight: "800" }}>＋</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    marginBottom: 10,
  },
  title: { fontWeight: "700", fontSize: 16 },
  sub: { marginTop: 4, color: "#6b7280" },
  fab: {
    position: "absolute",
    right: 16,
    backgroundColor: "#2563eb",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
});
