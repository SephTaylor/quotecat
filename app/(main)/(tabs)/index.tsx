// app/(main)/(tabs)/index.tsx
// Dashboard screen - Overview and quick stats
import { useTheme } from "@/contexts/ThemeContext";
import { listQuotes, type Quote } from "@/lib/quotes";
import { QuoteStatusMeta } from "@/lib/types";
import { calculateTotal } from "@/lib/validation";
import { loadPreferences, type DashboardPreferences } from "@/lib/preferences";
import { deleteQuote, saveQuote, updateQuote } from "@/lib/quotes";
import { SwipeableQuoteItem } from "@/components/SwipeableQuoteItem";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function Dashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<DashboardPreferences>({
    showStats: true,
    showValueTracking: true,
    showPinnedQuotes: true,
    showRecentQuotes: true,
    showQuickActions: true,
    recentQuotesCount: 5,
  });
  const [deletedQuote, setDeletedQuote] = useState<Quote | null>(null);
  const [showUndo, setShowUndo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, prefs] = await Promise.all([listQuotes(), loadPreferences()]);
    setQuotes(data);
    setPreferences(prefs.dashboard);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Calculate stats
  const stats = React.useMemo(() => {
    const activeQuotes = quotes.filter((q) => q.status === "active");
    const draftQuotes = quotes.filter((q) => q.status === "draft");
    const sentQuotes = quotes.filter((q) => q.status === "sent");
    const pinnedQuotes = quotes.filter((q) => q.pinned);

    const totalValue = quotes.reduce((sum, q) => sum + calculateTotal(q), 0);
    const activeValue = activeQuotes.reduce(
      (sum, q) => sum + calculateTotal(q),
      0,
    );

    return {
      total: quotes.length,
      active: activeQuotes.length,
      draft: draftQuotes.length,
      sent: sentQuotes.length,
      pinned: pinnedQuotes.length,
      totalValue,
      activeValue,
      pinnedQuotes,
    };
  }, [quotes]);

  const recentQuotes = React.useMemo(() => {
    if (preferences.recentQuotesCount === "all") {
      return quotes;
    }
    return quotes.slice(0, preferences.recentQuotesCount);
  }, [quotes, preferences.recentQuotesCount]);

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

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{ title: "Dashboard", headerBackVisible: false }}
      />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* App Title with Settings Button */}
          <View style={styles.titleRow}>
            <Text style={styles.appTitle}>QuoteCat</Text>
            <Pressable
              style={styles.settingsButton}
              onPress={() => router.push("/settings" as any)}
            >
              <Ionicons
                name="settings-outline"
                size={24}
                color={theme.colors.text}
              />
            </Pressable>
          </View>

          {/* Quick Stats */}
          {preferences.showStats && (
            <View style={styles.statsGrid}>
              <StatCard
                label="Total Quotes"
                value={stats.total}
                color={theme.colors.text}
                theme={theme}
              />
              <StatCard
                label="Active"
                value={stats.active}
                color={QuoteStatusMeta.active.color}
                theme={theme}
              />
              <StatCard
                label="Drafts"
                value={stats.draft}
                color={QuoteStatusMeta.draft.color}
                theme={theme}
              />
              <StatCard
                label="Sent"
                value={stats.sent}
                color={QuoteStatusMeta.sent.color}
                theme={theme}
              />
            </View>
          )}

          {/* Value Stats */}
          {preferences.showValueTracking && (
            <View style={styles.valueSection}>
              <View style={styles.valueRow}>
                <View>
                  <Text style={styles.valueLabel}>Total Value</Text>
                  <Text style={styles.valueText}>
                    ${stats.totalValue.toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.valueLabel}>Active</Text>
                  <Text style={styles.valueTextSecondary}>
                    ${stats.activeValue.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Pinned Quotes */}
          {preferences.showPinnedQuotes && stats.pinnedQuotes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pinned Quotes</Text>
              {stats.pinnedQuotes.map((quote) => (
                <SwipeableQuoteItem
                  key={quote.id}
                  item={quote}
                  onEdit={() => router.push(`/quote/${quote.id}/edit`)}
                  onDelete={() => handleDelete(quote)}
                  onTogglePin={() => handleTogglePin(quote)}
                />
              ))}
            </View>
          )}

          {/* Recent Activity */}
          {preferences.showRecentQuotes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Quotes</Text>
              {recentQuotes.map((quote) => (
                <SwipeableQuoteItem
                  key={quote.id}
                  item={quote}
                  onEdit={() => router.push(`/quote/${quote.id}/edit`)}
                  onDelete={() => handleDelete(quote)}
                  onTogglePin={() => handleTogglePin(quote)}
                />
              ))}
            </View>
          )}

          {/* Quick Actions */}
          {preferences.showQuickActions && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <Pressable
                style={styles.actionButton}
                onPress={() => router.push("./quotes" as any)}
              >
                <Text style={styles.actionText}>View All Quotes →</Text>
              </Pressable>
              <Pressable
                style={styles.actionButton}
                onPress={() => router.push("./assemblies" as any)}
              >
                <Text style={styles.actionText}>Browse Assemblies →</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Undo Snackbar */}
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

function StatCard({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    scrollContent: {
      padding: theme.spacing(2),
    },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(2),
    },
    appTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.colors.text,
    },
    settingsButton: {
      padding: theme.spacing(1),
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
    },
    statCard: {
      flex: 1,
      minWidth: "47%",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    statValue: {
      fontSize: 24,
      fontWeight: "700",
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      color: theme.colors.muted,
      textAlign: "center",
    },
    valueSection: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(3),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    valueRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    valueLabel: {
      fontSize: 12,
      color: theme.colors.muted,
      marginBottom: 4,
    },
    valueText: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
    },
    valueTextSecondary: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    actionButton: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
  });
}
