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
import { Stack, useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
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
  const params = useLocalSearchParams();
  const filterScrollRef = React.useRef<ScrollView>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deletedQuote, setDeletedQuote] = useState<Quote | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus | "all" | "pinned">(
    "all",
  );

  const load = useCallback(async () => {
    const data = await listQuotes();
    setQuotes(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Scroll to the selected filter chip
  const scrollToFilter = useCallback((filter: QuoteStatus | "all" | "pinned") => {
    if (!filterScrollRef.current) return;

    // Calculate approximate position based on filter order
    const filters = ["all", "pinned", "draft", "sent", "approved", "completed", "archived"];
    const index = filters.indexOf(filter);

    if (index === -1) return;

    // Approximate chip width (padding + text + margins)
    const chipWidth = 90; // Adjust based on your chip sizing
    const scrollPosition = Math.max(0, index * chipWidth - 50); // Center-ish

    filterScrollRef.current.scrollTo({
      x: scrollPosition,
      animated: true,
    });
  }, []);

  // Apply filter from navigation parameter
  useEffect(() => {
    if (params.filter && typeof params.filter === "string") {
      const filter = params.filter as QuoteStatus | "all" | "pinned";
      if (
        filter === "all" ||
        filter === "pinned" ||
        filter === "draft" ||
        filter === "sent" ||
        filter === "approved" ||
        filter === "completed" ||
        filter === "archived"
      ) {
        setSelectedStatus(filter);

        // Auto-scroll to the selected chip
        setTimeout(() => {
          scrollToFilter(filter);
        }, 100);
      }
    }
  }, [params.filter, scrollToFilter]);

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

    // Filter by status or pinned
    if (selectedStatus === "pinned") {
      filtered = filtered.filter((quote) => quote.pinned);
    } else if (selectedStatus !== "all") {
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
      <Stack.Screen options={{ title: "Quotes" }} />
      <View style={styles.container}>
        {/* Status Filters */}
        <ScrollView
          ref={filterScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
          style={styles.filterScrollView}
        >
          <FilterChip
            label="All"
            active={selectedStatus === "all"}
            onPress={() => setSelectedStatus("all")}
            theme={theme}
          />
          <FilterChip
            label="Pinned"
            active={selectedStatus === "pinned"}
            onPress={() => setSelectedStatus("pinned")}
            color="#FF8C00"
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

        {/* Search */}
        <View style={styles.topBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search quotes..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Quote List */}
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
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>
                {selectedStatus === "all" && searchQuery === ""
                  ? "No Quotes Yet"
                  : searchQuery !== ""
                  ? "No Matches Found"
                  : `No ${selectedStatus === "pinned" ? "Pinned" : QuoteStatusMeta[selectedStatus as QuoteStatus]?.label || ""} Quotes`}
              </Text>
              <Text style={styles.emptyDescription}>
                {selectedStatus === "all" && searchQuery === ""
                  ? "Create your first quote to get started. Tap the + button below to begin."
                  : searchQuery !== ""
                  ? `No quotes match "${searchQuery}". Try a different search term.`
                  : `You don't have any ${selectedStatus === "pinned" ? "pinned" : selectedStatus} quotes yet.`}
              </Text>
              {selectedStatus === "all" && searchQuery === "" && (
                <Pressable style={styles.emptyButton} onPress={onNew}>
                  <Text style={styles.emptyButtonText}>Create First Quote</Text>
                </Pressable>
              )}
            </View>
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
    topBar: {
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
    filterScrollView: {
      flexGrow: 0,
      flexShrink: 0,
    },
    filterContainer: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.25),
      gap: theme.spacing(1),
    },
    filterChip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(0.75),
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    filterChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    filterChipTextActive: {
      color: "#000",
    },
    listContent: {
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(10),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing(4),
      marginTop: theme.spacing(8),
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: theme.spacing(2),
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      marginBottom: theme.spacing(3),
      lineHeight: 20,
      maxWidth: 300,
    },
    emptyButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.xl,
    },
    emptyButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    fab: {
      position: "absolute",
      left: "50%",
      marginLeft: -28, // Half of width to center
      bottom: 20, // Much closer to tab bar
      height: 56,
      width: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    fabText: {
      fontSize: 32,
      lineHeight: 32,
      color: "#000",
      fontWeight: "800",
      textAlign: "center",
      includeFontPadding: false,
      marginTop: 4, // Nudge down for better visual centering
      marginLeft: 1, // Nudge right slightly
    },
  });
}
