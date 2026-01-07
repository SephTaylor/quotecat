// app/(main)/(tabs)/index.tsx
// Dashboard screen - Overview and quick stats
import { useTheme } from "@/contexts/ThemeContext";
import { listQuotes, type Quote } from "@/lib/quotes";
import { QuoteStatusMeta, InvoiceStatusMeta, ContractStatusMeta, type Invoice, type Contract } from "@/lib/types";
import { calculateQuoteTotal, calculateInvoiceTotal } from "@/lib/calculations";
import { loadPreferences, type DashboardPreferences } from "@/lib/preferences";
import { deleteQuote, saveQuote, duplicateQuote, createTierFromQuote, getLinkedQuotes } from "@/lib/quotes";
import { listInvoices, getToInvoiceStats, deleteInvoice } from "@/lib/invoices";
import { listContracts, deleteContract } from "@/lib/contracts";
import { generateAndShareMultiTierPDF } from "@/lib/pdf";
import { getCachedLogo } from "@/lib/logo";
import { canAccessAssemblies } from "@/lib/features";
import { SwipeableQuoteItem } from "@/components/SwipeableQuoteItem";
import { SwipeableInvoiceItem } from "@/components/SwipeableInvoiceItem";
import { SwipeableContractItem } from "@/components/SwipeableContractItem";
import { QuoteGroup } from "@/components/QuoteGroup";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { GradientBackground } from "@/components/GradientBackground";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshEvents, REFRESH_QUOTES_LIST } from "@/lib/refreshEvents";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { getLastSyncTime, isSyncAvailable } from "@/lib/quotesSync";
import { getUserState } from "@/lib/user";
import { hasSyncCompletedSince, onSyncComplete } from "@/lib/syncState";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { getActiveChangeOrderCount } from "@/modules/changeOrders";
import { WizardFAB } from "@/components/WizardFAB";

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
    showRecentInvoices: true,
    showRecentContracts: true,
    recentQuotesCount: 5,
  });
  const [deletedQuote, setDeletedQuote] = useState<Quote | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncAvailable, setSyncAvailable] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [coCounts, setCoCounts] = useState<Record<string, number>>({});
  const [toInvoiceStats, setToInvoiceStats] = useState<{ quoteCount: number; contractCount: number; totalValue: number }>({
    quoteCount: 0,
    contractCount: 0,
    totalValue: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  // Track when we last loaded data (for smart refresh after sync)
  const lastLoadedAt = useRef<number>(0);
  const hasLoadedOnce = useRef<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      // First get user state to know what to load
      const userState = await getUserState();
      const proAccess = canAccessAssemblies(userState);
      const premiumAccess = userState.tier === 'premium';
      setIsPro(proAccess);
      setIsPremium(premiumAccess);

      // Load data SEQUENTIALLY to avoid OOM from parallel loading
      // This is critical when background sync may also be running
      const prefs = await loadPreferences();
      setPreferences(prefs.dashboard);

      const syncTime = await getLastSyncTime();
      setLastSyncTime(syncTime);

      const available = await isSyncAvailable();
      setSyncAvailable(available && (userState.tier === 'pro' || userState.tier === 'premium'));

      // Load quotes with GC break
      const data = await listQuotes();
      setQuotes(data);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load invoices with GC break
      if (proAccess) {
        const invoiceData = await listInvoices();
        setInvoices(invoiceData);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Load contracts with GC break
      if (premiumAccess) {
        const contractData = await listContracts();
        setContracts(contractData);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Load to-invoice stats
      const toInvoice = await getToInvoiceStats();
      setToInvoiceStats(toInvoice);

      // Load CO counts SEQUENTIALLY (not in parallel) to reduce memory pressure
      const counts: Record<string, number> = {};
      const approvedQuotes = data.filter((q) => q.status === "approved" || q.status === "completed");
      for (const q of approvedQuotes) {
        const count = await getActiveChangeOrderCount(q.id);
        if (count > 0) counts[q.id] = count;
      }
      setCoCounts(counts);
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
      lastLoadedAt.current = Date.now();
      hasLoadedOnce.current = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Always reload when screen gains focus
      // This ensures fresh data after creating quotes, navigating back, etc.
      load();
    }, [load]),
  );

  // Auto-refresh when background sync completes (even if user is on this screen)
  useEffect(() => {
    const unsubscribe = onSyncComplete(() => {
      // Sync just completed - refresh data from SQLite
      load();
    });
    return unsubscribe;
  }, [load]);

  // Auto-refresh when quotes are created/updated (e.g., after creating a new quote)
  useEffect(() => {
    const unsubscribe = RefreshEvents.subscribe(REFRESH_QUOTES_LIST, load);
    return unsubscribe;
  }, [load]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Calculate stats
  const stats = React.useMemo(() => {
    // Get quote IDs that have become contracts (don't double-count these)
    const quotesWithContracts = new Set(
      contracts.filter(c => c.quoteId).map(c => c.quoteId)
    );

    // Filter out quotes that have become contracts for value calculations
    const quotesForValue = quotes.filter(q => !quotesWithContracts.has(q.id));

    const draftQuotes = quotes.filter((q) => q.status === "draft");
    const sentQuotes = quotesForValue.filter((q) => q.status === "sent");
    const approvedQuotes = quotesForValue.filter((q) => q.status === "approved");

    // Contract stages
    const sentContracts = contracts.filter((c) => c.status === "sent" || c.status === "viewed");
    const signedContracts = contracts.filter((c) => c.status === "signed");

    // Follow-ups: quotes with follow-up dates today or in the past
    // Count linked quotes (tiers) as one follow-up
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const countedIds = new Set<string>();
    let followUpCount = 0;

    for (const q of quotes) {
      if (countedIds.has(q.id)) continue;
      if (!q.followUpDate) continue;

      const followUpDate = new Date(q.followUpDate);
      followUpDate.setHours(0, 0, 0, 0);
      if (followUpDate > today) continue;

      // Count this as one follow-up
      followUpCount++;
      countedIds.add(q.id);

      // Mark all linked quotes as counted too
      if (q.linkedQuoteIds) {
        for (const linkedId of q.linkedQuoteIds) {
          countedIds.add(linkedId);
        }
      }
    }

    // Value tracking by business stage (quotes + contracts, no double-counting)
    const pendingQuoteValue = sentQuotes.reduce(
      (sum, q) => sum + calculateQuoteTotal(q),
      0,
    );
    const pendingContractValue = sentContracts.reduce(
      (sum, c) => sum + c.total,
      0,
    );

    const approvedQuoteValue = approvedQuotes.reduce(
      (sum, q) => sum + calculateQuoteTotal(q),
      0,
    );
    // Signed contracts = work authorized (like approved quotes)
    const signedContractValue = signedContracts.reduce(
      (sum, c) => sum + c.total,
      0,
    );

    // To Invoice count = quotes needing invoice + contracts needing invoice
    const toInvoiceCount = toInvoiceStats.quoteCount + toInvoiceStats.contractCount;

    return {
      total: quotes.length,
      draft: draftQuotes.length,
      sent: quotes.filter(q => q.status === "sent").length, // Still show all sent for the stat card
      approved: quotes.filter(q => q.status === "approved").length,
      toInvoice: toInvoiceCount,
      followUps: followUpCount,
      pendingValue: pendingQuoteValue + pendingContractValue,
      approvedValue: approvedQuoteValue + signedContractValue,
      toInvoiceValue: toInvoiceStats.totalValue,
    };
  }, [quotes, contracts, toInvoiceStats]);

  const recentQuotes = React.useMemo(() => {
    if (preferences.recentQuotesCount === "all") {
      return quotes;
    }
    return quotes.slice(0, preferences.recentQuotesCount);
  }, [quotes, preferences.recentQuotesCount]);

  // Group linked quotes together for display
  type QuoteOrGroup = { type: "single"; quote: Quote } | { type: "group"; quotes: Quote[] };

  const groupedRecentQuotes = React.useMemo((): QuoteOrGroup[] => {
    const result: QuoteOrGroup[] = [];
    const processedIds = new Set<string>();

    for (const quote of recentQuotes) {
      if (processedIds.has(quote.id)) continue;

      if (quote.linkedQuoteIds && quote.linkedQuoteIds.length > 0) {
        const groupQuotes = [quote];
        for (const linkedId of quote.linkedQuoteIds) {
          const linkedQuote = recentQuotes.find(q => q.id === linkedId);
          if (linkedQuote && !processedIds.has(linkedId)) {
            groupQuotes.push(linkedQuote);
          }
        }

        for (const gq of groupQuotes) {
          processedIds.add(gq.id);
        }

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
  }, [recentQuotes]);


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

  // Get recent contracts (max 5, prioritize sent/awaiting signature)
  const recentContracts = React.useMemo(() => {
    // Sort: sent (awaiting signature) first, then viewed, then by date
    const sorted = [...contracts].sort((a, b) => {
      // Sent (awaiting signature) comes first
      if (a.status === "sent" && b.status !== "sent") return -1;
      if (b.status === "sent" && a.status !== "sent") return 1;
      // Then viewed
      if (a.status === "viewed" && b.status !== "viewed") return -1;
      if (b.status === "viewed" && a.status !== "viewed") return 1;
      // Then by date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, 5);
  }, [contracts]);

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

  // Invoice handlers
  const handleDeleteInvoice = useCallback(async (invoice: Invoice) => {
    Alert.alert(
      "Delete Invoice",
      `Are you sure you want to delete "${invoice.name || invoice.invoiceNumber}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteInvoice(invoice.id);
            setInvoices((prev) => prev.filter((i) => i.id !== invoice.id));
          },
        },
      ]
    );
  }, []);

  const handleExportInvoice = useCallback(async (invoice: Invoice) => {
    // Navigate to invoice detail which has export functionality
    router.push(`/invoice/${invoice.id}`);
  }, [router]);

  const handleUpdateInvoiceStatus = useCallback((invoice: Invoice) => {
    // Navigate to invoice detail to update status
    router.push(`/invoice/${invoice.id}`);
  }, [router]);

  const handleCopyInvoice = useCallback((invoice: Invoice) => {
    // Navigate to invoice detail (copy functionality is there)
    router.push(`/invoice/${invoice.id}`);
  }, [router]);

  // Contract handlers
  const handleDeleteContract = useCallback(async (contract: Contract) => {
    Alert.alert(
      "Delete Contract",
      `Are you sure you want to delete "${contract.projectName || contract.contractNumber}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteContract(contract.id);
            setContracts((prev) => prev.filter((c) => c.id !== contract.id));
          },
        },
      ]
    );
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
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
                label="Follow-ups"
                value={stats.followUps}
                color="#FF9500"
                theme={theme}
                onPress={() => router.push("./quotes?filter=followup" as any)}
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
                label="To Invoice"
                value={stats.toInvoice}
                color={QuoteStatusMeta.completed.color}
                theme={theme}
                onPress={() => router.push("./quotes?filter=completed" as any)}
              />
            </View>
          )}

          {/* Business Value Tracking */}
          {preferences.showValueTracking && (
            <View style={styles.valueSection}>
              <Text style={styles.valueSectionTitle}>Business Value</Text>
              <View style={styles.valueGrid}>
                <View style={styles.valueRow}>
                  <Text style={styles.valueLabel}>Pending</Text>
                  <Text style={styles.valueAmount}>
                    ${stats.pendingValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.valueRow}>
                  <Text style={styles.valueLabel}>Approved</Text>
                  <Text style={styles.valueAmount}>
                    ${stats.approvedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.valueRow}>
                  <Text style={styles.valueLabel}>To Invoice</Text>
                  <Text style={styles.valueAmount}>
                    ${stats.toInvoiceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>
          )}


          {/* Recent Activity */}
          {preferences.showRecentQuotes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Quotes</Text>
              {groupedRecentQuotes.length === 0 ? (
                <View style={styles.emptyStateSimple}>
                  <Text style={styles.emptyTextSimple}>
                    No quotes yet. Tap the + button above to create your first quote.
                  </Text>
                </View>
              ) : (
                groupedRecentQuotes.map((item) => {
                  if (item.type === "group") {
                    return (
                      <QuoteGroup
                        key={item.quotes[0].id}
                        quotes={item.quotes}
                        onEdit={(q) => router.push(`/quote/${q.id}/edit`)}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onLongPress={() => {}}
                        onCreateTier={handleCreateTier}
                        onExportAllTiers={handleExportAllTiers}
                        onUnlink={() => {}}
                        coCounts={coCounts}
                      />
                    );
                  }
                  return (
                    <SwipeableQuoteItem
                      key={item.quote.id}
                      item={item.quote}
                      onEdit={() => router.push(`/quote/${item.quote.id}/edit`)}
                      onDelete={() => handleDelete(item.quote)}
                      onDuplicate={() => handleDuplicate(item.quote)}
                      onCreateTier={() => handleCreateTier(item.quote)}
                      onExportAllTiers={() => handleExportAllTiers(item.quote)}
                      changeOrderCount={coCounts[item.quote.id]}
                    />
                  );
                })
              )}
            </View>
          )}

          {/* Recent Invoices - Pro only */}
          {isPro && preferences.showRecentInvoices && recentInvoices.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Invoices</Text>
              {recentInvoices.map((invoice) => (
                <SwipeableInvoiceItem
                  key={invoice.id}
                  item={invoice}
                  onPress={() => router.push(`/invoice/${invoice.id}`)}
                  onDelete={() => handleDeleteInvoice(invoice)}
                  onExport={() => handleExportInvoice(invoice)}
                  onUpdateStatus={() => handleUpdateInvoiceStatus(invoice)}
                  onCopy={() => handleCopyInvoice(invoice)}
                />
              ))}
            </View>
          )}

          {/* Recent Contracts - Premium only */}
          {isPremium && preferences.showRecentContracts && recentContracts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Contracts</Text>
              {recentContracts.map((contract) => (
                <SwipeableContractItem
                  key={contract.id}
                  item={contract}
                  onPress={() => router.push(`/(forms)/contract/${contract.id}/edit`)}
                  onDelete={() => handleDeleteContract(contract)}
                />
              ))}
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

        {/* Quote Wizard FAB */}
        <WizardFAB />
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
      paddingHorizontal: theme.spacing(3),
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(10), // Extra space for FAB
    },
    welcomeSection: {
      marginBottom: theme.spacing(2),
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
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1.5),
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
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
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
      gap: 8,
    },
    valueRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    valueLabel: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    valueAmount: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
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
      top: theme.spacing(2),
      right: theme.spacing(2),
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
    // Contract card styles
    contractCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    contractHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    contractNumber: {
      fontSize: 14,
      fontWeight: "700",
      color: "#5856D6", // Premium purple
    },
    contractStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      gap: 4,
    },
    contractStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    contractStatusText: {
      fontSize: 12,
      fontWeight: "600",
    },
    contractName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    contractClient: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1),
    },
    contractFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: theme.spacing(1),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    contractDate: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    contractAmount: {
      fontSize: 18,
      fontWeight: "700",
      color: "#5856D6", // Premium purple
    },
  });
}
