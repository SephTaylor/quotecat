// components/FirstQuoteNudge.tsx
// One-time celebratory modal after the user creates their first quote.
//
// Pure celebration first, then a passive Pro features preview + an honest
// "Unlock Pro" CTA. The rename from "See what Pro unlocks" → "Unlock Pro"
// fixes the earlier bait-and-switch (the button now says what it does).
// If the user isn't ready, they can dismiss with the secondary button.
//
// The paywall is opened via presentPaywallAndSync (IAP, Apple-sanctioned).
// If RC isn't ready (sim / edge case), we show a brief in-app alert — no
// fallback link to the marketing site (Apple's anti-steering rule).
//
// Fires once, ever, tracked via UserState.nudgesShown.firstQuote.
// Only shown to Free users — Pro/Premium users skip it since they're
// already past the upgrade decision.

import React from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { presentPaywallAndSync } from "@/lib/revenuecat";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function FirstQuoteNudge({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleUnlockPro = async () => {
    onClose();
    // Small delay so the modal dismiss animation completes before the
    // paywall slides in.
    setTimeout(async () => {
      const shown = await presentPaywallAndSync("first_quote_nudge");
      if (!shown) {
        Alert.alert(
          "Not available right now",
          "Purchases aren't available at the moment. Please try again in a bit."
        );
      }
    }, 250);
  };

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

          <View style={styles.buttonContainer}>
            <Pressable style={[styles.button, styles.primaryButton]} onPress={handleUnlockPro}>
              <Text style={styles.primaryButtonText}>Unlock Pro</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Not yet</Text>
            </Pressable>
          </View>
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
    buttonContainer: {
      gap: 10,
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
    secondaryButton: {
      backgroundColor: "transparent",
    },
    secondaryButtonText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.muted,
    },
  });
}
