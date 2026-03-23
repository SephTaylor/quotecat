// app/(main)/confirm-target-margin.tsx
// Onboarding step 4: Confirm target profit margin

import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Stack, useRouter } from "expo-router";
import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { loadPreferences, updateOverheadSettings, type OverheadSettings, type PricingSettings } from "@/lib/preferences";

/**
 * Calculate recommended profit margin based on overhead and job mix.
 * Returns null if insufficient data to calculate.
 */
function calculateRecommendedMargin(
  overhead: OverheadSettings | undefined,
  pricing: Partial<PricingSettings> | undefined
): number | null {
  // Need annualOverhead and annualLaborRevenue to calculate
  if (!overhead?.annualOverhead || !overhead?.annualLaborRevenue || overhead.annualLaborRevenue === 0) {
    return null;
  }

  const annualOverhead = overhead.annualOverhead;
  const annualLaborRevenue = overhead.annualLaborRevenue;
  const materialsMixPercent = overhead.materialsMixPercent ?? 40; // Default 40%
  const defaultMarkupPercent = pricing?.defaultMarkupPercent ?? 20; // Default 20%

  // Formula:
  // overheadBurden = annualOverhead / annualLaborRevenue
  // laborPortion = 1 - (materialsMixPercent / 100)
  // materialsProfitRate = defaultMarkupPercent / (100 + defaultMarkupPercent)
  // materialsContribution = (materialsMixPercent / 100) × materialsProfitRate
  // breakEvenMargin = (overheadBurden × laborPortion) - materialsContribution
  // minimumViableMargin = max(breakEvenMargin, 0) + 5%
  // recommendedMargin = minimumViableMargin + 5%

  const overheadBurden = annualOverhead / annualLaborRevenue;
  const laborPortion = 1 - (materialsMixPercent / 100);
  const materialsProfitRate = defaultMarkupPercent / (100 + defaultMarkupPercent);
  const materialsContribution = (materialsMixPercent / 100) * materialsProfitRate;
  const breakEvenMargin = (overheadBurden * laborPortion) - materialsContribution;
  const minimumViableMargin = Math.max(breakEvenMargin, 0) + 0.05;
  const recommendedMargin = minimumViableMargin + 0.05;

  // Return as percentage
  return Math.round(recommendedMargin * 100);
}

export default function ConfirmTargetMargin() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [targetMargin, setTargetMargin] = useState("");
  const [loading, setLoading] = useState(true);
  const [recommendedMargin, setRecommendedMargin] = useState<number | null>(null);

  // Load existing value and calculate recommendation
  useEffect(() => {
    const load = async () => {
      try {
        const prefs = await loadPreferences();

        // Load existing target margin
        const existing = prefs.overhead?.targetProfitMarginPercent;
        if (existing && existing > 0) {
          setTargetMargin(String(existing));
        } else {
          // Default to 20% if not set
          setTargetMargin("20");
        }

        // Calculate recommended margin
        const recommended = calculateRecommendedMargin(prefs.overhead, prefs.pricing);
        setRecommendedMargin(recommended);
      } catch (error) {
        console.error("Failed to load target margin:", error);
        setTargetMargin("20");
      }
      setLoading(false);
    };
    load();
  }, []);

  const filterNumber = (value: string) =>
    value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

  const marginValue = parseFloat(targetMargin) || 0;

  const handleConfirm = async () => {
    const prefs = await loadPreferences();
    await updateOverheadSettings({
      ...prefs.overhead,
      targetProfitMarginPercent: marginValue > 0 ? marginValue : undefined,
    });
    router.back();
  };

  const handleUseRecommended = () => {
    if (recommendedMargin !== null) {
      setTargetMargin(String(recommendedMargin));
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Target Margin",
            headerShown: true,
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <GradientBackground>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </GradientBackground>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Target Margin",
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <GradientBackground>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <Ionicons name="speedometer-outline" size={48} color={theme.colors.accent} />
              </View>

              {/* Explanation */}
              <Text style={styles.title}>Your Target Profit Margin</Text>
              <Text style={styles.description}>
                Quotes below this margin will show a warning indicator, helping you avoid
                underpriced jobs.
              </Text>

              {/* Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={targetMargin}
                  onChangeText={(v) => setTargetMargin(filterNumber(v))}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  placeholder="20"
                  placeholderTextColor={theme.colors.muted}
                />
                <Text style={styles.suffix}>%</Text>
              </View>

              {/* Recommendation */}
              {recommendedMargin !== null && (
                <Pressable style={styles.recommendationContainer} onPress={handleUseRecommended}>
                  <View style={styles.recommendationHeader}>
                    <Ionicons name="bulb-outline" size={18} color={theme.colors.accent} />
                    <Text style={styles.recommendationLabel}>
                      Recommended: {recommendedMargin}%
                    </Text>
                  </View>
                  <Text style={styles.recommendationText}>
                    Based on your overhead and job mix. Tap to use.
                  </Text>
                  {recommendedMargin > 35 && (
                    <Text style={styles.recommendationNote}>
                      This is higher than typical for most trades — but if you specialize in
                      high-end or complex work, this may be appropriate for your business.
                    </Text>
                  )}
                </Pressable>
              )}

              {/* Preview */}
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>Margin Indicator Preview:</Text>
                <View style={styles.previewRow}>
                  <View style={[styles.indicator, { backgroundColor: "#22c55e" }]}>
                    <Ionicons name="checkmark" size={12} color="white" />
                  </View>
                  <Text style={styles.previewText}>
                    {marginValue}%+ = On target
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <View style={[styles.indicator, { backgroundColor: "#eab308" }]}>
                    <Ionicons name="warning" size={12} color="white" />
                  </View>
                  <Text style={styles.previewText}>
                    {Math.max(0, marginValue - 5)}-{marginValue}% = Close
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <View style={[styles.indicator, { backgroundColor: "#ef4444" }]}>
                    <Ionicons name="close" size={12} color="white" />
                  </View>
                  <Text style={styles.previewText}>
                    Below {Math.max(0, marginValue - 5)}% = Warning
                  </Text>
                </View>
              </View>

              {/* Confirm Button */}
              <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Confirm Target</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </GradientBackground>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      color: theme.colors.muted,
      fontSize: 16,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 40,
      alignItems: "center",
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 24,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    input: {
      fontSize: 36,
      fontWeight: "700",
      color: theme.colors.text,
      minWidth: 80,
      textAlign: "center",
    },
    suffix: {
      fontSize: 24,
      fontWeight: "600",
      color: theme.colors.muted,
      marginLeft: 4,
    },
    recommendationContainer: {
      backgroundColor: `${theme.colors.accent}15`,
      borderRadius: 12,
      padding: 16,
      width: "100%",
      marginBottom: 24,
      borderWidth: 1,
      borderColor: `${theme.colors.accent}30`,
    },
    recommendationHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    recommendationLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    recommendationText: {
      fontSize: 14,
      color: theme.colors.muted,
      marginLeft: 26,
    },
    recommendationNote: {
      fontSize: 13,
      color: theme.colors.muted,
      fontStyle: "italic",
      marginTop: 8,
      marginLeft: 26,
      lineHeight: 18,
    },
    previewContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      width: "100%",
      marginBottom: 24,
    },
    previewLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: 12,
    },
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    indicator: {
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    previewText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    confirmButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      width: "100%",
    },
    confirmButtonText: {
      color: "#ffffff",
      fontSize: 18,
      fontWeight: "600",
      textAlign: "center",
    },
  });
}
