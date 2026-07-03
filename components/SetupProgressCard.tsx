// components/SetupProgressCard.tsx
// Non-blocking, dismissable "setup your business" card for the Dashboard.
//
// Replaces the old first-launch blocking Modal that gated every new user
// behind a five-step setup wall. That modal was almost certainly why
// bubonko@gmail.com — a real organic signup — bounced 1.3 seconds after
// creating their account: they landed on a wall of homework instead of
// the actual product.
//
// New shape: users land on the product immediately after account
// creation. This card sits at the top of the Dashboard as a soft nudge.
// It's collapsible, dismissible for the current session, and comes back
// on next launch if setup is still incomplete. Each step deep-links to
// the existing calculator/settings screens.
//
// Setup progress is derived from the same preferences flags the old
// wizard used, so anyone who set things up via the old flow already
// shows as complete here.

import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { loadPreferences } from "@/lib/preferences";

type Step = {
  key: string;
  title: string;
  route: string;
  done: boolean;
};

interface SetupProgressCardProps {
  /** Called when the user dismisses the card for this session. */
  onDismiss: () => void;
}

export function SetupProgressCard({ onDismiss }: SetupProgressCardProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([]);
  // Start collapsed. Expanded-by-default competed visually with the
  // "make your first quote" hero on Dashboard; keeping this collapsed lets
  // the hero own the primary attention slot while still showing the
  // "X of 4" progress so the user knows setup is here when they want it.
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    const prefs = await loadPreferences();
    setSteps([
      {
        key: "company",
        title: "Add your company info",
        route: "/business-settings",
        done: !!prefs.company?.companyName,
      },
      {
        key: "overhead",
        title: "Calculate your overhead",
        route: "/overhead-calculator",
        done: (prefs.overhead?.annualOverhead ?? 0) > 0,
      },
      {
        key: "laborRate",
        title: "Find your billable rate",
        route: "/labor-rate-calculator",
        done:
          (prefs.pricing?.defaultLaborRate ?? 0) > 0 &&
          (prefs.pricing?.defaultLaborCostRate ?? 0) > 0,
      },
      {
        key: "margin",
        title: "Set your target margin",
        route: "/confirm-target-margin",
        done: (prefs.overhead?.targetProfitMarginPercent ?? 0) > 0,
      },
    ]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-check when this screen re-focuses (user returned from a step screen).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const allDone = doneCount === totalCount && totalCount > 0;

  // Hide once every step is complete; there's no more nudging to do.
  if (allDone) return null;

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        hitSlop={4}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="construct-outline" size={22} color={theme.colors.accent} />
          <View style={styles.headerText}>
            <Text style={styles.title}>Set up your business</Text>
            <Text style={styles.subtitle}>
              {doneCount} of {totalCount} · takes about 5 minutes
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            hitSlop={12}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color={theme.colors.muted} />
          </Pressable>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.colors.muted}
            style={{ marginLeft: 4 }}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.stepsContainer}>
          {steps.map((step) => (
            <Pressable
              key={step.key}
              style={styles.stepRow}
              onPress={() => router.push(step.route as never)}
            >
              <Ionicons
                name={step.done ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={step.done ? "#22c55e" : theme.colors.muted}
              />
              <Text
                style={[
                  styles.stepTitle,
                  step.done && { color: theme.colors.muted, textDecorationLine: "line-through" },
                ]}
              >
                {step.title}
              </Text>
              {!step.done && (
                <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    headerText: {
      marginLeft: 10,
      flex: 1,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    closeButton: {
      padding: 4,
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    stepsContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingVertical: theme.spacing(0.5),
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.25),
      gap: 12,
    },
    stepTitle: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
    },
  });
}
