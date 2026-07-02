// components/FirstQuoteNudge.tsx
// One-time celebratory modal after the user creates their first quote.
//
// This is deliberately NOT a paywall. The moment a contractor finishes
// their first quote is a genuine win — the modal celebrates that first,
// then plants a soft seed about what unlocks in Pro. If it feels like a
// sales pitch the shine dulls; if it feels like acknowledgement, the
// upgrade thought lands more warmly later.
//
// Fires once, ever, tracked via UserState.nudgesShown.firstQuote.
// Only shown to Free users — Pro/Premium users skip it since they're
// already past the upgrade decision.

import React from "react";
import {
  Linking,
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

  const handleSeePro = async () => {
    onClose();
    // Small delay so the modal dismiss animation completes before the
    // paywall slides in — feels less like a bait-and-switch.
    setTimeout(async () => {
      const shown = await presentPaywallAndSync("first_quote_nudge");
      // presentPaywallAndSync returns false when RevenueCat isn't ready —
      // most commonly on the iOS simulator (no StoreKit) or when RC init
      // has failed silently. Rather than the button doing nothing, fall
      // back to the marketing site so the user still sees Pro's story.
      if (!shown) {
        try {
          await Linking.openURL("https://quotecat.ai/#pricing");
        } catch {
          /* nothing more we can do — swallow silently */
        }
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

          <Text style={styles.sectionLabel}>When you&rsquo;re ready to grow</Text>
          <View style={styles.featureList}>
            <FeatureRow theme={theme} icon="cloud-outline" text="Cloud sync across your devices" />
            <FeatureRow theme={theme} icon="link-outline" text="Send quotes as a link, not just a PDF" />
            <FeatureRow theme={theme} icon="card-outline" text="Accept card payments with a fee-free (to you) portal" />
            <FeatureRow theme={theme} icon="library-outline" text="Custom assemblies for the work you do most" />
          </View>

          <View style={styles.buttonContainer}>
            <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSeePro}>
              <Text style={styles.primaryButtonText}>See what Pro unlocks</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Keep going — I&rsquo;ll check later</Text>
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
