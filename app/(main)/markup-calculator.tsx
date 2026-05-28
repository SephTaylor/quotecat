// app/(main)/markup-calculator.tsx
// Free tool to calculate selling price from cost + markup, with margin breakdown

import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Stack, useRouter } from "expo-router";
import React, { useState, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

const MARKUP_PRESETS = [20, 30, 50, 75, 100];

export default function MarkupCalculator() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [jobCost, setJobCost] = useState("1000");
  const [markupPct, setMarkupPct] = useState("50");

  const filterNumber = (value: string) =>
    value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

  const cost = parseFloat(jobCost) || 0;
  const markup = parseFloat(markupPct) || 0;
  const sellingPrice = cost * (1 + markup / 100);
  const grossProfit = sellingPrice - cost;
  const margin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  const handleReset = () => {
    setJobCost("1000");
    setMarkupPct("50");
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <Stack.Screen
        options={{
          title: "Markup Calculator",
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
        }}
      />
      <GradientBackground>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Markup vs Margin</Text>
              <Text style={styles.headerSubtitle}>
                Most contractors confuse the two and quietly lose 7% per job. Find out where you stand.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Inputs</Text>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Job Cost (Materials + Labor)</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={jobCost}
                    onChangeText={(v) => setJobCost(filterNumber(v))}
                    placeholder="1,000"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    blurOnSubmit
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Markup</Text>
                <View style={styles.presetRow}>
                  {MARKUP_PRESETS.map((preset) => {
                    const active = parseFloat(markupPct) === preset;
                    return (
                      <Pressable
                        key={preset}
                        style={[styles.presetBtn, active && styles.presetBtnActive]}
                        onPress={() => setMarkupPct(String(preset))}
                      >
                        <Text style={[styles.presetBtnText, active && styles.presetBtnTextActive]}>
                          {preset}%
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[styles.inputWrapper, { marginTop: theme.spacing(1) }]}>
                  <TextInput
                    style={styles.input}
                    value={markupPct}
                    onChangeText={(v) => setMarkupPct(filterNumber(v))}
                    placeholder="50"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    blurOnSubmit
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>
            </View>

            <View style={styles.resultsSection}>
              <Text style={styles.sectionTitle}>Your Selling Price</Text>

              <View style={styles.resultCard}>
                <View style={styles.rateDisplay}>
                  <Text style={styles.rateValue}>${fmt(sellingPrice)}</Text>
                </View>

                <View style={styles.breakdown}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Job Cost</Text>
                    <Text style={styles.breakdownValue}>${fmt(cost)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>+ Markup ({markup}%)</Text>
                    <Text style={styles.breakdownValue}>${fmt(grossProfit)}</Text>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                    <Text style={styles.breakdownLabelBold}>Selling Price</Text>
                    <Text style={styles.breakdownValueBold}>${fmt(sellingPrice)}</Text>
                  </View>
                  <View style={[styles.breakdownRow, { marginTop: theme.spacing(1) }]}>
                    <Text style={styles.breakdownLabelBold}>Profit Margin</Text>
                    <Text style={styles.marginValue}>{margin.toFixed(1)}%</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>Why this matters</Text>
                <Text style={styles.infoBoxText}>
                  50% markup is NOT 50% margin.{"\n"}
                  Markup is based on cost: $1,000 + 50% = $1,500.{"\n"}
                  Margin is based on selling price: $500 / $1,500 = 33.3%.{"\n\n"}
                  Most contractors quote with markup but think in margin — and quietly leave money on the table on every job.
                </Text>
              </View>
            </View>

            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </GradientBackground>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    scrollContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(6),
    },
    header: {
      marginBottom: theme.spacing(3),
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      lineHeight: 20,
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: theme.spacing(1.5),
    },
    inputRow: {
      marginBottom: theme.spacing(2),
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(1.5),
    },
    inputPrefix: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.muted,
      marginRight: 4,
    },
    inputSuffix: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      marginLeft: 4,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      paddingVertical: theme.spacing(1.5),
    },
    presetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    presetBtn: {
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    presetBtnActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    presetBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    presetBtnTextActive: {
      color: "#000",
    },
    resultsSection: {
      marginBottom: theme.spacing(3),
    },
    resultCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rateDisplay: {
      alignItems: "center",
      marginBottom: theme.spacing(2),
      paddingBottom: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rateValue: {
      fontSize: 40,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    breakdown: {
      gap: 8,
    },
    breakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    breakdownTotal: {
      paddingTop: theme.spacing(1),
      marginTop: theme.spacing(0.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    breakdownLabel: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    breakdownLabelBold: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    breakdownValue: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    breakdownValueBold: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    marginValue: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    infoBox: {
      marginTop: theme.spacing(2),
      padding: theme.spacing(2),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    infoBoxTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.accent,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: theme.spacing(1),
    },
    infoBoxText: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 19,
    },
    resetButton: {
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
    },
    resetButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
  });
}
