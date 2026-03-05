// app/(main)/(tabs)/pro-tools.tsx
// Toolbox tab - Business tools for all users (free, pro, premium)
import { useTheme } from "@/contexts/ThemeContext";
import { canAccessAssemblies } from "@/lib/features";
import { getUserState } from "@/lib/user";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { presentPaywallAndSync } from "@/lib/revenuecat";
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

  const handleFeatureTap = async (featureName: string, requiresPremium: boolean = false, freeAccess: boolean = false) => {
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
      } else if (featureName === "Premium Portal") {
        // Premium users can access the web portal
        Alert.alert(
          "Premium Portal",
          "Access your full business suite at portal.quotecat.ai",
          [{ text: "OK" }]
        );
      } else if (featureName === "Team Members") {
        router.push("/(main)/team-members" as any);
      } else if (featureName === "Labor Rate Calculator") {
        router.push("/(main)/labor-rate-calculator" as any);
      } else if (featureName === "Overhead Calculator") {
        router.push("/(main)/overhead-calculator" as any);
      }
    } else {
      // Show RevenueCat paywall for non-subscribers
      try {
        const purchased = await presentPaywallAndSync();
        if (purchased) {
          // Refresh subscription status
          load();
        }
      } catch (e) {
        console.error("Paywall error:", e);
        // Fallback to sign in if paywall fails
        handleSignIn();
      }
    }
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Stack.Screen
        options={{ title: "Toolbox", headerBackVisible: false, headerTitleAlign: 'center' }}
      />
      <GradientBackground>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!isPro && (
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Toolbox</Text>
              <Text style={styles.headerSubtitle}>
                Business tools to help you price profitably
              </Text>
            </View>
          )}

          {/* Free Tools Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Free Tools</Text>

            {/* Labor Rate Calculator - Free for all */}
            <ProFeatureCard
              title="Labor Rate Calculator"
              description="Calculate your true hourly rate from salary, benefits, and overhead"
              locked={false}
              onPress={() => handleFeatureTap("Labor Rate Calculator", false, true)}
              theme={theme}
              tier="free"
            />

            {/* Client Manager - Free for all users */}
            <ProFeatureCard
              title="Client Manager"
              description="Save and manage your client list"
              locked={false}
              onPress={() => handleFeatureTap("Client Manager", false, true)}
              theme={theme}
              tier="free"
            />
          </View>

          {/* Pro Tools Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pro Tools</Text>

            {/* Overhead Calculator - Pro feature */}
            <ProFeatureCard
              title="Overhead Calculator"
              description="Calculate your true overhead costs step by step"
              locked={!isPro}
              onPress={() => handleFeatureTap("Overhead Calculator")}
              theme={theme}
              tier="pro"
            />

            {/* Assembly Manager */}
            <ProFeatureCard
              title="Assembly Manager"
              description="Create and manage your custom assemblies"
              locked={!isPro}
              onPress={() => handleFeatureTap("Assembly Manager")}
              theme={theme}
              tier="pro"
            />

            {/* Assembly Library */}
            <ProFeatureCard
              title="Assembly Library"
              description="Browse your pre-built assembly templates"
              locked={!isPro}
              onPress={() => handleFeatureTap("Assembly Library")}
              theme={theme}
              tier="pro"
            />

            {/* Job Calculator - Pro feature */}
            <ProFeatureCard
              title="Job Calculator"
              description="Calculate materials from job dimensions"
              locked={!isPro}
              onPress={() => handleFeatureTap("Job Calculator")}
              theme={theme}
              tier="pro"
            />

            {/* Price Book - Pro feature */}
            <ProFeatureCard
              title="Price Book"
              description="Create and manage your custom products and pricing"
              locked={!isPro}
              onPress={() => handleFeatureTap("Price Book")}
              theme={theme}
              tier="pro"
            />
          </View>

          {/* Premium Features Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Premium Tools</Text>

            {/* Team Members */}
            <ProFeatureCard
              title="Team Members"
              description="Manage your crew and track labor costs per worker"
              locked={!isPremium}
              onPress={() => handleFeatureTap("Team Members", true)}
              theme={theme}
              tier="premium"
            />

            {/* Contracts */}
            <ProFeatureCard
              title="Contracts"
              description="Create legally-binding contracts with digital signatures"
              locked={!isPremium}
              onPress={() => handleFeatureTap("Contracts", true)}
              theme={theme}
              tier="premium"
            />

            {/* Premium Portal */}
            <ProFeatureCard
              title="Premium Portal"
              description="Your full business suite on the web - everything in the app and more"
              locked={!isPremium}
              onPress={() => handleFeatureTap("Premium Portal", true)}
              theme={theme}
              tier="premium"
            />
          </View>

          {!isPro && (
            <View style={styles.upgradeSection}>
              <Pressable
                style={styles.upgradeButton}
                onPress={async () => {
                  try {
                    const purchased = await presentPaywallAndSync();
                    if (purchased) {
                      load();
                    }
                  } catch (e) {
                    console.error("Paywall error:", e);
                    handleSignIn();
                  }
                }}
              >
                <Text style={styles.upgradeButtonText}>
                  Upgrade
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
  title,
  description,
  locked,
  onPress,
  theme,
  tier = "pro",
}: {
  title: string;
  description: string;
  locked: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
  tier?: "free" | "pro" | "premium";
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const getBadgeStyle = () => {
    switch (tier) {
      case "free":
        return styles.freeBadge;
      case "premium":
        return styles.premiumBadge;
      default:
        return styles.proBadge;
    }
  };

  const getBadgeTextStyle = () => {
    switch (tier) {
      case "free":
        return styles.freeBadgeText;
      case "premium":
        return styles.premiumBadgeText;
      default:
        return styles.proBadgeText;
    }
  };

  const getBadgeLabel = () => {
    switch (tier) {
      case "free":
        return "FREE";
      case "premium":
        return "PREMIUM";
      default:
        return "PRO";
    }
  };

  return (
    <Pressable
      style={[
        styles.featureCard,
        locked && styles.featureCardLocked,
        tier === "premium" && styles.featureCardPremium,
      ]}
      onPress={onPress}
    >
      <View style={styles.featureInfo}>
        <View style={styles.featureTitleRow}>
          <Text style={styles.featureTitle}>{title}</Text>
          <View style={getBadgeStyle()}>
            <Text style={getBadgeTextStyle()}>{getBadgeLabel()}</Text>
          </View>
        </View>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>

      <View style={[
        styles.launchButton,
        locked && styles.launchButtonLocked,
        tier === "premium" && styles.launchButtonPremium,
      ]}>
        <Text style={[
          styles.launchButtonText,
          tier === "premium" && styles.launchButtonTextPremium,
        ]}>
          {locked ? "Upgrade" : "Launch"}
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
    freeBadge: {
      backgroundColor: "#22c55e20",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    freeBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#22c55e",
      textTransform: "uppercase",
    },
    proBadge: {
      backgroundColor: theme.colors.accent + "30",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    proBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.accent,
      textTransform: "uppercase",
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
