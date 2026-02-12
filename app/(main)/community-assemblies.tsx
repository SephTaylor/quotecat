// app/(main)/community-assemblies.tsx
// Browse shared community assemblies

import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { Screen } from "@/modules/core/ui";
import {
  fetchSharedAssemblies,
  getUserVotes,
  voteOnAssembly,
  type FetchSharedAssembliesOptions,
} from "@/lib/sharedAssembliesApi";
import type { SharedAssembly, AssemblyTrade, SharedAssemblySortOption } from "@/lib/types";
import { ASSEMBLY_TRADES } from "@/lib/types";

const SORT_OPTIONS: { id: SharedAssemblySortOption; label: string }[] = [
  { id: "popular", label: "Most Copied" },
  { id: "newest", label: "Newest" },
  { id: "top_rated", label: "Top Rated" },
];

export default function CommunityAssembliesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Data state
  const [assemblies, setAssemblies] = useState<SharedAssembly[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Filter state
  const [selectedTrade, setSelectedTrade] = useState<AssemblyTrade | "all">("all");
  const [selectedSort, setSelectedSort] = useState<SharedAssemblySortOption>("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Vote state
  const [userVotes, setUserVotes] = useState<Map<string, "up" | "down">>(new Map());
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch assemblies
  const fetchData = useCallback(
    async (resetPage = false) => {
      const currentPage = resetPage ? 0 : page;

      if (resetPage) {
        setLoading(true);
        setPage(0);
      }

      try {
        const options: FetchSharedAssembliesOptions = {
          trade: selectedTrade,
          sort: selectedSort,
          search: debouncedSearch || undefined,
          page: currentPage,
        };

        const result = await fetchSharedAssemblies(options);

        if (resetPage) {
          setAssemblies(result.assemblies);
        } else {
          setAssemblies((prev) => [...prev, ...result.assemblies]);
        }

        setHasMore(result.hasMore);

        // Fetch user votes for displayed assemblies
        const ids = result.assemblies.map((a) => a.id);
        if (ids.length > 0) {
          const votes = await getUserVotes(ids);
          setUserVotes((prev) => {
            const next = new Map(prev);
            votes.forEach((v, k) => next.set(k, v));
            return next;
          });
        }
      } catch (error) {
        console.error("Failed to fetch community assemblies:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, selectedTrade, selectedSort, debouncedSearch]
  );

  // Initial fetch and refetch on filter change
  useEffect(() => {
    fetchData(true);
  }, [selectedTrade, selectedSort, debouncedSearch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
  };

  const onEndReached = () => {
    if (!loading && hasMore) {
      setPage((p) => p + 1);
      fetchData(false);
    }
  };

  // Handle vote
  const handleVote = async (assemblyId: string, voteType: "up" | "down") => {
    if (votingIds.has(assemblyId)) return;

    const currentVote = userVotes.get(assemblyId);
    const newVote = currentVote === voteType ? null : voteType;

    // Optimistic update
    setVotingIds((prev) => new Set(prev).add(assemblyId));
    setUserVotes((prev) => {
      const next = new Map(prev);
      if (newVote === null) {
        next.delete(assemblyId);
      } else {
        next.set(assemblyId, newVote);
      }
      return next;
    });

    // Update counts optimistically
    setAssemblies((prev) =>
      prev.map((a) => {
        if (a.id !== assemblyId) return a;
        let { upvoteCount, downvoteCount } = a;

        // Remove old vote
        if (currentVote === "up") upvoteCount--;
        if (currentVote === "down") downvoteCount--;

        // Add new vote
        if (newVote === "up") upvoteCount++;
        if (newVote === "down") downvoteCount++;

        return { ...a, upvoteCount, downvoteCount };
      })
    );

    try {
      await voteOnAssembly(assemblyId, newVote);
    } catch (error) {
      console.error("Failed to vote:", error);
      // Revert on error
      setUserVotes((prev) => {
        const next = new Map(prev);
        if (currentVote) {
          next.set(assemblyId, currentVote);
        } else {
          next.delete(assemblyId);
        }
        return next;
      });
      // Revert counts
      setAssemblies((prev) =>
        prev.map((a) => {
          if (a.id !== assemblyId) return a;
          let { upvoteCount, downvoteCount } = a;
          if (newVote === "up") upvoteCount--;
          if (newVote === "down") downvoteCount--;
          if (currentVote === "up") upvoteCount++;
          if (currentVote === "down") downvoteCount++;
          return { ...a, upvoteCount, downvoteCount };
        })
      );
    } finally {
      setVotingIds((prev) => {
        const next = new Set(prev);
        next.delete(assemblyId);
        return next;
      });
    }
  };

  const renderAssemblyCard = ({ item }: { item: SharedAssembly }) => {
    const userVote = userVotes.get(item.id);
    const netVotes = item.upvoteCount - item.downvoteCount;

    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/(main)/copy-assembly/${item.id}` as any)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Pressable
            style={styles.copyButton}
            onPress={() => router.push(`/(main)/copy-assembly/${item.id}` as any)}
          >
            <Text style={styles.copyButtonText}>Copy</Text>
          </Pressable>
        </View>

        {item.creatorDisplayName && (
          <Text style={styles.creator}>by {item.creatorDisplayName}</Text>
        )}

        <Text style={styles.meta}>
          {item.items.length} items | {item.copyCount} copies
        </Text>

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Vote buttons */}
        <View style={styles.voteRow}>
          <Pressable
            style={[
              styles.voteButton,
              userVote === "up" && styles.voteButtonActive,
            ]}
            onPress={() => handleVote(item.id, "up")}
          >
            <Text
              style={[
                styles.voteIcon,
                userVote === "up" && styles.voteIconActive,
              ]}
            >
              +
            </Text>
            <Text
              style={[
                styles.voteCount,
                userVote === "up" && styles.voteCountActive,
              ]}
            >
              {item.upvoteCount}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.voteButton,
              userVote === "down" && styles.voteButtonActiveDown,
            ]}
            onPress={() => handleVote(item.id, "down")}
          >
            <Text
              style={[
                styles.voteIcon,
                userVote === "down" && styles.voteIconActiveDown,
              ]}
            >
              -
            </Text>
            <Text
              style={[
                styles.voteCount,
                userVote === "down" && styles.voteCountActiveDown,
              ]}
            >
              {item.downvoteCount}
            </Text>
          </Pressable>

          <Text style={[styles.netVotes, netVotes < 0 && styles.netVotesNeg]}>
            {netVotes >= 0 ? `+${netVotes}` : netVotes}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Community Library",
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
        }}
      />
      <Screen scroll={false} contentStyle={styles.container}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search assemblies..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Trade filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          <Pressable
            style={[styles.chip, selectedTrade === "all" && styles.chipSelected]}
            onPress={() => setSelectedTrade("all")}
          >
            <Text
              style={[
                styles.chipText,
                selectedTrade === "all" && styles.chipTextSelected,
              ]}
            >
              All
            </Text>
          </Pressable>
          {ASSEMBLY_TRADES.map((trade) => (
            <Pressable
              key={trade.id}
              style={[
                styles.chip,
                selectedTrade === trade.id && styles.chipSelected,
              ]}
              onPress={() => setSelectedTrade(trade.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedTrade === trade.id && styles.chipTextSelected,
                ]}
              >
                {trade.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Sort options */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              style={[
                styles.sortChip,
                selectedSort === opt.id && styles.sortChipSelected,
              ]}
              onPress={() => setSelectedSort(opt.id)}
            >
              <Text
                style={[
                  styles.sortChipText,
                  selectedSort === opt.id && styles.sortChipTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Assembly list */}
        {loading && assemblies.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <FlatList
            data={assemblies}
            keyExtractor={(item) => item.id}
            renderItem={renderAssemblyCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {debouncedSearch
                  ? `No assemblies found for "${debouncedSearch}"`
                  : "No community assemblies yet. Be the first to share!"}
              </Text>
            }
            ListFooterComponent={
              loading && assemblies.length > 0 ? (
                <ActivityIndicator style={styles.footerLoader} />
              ) : null
            }
          />
        )}
      </Screen>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    searchContainer: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(1),
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 14,
      color: theme.colors.text,
    },
    filterRow: {
      maxHeight: 44,
    },
    filterContent: {
      paddingHorizontal: theme.spacing(2),
      gap: theme.spacing(1),
    },
    chip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: 9999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    chipText: {
      fontSize: 13,
      color: theme.colors.text,
    },
    chipTextSelected: {
      color: "#000",
      fontWeight: "600",
    },
    sortRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      gap: theme.spacing(1),
    },
    sortLabel: {
      fontSize: 13,
      color: theme.colors.muted,
      marginRight: theme.spacing(0.5),
    },
    sortChip: {
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radius.md,
    },
    sortChipSelected: {
      backgroundColor: theme.colors.card,
    },
    sortChipText: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    sortChipTextSelected: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    listContent: {
      paddingHorizontal: theme.spacing(2),
      paddingBottom: theme.spacing(4),
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginRight: theme.spacing(1),
    },
    copyButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(0.75),
      borderRadius: theme.radius.md,
    },
    copyButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#000",
    },
    creator: {
      fontSize: 12,
      color: theme.colors.muted,
      marginBottom: 4,
    },
    meta: {
      fontSize: 12,
      color: theme.colors.muted,
      marginBottom: 8,
    },
    description: {
      fontSize: 13,
      color: theme.colors.text,
      lineHeight: 18,
      marginBottom: 12,
    },
    voteRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    voteButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.bg,
      gap: 4,
    },
    voteButtonActive: {
      backgroundColor: "rgba(76, 175, 80, 0.2)",
    },
    voteButtonActiveDown: {
      backgroundColor: "rgba(244, 67, 54, 0.2)",
    },
    voteIcon: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    voteIconActive: {
      color: "#4CAF50",
    },
    voteIconActiveDown: {
      color: "#F44336",
    },
    voteCount: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    voteCountActive: {
      color: "#4CAF50",
    },
    voteCountActiveDown: {
      color: "#F44336",
    },
    netVotes: {
      fontSize: 13,
      fontWeight: "600",
      color: "#4CAF50",
      marginLeft: "auto",
    },
    netVotesNeg: {
      color: "#F44336",
    },
    empty: {
      textAlign: "center",
      color: theme.colors.muted,
      marginTop: theme.spacing(4),
      paddingHorizontal: theme.spacing(2),
    },
    footerLoader: {
      paddingVertical: theme.spacing(2),
    },
  });
}
