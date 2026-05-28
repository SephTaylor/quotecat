// app/(main)/profit-margin-calculator.tsx
// Free tool to back-solve max job cost from selling price + target margin

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

export default function ProfitMarginCalculator() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [sellingPrice, setSellingPrice] = useState("5000");
  const [targetMargin, setTargetMargin] = useState("25");

  const filterNumber = (value: string) =>
    value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

  const price = parseFloat(sellingPrice) || 0;
  const marginPct = parseFloat(targetMargin) || 0;
  const profit = price * (marginPct / 100);
  const maxCost = price - profit;
  const requiredMarkup = maxCost > 0 ? (profit / maxCost) * 100 : 0;

  const handleReset = () => {
    setSellingPrice("5000");
    setTargetMargin("25");
  };

  const fmt = (n: number) =>
    "$" + Math.round(n).toLocaleString("en-US");

  return (
    <>
      <Stack.Screen
        options={{
          title: "Profit Margin Calculator",
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
              <Text style={styles.headerTitle}>Did this job make money?</Text>
              <Text style={styles.headerSubtitle}>
                Find out how much you can spend on a job before it stops being profitable.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Inputs</Text>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Selling Price</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={sellingPrice}
                    onChangeText={(v) => setSellingPrice(filterNumber(v))}
                    placeholder="5,000"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    blurOnSubmit
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Target Profit Margin</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={targetMargin}
                    onChangeText={(v) => setTargetMargin(filterNumber(v))}
                    placeholder="25"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    blurOnSubmit
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>
            </View>

            <View style={styles.resultsSection}>
              <Text style={styles.sectionTitle}>Max Total Cost</Text>

              <View style={styles.resultCard}>
                <View style={styles.rateDisplay}>
                  <Text style={styles.rateValue}>{fmt(maxCost)}</Text>
                  <Text style={styles.rateUnit}>max cost</Text>
                </View>

                <View style={styles.breakdown}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Selling Price</Text>
                    <Text style={styles.breakdownValue}>{fmt(price)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>− Profit ({marginPct}% margin)</Text>
                    <Text style={styles.breakdownValue}>{fmt(profit)}</Text>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                    <Text style={styles.breakdownLabelBold}>Max Total Cost</Text>
                    <Text style={styles.breakdownValueBold}>{fmt(maxCost)}</Text>
                  </View>
                  <View style={[styles.breakdownRow, { marginTop: theme.spacing(1) }]}>
                    <Text style={styles.breakdownLabelBold}>Required Markup</Text>
                    <Text style={styles.marginValue}>{requiredMarkup.toFixed(1)}%</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>How to use this</Text>
                <Text style={styles.infoBoxText}>
                  Before you bid a job, set your target margin. Then work backwards:
                  if your total costs (materials + labor + overhead) exceed the max cost above,
                  you need to either raise your price or walk away.{"\n\n"}
                  Rule of thumb: total costs more than 75% of selling price means you&apos;re working for less than 25% margin.
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
    rateUnit: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      marginTop: 4,
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
