// app/(main)/pricing-health-check.tsx
// Pro+ tool — audits recent quotes and flags ones that were underpriced.
// Pure read: never modifies user data.

import { useTheme } from "@/contexts/ThemeContext";
import { useTechContext } from "@/contexts/TechContext";
import { GradientBackground } from "@/components/GradientBackground";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { listQuotes } from "@/lib/quotes";
import { getLocalTeamMembers } from "@/lib/teamMembersSync";
import { loadPreferences } from "@/lib/preferences";
import { presentPaywallAndSync } from "@/lib/revenuecat";
import { getMarginColor, getMarginIcon } from "@/lib/calculations";
import {
  analyzeQuoteHealth,
  type HealthCheckResult,
  type FlaggedQuote,
} from "@/lib/pricingHealth";

const LOST_PROFIT_EXPLAINER =
  "Margin shortfall — the profit gap between your target margin and what this quote delivered, at the price you actually sold. Not what you'd make if you repriced.";

export default function PricingHealthCheck() {
  const router = useRouter();
  const { theme } = useTheme();
  const { effectiveTier } = useTechContext();
  const isPro = effectiveTier === "pro" || effectiveTier === "premium";
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessChecked, setAccessChecked] = useState(false);

  // Gate at mount. If Free, show paywall; if not purchased, back out.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        if (isPro) {
          setAccessChecked(true);
          await loadAndAnalyze();
          return;
        }

        try {
          const purchased = await presentPaywallAndSync();
          if (cancelled) return;
          if (purchased) {
            setAccessChecked(true);
            await loadAndAnalyze();
          } else {
            router.back();
          }
        } catch {
          if (!cancelled) router.back();
        }
      })();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPro])
  );

  const loadAndAnalyze = async () => {
    setLoading(true);
    try {
      const [quotes, prefs, team] = await Promise.all([
        listQuotes(),
        loadPreferences(),
        getLocalTeamMembers(),
      ]);
      const r = analyzeQuoteHealth(quotes, prefs.pricing, prefs.overhead, team);
      setResult(r);
    } catch (err) {
      console.error("PricingHealthCheck: load failed", err);
      Alert.alert("Couldn't load", "Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const showLostProfitExplainer = () => {
    Alert.alert("How this is calculated", LOST_PROFIT_EXPLAINER, [{ text: "Got it" }]);
  };

  if (!accessChecked) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Pricing Health Check",
            headerShown: true,
            headerBackVisible: false,
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
          }}
        />
        <GradientBackground>
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        </GradientBackground>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Pricing Health Check",
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
        }}
      />
      <GradientBackground>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {loading || !result ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : (
            <ResultsView
              result={result}
              theme={theme}
              styles={styles}
              onTapQuote={(q) => router.push(`/quote/${q.quote.id}/edit` as any)}
              onTapLostProfitInfo={showLostProfitExplainer}
            />
          )}
        </ScrollView>
      </GradientBackground>
    </>
  );
}

function ResultsView({
  result,
  theme,
  styles,
  onTapQuote,
  onTapLostProfitInfo,
}: {
  result: HealthCheckResult;
  theme: ReturnType<typeof useTheme>["theme"];
  styles: ReturnType<typeof createStyles>;
  onTapQuote: (q: FlaggedQuote) => void;
  onTapLostProfitInfo: () => void;
}) {
  const totalSent = result.totalAnalyzed + result.totalSkipped;

  // 1. No quotes in window at all
  if (totalSent === 0) {
    return (
      <View>
        <Text style={styles.headerTitle}>No quotes to audit yet</Text>
        <Text style={styles.headerSubtitle}>
          Once you send quotes, this screen will analyze them for underpricing in the
          last {result.windowDays} days.
        </Text>
      </View>
    );
  }

  // 2. Labor rates not configured — everything was skipped
  if (!result.hasLaborRatesConfigured) {
    return (
      <View>
        <Text style={styles.headerTitle}>Set up your labor rates</Text>
        <Text style={styles.headerSubtitle}>
          Pricing Health Check needs your labor rate (billable) and labor cost rate to
          analyze quotes. Set them up to get accurate audits.
        </Text>
        <View style={{ marginTop: theme.spacing(2) }}>
          <Text style={styles.bannerText}>
            Open Labor Rate Calculator from the Toolbox to set both rates in one step.
          </Text>
        </View>
      </View>
    );
  }

  // 3. Quotes exist, all analyzed, none flagged — celebratory state
  if (result.flagged.length === 0) {
    return (
      <View>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Last {result.windowDays} days</Text>
          <Text style={styles.heroBigPositive}>You&apos;re in the clear.</Text>
          <Text style={styles.heroSubtitle}>
            {result.totalAnalyzed} quote{result.totalAnalyzed === 1 ? "" : "s"} analyzed.
            None flagged as underpriced.
          </Text>
        </View>
        {result.totalSkipped > 0 && (
          <View style={styles.banner}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={theme.colors.muted}
            />
            <Text style={styles.bannerText}>
              {result.totalSkipped} quote{result.totalSkipped === 1 ? "" : "s"} couldn&apos;t
              be analyzed (missing labor rate data).
            </Text>
          </View>
        )}
        {result.usingDefaultTarget && (
          <View style={styles.banner}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={theme.colors.muted}
            />
            <Text style={styles.bannerText}>
              Using default {result.targetMargin}% target margin. Set yours in Business
              Settings for more accurate audits.
            </Text>
          </View>
        )}
      </View>
    );
  }

  // 4. Main result — flagged quotes exist
  const flaggedCount = result.flagged.length;
  const lostFmt = result.totalEstimatedLostProfit.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Last {result.windowDays} days</Text>
        <Text style={styles.heroBigNumber}>
          {flaggedCount} quote{flaggedCount === 1 ? "" : "s"} underpriced
        </Text>
        <Pressable style={styles.heroLostRow} onPress={onTapLostProfitInfo}>
          <Text style={styles.heroLostText}>
            ~${lostFmt} estimated profit on the table
          </Text>
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.muted} />
        </Pressable>
        <Text style={styles.heroSubtitle}>
          {result.totalAnalyzed} quote{result.totalAnalyzed === 1 ? "" : "s"} analyzed,
          target margin {result.targetMargin}%.
        </Text>
      </View>

      {result.totalSkipped > 0 && (
        <View style={styles.banner}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={theme.colors.muted}
          />
          <Text style={styles.bannerText}>
            {result.totalSkipped} quote{result.totalSkipped === 1 ? "" : "s"} couldn&apos;t be
            analyzed (missing labor rate data).
          </Text>
        </View>
      )}

      {result.usingDefaultTarget && (
        <View style={styles.banner}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={theme.colors.muted}
          />
          <Text style={styles.bannerText}>
            Using default {result.targetMargin}% target margin. Set yours in Business
            Settings for more accurate audits.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Underpriced quotes</Text>

      {result.flagged.map((f) => (
        <FlaggedQuoteRow
          key={f.quote.id}
          flagged={f}
          theme={theme}
          styles={styles}
          onPress={() => onTapQuote(f)}
          onTapLostProfit={onTapLostProfitInfo}
        />
      ))}
    </View>
  );
}

function FlaggedQuoteRow({
  flagged,
  theme,
  styles,
  onPress,
  onTapLostProfit,
}: {
  flagged: FlaggedQuote;
  theme: ReturnType<typeof useTheme>["theme"];
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  onTapLostProfit: () => void;
}) {
  const { quote, profitability, targetMargin, estimatedLostProfit } = flagged;
  const marginPercent = profitability.marginPercent;
  const marginColor = getMarginColor(marginPercent, targetMargin);
  const iconName = getMarginIcon(marginPercent, targetMargin) as keyof typeof Ionicons.glyphMap;
  const lostFmt = estimatedLostProfit.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const revenueFmt = profitability.revenue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowHeader}>
        <View style={[styles.marginIndicator, { backgroundColor: marginColor }]}>
          <Ionicons name={iconName} size={14} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {quote.name || "Untitled quote"}
          </Text>
          {quote.clientName && (
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {quote.clientName}
            </Text>
          )}
        </View>
        <Text style={styles.rowAmount}>${revenueFmt}</Text>
      </View>
      <View style={styles.rowDetails}>
        <Text style={styles.rowDetailText}>
          {marginPercent.toFixed(1)}% margin · target {targetMargin}%
        </Text>
        <Pressable
          style={styles.lostProfitRow}
          onPress={(e) => {
            e.stopPropagation();
            onTapLostProfit();
          }}
          hitSlop={8}
        >
          <Text style={[styles.rowLostText, { color: marginColor }]}>
            ~${lostFmt} short
          </Text>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={theme.colors.muted}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    scrollContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(6),
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(4),
    },
    hero: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing(2),
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.5),
    },
    heroBigNumber: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    heroBigPositive: {
      fontSize: 28,
      fontWeight: "800",
      color: "#22c55e",
      marginBottom: theme.spacing(1),
    },
    heroLostRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: theme.spacing(1),
    },
    heroLostText: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    heroSubtitle: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      lineHeight: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: theme.colors.muted,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
    },
    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1.5),
    },
    bannerText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
    },
    row: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
    },
    rowHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
      marginBottom: theme.spacing(1),
    },
    marginIndicator: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    rowSubtitle: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    rowAmount: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    rowDetails: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: theme.spacing(1),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    rowDetailText: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    lostProfitRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    rowLostText: {
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
