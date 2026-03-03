// app/(main)/overhead-calculator.tsx
// Pro+ tool - Step-by-step overhead calculator wizard
// Matches portal wizard at /dashboard/profitability

import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { loadPreferences, updateOverheadSettings, type OverheadSettings } from "@/lib/preferences";
import { Stack, useRouter } from "expo-router";
import React, { useState, useMemo, useEffect, useCallback } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROGRESS_KEY = "@quotecat/overhead_wizard_progress";

// Matches portal wizard steps exactly
const WIZARD_STEPS = [
  {
    id: "vehicle",
    title: "Vehicle Costs",
    description: "Monthly payment, gas, maintenance, insurance for your work vehicle(s)",
    placeholder: "800",
    icon: "car-outline" as const,
  },
  {
    id: "insurance",
    title: "Business Insurance",
    description: "Business liability, workers comp, bonding - monthly average",
    placeholder: "300",
    icon: "shield-checkmark-outline" as const,
  },
  {
    id: "tools",
    title: "Tools & Equipment",
    description: "Tool purchases, repairs, replacements - averaged monthly",
    placeholder: "200",
    icon: "hammer-outline" as const,
  },
  {
    id: "software",
    title: "Software & Subscriptions",
    description: "QuoteCat, accounting software, other business subscriptions",
    placeholder: "150",
    icon: "apps-outline" as const,
  },
  {
    id: "office",
    title: "Office & Storage",
    description: "Shop rent, storage unit, or home office portion of rent/mortgage",
    placeholder: "400",
    icon: "business-outline" as const,
  },
  {
    id: "marketing",
    title: "Marketing",
    description: "Ads, website hosting, lead generation, business cards",
    placeholder: "100",
    icon: "megaphone-outline" as const,
  },
  {
    id: "other",
    title: "Other Overhead",
    description: "Callbacks, warranty work, misc business expenses",
    placeholder: "200",
    icon: "ellipsis-horizontal-outline" as const,
  },
  {
    id: "laborRevenue",
    title: "Monthly Labor Revenue",
    description: "How much do you typically bill in labor per month?",
    placeholder: "8000",
    icon: "cash-outline" as const,
  },
];

type WizardProgress = {
  currentStep: number;
  values: Record<string, string>;
  savedAt: string;
};

export default function OverheadCalculator() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [existingSettings, setExistingSettings] = useState<OverheadSettings | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const currentStepData = WIZARD_STEPS[currentStep];
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;
  const isSummaryStep = currentStep === WIZARD_STEPS.length;

  // Calculate totals
  const monthlyOverhead = WIZARD_STEPS.slice(0, 7).reduce(
    (sum, step) => sum + (parseFloat(values[step.id]) || 0),
    0
  );
  const annualOverhead = monthlyOverhead * 12;
  const monthlyLaborRevenue = parseFloat(values.laborRevenue) || 0;
  const annualLaborRevenue = monthlyLaborRevenue * 12;
  const overheadPercent = annualLaborRevenue > 0 ? (annualOverhead / annualLaborRevenue) * 100 : 0;

  // Load saved progress and existing settings
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load existing overhead settings
        const prefs = await loadPreferences();
        if (prefs.overhead) {
          setExistingSettings(prefs.overhead);
        }

        // Load wizard progress
        const progressJson = await AsyncStorage.getItem(PROGRESS_KEY);
        if (progressJson) {
          const progress: WizardProgress = JSON.parse(progressJson);
          setCurrentStep(progress.currentStep);
          setValues(progress.values);
        }
      } catch (error) {
        console.error("Failed to load overhead wizard progress:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Save progress whenever values or step changes
  const saveProgress = useCallback(async (step: number, vals: Record<string, string>) => {
    try {
      const progress: WizardProgress = {
        currentStep: step,
        values: vals,
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error("Failed to save overhead wizard progress:", error);
    }
  }, []);

  const handleValueChange = (value: string) => {
    // Filter to numbers and decimal only
    const filtered = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    const newValues = { ...values, [currentStepData.id]: filtered };
    setValues(newValues);
    saveProgress(currentStep, newValues);
  };

  const handleNext = () => {
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    saveProgress(nextStep, values);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveProgress(prevStep, values);
    }
  };

  const handleStepTap = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    saveProgress(stepIndex, values);
  };

  const handleSave = async () => {
    if (annualLaborRevenue === 0) {
      Alert.alert("Missing Information", "Please enter your monthly labor revenue to calculate overhead percentage.");
      return;
    }

    const settings: OverheadSettings = {
      annualOverhead,
      annualLaborRevenue,
      overheadPercent,
      targetProfitMarginPercent: existingSettings?.targetProfitMarginPercent,
      completedAt: new Date().toISOString(),
    };

    await updateOverheadSettings(settings);

    // Clear wizard progress
    await AsyncStorage.removeItem(PROGRESS_KEY);

    Alert.alert(
      "Overhead Saved",
      `Your overhead rate is ${overheadPercent.toFixed(1)}%.\n\nThis will be used to calculate profit margins on your quotes.`,
      [{ text: "Done", onPress: () => router.back() }]
    );
  };

  const handleReset = () => {
    Alert.alert(
      "Reset Calculator",
      "This will clear all your entries. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setValues({});
            setCurrentStep(0);
            await AsyncStorage.removeItem(PROGRESS_KEY);
          },
        },
      ]
    );
  };

  const renderInputStep = () => {
    if (!currentStepData) return null;

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIconContainer}>
            <Ionicons name={currentStepData.icon} size={32} color={theme.colors.accent} />
          </View>
          <Text style={styles.stepTitle}>{currentStepData.title}</Text>
          <Text style={styles.stepDescription}>{currentStepData.description}</Text>
        </View>

        <View style={styles.inputSection}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputPrefix}>$</Text>
            <TextInput
              style={styles.input}
              value={values[currentStepData.id] || ""}
              onChangeText={handleValueChange}
              onBlur={() => saveProgress(currentStep, values)}
              placeholder={currentStepData.placeholder}
              placeholderTextColor={theme.colors.muted}
              keyboardType="decimal-pad"
              blurOnSubmit
              autoFocus
            />
            <Text style={styles.inputSuffix}>/month</Text>
          </View>
        </View>

        {/* Running total */}
        {currentStep < 7 && (
          <View style={styles.runningTotal}>
            <Text style={styles.runningTotalLabel}>Monthly Overhead So Far</Text>
            <Text style={styles.runningTotalValue}>
              ${monthlyOverhead.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderSummaryStep = () => {
    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIconContainer}>
            <Ionicons name="calculator-outline" size={32} color={theme.colors.accent} />
          </View>
          <Text style={styles.stepTitle}>Your Overhead Summary</Text>
          <Text style={styles.stepDescription}>Tap any category to edit</Text>
        </View>

        {/* Category breakdown */}
        <View style={styles.summaryCard}>
          {WIZARD_STEPS.slice(0, 7).map((step, index) => {
            const value = parseFloat(values[step.id]) || 0;
            return (
              <Pressable
                key={step.id}
                style={styles.summaryRow}
                onPress={() => handleStepTap(index)}
              >
                <View style={styles.summaryRowLeft}>
                  <Ionicons name={step.icon} size={18} color={theme.colors.muted} />
                  <Text style={styles.summaryRowLabel}>{step.title}</Text>
                </View>
                <Text style={styles.summaryRowValue}>
                  ${value.toLocaleString("en-US", { minimumFractionDigits: 0 })}/mo
                </Text>
              </Pressable>
            );
          })}
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalLabel}>Total Monthly Overhead</Text>
            <Text style={styles.summaryTotalValue}>
              ${monthlyOverhead.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalLabel}>Annual Overhead</Text>
            <Text style={styles.summaryTotalValueLarge}>
              ${annualOverhead.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </Text>
          </View>
        </View>

        {/* Labor revenue */}
        <Pressable style={styles.laborRevenueCard} onPress={() => handleStepTap(7)}>
          <View style={styles.summaryRowLeft}>
            <Ionicons name="cash-outline" size={18} color={theme.colors.muted} />
            <Text style={styles.summaryRowLabel}>Monthly Labor Revenue</Text>
          </View>
          <Text style={styles.summaryRowValue}>
            ${monthlyLaborRevenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}/mo
          </Text>
        </Pressable>

        {/* Result */}
        {annualLaborRevenue > 0 && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Your Overhead Rate</Text>
            <Text style={styles.resultValue}>{overheadPercent.toFixed(1)}%</Text>
            <Text style={styles.resultHint}>
              For every $100 in labor, ${overheadPercent.toFixed(0)} goes to overhead
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Overhead Calculator",
            headerShown: true,
            headerBackVisible: false,
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
          title: "Overhead Calculator",
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerRight: () => (
            <Pressable onPress={handleReset} style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 14 }}>Reset</Text>
            </Pressable>
          ),
        }}
      />
      <GradientBackground>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((currentStep + 1) / (WIZARD_STEPS.length + 1)) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {isSummaryStep
                ? "Summary"
                : `Step ${currentStep + 1} of ${WIZARD_STEPS.length}`}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {isSummaryStep ? renderSummaryStep() : renderInputStep()}
          </ScrollView>

          {/* Navigation buttons */}
          <View style={styles.navButtons}>
            {currentStep > 0 && (
              <Pressable style={styles.backButton} onPress={handleBack}>
                <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            )}
            {!isSummaryStep && (
              <Pressable
                style={styles.saveExitButton}
                onPress={() => {
                  saveProgress(currentStep, values);
                  router.back();
                }}
              >
                <Text style={styles.saveExitButtonText}>Save & Exit</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            {isSummaryStep ? (
              <Pressable
                style={[styles.saveButton, annualLaborRevenue === 0 && styles.saveButtonDisabled]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Save Overhead</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>
                  {isLastStep ? "Review" : "Next"}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#000" />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </GradientBackground>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    progressContainer: {
      paddingHorizontal: theme.spacing(3),
      paddingTop: theme.spacing(2),
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.accent,
    },
    progressText: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: theme.spacing(0.5),
      textAlign: "center",
    },
    scrollContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(2),
    },
    stepContent: {
      flex: 1,
    },
    stepHeader: {
      alignItems: "center",
      marginBottom: theme.spacing(4),
    },
    stepIconContainer: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: `${theme.colors.accent}20`,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing(2),
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    stepDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
      paddingHorizontal: theme.spacing(2),
    },
    inputSection: {
      marginBottom: theme.spacing(4),
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
    },
    inputPrefix: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      marginRight: 4,
    },
    inputSuffix: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.muted,
      marginLeft: 8,
    },
    input: {
      flex: 1,
      fontSize: 32,
      fontWeight: "700",
      color: theme.colors.text,
      paddingVertical: theme.spacing(2),
      textAlign: "center",
    },
    runningTotal: {
      alignItems: "center",
      paddingTop: theme.spacing(2),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    runningTotalLabel: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.5),
    },
    runningTotalValue: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing(2),
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing(1.25),
    },
    summaryRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
    },
    summaryRowLabel: {
      fontSize: 15,
      color: theme.colors.text,
    },
    summaryRowValue: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    summaryTotal: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: theme.spacing(1.5),
      marginTop: theme.spacing(1),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    summaryTotalLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    summaryTotalValue: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.colors.text,
    },
    summaryTotalValueLarge: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    laborRevenueCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing(3),
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    resultCard: {
      backgroundColor: `${theme.colors.accent}15`,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    resultLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    resultValue: {
      fontSize: 56,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    resultHint: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: theme.spacing(1),
      textAlign: "center",
    },
    navButtons: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(4),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginLeft: 4,
    },
    nextButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(3),
      borderRadius: theme.radius.lg,
    },
    nextButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
      marginRight: 4,
    },
    saveButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(3),
      borderRadius: theme.radius.lg,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    saveExitButton: {
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      marginLeft: theme.spacing(1),
    },
    saveExitButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
  });
}
