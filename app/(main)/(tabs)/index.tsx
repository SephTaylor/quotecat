// app/(main)/(tabs)/index.tsx
// Dashboard screen - Overview and quick stats
import { theme } from "@/constants/theme";
import { listQuotes, type Quote } from "@/lib/quotes";
import { Screen } from "@/modules/core/ui";
import { QuoteStatusMeta } from "@/lib/types";
import { calculateTotal } from "@/lib/validation";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function Dashboard() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listQuotes();
    setQuotes(data);
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
    return quotes.slice(0, 5);
  }, [quotes]);

  return (
    <>
      <Stack.Screen
        options={{ title: "Dashboard", headerBackVisible: false }}
      />
      <Screen scroll={false} contentStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* App Title */}
          <Text style={styles.appTitle}>🐱 QuoteCat</Text>

          {/* Quick Stats */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Total Quotes"
              value={stats.total}
              color={theme.colors.text}
            />
            <StatCard
              label="Active"
              value={stats.active}
              color={QuoteStatusMeta.active.color}
            />
            <StatCard
              label="Drafts"
              value={stats.draft}
              color={QuoteStatusMeta.draft.color}
            />
            <StatCard
              label="Sent"
              value={stats.sent}
              color={QuoteStatusMeta.sent.color}
            />
          </View>

          {/* Value Stats */}
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

          {/* Pinned Quotes */}
          {stats.pinnedQuotes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⭐ Pinned Quotes</Text>
              {stats.pinnedQuotes.map((quote) => (
                <Pressable
                  key={quote.id}
                  style={styles.quoteCard}
                  onPress={() => router.push(`/quote/${quote.id}/edit`)}
                >
                  <View style={styles.quoteHeader}>
                    <Text style={styles.quoteName}>
                      {quote.name || "Untitled"}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            QuoteStatusMeta[quote.status].color + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: QuoteStatusMeta[quote.status].color },
                        ]}
                      >
                        {QuoteStatusMeta[quote.status].label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.quoteValue}>
                    ${calculateTotal(quote).toFixed(2)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Quotes</Text>
            {recentQuotes.map((quote) => (
              <Pressable
                key={quote.id}
                style={styles.quoteCard}
                onPress={() => router.push(`/quote/${quote.id}/edit`)}
              >
                <View style={styles.quoteHeader}>
                  <Text style={styles.quoteName}>
                    {quote.name || "Untitled"}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          QuoteStatusMeta[quote.status].color + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: QuoteStatusMeta[quote.status].color },
                      ]}
                    >
                      {QuoteStatusMeta[quote.status].label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.quoteValue}>
                  ${calculateTotal(quote).toFixed(2)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Quick Actions */}
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
        </ScrollView>
      </Screen>
    </>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scrollContent: {
    padding: theme.spacing(2),
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
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
  quoteCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quoteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  quoteName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  quoteValue: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
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
