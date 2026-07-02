// components/PdfLimitNudge.tsx
// Modal shown when a Free user hits their monthly PDF export cap.
//
// Fires each month the user reaches the cap, but at most once per month
// (tracked via UserState.nudgesShown.pdfLimit — re-arms on the 1st via
// wasNudgeShownThisMonth). Only for Free users; Pro/Premium have unlimited.
//
// Copy leans into what unlocks with Pro instead of shaming the limit,
// and always tells them exactly when the cap refreshes ("resets on
// August 1") so the "wait it out" option is visible and honest.

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
import { getNextResetDateLabel } from "@/lib/user";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** How many PDFs Free users get per month — usually FREE_LIMITS.pdfs. */
  monthlyLimit: number;
};

export function PdfLimitNudge({ visible, onClose, monthlyLimit }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const resetLabel = getNextResetDateLabel();

  const handleSeePro = async () => {
    onClose();
    // Legitimate limit-reached → IAP upgrade flow. Apple explicitly sanctions
    // this path (in-app IAP for digital-content limits). If RevenueCat isn't
    // ready (e.g. simulator, RC init failed), show a brief in-app alert and
    // stay silent — DO NOT link to the marketing site as an alternative
    // purchase path (that runs into Apple's anti-steering rules under
    // Guideline 3.1.1). The dedicated in-app "compare plans" screen is on
    // the roadmap and will host any richer upgrade content.
    setTimeout(async () => {
      const shown = await presentPaywallAndSync("pdf_limit_nudge");
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
            <Ionicons name="document-text-outline" size={52} color={theme.colors.accent} />
          </View>

          <Text style={styles.title}>You&rsquo;ve hit your {monthlyLimit} PDFs this month</Text>

          <Text style={styles.description}>
            Nothing broken — this is the Free tier cap. Your next {monthlyLimit} refresh on{" "}
            <Text style={{ fontWeight: "700", color: theme.colors.text }}>{resetLabel}</Text>.
          </Text>

          <View style={styles.callout}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.muted} />
            <Text style={styles.calloutText}>
              Unused PDFs don&rsquo;t roll over — every month starts fresh at {monthlyLimit}.
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>If you don&rsquo;t want to wait</Text>
          <View style={styles.featureList}>
            <FeatureRow theme={theme} icon="infinite-outline" text="Unlimited PDF exports" />
            <FeatureRow theme={theme} icon="link-outline" text="Share as a live link — customer signs on their phone" />
            <FeatureRow theme={theme} icon="card-outline" text="Get paid by card (fee-free to you)" />
            <FeatureRow theme={theme} icon="cloud-outline" text="Cloud sync + multi-device" />
          </View>

          <View style={styles.buttonContainer}>
            <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSeePro}>
              <Text style={styles.primaryButtonText}>See what Pro unlocks</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>I&rsquo;ll wait until {resetLabel}</Text>
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
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: 10,
    },
    description: {
      fontSize: 15,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 14,
    },
    callout: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      padding: 12,
      marginBottom: 4,
    },
    calloutText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
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
