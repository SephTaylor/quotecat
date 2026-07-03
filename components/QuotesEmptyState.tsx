// components/QuotesEmptyState.tsx
// Empty-state UI for the Quotes tab. Replaces the old two-line
// "No quotes yet — tap the + to start" text.
//
// The single biggest activation moment in the app is "brand-new user
// makes their first quote." Everything else — cloud sync, exports,
// contracts — is downstream of that. So the empty state gets a big,
// prominent CTA that says exactly what to do, framed as a celebration
// of the moment (this is a starting line, not a barrier).

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

interface QuotesEmptyStateProps {
  onPress: () => void;
  /** When the filter is active, show a lighter "no matches" state instead. */
  variant?: "start" | "filtered" | "followup";
}

export function QuotesEmptyState({ onPress, variant = "start" }: QuotesEmptyStateProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  if (variant === "filtered") {
    return (
      <View style={styles.container}>
        <Ionicons name="search" size={32} color={theme.colors.muted} />
        <Text style={styles.title}>No matches</Text>
        <Text style={styles.description}>Try a different search or filter.</Text>
      </View>
    );
  }

  if (variant === "followup") {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-circle-outline" size={40} color="#22c55e" />
        <Text style={styles.title}>You&rsquo;re all caught up</Text>
        <Text style={styles.description}>No follow-ups due right now.</Text>
      </View>
    );
  }

  // Default: the "you just installed the app" moment.
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="hammer" size={36} color={theme.colors.accent} />
      </View>
      <Text style={styles.title}>Ready to make your first quote?</Text>
      <Text style={styles.description}>
        You can add your company info and other setup later — it&rsquo;s all optional.
      </Text>
      <Pressable style={styles.primaryButton} onPress={onPress}>
        <Text style={styles.primaryButtonText}>Start my first quote</Text>
        <Ionicons name="arrow-forward" size={18} color="#000" />
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(6),
    },
    iconCircle: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: theme.colors.accent + "18",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing(3),
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: theme.spacing(1),
    },
    description: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: theme.spacing(3),
      maxWidth: 320,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(1.75),
      paddingHorizontal: theme.spacing(3),
      borderRadius: theme.radius.xl,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
}
