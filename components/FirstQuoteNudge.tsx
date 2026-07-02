// components/FirstQuoteNudge.tsx
// One-time celebratory modal after the user creates their first quote.
//
// Pure celebration + a passive preview of what Pro adds. Deliberately no
// upgrade button here — that was bait-and-switch (button said "See what
// Pro unlocks" but immediately asked for money) and the marketing-site
// fallback also risked running into Apple's anti-steering rules.
//
// The real upgrade path lives elsewhere: legitimate limit-reached moments
// (like the monthly PDF cap) route straight to the IAP paywall, which is
// exactly what Apple sanctions. A dedicated in-app "compare plans" screen
// with an IAP button is on the roadmap and will be Apple-compliant.
//
// Fires once, ever, tracked via UserState.nudgesShown.firstQuote.
// Only shown to Free users — Pro/Premium users skip it since they're
// already past the upgrade decision.

import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function FirstQuoteNudge({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={56} color={theme.colors.accent} />
          </View>

          <Text style={styles.title}>First quote saved</Text>

          <Text style={styles.description}>
            Nice work. The hardest quote is the first one — everything after this gets faster.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>What Pro adds when you&rsquo;re ready</Text>
          <View style={styles.featureList}>
            <FeatureRow theme={theme} icon="cloud-outline" text="Cloud sync across your devices" />
            <FeatureRow theme={theme} icon="link-outline" text="Send quotes as a link, not just a PDF" />
            <FeatureRow theme={theme} icon="card-outline" text="Accept card payments — no QuoteCat fees" />
            <FeatureRow theme={theme} icon="library-outline" text="Custom assemblies for the work you do most" />
          </View>

          <Pressable style={[styles.button, styles.primaryButton]} onPress={onClose}>
            <Text style={styles.primaryButtonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function FeatureRow({
  theme,
  icon,
  text,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <Ionicons name={icon} size={18} color={theme.colors.accent} />
      <Text style={{ flex: 1, fontSize: 14, color: theme.colors.text, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modalContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      padding: 24,
      width: "100%",
      maxWidth: 400,
    },
    iconContainer: {
      alignItems: "center",
      marginBottom: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 8,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 16,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    featureList: {
      marginBottom: 20,
    },
    button: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: theme.radius.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
}
