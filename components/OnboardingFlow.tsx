// components/OnboardingFlow.tsx
// Main onboarding flow modal content

import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
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
} from "@/lib/preferences";

interface OnboardingFlowProps {
  onComplete: () => void;
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
    title: "Set Your Target Margin",
    subtitle:
      "QuoteCat flags any quote that falls short. Most contractors aim for 20-25%.",
    ctaLabel: "Set My Target",
    route: "/business-settings?scrollTo=margin",
  },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<Steps>({
    companySetup: false,
    overheadCalc: false,
    laborRate: false,
    targetMargin: false,
  });

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
      checkAndUpdateSteps();
    }, [checkAndUpdateSteps])
  );

  // Handle skip
  const handleSkip = async () => {
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

  // Navigate to step
  const handleStepPress = (route: string) => {
    router.push(route as any);
  };

  // Calculate step status
  const getStepStatus = (index: number): OnboardingStepStatus => {
    const stepKey = STEP_CONFIG[index].key;

    // If this step is complete, show complete
    if (steps[stepKey]) return "complete";

    // Find the first incomplete step
    for (let i = 0; i < STEP_CONFIG.length; i++) {
      if (!steps[STEP_CONFIG[i].key]) {
        // This is the first incomplete step
        return i === index ? "current" : "pending";
      }
    }

    return "pending";
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
        </View>

        {/* Steps */}
        {!allComplete && (
          <View style={styles.stepsContainer}>
            {STEP_CONFIG.map((step, index) => (
              <OnboardingStepCard
                key={step.key}
                title={step.title}
                subtitle={step.subtitle}
                ctaLabel={step.ctaLabel}
                status={getStepStatus(index)}
                onPress={() => handleStepPress(step.route)}
              />
            ))}
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

      {/* Bottom actions */}
      <View
        style={[
          styles.bottomActions,
          { borderTopColor: theme.colors.border },
        ]}
      >
        {allComplete ? (
          <Pressable
            onPress={handleStartQuoting}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.colors.accent },
            ]}
          >
            <Text style={styles.primaryButtonText}>Start Quoting</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text style={[styles.skipButtonText, { color: theme.colors.muted }]}>
              Skip for now
            </Text>
          </Pressable>
        )}
      </View>
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
    padding: 24,
    paddingBottom: 100,
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
    marginBottom: 32,
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
    marginTop: 8,
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
  skipButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  skipButtonText: {
    fontSize: 16,
  },
});
