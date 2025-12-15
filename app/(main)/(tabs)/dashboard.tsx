// app/(main)/(tabs)/index.tsx
// Dashboard screen - Overview and quick stats
import { useTheme } from "@/contexts/ThemeContext";
import { listQuotes, type Quote } from "@/lib/quotes";
import { QuoteStatusMeta, InvoiceStatusMeta, type Invoice } from "@/lib/types";
import { calculateTotal } from "@/lib/validation";
import { loadPreferences, type DashboardPreferences } from "@/lib/preferences";
import { deleteQuote, saveQuote, updateQuote, duplicateQuote, createTierFromQuote, getLinkedQuotes } from "@/lib/quotes";
import { listInvoices } from "@/lib/invoices";
import { generateAndShareMultiTierPDF } from "@/lib/pdf";
import { getCachedLogo } from "@/lib/logo";
import { canAccessAssemblies } from "@/lib/features";
import { SwipeableQuoteItem } from "@/components/SwipeableQuoteItem";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { GradientBackground } from "@/components/GradientBackground";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getLastSyncTime, isSyncAvailable } from "@/lib/quotesSync";
import { getUserState } from "@/lib/user";
import { GestureHandlerRootView } from "react-native-gesture-handler";

/**
 * Calculate total for an invoice
 */
function calculateInvoiceTotal(invoice: Invoice): number {
  const materialsFromItems = invoice.items?.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  ) ?? 0;
  const materialEstimate = invoice.materialEstimate ?? 0;
  const labor = invoice.labor ?? 0;
  const overhead = invoice.overhead ?? 0;
  const subtotal = materialsFromItems + materialEstimate + labor + overhead;

  const markupPercent = invoice.markupPercent ?? 0;
  const afterMarkup = subtotal * (1 + markupPercent / 100);

  const taxPercent = invoice.taxPercent ?? 0;
  const total = afterMarkup * (1 + taxPercent / 100);

  if (invoice.percentage && invoice.percentage < 100) {
    return total * (invoice.percentage / 100);
  }

  return total;
}

/**
 * Format sync time as relative time (e.g., "just now", "2 minutes ago")
 */
function formatSyncTime(date: Date): string {
  const now = Date.now();
  const syncTime = date.getTime();
  const diffMs = now - syncTime;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

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
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncAvailable, setSyncAvailable] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, prefs, syncTime, available, userState] = await Promise.all([
      listQuotes(),
      loadPreferences(),
      getLastSyncTime(),
      isSyncAvailable(),
      getUserState(),
    ]);
    setQuotes(data);
    setPreferences(prefs.dashboard);
    setLastSyncTime(syncTime);
    setSyncAvailable(available && (userState.tier === 'pro' || userState.tier === 'premium'));

    // Load invoices for Pro users
    const proAccess = canAccessAssemblies(userState);
    setIsPro(proAccess);
    if (proAccess) {
      const invoiceData = await listInvoices();
      setInvoices(invoiceData);
    }

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

  // Get recent invoices (max 5, prioritize unpaid/overdue)
  const recentInvoices = React.useMemo(() => {
    // Sort: overdue first, then unpaid, then by date
    const sorted = [...invoices].sort((a, b) => {
      // Overdue comes first
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (b.status === "overdue" && a.status !== "overdue") return 1;
      // Then unpaid
      if (a.status === "unpaid" && b.status !== "unpaid") return -1;
      if (b.status === "unpaid" && a.status !== "unpaid") return 1;
      // Then by date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, 5);
  }, [invoices]);

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

  const handleDuplicate = useCallback(async (quote: Quote) => {
    const duplicated = await duplicateQuote(quote.id);
    if (duplicated) {
      // Reload list to show the duplicate
      await load();
    }
  }, [load]);

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
            const newTier = await createTierFromQuote(quote.id, tierName.trim());
            if (newTier) {
              await load();
              router.push(`/quote/${newTier.id}/edit`);
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
      const linkedQuotes = await getLinkedQuotes(quote.id);

      if (linkedQuotes.length <= 1) {
        Alert.alert("No Linked Options", "This quote has no linked tier options to export together.");
        return;
      }

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

      await generateAndShareMultiTierPDF(linkedQuotes, {
        includeBranding: userState.tier === "free",
        companyDetails: prefs.company,
        logoBase64: logo?.base64,
      });
    } catch (error) {
      Alert.alert(
        "Export Failed",
        error instanceof Error ? error.message : "Failed to export PDF"
      );
    }
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
            {syncAvailable && lastSyncTime && (
              <Text style={styles.syncIndicator}>
                ☁️ Synced {formatSyncTime(lastSyncTime)}
              </Text>
            )}
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
                  onDuplicate={() => handleDuplicate(quote)}
                  onTogglePin={() => handleTogglePin(quote)}
                  onCreateTier={() => handleCreateTier(quote)}
                  onExportAllTiers={() => handleExportAllTiers(quote)}
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
                    No quotes yet. Tap the + button above to create your first quote.
                  </Text>
                </View>
              ) : (
                recentQuotes.map((quote) => (
                  <SwipeableQuoteItem
                    key={quote.id}
                    item={quote}
                    onEdit={() => router.push(`/quote/${quote.id}/edit`)}
                    onDelete={() => handleDelete(quote)}
                    onDuplicate={() => handleDuplicate(quote)}
                    onTogglePin={() => handleTogglePin(quote)}
                    onCreateTier={() => handleCreateTier(quote)}
                    onExportAllTiers={() => handleExportAllTiers(quote)}
                  />
                ))
              )}
            </View>
          )}

          {/* Recent Invoices - Pro only */}
          {isPro && recentInvoices.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Invoices</Text>
              {recentInvoices.map((invoice) => {
                const statusMeta = InvoiceStatusMeta[invoice.status];
                const total = calculateInvoiceTotal(invoice);
                const remaining = invoice.paidAmount ? total - invoice.paidAmount : total;

                return (
                  <Pressable
                    key={invoice.id}
                    style={styles.invoiceCard}
                    onPress={() => router.push(`/invoice/${invoice.id}`)}
                  >
                    <View style={styles.invoiceHeader}>
                      <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusMeta.color }]}>
                        <Text style={styles.statusBadgeText}>{statusMeta.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.invoiceName} numberOfLines={1}>
                      {invoice.name || "Untitled"}
                    </Text>
                    <Text style={styles.invoiceClient} numberOfLines={1}>
                      {invoice.clientName || "No client"}
                    </Text>
                    <View style={styles.invoiceFooter}>
                      <Text style={styles.invoiceDue}>
                        Due: {new Date(invoice.dueDate).toLocaleDateString()}
                      </Text>
                      <Text style={[
                        styles.invoiceAmount,
                        invoice.status === "overdue" && { color: "#FF3B30" }
                      ]}>
                        ${remaining.toFixed(2)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
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
    syncIndicator: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 8,
      opacity: 0.7,
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
    // Invoice card styles
    invoiceCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    invoiceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    invoiceNumber: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#FFF",
    },
    invoiceName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    invoiceClient: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1),
    },
    invoiceFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: theme.spacing(1),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    invoiceDue: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    invoiceAmount: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.accent,
    },
  });
}
