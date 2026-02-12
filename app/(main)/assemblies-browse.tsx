// app/(main)/assemblies-browse.tsx
import { useTheme } from "@/contexts/ThemeContext";
import { useAssemblies } from "@/modules/assemblies";
import { deleteAssembly } from "@/modules/assemblies/storage";
import { getUserState } from "@/lib/user";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import React, { memo, useMemo, useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
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
import Swipeable from "react-native-gesture-handler/Swipeable";
import type { Assembly } from "@/modules/assemblies";
import { GradientBackground } from "@/components/GradientBackground";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import {
  fetchSharedAssemblies,
  getUserVotes,
  voteOnAssembly,
  getAssemblyComments,
  addAssemblyComment,
} from "@/lib/sharedAssembliesApi";
import { syncAssemblies } from "@/lib/assembliesSync";
import type { SharedAssembly, AssemblyTrade, SharedAssemblySortOption, AssemblyComment } from "@/lib/types";
import { ASSEMBLY_TRADES } from "@/lib/types";

type TabType = "my" | "community";

const SORT_OPTIONS: { id: SharedAssemblySortOption; label: string }[] = [
  { id: "popular", label: "Most Copied" },
  { id: "newest", label: "Newest" },
  { id: "top_rated", label: "Top Rated" },
];

// Memoized assembly list item for performance
const AssemblyListItem = memo(
  ({
    item,
    onPress,
    onDelete,
    styles,
  }: {
    item: Assembly;
    onPress: () => void;
    onDelete?: () => void;
    styles: ReturnType<typeof createStyles>;
  }) => {
    const materialCount = item.items.length;
    const isCustom = item.id.startsWith("custom-");

    const renderRightActions = () =>
      isCustom && onDelete ? (
        <Pressable style={styles.deleteAction} onPress={onDelete}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      ) : null;

    const content = (
      <Pressable
        style={[styles.card, isCustom && styles.cardCustom]}
        onPress={onPress}
      >
        <View style={styles.cardRow}>
          <Text style={styles.title} numberOfLines={1}>
            {isCustom && "📌 "}
            {item.name}
          </Text>
          <Text style={styles.sub}>
            {materialCount} item{materialCount !== 1 ? "s" : ""}
          </Text>
        </View>
      </Pressable>
    );

    return isCustom && onDelete ? (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        {content}
      </Swipeable>
    ) : (
      content
    );
  },
);

AssemblyListItem.displayName = "AssemblyListItem";

export default function AssembliesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ quoteId?: string }>();
  const quoteId = params.quoteId; // If present, we're adding to an existing quote
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { assemblies, loading, reload } = useAssemblies();
  const [refreshing, setRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPro, setIsPro] = React.useState(false);
  const [checkingTier, setCheckingTier] = React.useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("my");

  // Community tab state
  const [communityAssemblies, setCommunityAssemblies] = useState<SharedAssembly[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityUnavailable, setCommunityUnavailable] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<AssemblyTrade | "all">("all");
  const [selectedSort, setSelectedSort] = useState<SharedAssemblySortOption>("popular");
  const [communitySearch, setCommunitySearch] = useState("");
  const [userVotes, setUserVotes] = useState<Map<string, "up">>(new Map());
  const [expandedAssembly, setExpandedAssembly] = useState<string | null>(null);

  // Comments state
  const [commentsOpen, setCommentsOpen] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Map<string, AssemblyComment[]>>(new Map());
  const [loadingComments, setLoadingComments] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Check Pro tier on mount
  React.useEffect(() => {
    const checkTier = async () => {
      const userState = await getUserState();
      setIsPro(userState.tier === "pro" || userState.tier === "premium");
      setCheckingTier(false);
    };
    checkTier();
  }, []);

  // Fetch community assemblies when tab changes or filters change
  const fetchCommunity = useCallback(async () => {
    if (activeTab !== "community") return;
    setCommunityLoading(true);
    try {
      const result = await fetchSharedAssemblies({
        trade: selectedTrade,
        sort: selectedSort,
        search: communitySearch || undefined,
      });
      setCommunityAssemblies(result.assemblies);
      // Fetch user votes
      if (result.assemblies.length > 0) {
        const votes = await getUserVotes(result.assemblies.map((a) => a.id));
        setUserVotes(votes);
      }
    } catch (error: any) {
      // If table doesn't exist yet, show "coming soon" instead of error
      if (error?.code === "PGRST205" || error?.message?.includes("shared_assemblies")) {
        setCommunityUnavailable(true);
      } else {
        console.error("Failed to fetch community assemblies:", error);
      }
    } finally {
      setCommunityLoading(false);
    }
  }, [activeTab, selectedTrade, selectedSort, communitySearch]);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  // Toggle comments panel and load comments if needed
  const handleToggleComments = async (assemblyId: string) => {
    if (commentsOpen === assemblyId) {
      setCommentsOpen(null);
      setNewComment("");
      return;
    }

    setCommentsOpen(assemblyId);

    // Load comments if not already loaded
    if (!commentsMap.has(assemblyId)) {
      setLoadingComments(assemblyId);
      try {
        const comments = await getAssemblyComments(assemblyId);
        setCommentsMap((prev) => new Map(prev).set(assemblyId, comments));
      } catch (error) {
        console.error("Failed to load comments:", error);
      } finally {
        setLoadingComments(null);
      }
    }
  };

  // Submit a new comment
  const handleSubmitComment = async (assemblyId: string) => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const comment = await addAssemblyComment(assemblyId, newComment.trim());
      if (comment) {
        setCommentsMap((prev) => {
          const next = new Map(prev);
          const existing = next.get(assemblyId) || [];
          next.set(assemblyId, [...existing, comment]);
          return next;
        });
        // Update comment count in the list
        setCommunityAssemblies((prev) =>
          prev.map((a) =>
            a.id === assemblyId ? { ...a, commentCount: (a.commentCount || 0) + 1 } : a
          )
        );
        setNewComment("");
      }
    } catch (error) {
      Alert.alert("Error", "Could not post comment. Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle like (toggle)
  const handleVote = async (assemblyId: string, voteType: "up") => {
    const currentVote = userVotes.get(assemblyId);
    const isLiked = currentVote === "up";
    const newVote = isLiked ? null : "up";

    // Optimistic update
    setUserVotes((prev) => {
      const next = new Map(prev);
      if (newVote === null) {
        next.delete(assemblyId);
      } else {
        next.set(assemblyId, "up");
      }
      return next;
    });

    setCommunityAssemblies((prev) =>
      prev.map((a) => {
        if (a.id !== assemblyId) return a;
        const upvoteCount = a.upvoteCount + (isLiked ? -1 : 1);
        return { ...a, upvoteCount };
      })
    );

    try {
      await voteOnAssembly(assemblyId, newVote);
    } catch (error) {
      console.error("Failed to like:", error);
      // Revert on error
      fetchCommunity();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncAssemblies(); // Sync from cloud first
    } catch (error) {
      console.error("Failed to sync assemblies:", error);
    }
    await reload(); // Then reload from local
    setRefreshing(false);
  };

  const handleDeleteAssembly = async (assembly: Assembly) => {
    const isCustom = assembly.id.startsWith("custom-");

    if (!isCustom) {
      Alert.alert(
        "Cannot Delete",
        "Seed assemblies cannot be deleted. Only custom assemblies can be removed.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Delete Assembly?",
      `Are you sure you want to delete "${assembly.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAssembly(assembly.id);
              await reload(); // Refresh the list
            } catch (error) {
              console.error("Failed to delete assembly:", error);
              Alert.alert("Error", "Could not delete assembly. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Filter assemblies based on search query
  const filteredAssemblies = useMemo(() => {
    if (!searchQuery.trim()) return assemblies;
    const query = searchQuery.toLowerCase();
    return assemblies.filter((assembly) =>
      assembly.name.toLowerCase().includes(query)
    );
  }, [assemblies, searchQuery]);

  if (loading || checkingTier) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Assembly Library",
            headerShown: true,
            headerTitleAlign: 'center',
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          }}
        />
        <GradientBackground>
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        </GradientBackground>
      </>
    );
  }

  // Show upgrade teaser for free users
  if (!isPro) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Assembly Library",
            headerShown: true,
            headerTitleAlign: 'center',
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          }}
        />
        <GradientBackground>
          <View style={styles.upgradeContainer}>
            <Text style={styles.upgradeIcon}>🚀</Text>
            <Text style={styles.upgradeTitle}>Assemblies Library</Text>
            <Text style={styles.upgradeSubtitle}>Pro Feature</Text>

            <View style={styles.upgradeCard}>
              <Text style={styles.upgradeDescription}>
                Save your quotes as reusable assembly templates and speed up your workflow.
              </Text>

              <View style={styles.benefitsList}>
                <View style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>⚡</Text>
                  <Text style={styles.benefitText}>
                    Pre-built material calculators for common tasks
                  </Text>
                </View>
                <View style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>💾</Text>
                  <Text style={styles.benefitText}>
                    Save your own quotes as custom assemblies
                  </Text>
                </View>
                <View style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>📌</Text>
                  <Text style={styles.benefitText}>
                    Build your personal template library
                  </Text>
                </View>
                <View style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>🎯</Text>
                  <Text style={styles.benefitText}>
                    Always-current pricing from live catalog
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              style={styles.upgradeButton}
              onPress={() => router.push("/(auth)/sign-in")}
            >
              <Text style={styles.upgradeButtonText}>Sign In</Text>
            </Pressable>
          </View>
        </GradientBackground>
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Assembly Library",
          headerShown: true,
          headerTitleAlign: 'center',
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
        }}
      />
      <GradientBackground>
        {/* Tab bar */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, activeTab === "my" && styles.tabActive]}
            onPress={() => setActiveTab("my")}
          >
            <Text style={[styles.tabText, activeTab === "my" && styles.tabTextActive]}>
              My Assemblies
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "community" && styles.tabActive]}
            onPress={() => setActiveTab("community")}
          >
            <Text style={[styles.tabText, activeTab === "community" && styles.tabTextActive]}>
              Community
            </Text>
          </Pressable>
        </View>

        {/* My Assemblies Tab Content */}
        {activeTab === "my" && (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.headerDescription}>
                Your reusable material templates
              </Text>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search assemblies..."
                placeholderTextColor={theme.colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredAssemblies}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              style={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              renderItem={({ item }) => (
                <AssemblyListItem
                  item={item}
                  onPress={() => {
                    const url = quoteId
                      ? `/(main)/assembly/${item.id}?quoteId=${quoteId}`
                      : `/(main)/assembly/${item.id}`;
                    router.push(url as any);
                  }}
                  onDelete={() => handleDeleteAssembly(item)}
                  styles={styles}
                />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searchQuery.trim()
                ? `No assemblies found for "${searchQuery}"`
                : "No assemblies available."}
            </Text>
          }
        />
          </>
        )}

        {/* Community Tab Content */}
        {activeTab === "community" && (
          <>
            {/* Search */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search community assemblies..."
                placeholderTextColor={theme.colors.muted}
                value={communitySearch}
                onChangeText={setCommunitySearch}
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
                <Text style={[styles.chipText, selectedTrade === "all" && styles.chipTextSelected]}>
                  All
                </Text>
              </Pressable>
              {ASSEMBLY_TRADES.map((trade) => (
                <Pressable
                  key={trade.id}
                  style={[styles.chip, selectedTrade === trade.id && styles.chipSelected]}
                  onPress={() => setSelectedTrade(trade.id)}
                >
                  <Text style={[styles.chipText, selectedTrade === trade.id && styles.chipTextSelected]}>
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
                  style={[styles.sortChip, selectedSort === opt.id && styles.sortChipSelected]}
                  onPress={() => setSelectedSort(opt.id)}
                >
                  <Text style={[styles.sortChipText, selectedSort === opt.id && styles.sortChipTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Community assembly list */}
            {communityUnavailable ? (
              <View style={styles.comingSoonContainer}>
                <Text style={styles.comingSoonTitle}>Coming Soon</Text>
                <Text style={styles.comingSoonText}>
                  The community library is being built! Soon you'll be able to browse and share assembly templates with other contractors.
                </Text>
              </View>
            ) : communityLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <FlatList
                data={communityAssemblies}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                style={styles.list}
                refreshControl={
                  <RefreshControl refreshing={communityLoading} onRefresh={fetchCommunity} />
                }
                renderItem={({ item }) => {
                  const userVote = userVotes.get(item.id);
                  const isExpanded = expandedAssembly === item.id;
                  return (
                    <View style={styles.card}>
                      {/* Title + action buttons */}
                      <View style={styles.cardHeader}>
                        <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.actionButtons}>
                          <Pressable
                            style={styles.viewButton}
                            onPress={() => setExpandedAssembly(isExpanded ? null : item.id)}
                          >
                            <Text style={styles.viewButtonText}>{isExpanded ? "Hide" : "View"}</Text>
                          </Pressable>
                          <Pressable
                            style={styles.copyButton}
                            onPress={() => router.push(`/(main)/copy-assembly/${item.id}` as any)}
                          >
                            <Text style={styles.copyButtonText}>Copy</Text>
                          </Pressable>
                        </View>
                      </View>
                      {/* Meta row */}
                      <Text style={styles.meta} numberOfLines={1}>
                        {item.creatorDisplayName ? `by ${item.creatorDisplayName} · ` : ""}
                        {item.items.length} items · {item.copyCount} copies
                      </Text>
                      {isExpanded && item.items.length > 0 && (
                        <View style={styles.itemsList}>
                          {item.items.slice(0, 10).map((assemblyItem, idx) => (
                            <Text key={idx} style={styles.itemRow}>
                              • {assemblyItem.name} × {assemblyItem.qty}
                            </Text>
                          ))}
                          {item.items.length > 10 && (
                            <Text style={styles.itemRowMore}>
                              +{item.items.length - 10} more...
                            </Text>
                          )}
                        </View>
                      )}
                      {/* Like and comments */}
                      <View style={styles.voteRow}>
                        <Pressable
                          style={[styles.voteButton, userVote === "up" && styles.voteButtonActive]}
                          onPress={() => handleVote(item.id, "up")}
                        >
                          <Text style={styles.voteLabel}>Like</Text>
                          <Text style={[styles.voteCount, userVote === "up" && styles.voteCountActive]}>{item.upvoteCount}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.commentToggle, commentsOpen === item.id && styles.commentToggleActive]}
                          onPress={() => handleToggleComments(item.id)}
                        >
                          <Text style={styles.commentLabel}>
                            {item.commentCount || 0} comment{(item.commentCount || 0) !== 1 ? "s" : ""}
                          </Text>
                        </Pressable>
                      </View>

                      {/* Comments section */}
                      {commentsOpen === item.id && (
                        <View style={styles.commentsSection}>
                          {loadingComments === item.id ? (
                            <ActivityIndicator size="small" style={{ marginVertical: 8 }} />
                          ) : (
                            <>
                              {(commentsMap.get(item.id) || []).map((comment) => (
                                <View key={comment.id} style={styles.commentItem}>
                                  <View style={styles.commentHeader}>
                                    <Text style={styles.commentAuthor}>
                                      {comment.userDisplayName || "Anonymous"}
                                    </Text>
                                    <Text style={styles.commentDate}>
                                      {new Date(comment.createdAt).toLocaleDateString()}
                                    </Text>
                                  </View>
                                  <Text style={styles.commentContent}>{comment.content}</Text>
                                </View>
                              ))}
                              {(commentsMap.get(item.id) || []).length === 0 && (
                                <Text style={styles.noComments}>No comments yet</Text>
                              )}
                            </>
                          )}
                          <View style={styles.addCommentRow}>
                            <TextInput
                              style={styles.commentInput}
                              placeholder="Add a comment..."
                              placeholderTextColor={theme.colors.muted}
                              value={newComment}
                              onChangeText={setNewComment}
                              multiline
                              maxLength={500}
                            />
                            <Pressable
                              style={[
                                styles.commentButton,
                                (!newComment.trim() || submittingComment) && styles.commentButtonDisabled,
                              ]}
                              onPress={() => handleSubmitComment(item.id)}
                              disabled={!newComment.trim() || submittingComment}
                            >
                              <Text style={styles.commentButtonText}>
                                {submittingComment ? "..." : "Post"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.empty}>
                    No community assemblies yet. Be the first to share!
                  </Text>
                }
              />
            )}
          </>
        )}

      </GradientBackground>
    </GestureHandlerRootView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      paddingTop: 0,
    },
    headerContainer: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },
    headerDescription: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
    },
    tabBar: {
      flexDirection: "row",
      marginHorizontal: theme.spacing(2),
      marginTop: theme.spacing(1.5),
      marginBottom: theme.spacing(1),
      gap: theme.spacing(1),
    },
    tab: {
      flex: 1,
      paddingVertical: theme.spacing(1.25),
      alignItems: "center",
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    tabTextActive: {
      color: "#000",
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(4),
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1.25),
      marginBottom: theme.spacing(0.75),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardCustom: {
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
      marginRight: theme.spacing(1),
    },
    sub: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    empty: {
      textAlign: "center",
      color: theme.colors.muted,
      marginTop: theme.spacing(4),
    },
    searchContainer: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 2,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 14,
      color: theme.colors.text,
    },
    upgradeContainer: {
      flex: 1,
      padding: theme.spacing(3),
      justifyContent: "center",
      alignItems: "center",
    },
    upgradeIcon: {
      fontSize: 64,
      marginBottom: theme.spacing(2),
    },
    upgradeTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
      textAlign: "center",
    },
    upgradeSubtitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.accent,
      marginBottom: theme.spacing(3),
      textAlign: "center",
    },
    upgradeCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      padding: theme.spacing(3),
      marginBottom: theme.spacing(3),
      borderWidth: 1,
      borderColor: theme.colors.border,
      width: "100%",
    },
    upgradeDescription: {
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing(3),
      textAlign: "center",
      lineHeight: 24,
    },
    benefitsList: {
      gap: theme.spacing(2),
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing(1.5),
    },
    benefitIcon: {
      fontSize: 20,
      marginTop: 2,
    },
    benefitText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    upgradeButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(2),
      borderRadius: theme.radius.xl,
      marginBottom: theme.spacing(1.5),
    },
    upgradeButtonText: {
      fontSize: 18,
      fontWeight: "700",
      color: "#000",
    },
    upgradeHint: {
      fontSize: 12,
      color: theme.colors.muted,
      textAlign: "center",
    },
    deleteAction: {
      backgroundColor: theme.colors.danger,
      justifyContent: "center",
      alignItems: "center",
      width: 80,
      borderRadius: theme.radius.lg,
      marginBottom: theme.spacing(2),
    },
    deleteText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    // Community tab styles
    filterRow: {
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
    },
    filterContent: {
      paddingHorizontal: theme.spacing(2),
      gap: theme.spacing(1),
      alignItems: "center",
      height: 44,
    },
    chip: {
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.75),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignSelf: "center",
    },
    chipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    chipText: {
      fontSize: 12,
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
      paddingBottom: theme.spacing(1),
      gap: theme.spacing(0.5),
    },
    sortLabel: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    sortChip: {
      paddingHorizontal: theme.spacing(1.25),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radius.sm,
    },
    sortChipSelected: {
      backgroundColor: theme.colors.card,
    },
    sortChipText: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    sortChipTextSelected: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    actionButtons: {
      flexDirection: "row",
      gap: theme.spacing(1),
    },
    viewButton: {
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.bg,
    },
    viewButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    copyButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radius.md,
    },
    copyButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#000",
    },
    meta: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
      marginBottom: 4,
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
    voteLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    voteCount: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    voteCountActive: {
      color: "#4CAF50",
    },
    commentToggle: {
      marginLeft: "auto",
      paddingHorizontal: theme.spacing(1),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radius.md,
    },
    commentToggleActive: {
      backgroundColor: theme.colors.bg,
    },
    commentLabel: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    commentsSection: {
      marginTop: theme.spacing(1.5),
      paddingTop: theme.spacing(1.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    commentItem: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1),
    },
    commentHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(0.5),
    },
    commentAuthor: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    commentDate: {
      fontSize: 11,
      color: theme.colors.muted,
    },
    commentContent: {
      fontSize: 13,
      color: theme.colors.text,
      lineHeight: 18,
    },
    noComments: {
      fontSize: 13,
      color: theme.colors.muted,
      textAlign: "center",
      paddingVertical: theme.spacing(1),
    },
    addCommentRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
    },
    commentInput: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 14,
      color: theme.colors.text,
      maxHeight: 80,
    },
    commentButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
    },
    commentButtonDisabled: {
      opacity: 0.5,
    },
    commentButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#000",
    },
    comingSoonContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing(4),
    },
    comingSoonTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    comingSoonText: {
      fontSize: 15,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 22,
    },
    itemsPreview: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(0.5),
    },
    itemsList: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      padding: theme.spacing(1.5),
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
    },
    itemRow: {
      fontSize: 13,
      color: theme.colors.text,
      paddingVertical: 2,
    },
    itemRowMore: {
      fontSize: 13,
      color: theme.colors.muted,
      fontStyle: "italic",
      paddingTop: 4,
    },
  });
}
