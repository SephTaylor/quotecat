// app/(main)/(tabs)/quotes.tsx
import { useTheme } from "@/contexts/ThemeContext";
import {
  createNewQuote,
  deleteQuote,
  listQuotes,
  saveQuote,
  updateQuote,
  type Quote,
} from "@/lib/quotes";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import type { QuoteStatus } from "@/lib/types";
import { QuoteStatusMeta } from "@/lib/types";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SwipeableQuoteItem } from "@/components/SwipeableQuoteItem";
import { UndoSnackbar } from "@/components/UndoSnackbar";

export default function QuotesList() {
  const router = useRouter();
  const { theme } = useTheme();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deletedQuote, setDeletedQuote] = useState<Quote | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus | "all">(
    "all",
  );

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

  const handleDelete = useCallback(async (quote: Quote) => {
    // Store deleted quote for undo
    setDeletedQuote(quote);

    // Optimistically remove from list
    setQuotes((prev) => prev.filter((q) => q.id !== quote.id));

    // Delete from storage
    await deleteQuote(quote.id);

    // Show undo snackbar
    setShowUndo(true);
  }, []);

  const handleUndo = useCallback(async () => {
    if (!deletedQuote) return;

    // Restore the quote
    await saveQuote(deletedQuote);

    // Reload list
    await load();

    // Clear deleted quote
    setDeletedQuote(null);
  }, [deletedQuote, load]);

  const handleDismissUndo = useCallback(() => {
    setShowUndo(false);
    setDeletedQuote(null);
  }, []);

  const handleTogglePin = useCallback(async (quote: Quote) => {
    // Optimistically update UI
    setQuotes((prev) =>
      prev.map((q) => (q.id === quote.id ? { ...q, pinned: !q.pinned } : q)),
    );

    // Update in storage
    await updateQuote(quote.id, { pinned: !quote.pinned });
  }, []);

  // Filter quotes based on search query and status
  const filteredQuotes = React.useMemo(() => {
    let filtered = quotes;

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((quote) => quote.status === selectedStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (quote) =>
          quote.name.toLowerCase().includes(query) ||
          quote.clientName?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [quotes, searchQuery, selectedStatus]);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Quotes", headerBackVisible: false }} />
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search quotes by name or client..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          <FilterChip
            label="All"
            active={selectedStatus === "all"}
            onPress={() => setSelectedStatus("all")}
            theme={theme}
          />
          <FilterChip
            label="Draft"
            active={selectedStatus === "draft"}
            onPress={() => setSelectedStatus("draft")}
            color={QuoteStatusMeta.draft.color}
            theme={theme}
          />
          <FilterChip
            label="Active"
            active={selectedStatus === "active"}
            onPress={() => setSelectedStatus("active")}
            color={QuoteStatusMeta.active.color}
            theme={theme}
          />
          <FilterChip
            label="Sent"
            active={selectedStatus === "sent"}
            onPress={() => setSelectedStatus("sent")}
            color={QuoteStatusMeta.sent.color}
            theme={theme}
          />
          <FilterChip
            label="Approved"
            active={selectedStatus === "approved"}
            onPress={() => setSelectedStatus("approved")}
            color={QuoteStatusMeta.approved.color}
            theme={theme}
          />
          <FilterChip
            label="Completed"
            active={selectedStatus === "completed"}
            onPress={() => setSelectedStatus("completed")}
            color={QuoteStatusMeta.completed.color}
            theme={theme}
          />
          <FilterChip
            label="Archived"
            active={selectedStatus === "archived"}
            onPress={() => setSelectedStatus("archived")}
            color={QuoteStatusMeta.archived.color}
            theme={theme}
          />
        </ScrollView>
        <FlatList
          data={filteredQuotes}
          keyExtractor={(q) => q.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <SwipeableQuoteItem
              item={item}
              onEdit={() => router.push(`/quote/${item.id}/edit`)}
              onDelete={() => handleDelete(item)}
              onTogglePin={() => handleTogglePin(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No quotes yet. Tap + to start.</Text>
          }
        />

        <Pressable style={styles.fab} onPress={onNew}>
          <Text style={styles.fabText}>＋</Text>
        </Pressable>

        <UndoSnackbar
          visible={showUndo}
          message={`Deleted "${deletedQuote?.name || "quote"}"`}
          onUndo={handleUndo}
          onDismiss={handleDismissUndo}
        />
      </View>
    </GestureHandlerRootView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  color,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={[
        styles.filterChip,
        active && styles.filterChipActive,
        active && color && { backgroundColor: color },
      ]}
      onPress={onPress}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    searchContainer: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      backgroundColor: theme.colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterContainer: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
    },
    filterChip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginRight: theme.spacing(1),
      alignItems: "center",
      justifyContent: "center",
    },
    filterChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    filterChipTextActive: {
      color: "#000",
    },
    listContent: { padding: theme.spacing(2) },
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
}
