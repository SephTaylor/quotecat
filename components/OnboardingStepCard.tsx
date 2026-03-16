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
    <View
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
      {/* Left icon */}
      <View style={styles.iconContainer}>
        {isComplete ? (
          <Ionicons name="checkmark-circle" size={28} color={iconColor} />
        ) : isCurrent ? (
          <Ionicons name="arrow-forward-circle" size={28} color={iconColor} />
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

      {/* Right action */}
      <View style={styles.actionContainer}>
        {isComplete ? (
          <Pressable onPress={onPress} style={styles.doneButton}>
            <Text style={[styles.doneText, { color: "#22c55e" }]}>Done</Text>
          </Pressable>
        ) : isCurrent ? (
          <Pressable
            onPress={onPress}
            style={[styles.ctaButton, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 12,
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
    alignItems: "flex-end",
  },
  ctaButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  doneButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doneText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
