// app/(main)/(tabs)/pro-tools.tsx
// Tools tab - Shows Pro and Premium features
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
import { GradientBackground } from "@/components/GradientBackground";

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
    Linking.openURL("https://quotecat.ai");
  };

  const handleFeatureTap = (featureName: string) => {
    if (isPro) {
      // Navigate to feature
      if (featureName === "Assembly Library") {
        router.push("/(main)/assemblies-browse" as any);
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
        options={{ title: "Tools", headerBackVisible: false, headerTitleAlign: 'center' }}
      />
      <GradientBackground>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!isPro && (
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Professional Tools</Text>
              <Text style={styles.headerSubtitle}>
                Powerful features for contractors and builders
              </Text>
            </View>
          )}

          {/* Available Tools Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Now</Text>

            {/* Assembly Manager */}
            <ProFeatureCard
              title="Assembly Manager"
              description="Create and manage your custom assemblies"
              tier="PRO"
              locked={!isPro}
              onPress={() => handleFeatureTap("Assembly Manager")}
              theme={theme}
            />

            {/* Assembly Library */}
            <ProFeatureCard
              title="Assembly Library"
              description="Browse pre-built assembly templates"
              tier="PRO"
              locked={!isPro}
              onPress={() => handleFeatureTap("Assembly Library")}
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
                <Text style={styles.comingSoonTitle}>Advanced Analytics</Text>
                <Text style={styles.comingSoonDescription}>
                  Track quote value and performance
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </GradientBackground>
    </>
  );
}

function ProFeatureCard({
  title,
  description,
  tier,
  locked,
  onPress,
  theme,
}: {
  title: string;
  description: string;
  tier: "PRO" | "PREMIUM";
  locked: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={[styles.featureCard, locked && styles.featureCardLocked]}
      onPress={onPress}
    >
      <View style={styles.featureInfo}>
        <View style={styles.featureTitleRow}>
          <Text style={styles.featureTitle}>{title}</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{tier}</Text>
          </View>
        </View>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>

      <View style={[styles.launchButton, locked && styles.launchButtonLocked]}>
        <Text style={styles.launchButtonText}>
          {locked ? "Learn More" : "Launch"}
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
    featureInfo: {
      flex: 1,
    },
    featureTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      marginBottom: 2,
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    tierBadge: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    tierBadgeText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#000",
      letterSpacing: 0.5,
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
  });
}
