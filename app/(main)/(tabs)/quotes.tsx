// app/(main)/(tabs)/quotes.tsx
import { useTheme } from "@/contexts/ThemeContext";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import {
  deleteQuote,
  duplicateQuote,
  listQuotes,
  saveQuote,
  updateQuote,
  createTierFromQuote,
  getLinkedQuotes,
  unlinkQuote,
  createNewQuote,
  type Quote,
} from "@/lib/quotes";
import { generateAndShareMultiTierPDF } from "@/lib/pdf";
import { loadPreferences } from "@/lib/preferences";
import { getUserState } from "@/lib/user";
import { getCachedLogo } from "@/lib/logo";
import { isSyncAvailable, syncQuotes } from "@/lib/quotesSync";
import { getActiveChangeOrderCount } from "@/modules/changeOrders";
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { RefreshEvents, REFRESH_QUOTES_LIST } from "@/lib/refreshEvents";
import type { QuoteStatus } from "@/lib/types";
import { QuoteStatusMeta } from "@/lib/types";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SwipeableQuoteItem } from "@/components/SwipeableQuoteItem";
import { QuoteGroup } from "@/components/QuoteGroup";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { GradientBackground } from "@/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

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
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus | "all" | "followup">(
    "all",
  );
  const [sortBy, setSortBy] = useState<"date" | "amount" | "name" | "client" | "followUp">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showSortModal, setShowSortModal] = useState(false);

  // Multi-select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Change order counts per quote
  const [coCounts, setCoCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      const data = await listQuotes({ skipCache: true });
      setQuotes(data);

      // Load CO counts for quotes that might have them (approved/completed)
      const counts: Record<string, number> = {};
      await Promise.all(
        data
          .filter((q) => q.status === "approved" || q.status === "completed")
          .map(async (q) => {
            try {
              const count = await getActiveChangeOrderCount(q.id);
              if (count > 0) counts[q.id] = count;
            } catch {
              // Skip this quote's CO count on error
            }
          })
      );
      setCoCounts(counts);
    } catch (error) {
      console.error("Failed to load quotes:", error);
      // Keep existing quotes state on error
    }
  }, []);

  // Track if this is the first focus to avoid double-loading
  const isFirstFocusRef = useRef(true);

  // Load on mount
  useEffect(() => {
    load();
  }, [load]);

  // Reload when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      load();
    }, [load])
  );

  // Subscribe to refresh events (triggered when quotes are created/updated elsewhere)
  useEffect(() => {
    const unsubscribe = RefreshEvents.subscribe(REFRESH_QUOTES_LIST, load);
    return unsubscribe;
  }, [load]);

  // Scroll to the selected filter chip
  const scrollToFilter = useCallback((filter: QuoteStatus | "all" | "followup") => {
    if (!filterScrollRef.current) return;

    // Calculate approximate position based on filter order
    const filters = ["all", "followup", "draft", "sent", "approved", "declined", "completed", "archived"];
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
      const filter = params.filter as QuoteStatus | "all" | "followup";
      if (
        filter === "all" ||
        filter === "followup" ||
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


  // Create new quote handler
  const handleCreateNewQuote = useCallback(() => {
    // Navigate to "new" - quote will only be created when user fills required fields
    router.push("/quote/new/edit");
  }, [router]);

  // Pull-to-refresh handler - triggers cloud sync for Pro/Premium users
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Trigger cloud sync if available (Pro/Premium users)
      const available = await isSyncAvailable();
      const user = await getUserState();
      if (available && (user.tier === 'pro' || user.tier === 'premium')) {
        await syncQuotes().catch(() => {});
      }
    } catch {
      // Sync failed, continue with local data
    }
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = useCallback(async (quote: Quote) => {
    // Store deleted quote for undo
    setDeletedQuote(quote);

    // Optimistically remove from list
    setQuotes((prev) => prev.filter((q) => q.id !== quote.id));

    try {
      // Delete from storage
      await deleteQuote(quote.id);
    } catch (error) {
      console.error("Failed to delete quote:", error);
      // Restore the quote on error
      setQuotes((prev) => [...prev, quote].sort((a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      ));
      setDeletedQuote(null);
      Alert.alert("Error", "Failed to delete quote. Please try again.");
      return;
    }

    // Show undo snackbar
    setShowUndo(true);
  }, []);

  const handleUndo = useCallback(async () => {
    if (!deletedQuote) return;

    try {
      // Restore the quote
      await saveQuote(deletedQuote);

      // Reload list
      await load();

      // Clear deleted quote
      setDeletedQuote(null);
    } catch (error) {
      console.error("Failed to restore quote:", error);
      Alert.alert("Error", "Failed to restore quote. Please try again.");
    }
  }, [deletedQuote, load]);

  const handleDismissUndo = useCallback(() => {
    setShowUndo(false);
    setDeletedQuote(null);
  }, []);

  const handleDuplicate = useCallback(async (quote: Quote) => {
    try {
      const duplicated = await duplicateQuote(quote.id);
      if (duplicated) {
        // Optimistically add to list at the top
        setQuotes((prev) => [duplicated, ...prev]);

        // Navigate to edit the new quote
        router.push(`/quote/${duplicated.id}/edit`);
      }
    } catch (error) {
      console.error("Failed to duplicate quote:", error);
      Alert.alert("Error", "Failed to duplicate quote. Please try again.");
    }
  }, [router]);

  const handleCreateTier = useCallback((quote: Quote) => {
    Alert.prompt(
      "Create Tier",
      `Enter a name for this tier option (e.g., "Better", "Best", "With Generator")`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: async (tierName: string | undefined) => {
            if (!tierName?.trim()) {
              Alert.alert("Error", "Please enter a tier name");
              return;
            }
            try {
              const newTier = await createTierFromQuote(quote.id, tierName.trim());
              if (newTier) {
                // Reload list to get updated linked quotes
                await load();
                // Navigate to edit the new tier
                router.push(`/quote/${newTier.id}/edit`);
              }
            } catch (error) {
              console.error("Failed to create tier:", error);
              Alert.alert("Error", "Failed to create tier. Please try again.");
            }
          },
        },
      ],
      "plain-text",
      "",
      "default"
    );
  }, [load, router]);

  const handleExportAllTiers = useCallback(async (quote: Quote) => {
    try {
      // Get all linked quotes
      const linkedQuotes = await getLinkedQuotes(quote.id);

      if (linkedQuotes.length <= 1) {
        Alert.alert("No Linked Options", "This quote has no linked tier options to export together.");
        return;
      }

      // Load user state, preferences, and logo
      const [userState, prefs] = await Promise.all([
        getUserState(),
        loadPreferences(),
      ]);

      let logo = null;
      try {
        logo = await getCachedLogo();
      } catch {
        // Logo loading failed, continue without it
      }

      // Generate and share combined PDF
      // Strip data URL prefix if present - PDF template adds it back
      const rawBase64 = logo?.base64?.replace(/^data:image\/\w+;base64,/, '');
      await generateAndShareMultiTierPDF(linkedQuotes, {
        includeBranding: userState.tier === "free",
        companyDetails: prefs.company,
        logoBase64: rawBase64,
      });
    } catch (error) {
      Alert.alert(
        "Export Failed",
        error instanceof Error ? error.message : "Failed to export PDF"
      );
    }
  }, []);

  const handleUnlink = useCallback((quote: Quote) => {
    Alert.alert(
      "Unlink Quote",
      `Remove "${quote.name || "Untitled"}${quote.tier ? ` (${quote.tier})` : ""}" from this group? The quote won't be deleted, just unlinked from the other options.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            try {
              await unlinkQuote(quote.id);
              await load();
            } catch (error) {
              console.error("Failed to unlink quote:", error);
              Alert.alert("Error", "Failed to unlink quote. Please try again.");
            }
          },
        },
      ]
    );
  }, [load]);

  // Multi-select handlers
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectQuote = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const enterSelectMode = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  // selectAll is defined after filteredQuotes

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    Alert.alert(
      "Delete Quotes",
      `Are you sure you want to delete ${selectedIds.size} quote${selectedIds.size === 1 ? "" : "s"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              for (const id of selectedIds) {
                await deleteQuote(id);
              }
              await load();
              setSelectMode(false);
              setSelectedIds(new Set());
            } catch (error) {
              console.error("Failed to delete quotes:", error);
              Alert.alert("Error", "Some quotes failed to delete. Please try again.");
              await load(); // Reload to show current state
            }
          },
        },
      ]
    );
  }, [selectedIds, load]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return;

    try {
      for (const id of selectedIds) {
        await updateQuote(id, { status: "archived" });
      }
      await load();
      setSelectMode(false);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Failed to archive quotes:", error);
      Alert.alert("Error", "Some quotes failed to archive. Please try again.");
      await load(); // Reload to show current state
    }
  }, [selectedIds, load]);

  const handleBulkStatusChange = useCallback(() => {
    if (selectedIds.size === 0) return;

    const statusOptions: QuoteStatus[] = ["draft", "sent", "approved", "declined", "completed", "archived"];

    Alert.alert(
      "Change Status",
      `Set status for ${selectedIds.size} quote${selectedIds.size === 1 ? "" : "s"}`,
      [
        ...statusOptions.map((status) => ({
          text: QuoteStatusMeta[status].label,
          onPress: async () => {
            try {
              for (const id of selectedIds) {
                await updateQuote(id, { status });
              }
              await load();
              setSelectMode(false);
              setSelectedIds(new Set());
            } catch (error) {
              console.error("Failed to update quote status:", error);
              Alert.alert("Error", "Some quotes failed to update. Please try again.");
              await load(); // Reload to show current state
            }
          },
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  }, [selectedIds, load]);

  // Filter and sort quotes
  const filteredQuotes = React.useMemo(() => {
    let filtered = quotes;

    // Filter by status or follow-up
    if (selectedStatus === "followup") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((quote) => {
        if (!quote.followUpDate) return false;
        const followUpDate = new Date(quote.followUpDate);
        followUpDate.setHours(0, 0, 0, 0);
        return followUpDate <= today;
      });
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

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date":
          comparison = new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
          break;
        case "amount":
          comparison = (b.total || 0) - (a.total || 0);
          break;
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "client":
          comparison = (a.clientName || "").localeCompare(b.clientName || "");
          break;
        case "followUp":
          // Quotes with follow-up dates come first, then sorted by date
          const aDate = a.followUpDate ? new Date(a.followUpDate).getTime() : Infinity;
          const bDate = b.followUpDate ? new Date(b.followUpDate).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
      }
      return sortOrder === "asc" ? -comparison : comparison;
    });

    return sorted;
  }, [quotes, searchQuery, selectedStatus, sortBy, sortOrder]);

  // Group linked quotes together
  type QuoteOrGroup = { type: "single"; quote: Quote } | { type: "group"; quotes: Quote[] };

  const groupedQuotes = React.useMemo((): QuoteOrGroup[] => {
    const result: QuoteOrGroup[] = [];
    const processedIds = new Set<string>();

    // Helper to collect all linked quotes transitively (handles star topology)
    const collectLinkedQuotes = (startQuote: Quote): Quote[] => {
      const group: Quote[] = [];
      const toProcess = [startQuote];
      const seen = new Set<string>();

      while (toProcess.length > 0) {
        const current = toProcess.pop()!;
        if (seen.has(current.id)) continue;
        seen.add(current.id);
        group.push(current);

        // Check this quote's linked quotes
        if (current.linkedQuoteIds) {
          for (const linkedId of current.linkedQuoteIds) {
            if (!seen.has(linkedId)) {
              const linkedQuote = filteredQuotes.find(q => q.id === linkedId);
              if (linkedQuote) {
                toProcess.push(linkedQuote);
              }
            }
          }
        }
      }

      return group;
    };

    for (const quote of filteredQuotes) {
      // Skip if already processed as part of a group
      if (processedIds.has(quote.id)) continue;

      // Check if this quote has linked quotes
      if (quote.linkedQuoteIds && quote.linkedQuoteIds.length > 0) {
        // Collect all linked quotes transitively (follows links through base)
        const groupQuotes = collectLinkedQuotes(quote);

        // Mark all as processed
        for (const gq of groupQuotes) {
          processedIds.add(gq.id);
        }

        // Only create a group if we have 2+ quotes
        if (groupQuotes.length >= 2) {
          result.push({ type: "group", quotes: groupQuotes });
        } else {
          result.push({ type: "single", quote });
        }
      } else {
        processedIds.add(quote.id);
        result.push({ type: "single", quote });
      }
    }

    return result;
  }, [filteredQuotes]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredQuotes.map((q) => q.id)));
  }, [filteredQuotes]);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: selectMode ? `${selectedIds.size} Selected` : "Quotes",
          headerTitleAlign: 'center',
          headerRight: () => (
            selectMode ? (
              <Pressable onPress={toggleSelectMode} style={{ paddingHorizontal: 16 }}>
                <Text style={{ color: theme.colors.accent, fontSize: 16, fontWeight: "600" }}>
                  Done
                </Text>
              </Pressable>
            ) : (
              <HeaderIconButton
                onPress={handleCreateNewQuote}
                icon="+"
                side="right"
              />
            )
          ),
        }}
      />
      <GradientBackground>
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
            label="Follow-ups"
            active={selectedStatus === "followup"}
            onPress={() => setSelectedStatus("followup")}
            color="#FF9500"
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
            label="Declined"
            active={selectedStatus === "declined"}
            onPress={() => setSelectedStatus("declined")}
            color={QuoteStatusMeta.declined.color}
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

        {/* Search and Sort */}
        <View style={styles.topBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search quotes..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          <Pressable
            style={styles.sortButton}
            onPress={() => setShowSortModal(true)}
          >
            <Ionicons name="swap-vertical-outline" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Sort Modal */}
        <Modal
          visible={showSortModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSortModal(false)}
        >
          <Pressable
            style={styles.sortModalOverlay}
            onPress={() => setShowSortModal(false)}
          >
            <View style={styles.sortModalContent}>
              <Text style={styles.sortModalTitle}>Sort By</Text>
              {[
                { key: "date" as const, label: "Date", defaultOrder: "desc" as const },
                { key: "amount" as const, label: "Amount", defaultOrder: "desc" as const },
                { key: "name" as const, label: "Name", defaultOrder: "asc" as const },
                { key: "client" as const, label: "Client", defaultOrder: "asc" as const },
                { key: "followUp" as const, label: "Follow-up", defaultOrder: "desc" as const },
              ].map((option) => (
                <Pressable
                  key={option.key}
                  style={styles.sortModalOption}
                  onPress={() => {
                    if (sortBy === option.key) {
                      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                    } else {
                      setSortBy(option.key);
                      setSortOrder(option.defaultOrder);
                    }
                    setShowSortModal(false);
                  }}
                >
                  <Text style={[
                    styles.sortModalOptionText,
                    sortBy === option.key && styles.sortModalOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                  {sortBy === option.key && (
                    <Text style={styles.sortModalOptionArrow}>
                      {sortOrder === "desc" ? "↓" : "↑"}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Quote List */}
        {selectMode ? (
          <FlatList
            data={filteredQuotes}
            keyExtractor={(q) => q.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item: quote }) => (
              <Pressable
                style={styles.selectableItem}
                onPress={() => toggleSelectQuote(quote.id)}
              >
                <View style={[
                  styles.checkbox,
                  selectedIds.has(quote.id) && styles.checkboxSelected
                ]}>
                  {selectedIds.has(quote.id) && (
                    <Ionicons name="checkmark" size={16} color="#000" />
                  )}
                </View>
                <View style={styles.selectableItemContent}>
                  <Text style={styles.selectableItemName} numberOfLines={1}>
                    {quote.name || "Untitled"}{quote.tier ? ` - ${quote.tier}` : ""}
                  </Text>
                  <Text style={styles.selectableItemClient} numberOfLines={1}>
                    {quote.clientName || "No client"}
                  </Text>
                </View>
                <Text style={styles.selectableItemTotal}>
                  ${quote.total?.toFixed(2) || "0.00"}
                </Text>
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            data={groupedQuotes}
            keyExtractor={(item) =>
              item.type === "single" ? item.quote.id : item.quotes[0].id
            }
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => {
              if (item.type === "group") {
                return (
                  <QuoteGroup
                    quotes={item.quotes}
                    onEdit={(q) => router.push(`/quote/${q.id}/edit`)}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onLongPress={(q) => enterSelectMode(q.id)}
                    onCreateTier={handleCreateTier}
                    onExportAllTiers={handleExportAllTiers}
                    onUnlink={handleUnlink}
                    coCounts={coCounts}
                  />
                );
              }

              return (
                <SwipeableQuoteItem
                  item={item.quote}
                  onEdit={() => router.push(`/quote/${item.quote.id}/edit`)}
                  onDelete={() => handleDelete(item.quote)}
                  onDuplicate={() => handleDuplicate(item.quote)}
                  onLongPress={() => enterSelectMode(item.quote.id)}
                  onCreateTier={() => handleCreateTier(item.quote)}
                  onExportAllTiers={() => handleExportAllTiers(item.quote)}
                  onUnlink={() => handleUnlink(item.quote)}
                  changeOrderCount={coCounts[item.quote.id]}
                />
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                  {selectedStatus === "all" && searchQuery === ""
                    ? "No quotes yet"
                    : searchQuery !== ""
                    ? "No matches"
                    : selectedStatus === "followup"
                    ? "No follow-ups due"
                    : `No ${selectedStatus} quotes`}
                </Text>
                <Text style={styles.emptyDescription}>
                  {selectedStatus === "all" && searchQuery === ""
                    ? "Tap the + to start"
                    : searchQuery !== ""
                    ? `Try a different search term`
                    : selectedStatus === "followup"
                    ? "You're all caught up!"
                    : `Tap the + to start`}
                </Text>
              </View>
            }
          />
        )}

        <UndoSnackbar
          visible={showUndo}
          message={`Deleted "${deletedQuote?.name || "quote"}"`}
          onUndo={handleUndo}
          onDismiss={handleDismissUndo}
        />

        {/* Bulk Actions Bar */}
        {selectMode && (
          <View style={styles.bulkActionsBar}>
            <Pressable
              style={styles.bulkActionButton}
              onPress={selectAll}
            >
              <Ionicons name="checkmark-done-outline" size={20} color={theme.colors.text} />
              <Text style={styles.bulkActionText}>Select All</Text>
            </Pressable>

            <Pressable
              style={[styles.bulkActionButton, selectedIds.size === 0 && styles.bulkActionDisabled]}
              onPress={handleBulkStatusChange}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="flag-outline" size={20} color={selectedIds.size === 0 ? theme.colors.muted : theme.colors.text} />
              <Text style={[styles.bulkActionText, selectedIds.size === 0 && styles.bulkActionTextDisabled]}>Status</Text>
            </Pressable>

            <Pressable
              style={[styles.bulkActionButton, selectedIds.size === 0 && styles.bulkActionDisabled]}
              onPress={handleBulkArchive}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="archive-outline" size={20} color={selectedIds.size === 0 ? theme.colors.muted : theme.colors.text} />
              <Text style={[styles.bulkActionText, selectedIds.size === 0 && styles.bulkActionTextDisabled]}>Archive</Text>
            </Pressable>

            <Pressable
              style={[styles.bulkActionButton, selectedIds.size === 0 && styles.bulkActionDisabled]}
              onPress={handleBulkDelete}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="trash-outline" size={20} color={selectedIds.size === 0 ? theme.colors.muted : "#FF3B30"} />
              <Text style={[styles.bulkActionText, selectedIds.size === 0 && styles.bulkActionTextDisabled, selectedIds.size > 0 && { color: "#FF3B30" }]}>Delete</Text>
            </Pressable>
          </View>
        )}
      </GradientBackground>
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
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      backgroundColor: theme.colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    searchInput: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sortButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    filterScrollView: {
      flexGrow: 0,
      flexShrink: 0,
    },
    filterContainer: {
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
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
      color: "#000", // Black on orange accent (good contrast)
    },
    listContent: {
      padding: theme.spacing(3),
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
      lineHeight: 20,
      maxWidth: 300,
    },
    // Multi-select styles
    selectableItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing(2),
    },
    checkboxSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    selectableItemContent: {
      flex: 1,
    },
    selectableItemName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    selectableItemClient: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    selectableItemTotal: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    // Bulk actions bar
    bulkActionsBar: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      paddingBottom: theme.spacing(4), // Extra padding for home indicator
    },
    bulkActionButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(1.5),
    },
    bulkActionText: {
      fontSize: 12,
      color: theme.colors.text,
      marginTop: 4,
    },
    bulkActionDisabled: {
      opacity: 0.5,
    },
    bulkActionTextDisabled: {
      color: theme.colors.muted,
    },
    // Sort modal styles
    sortModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    sortModalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      minWidth: 200,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    sortModalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: theme.spacing(2),
      paddingBottom: theme.spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sortModalOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderRadius: theme.radius.sm,
    },
    sortModalOptionText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    sortModalOptionTextActive: {
      color: theme.colors.accent,
      fontWeight: "600",
    },
    sortModalOptionArrow: {
      fontSize: 16,
      color: theme.colors.accent,
      fontWeight: "600",
      marginLeft: theme.spacing(1),
    },
  });
}
