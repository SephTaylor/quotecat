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
      if (featureName === "Assemblies") {
        router.push("./assemblies" as any);
      } else if (featureName === "Assembly Manager") {
        router.push("/(main)/assembly-manager" as any);
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
              <Text style={styles.headerTitle}>✨ Pro Features</Text>
              <Text style={styles.headerSubtitle}>
                Unlock powerful tools for professional quoting
              </Text>
            </View>
          )}

          {/* Assembly Manager */}
          <ProFeatureCard
            icon="🛠️"
            title="Assembly Manager"
            description="Create and manage custom assembly templates"
            locked={!isPro}
            onPress={() => handleFeatureTap("Assembly Manager")}
            details={[
              "Create custom assemblies",
              "Manage your template library",
              "Delete or edit existing assemblies",
              "Build reusable material packages",
            ]}
            theme={theme}
          />

          {/* Assemblies Library */}
          <ProFeatureCard
            icon="📐"
            title="Assemblies Library"
            description="Pre-built calculators for all trades"
            locked={!isPro}
            onPress={() => handleFeatureTap("Assemblies")}
            details={[
              "General Construction",
              "Electrical",
              "Plumbing",
              "HVAC",
              "Finishing",
              "Exterior",
              "Custom formulas",
            ]}
            theme={theme}
          />

          {/* Cloud Backup */}
          <ProFeatureCard
            icon="☁️"
            title="Cloud Backup & Sync"
            description="Never lose your quotes"
            locked={!isPro}
            onPress={() => handleFeatureTap("Cloud")}
            details={[
              "Auto-save to cloud",
              "Sync across devices",
              "Access anywhere",
              "Backup history",
            ]}
            theme={theme}
          />

          {/* Branded PDFs */}
          <ProFeatureCard
            icon="📄"
            title="Branded PDFs"
            description="Professional exports with your branding"
            locked={!isPro}
            onPress={() => handleFeatureTap("Branding")}
            details={[
              "Unlimited exports",
              "Custom logo & colors",
              "No watermarks",
              "Professional templates",
            ]}
            theme={theme}
          />

          {/* Value Tracking */}
          <ProFeatureCard
            icon="💰"
            title="Advanced Analytics"
            description="Track quote value and performance"
            locked={!isPro}
            onPress={() => handleFeatureTap("Analytics")}
            details={[
              "Total pipeline value",
              "Status breakdown",
              "Win rate tracking",
              "Revenue forecasting",
            ]}
            theme={theme}
          />

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
    <Pressable
      style={[styles.featureCard, locked && styles.featureCardLocked]}
      onPress={onPress}
    >
      <View style={styles.featureHeader}>
        <Text style={styles.featureIcon}>{icon}</Text>
        {locked && <Text style={styles.lockIcon}>🔒</Text>}
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>

      <View style={styles.featureDetails}>
        {details.map((detail, index) => (
          <Text key={index} style={styles.featureDetail}>
            • {detail}
          </Text>
        ))}
      </View>

      {locked && (
        <View style={styles.unlockBadge}>
          <Text style={styles.unlockBadgeText}>Tap to unlock</Text>
        </View>
      )}
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
    featureCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    featureCardLocked: {
      opacity: 0.8,
    },
    featureHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    featureIcon: {
      fontSize: 32,
    },
    lockIcon: {
      fontSize: 20,
    },
    featureTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    featureDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1.5),
    },
    featureDetails: {
      marginTop: theme.spacing(1),
    },
    featureDetail: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: 4,
    },
    unlockBadge: {
      marginTop: theme.spacing(1.5),
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: 999,
      alignSelf: "flex-start",
    },
    unlockBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#000",
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
