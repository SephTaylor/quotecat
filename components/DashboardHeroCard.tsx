// components/DashboardHeroCard.tsx
// Dashboard hero shown only to users who have never made a quote or an
// invoice. Sits above SetupProgressCard so the activation moment
// ("make your first quote") beats the homework ("set your margin").
//
// Once the user has any quote or invoice, this card unmounts and the
// Dashboard reverts to its normal stats-first layout. The X in the top
// corner dismisses the card session-scoped (comes back next launch if
// still no quotes) — same pattern as SetupProgressCard.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

interface DashboardHeroCardProps {
  onPress: () => void;
  onDismiss: () => void;
}

export function DashboardHeroCard({ onPress, onDismiss }: DashboardHeroCardProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onDismiss}
        hitSlop={12}
        style={styles.closeButton}
        accessibilityLabel="Dismiss"
      >
        <Ionicons name="close" size={18} color={theme.colors.muted} />
      </Pressable>
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
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2.5),
      paddingVertical: theme.spacing(2),
      alignItems: "center",
    },
    closeButton: {
      position: "absolute",
      top: theme.spacing(1),
      right: theme.spacing(1),
      padding: 4,
      zIndex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: theme.spacing(0.5),
    },
    description: {
      fontSize: 13,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 18,
      marginBottom: theme.spacing(1.5),
      maxWidth: 320,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(1.25),
      paddingHorizontal: theme.spacing(2.5),
      borderRadius: theme.radius.xl,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
}
