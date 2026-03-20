// components/OnboardingStepCard.tsx
// Individual step row component for onboarding flow

import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

export type OnboardingStepStatus = "pending" | "current" | "complete";

interface OnboardingStepCardProps {
  title: string;
  subtitle: string;
  ctaLabel: string;
  status: OnboardingStepStatus;
  onPress: () => void;
}

export function OnboardingStepCard({
  title,
  subtitle,
  ctaLabel,
  status,
  onPress,
}: OnboardingStepCardProps) {
  const { theme } = useTheme();

  const isPending = status === "pending";
  const isCurrent = status === "current";
  const isComplete = status === "complete";

  // Colors based on status
  const iconColor = isComplete
    ? "#22c55e" // Green
    : isCurrent
      ? theme.colors.accent // Orange
      : theme.colors.muted; // Gray

  const textOpacity = isPending ? 0.5 : 1;

  return (
    <Pressable
      onPress={onPress}
      disabled={isPending}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: isCurrent ? theme.colors.accent : theme.colors.border,
          borderWidth: isCurrent ? 2 : 1,
          opacity: isPending ? 0.6 : 1,
        },
      ]}
    >
      {/* Top row: icon + content + done badge */}
      <View style={styles.topRow}>
        {/* Left icon */}
        <View style={styles.iconContainer}>
          {isComplete ? (
            <Ionicons name="checkmark-circle" size={28} color={iconColor} />
          ) : (
            <Ionicons name="ellipse-outline" size={28} color={iconColor} />
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text
            style={[
              styles.title,
              { color: theme.colors.text, opacity: textOpacity },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.muted, opacity: textOpacity },
            ]}
          >
            {subtitle}
          </Text>
        </View>

        {/* Done badge for complete steps */}
        {isComplete && (
          <View style={styles.actionContainer}>
            <Text style={[styles.doneText, { color: "#22c55e" }]}>Done</Text>
          </View>
        )}
      </View>

      {/* Bottom row: CTA button for incomplete steps */}
      {isCurrent && (
        <View style={styles.ctaRow}>
          <View
            style={[styles.ctaButton, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionContainer: {
    marginLeft: 12,
  },
  ctaRow: {
    marginTop: 12,
    alignItems: "flex-start",
  },
  ctaButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  doneText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
