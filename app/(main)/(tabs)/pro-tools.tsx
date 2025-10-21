// app/(main)/(tabs)/pro-tools.tsx
// Pro Tools tab - Shows locked features for free users, unlocked for pro users
import { useTheme } from "@/contexts/ThemeContext";
import { canAccessAssemblies } from "@/lib/features";
import { getUserState } from "@/lib/user";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ProTools() {
  const router = useRouter();
  const { theme } = useTheme();
  const [isPro, setIsPro] = useState(false);

  const load = useCallback(async () => {
    const user = await getUserState();
    setIsPro(canAccessAssemblies(user));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleUpgrade = () => {
    Alert.alert(
      "Upgrade to Pro",
      "You'll be redirected to quotecat.ai to view pricing and upgrade options.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            Linking.openURL("https://quotecat.ai/pricing");
          },
        },
      ],
    );
  };

  const handleFeatureTap = (featureName: string) => {
    if (isPro) {
      // Navigate to feature
      if (featureName === "Assembly Library") {
        router.push("./assemblies" as any);
      } else if (featureName === "Assembly Manager") {
        router.push("/(main)/assembly-manager" as any);
      } else if (featureName === "Wizard") {
        // Coming soon
        Alert.alert(
          "Coming Soon",
          "The Quote Wizard will help you build quotes faster by calculating materials based on room dimensions and project scope.",
          [{ text: "OK" }]
        );
      }
      // Add other pro features here
    } else {
      // Show upgrade prompt
      handleUpgrade();
    }
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Stack.Screen
        options={{ title: "Pro Tools", headerBackVisible: false }}
      />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!isPro && (
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Pro Features</Text>
              <Text style={styles.headerSubtitle}>
                Unlock powerful tools for professional quoting
              </Text>
            </View>
          )}

          {/* Available Tools Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Now</Text>

            {/* Assembly Manager */}
            <ProFeatureCard
              icon=""
              title="Assembly Manager"
              description="Create and manage your custom assemblies"
              locked={!isPro}
              onPress={() => handleFeatureTap("Assembly Manager")}
              details={[]}
              theme={theme}
            />

            {/* Assembly Library */}
            <ProFeatureCard
              icon=""
              title="Assembly Library"
              description="Browse pre-built assembly templates"
              locked={!isPro}
              onPress={() => handleFeatureTap("Assembly Library")}
              details={[]}
              theme={theme}
            />
          </View>

          {/* Coming Soon Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coming Soon</Text>

            <View style={styles.comingSoonList}>
              <View style={styles.comingSoonItem}>
                <Text style={styles.comingSoonTitle}>Quote Wizard</Text>
                <Text style={styles.comingSoonDescription}>
                  Calculate materials from room dimensions
                </Text>
              </View>

              <View style={styles.comingSoonItem}>
                <Text style={styles.comingSoonTitle}>Cloud Backup & Sync</Text>
                <Text style={styles.comingSoonDescription}>
                  Never lose your quotes
                </Text>
              </View>

              <View style={styles.comingSoonItem}>
                <Text style={styles.comingSoonTitle}>Branded PDFs</Text>
                <Text style={styles.comingSoonDescription}>
                  Professional exports with your branding
                </Text>
              </View>

              <View style={styles.comingSoonItem}>
                <Text style={styles.comingSoonTitle}>Advanced Analytics</Text>
                <Text style={styles.comingSoonDescription}>
                  Track quote value and performance
                </Text>
              </View>
            </View>
          </View>

          {!isPro && (
            <View style={styles.upgradeSection}>
              <Text style={styles.upgradeTitle}>Ready to upgrade?</Text>
              <Text style={styles.upgradeSubtitle}>
                Visit quotecat.ai to view pricing and plans
              </Text>
              <Pressable style={styles.upgradeButton} onPress={handleUpgrade}>
                <Text style={styles.upgradeButtonText}>
                  Learn More & Upgrade
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

function ProFeatureCard({
  icon,
  title,
  description,
  locked,
  onPress,
  details,
  theme,
}: {
  icon: string;
  title: string;
  description: string;
  locked: boolean;
  onPress: () => void;
  details: string[];
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.featureCard, locked && styles.featureCardLocked]}>
      <View style={styles.featureInfo}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>

      <Pressable
        style={[styles.launchButton, locked && styles.launchButtonLocked]}
        onPress={onPress}
      >
        <Text style={styles.launchButtonText}>
          {locked ? "Unlock" : "Launch"}
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    scrollContent: {
      padding: theme.spacing(2),
    },
    header: {
      marginBottom: theme.spacing(3),
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    headerSubtitle: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: theme.spacing(1.5),
    },
    featureCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing(2),
    },
    featureCardLocked: {
      opacity: 0.8,
    },
    featureInfo: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 2,
    },
    featureDescription: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    launchButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.75),
      borderRadius: theme.radius.sm,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    launchButtonLocked: {
      opacity: 0.7,
    },
    launchButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#000",
    },
    comingSoonList: {
      gap: theme.spacing(2),
    },
    comingSoonItem: {
      paddingLeft: theme.spacing(1),
    },
    comingSoonTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    comingSoonDescription: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    upgradeSection: {
      marginTop: theme.spacing(3),
      padding: theme.spacing(3),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      alignItems: "center",
    },
    upgradeTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    upgradeSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      marginBottom: theme.spacing(2),
    },
    upgradeButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    upgradeButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
}
