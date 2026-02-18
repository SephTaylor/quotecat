// app/(main)/(tabs)/pro-tools.tsx
// Pro Tools tab - Shows locked features for free users, unlocked for pro users
import { useTheme } from "@/contexts/ThemeContext";
import { canAccessAssemblies } from "@/lib/features";
import { getUserState } from "@/lib/user";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GradientBackground } from "@/components/GradientBackground";

export default function ProTools() {
  const router = useRouter();
  const { theme } = useTheme();
  const [isPro, setIsPro] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  const load = useCallback(async () => {
    const user = await getUserState();
    setIsPro(canAccessAssemblies(user));
    setIsPremium(user?.tier === "premium");
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSignIn = () => {
    router.push("/(auth)/sign-in" as any);
  };

  const handleFeatureTap = (featureName: string, requiresPremium: boolean = false, freeAccess: boolean = false) => {
    // Check if user has the required tier (or if feature is free for all)
    const hasAccess = freeAccess || (requiresPremium ? isPremium : isPro);

    if (hasAccess) {
      // Navigate to feature
      if (featureName === "Assembly Library") {
        router.push("/(main)/assemblies-browse" as any);
      } else if (featureName === "Assembly Manager") {
        router.push("/(main)/assembly-manager" as any);
      } else if (featureName === "Client Manager") {
        router.push("/(main)/client-manager" as any);
      } else if (featureName === "Contracts") {
        router.push("/(main)/(tabs)/contracts" as any);
      } else if (featureName === "Price Book") {
        router.push("/(main)/price-book" as any);
      } else if (featureName === "Job Calculator") {
        router.push("/(main)/job-calculator" as any);
      }
    } else {
      // Show sign in prompt
      handleSignIn();
    }
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Stack.Screen
        options={{ title: "Pro Tools", headerBackVisible: false, headerTitleAlign: 'center' }}
      />
      <GradientBackground>
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
              description="Browse your pre-built assembly templates"
              locked={!isPro}
              onPress={() => handleFeatureTap("Assembly Library")}
              details={[]}
              theme={theme}
            />

            {/* Client Manager - Free for all users */}
            <ProFeatureCard
              icon=""
              title="Client Manager"
              description="Save and manage your client list"
              locked={false}
              onPress={() => handleFeatureTap("Client Manager", false, true)}
              details={[]}
              theme={theme}
            />

            {/* Job Calculator - Pro feature */}
            <ProFeatureCard
              icon=""
              title="Job Calculator"
              description="Calculate materials from job dimensions"
              locked={!isPro}
              onPress={() => handleFeatureTap("Job Calculator")}
              details={[]}
              theme={theme}
            />
          </View>

          {/* Premium Features Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Premium Features</Text>

            {/* Contracts */}
            <ProFeatureCard
              icon=""
              title="Contracts"
              description="Create legally-binding contracts with digital signatures"
              locked={!isPremium}
              onPress={() => handleFeatureTap("Contracts", true)}
              details={[]}
              theme={theme}
              isPremium
            />

            {/* Price Book */}
            <ProFeatureCard
              icon=""
              title="Price Book"
              description="Create and manage your custom products and pricing"
              locked={!isPremium}
              onPress={() => handleFeatureTap("Price Book", true)}
              details={[]}
              theme={theme}
              isPremium
            />
          </View>

          {!isPro && (
            <View style={styles.upgradeSection}>
              <Pressable style={styles.upgradeButton} onPress={handleSignIn}>
                <Text style={styles.upgradeButtonText}>
                  Sign In
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </GradientBackground>
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
  isPremium = false,
}: {
  icon: string;
  title: string;
  description: string;
  locked: boolean;
  onPress: () => void;
  details: string[];
  theme: ReturnType<typeof useTheme>["theme"];
  isPremium?: boolean;
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={[styles.featureCard, locked && styles.featureCardLocked, isPremium && styles.featureCardPremium]}
      onPress={onPress}
    >
      <View style={styles.featureInfo}>
        <View style={styles.featureTitleRow}>
          <Text style={styles.featureTitle}>{title}</Text>
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>Premium</Text>
            </View>
          )}
        </View>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>

      <View style={[styles.launchButton, locked && styles.launchButtonLocked, isPremium && !locked && styles.launchButtonPremium]}>
        <Text style={[styles.launchButtonText, isPremium && !locked && styles.launchButtonTextPremium]}>
          {locked ? "Unlock" : "Launch"}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    scrollContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(2),
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
    featureCardPremium: {
      borderColor: "#5856D6",
      borderWidth: 1.5,
    },
    featureInfo: {
      flex: 1,
    },
    featureTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 2,
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    premiumBadge: {
      backgroundColor: "#5856D620",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    premiumBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#5856D6",
      textTransform: "uppercase",
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
    launchButtonPremium: {
      backgroundColor: "#5856D6",
    },
    launchButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#000",
    },
    launchButtonTextPremium: {
      color: "#FFF",
    },
    upgradeSection: {
      marginTop: theme.spacing(2),
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
