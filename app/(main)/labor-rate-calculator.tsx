// app/(main)/labor-rate-calculator.tsx
// Free tool to calculate true hourly labor rate from salary, benefits, and overhead

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
  Alert,
} from "react-native";
import { updatePricingSettings } from "@/lib/preferences";

export default function LaborRateCalculator() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Input state
  const [desiredSalary, setDesiredSalary] = useState("");
  const [healthInsurance, setHealthInsurance] = useState("");
  const [retirement, setRetirement] = useState(""); // % of salary
  const [annualOverhead, setAnnualOverhead] = useState("");
  const [profitMargin, setProfitMargin] = useState("15"); // default 15%
  const [billableHours, setBillableHours] = useState("1500"); // default 1500

  // Filter to numbers and decimal only
  const filterNumber = (value: string) =>
    value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

  // Parse values
  const salary = parseFloat(desiredSalary) || 0;
  const health = parseFloat(healthInsurance) || 0;
  const retirementPct = parseFloat(retirement) || 0;
  const overhead = parseFloat(annualOverhead) || 0;
  const profitPct = parseFloat(profitMargin) || 0;
  const hours = parseFloat(billableHours) || 1500;

  // Calculations
  const retirementAmount = salary * (retirementPct / 100);
  const payrollTaxes = salary * 0.0765; // 7.65% (Social Security + Medicare)
  const totalBenefits = health + retirementAmount + payrollTaxes;
  const baseCost = salary + totalBenefits + overhead;
  const profitAmount = baseCost * (profitPct / 100);
  const totalRequired = baseCost + profitAmount;
  const hourlyRate = hours > 0 ? totalRequired / hours : 0;

  const handleReset = () => {
    setDesiredSalary("");
    setHealthInsurance("");
    setRetirement("");
    setAnnualOverhead("");
    setProfitMargin("15");
    setBillableHours("1500");
  };

  const handleSaveRate = async () => {
    if (hourlyRate <= 0) {
      Alert.alert("Enter Your Info", "Fill in your salary and costs to calculate a rate first.");
      return;
    }
    const roundedRate = Math.round(hourlyRate);
    await updatePricingSettings({ defaultLaborRate: roundedRate });
    Alert.alert(
      "Rate Saved",
      `$${roundedRate}/hr saved as your default labor rate.\n\nThis will be used when adding labor to quotes.`,
      [{ text: "OK" }]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Labor Rate Calculator",
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <GradientBackground>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>What should you charge?</Text>
              <Text style={styles.headerSubtitle}>
                Calculate your true hourly rate based on what you want to earn
              </Text>
            </View>

            {/* Input Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Goals</Text>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Desired Annual Salary</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={desiredSalary}
                    onChangeText={(v) => setDesiredSalary(filterNumber(v))}
                    placeholder="100,000"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    blurOnSubmit
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Health Insurance (annual)</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={healthInsurance}
                    onChangeText={(v) => setHealthInsurance(filterNumber(v))}
                    placeholder="12,000"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    blurOnSubmit
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Retirement Contribution</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={retirement}
                    onChangeText={(v) => setRetirement(filterNumber(v))}
                    placeholder="10"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    blurOnSubmit
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Annual Overhead Costs</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={annualOverhead}
                    onChangeText={(v) => setAnnualOverhead(filterNumber(v))}
                    placeholder="60,000"
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
                    value={profitMargin}
                    onChangeText={(v) => setProfitMargin(filterNumber(v))}
                    placeholder="15"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    blurOnSubmit
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Billable Hours per Year</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={billableHours}
                    onChangeText={(v) => setBillableHours(filterNumber(v))}
                    placeholder="1500"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    blurOnSubmit
                  />
                  <Text style={styles.inputSuffix}>hrs</Text>
                </View>
              </View>
            </View>

            {/* Results Section */}
            <View style={styles.resultsSection}>
              <Text style={styles.sectionTitle}>Your True Labor Rate</Text>

              <View style={styles.resultCard}>
                <View style={styles.rateDisplay}>
                  <Text style={styles.rateValue}>
                    ${hourlyRate.toFixed(0)}
                  </Text>
                  <Text style={styles.rateUnit}>/hour</Text>
                </View>

                <View style={styles.breakdown}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Base Salary</Text>
                    <Text style={styles.breakdownValue}>
                      ${salary.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>+ Health Insurance</Text>
                    <Text style={styles.breakdownValue}>
                      ${health.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>+ Retirement ({retirementPct}%)</Text>
                    <Text style={styles.breakdownValue}>
                      ${retirementAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>+ Payroll Taxes (7.65%)</Text>
                    <Text style={styles.breakdownValue}>
                      ${payrollTaxes.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>+ Overhead</Text>
                    <Text style={styles.breakdownValue}>
                      ${overhead.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownSubtotal]}>
                    <Text style={styles.breakdownLabelBold}>Base Cost</Text>
                    <Text style={styles.breakdownValueBold}>
                      ${baseCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>+ Profit ({profitPct}%)</Text>
                    <Text style={styles.breakdownValue}>
                      ${profitAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                    <Text style={styles.breakdownLabelBold}>Total Required</Text>
                    <Text style={styles.breakdownValueBold}>
                      ${totalRequired.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>÷ {hours} billable hours</Text>
                    <Text style={styles.breakdownValue}>=</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.helperText}>
                This is the minimum you should charge per hour to meet your financial goals.
                Many contractors round up to the nearest $5 or $10.
              </Text>
            </View>

            {/* Save Button */}
            {hourlyRate > 0 && (
              <Pressable style={styles.saveButton} onPress={handleSaveRate}>
                <Text style={styles.saveButtonText}>Save as Default Rate</Text>
              </Pressable>
            )}

            {/* Reset Button */}
            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset Calculator</Text>
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
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "center",
      marginBottom: theme.spacing(2),
      paddingBottom: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rateValue: {
      fontSize: 48,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    rateUnit: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.muted,
      marginLeft: 4,
    },
    breakdown: {
      gap: 8,
    },
    breakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    breakdownSubtotal: {
      paddingTop: theme.spacing(1),
      marginTop: theme.spacing(0.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    breakdownTotal: {
      paddingTop: theme.spacing(1),
      marginTop: theme.spacing(0.5),
      borderTopWidth: 2,
      borderTopColor: theme.colors.accent,
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
    helperText: {
      fontSize: 13,
      color: theme.colors.muted,
      marginTop: theme.spacing(2),
      lineHeight: 18,
    },
    saveButton: {
      alignItems: "center",
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(3),
      borderRadius: theme.radius.lg,
      marginTop: theme.spacing(2),
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
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
