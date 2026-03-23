// components/OnboardingFlow.tsx
// Main onboarding flow modal content

import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import {
  OnboardingStepCard,
  type OnboardingStepStatus,
} from "./OnboardingStepCard";
import {
  loadPreferences,
  updateOnboardingPreferences,
  updateOverheadSettings,
} from "@/lib/preferences";

interface OnboardingFlowProps {
  onComplete: () => void;
  tier?: 'free' | 'pro' | 'premium';
}

type StepKey = "companySetup" | "overheadCalc" | "laborRate" | "targetMargin";

type Steps = Record<StepKey, boolean>;

const STEP_CONFIG: {
  key: StepKey;
  title: string;
  subtitle: string;
  ctaLabel: string;
  route: string;
}[] = [
  {
    key: "companySetup",
    title: "Set Up Your Business",
    subtitle: "Your company info appears on every quote and invoice.",
    ctaLabel: "Set Up Company",
    route: "/company-details",
  },
  {
    key: "overheadCalc",
    title: "Know Your Overhead",
    subtitle:
      "Vehicle, insurance, tools, software — add them up once and never guess again.",
    ctaLabel: "Calculate Overhead",
    route: "/overhead-calculator",
  },
  {
    key: "laborRate",
    title: "Find Your Billable Rate",
    subtitle:
      "Plug in your salary and costs. QuoteCat calculates what you need to charge.",
    ctaLabel: "Calculate My Rate",
    route: "/labor-rate-calculator",
  },
  {
    key: "targetMargin",
    title: "Confirm Your Target Margin",
    subtitle:
      "Quotes below this margin show a warning. Verify your target or adjust if needed.",
    ctaLabel: "Review Target",
    route: "/confirm-target-margin",
  },
];

export function OnboardingFlow({ onComplete, tier = 'free' }: OnboardingFlowProps) {
  const isFree = tier === 'free';
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<Steps>({
    companySetup: false,
    overheadCalc: false,
    laborRate: false,
    targetMargin: false,
  });
  const [navigating, setNavigating] = useState(false);

  const allComplete = Object.values(steps).every(Boolean);

  // Check step completion status
  const checkAndUpdateSteps = useCallback(async () => {
    try {
      const prefs = await loadPreferences();

      const newSteps: Steps = {
        // Step 1: Company name set
        companySetup: !!prefs.company?.companyName,
        // Step 2: Overhead calculator completed (sets annualOverhead > 0)
        overheadCalc: (prefs.overhead?.annualOverhead ?? 0) > 0,
        // Step 3: Labor Rate Calculator completed (both rates set)
        laborRate:
          (prefs.pricing?.defaultLaborRate ?? 0) > 0 &&
          (prefs.pricing?.defaultLaborCostRate ?? 0) > 0,
        // Step 4: Target margin set
        targetMargin: (prefs.overhead?.targetProfitMarginPercent ?? 0) > 0,
      };

      // Only update if changed
      const current = prefs.onboarding?.steps;
      const changed =
        current?.companySetup !== newSteps.companySetup ||
        current?.overheadCalc !== newSteps.overheadCalc ||
        current?.laborRate !== newSteps.laborRate ||
        current?.targetMargin !== newSteps.targetMargin;

      if (changed) {
        await updateOnboardingPreferences({ steps: newSteps });
      }

      // Auto-set overhead.completedAt if data present but no timestamp
      // This ensures financial intel shows even when data was entered manually
      const overheadDataPresent = newSteps.overheadCalc || newSteps.targetMargin;
      if (overheadDataPresent && !prefs.overhead?.completedAt) {
        await updateOverheadSettings({
          ...prefs.overhead,
          completedAt: new Date().toISOString(),
        });
      }

      // Auto-complete onboarding if all steps done
      const allStepsComplete = Object.values(newSteps).every(Boolean);
      if (allStepsComplete && !prefs.onboarding?.completedAt) {
        await updateOnboardingPreferences({ completedAt: new Date().toISOString() });
      }

      setSteps(newSteps);
      setLoading(false);
    } catch (error) {
      console.error("Error checking onboarding steps:", error);
      setLoading(false);
    }
  }, []);

  // Check on mount
  useEffect(() => {
    checkAndUpdateSteps();
  }, [checkAndUpdateSteps]);

  // Re-check on focus (when returning from a step screen)
  useFocusEffect(
    useCallback(() => {
      setNavigating(false); // Reset navigation lock
      checkAndUpdateSteps();
    }, [checkAndUpdateSteps])
  );

  // Handle skip (with double-tap protection)
  const handleSkip = async () => {
    if (navigating) return;
    setNavigating(true);
    await updateOnboardingPreferences({
      skippedAt: new Date().toISOString(),
    });
    onComplete();
  };

  // Handle completion
  const handleStartQuoting = async () => {
    await updateOnboardingPreferences({
      completedAt: new Date().toISOString(),
    });
    onComplete();
  };

  // Navigate to step (with double-tap protection)
  const handleStepPress = (route: string) => {
    if (navigating) return;
    setNavigating(true);
    onComplete(); // Close modal before navigating
    // Small delay to let modal animation complete
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  // Calculate step status
  const getStepStatus = (index: number): OnboardingStepStatus => {
    const stepKey = STEP_CONFIG[index].key;

    // If this step is complete, show complete
    if (steps[stepKey]) return "complete";

    // All incomplete steps are clickable (not sequential)
    // This allows users to complete steps in any order
    return "current";
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.bg }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.muted }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.bg }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Welcome to QuoteCat
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            {allComplete
              ? "You're all set!"
              : "Let's get you set up to win."}
          </Text>
          {!allComplete && (
            <Pressable onPress={handleSkip} style={styles.skipButtonTop}>
              <Text style={[styles.skipButtonText, { color: theme.colors.muted }]}>
                Skip for now
              </Text>
            </Pressable>
          )}
        </View>

        {/* Steps */}
        {!allComplete && (
          <View style={styles.stepsContainer}>
            {STEP_CONFIG.map((step, index) => {
              // Add note for free users on company setup step
              let subtitle = step.subtitle;
              if (step.key === "companySetup" && isFree) {
                subtitle += " Stored locally until you upgrade.";
              }
              return (
                <OnboardingStepCard
                  key={step.key}
                  title={`${index + 1}. ${step.title}`}
                  subtitle={subtitle}
                  ctaLabel={step.ctaLabel}
                  status={getStepStatus(index)}
                  onPress={() => handleStepPress(step.route)}
                />
              );
            })}
          </View>
        )}

        {/* Completion state */}
        {allComplete && (
          <View style={styles.completionContainer}>
            <View
              style={[
                styles.completionIcon,
                { backgroundColor: "#22c55e20" },
              ]}
            >
              <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            </View>
            <Text
              style={[styles.completionSubtitle, { color: theme.colors.muted }]}
            >
              QuoteCat is ready to work.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom actions - only show when all complete */}
      {allComplete && (
        <View
          style={[
            styles.bottomActions,
            { borderTopColor: theme.colors.border },
          ]}
        >
          <Pressable
            onPress={handleStartQuoting}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.colors.accent },
            ]}
          >
            <Text style={styles.primaryButtonText}>Start Quoting</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    marginBottom: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  stepsContainer: {
    marginTop: 4,
  },
  completionContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  completionIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  completionSubtitle: {
    fontSize: 18,
    textAlign: "center",
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  skipButtonTop: {
    marginTop: 12,
    paddingVertical: 6,
  },
  skipButtonText: {
    fontSize: 15,
    textDecorationLine: "underline",
  },
});
