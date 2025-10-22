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
import { GradientBackground } from "@/components/GradientBackground";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function Dashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
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
    const [data, prefs] = await Promise.all([
      listQuotes(),
      loadPreferences(),
    ]);
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
    const draftQuotes = quotes.filter((q) => q.status === "draft");
    const sentQuotes = quotes.filter((q) => q.status === "sent");
    const approvedQuotes = quotes.filter((q) => q.status === "approved");
    const completedQuotes = quotes.filter((q) => q.status === "completed");
    const pinnedQuotes = quotes.filter((q) => q.pinned);

    // Value tracking by business stage
    const pendingValue = sentQuotes.reduce(
      (sum, q) => sum + calculateTotal(q),
      0,
    );
    const approvedValue = approvedQuotes.reduce(
      (sum, q) => sum + calculateTotal(q),
      0,
    );
    const toInvoiceValue = completedQuotes.reduce(
      (sum, q) => sum + calculateTotal(q),
      0,
    );

    return {
      total: quotes.length,
      draft: draftQuotes.length,
      sent: sentQuotes.length,
      approved: approvedQuotes.length,
      completed: completedQuotes.length,
      pinned: pinnedQuotes.length,
      pendingValue,
      approvedValue,
      toInvoiceValue,
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

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GradientBackground>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        </GradientBackground>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GradientBackground>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Welcome message */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.welcomeSubtext}>Here&apos;s your business overview</Text>
          </View>

          {/* Quick Stats */}
          {preferences.showStats && (
            <View style={styles.statsGrid}>
              <StatCard
                label="All"
                value={stats.total}
                color={theme.colors.text}
                theme={theme}
                onPress={() => router.push("./quotes?filter=all" as any)}
              />
              <StatCard
                label="Pinned"
                value={stats.pinned}
                color={theme.colors.accent}
                theme={theme}
                onPress={() => router.push("./quotes?filter=pinned" as any)}
              />
              <StatCard
                label="Draft"
                value={stats.draft}
                color={QuoteStatusMeta.draft.color}
                theme={theme}
                onPress={() => router.push("./quotes?filter=draft" as any)}
              />
              <StatCard
                label="Sent"
                value={stats.sent}
                color={QuoteStatusMeta.sent.color}
                theme={theme}
                onPress={() => router.push("./quotes?filter=sent" as any)}
              />
              <StatCard
                label="Approved"
                value={stats.approved}
                color={QuoteStatusMeta.approved.color}
                theme={theme}
                onPress={() => router.push("./quotes?filter=approved" as any)}
              />
              <StatCard
                label="Completed"
                value={stats.completed}
                color={QuoteStatusMeta.completed.color}
                theme={theme}
                onPress={() => router.push("./quotes?filter=completed" as any)}
              />
            </View>
          )}

          {/* Quote Value Tracking */}
          {preferences.showValueTracking && (
            <View style={styles.valueSection}>
              <Text style={styles.valueSectionTitle}>Quote Value</Text>
              <View style={styles.valueGrid}>
                <View style={styles.valueItem}>
                  <Text style={styles.valueLabel}>Pending</Text>
                  <Text style={styles.valueAmount}>
                    ${stats.pendingValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.valueItem}>
                  <Text style={styles.valueLabel}>Approved</Text>
                  <Text style={styles.valueAmount}>
                    ${stats.approvedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.valueItem}>
                  <Text style={styles.valueLabel}>To Invoice</Text>
                  <Text style={styles.valueAmount}>
                    ${stats.toInvoiceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              {recentQuotes.length === 0 ? (
                <View style={styles.emptyStateSimple}>
                  <Text style={styles.emptyTextSimple}>
                    No quotes yet. Tap the Quotes tab below to create your first quote.
                  </Text>
                </View>
              ) : (
                recentQuotes.map((quote) => (
                  <SwipeableQuoteItem
                    key={quote.id}
                    item={quote}
                    onEdit={() => router.push(`/quote/${quote.id}/edit`)}
                    onDelete={() => handleDelete(quote)}
                    onTogglePin={() => handleTogglePin(quote)}
                  />
                ))
              )}
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
      </GradientBackground>
    </GestureHandlerRootView>
  );
}

function StatCard({
  label,
  value,
  color,
  theme,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  theme: ReturnType<typeof useTheme>["theme"];
  onPress?: () => void;
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Dynamic color: accent when has value, text color when zero
  const displayColor = value > 0 ? theme.colors.accent : theme.colors.text;

  return (
    <Pressable style={styles.statCard} onPress={onPress}>
      <Text style={[styles.statValue, { color: displayColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
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
    scrollContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(2),
    },
    welcomeSection: {
      marginBottom: theme.spacing(3),
    },
    welcomeText: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 4,
    },
    welcomeSubtext: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
    },
    statCard: {
      flex: 1,
      minWidth: "31%",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    statValue: {
      fontSize: 32,
      fontWeight: "700",
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 12,
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
    valueSectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1.5),
    },
    valueGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing(1.5),
    },
    valueItem: {
      flex: 1,
      alignItems: "center",
    },
    valueLabel: {
      fontSize: 11,
      color: theme.colors.muted,
      marginBottom: 6,
      textAlign: "center",
    },
    valueAmount: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1.5),
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    emptyState: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(4),
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
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
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: theme.spacing(3),
    },
    emptyButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.xl,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    emptyButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    fab: {
      position: "absolute",
      bottom: theme.spacing(3),
      right: theme.spacing(3),
      backgroundColor: theme.colors.accent,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2.5),
      borderRadius: theme.radius.xl,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    fabText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    emptyStateSimple: {
      paddingVertical: theme.spacing(3),
      alignItems: "center",
    },
    emptyTextSimple: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
  });
}
