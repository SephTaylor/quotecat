// app/(main)/assemblies.tsx
import { useTheme } from "@/contexts/ThemeContext";
import { Screen } from "@/modules/core/ui";
import { useAssemblies } from "@/modules/assemblies";
import { deleteAssembly } from "@/modules/assemblies/storage";
import { getUserState } from "@/lib/user";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import React, { memo, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Assembly } from "@/modules/assemblies";

// Memoized assembly list item for performance
const AssemblyListItem = memo(
  ({
    item,
    onPress,
    onLongPress,
    styles,
  }: {
    item: Assembly;
    onPress: () => void;
    onLongPress?: () => void;
    styles: ReturnType<typeof createStyles>;
  }) => {
    const materialCount = item.items.length;
    const isCustom = item.id.startsWith("custom-");

    return (
      <Pressable
        style={[styles.card, isCustom && styles.cardCustom]}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.title}>
            {isCustom && "📌 "}
            {item.name}
          </Text>
        </View>
        <Text style={styles.sub}>
          {materialCount} material{materialCount !== 1 ? "s" : ""}
          {isCustom && " • Custom"}
        </Text>
      </Pressable>
    );
  },
);

AssemblyListItem.displayName = "AssemblyListItem";

export default function AssembliesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ quoteId?: string }>();
  const quoteId = params.quoteId;
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { assemblies, loading, reload } = useAssemblies();
  const [refreshing, setRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPro, setIsPro] = React.useState(false);
  const [checkingTier, setCheckingTier] = React.useState(true);

  // Check Pro tier on mount
  React.useEffect(() => {
    const checkTier = async () => {
      const userState = await getUserState();
      setIsPro(userState.tier === "pro");
      setCheckingTier(false);
    };
    checkTier();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const handleDeleteAssembly = async (assembly: Assembly) => {
    const isCustom = assembly.id.startsWith("custom-");

    if (!isCustom) {
      Alert.alert(
        "Cannot Delete",
        "Seed assemblies cannot be deleted. Only custom assemblies can be removed.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Delete Assembly?",
      `Are you sure you want to delete "${assembly.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAssembly(assembly.id);
              await reload(); // Refresh the list
              Alert.alert("Deleted", `"${assembly.name}" has been deleted.`);
            } catch (error) {
              console.error("Failed to delete assembly:", error);
              Alert.alert("Error", "Could not delete assembly. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Filter assemblies based on search query
  const filteredAssemblies = useMemo(() => {
    if (!searchQuery.trim()) return assemblies;
    const query = searchQuery.toLowerCase();
    return assemblies.filter((assembly) =>
      assembly.name.toLowerCase().includes(query)
    );
  }, [assemblies, searchQuery]);

  if (loading || checkingTier) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Assembly Library",
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          }}
        />
        <Screen scroll={false} contentStyle={styles.center}>
          <ActivityIndicator size="large" />
        </Screen>
      </>
    );
  }

  // Show upgrade teaser for free users
  if (!isPro) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Assembly Library",
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          }}
        />
        <Screen scroll={false} contentStyle={styles.container}>
          <View style={styles.upgradeContainer}>
            <Text style={styles.upgradeIcon}>🚀</Text>
            <Text style={styles.upgradeTitle}>Assemblies Library</Text>
            <Text style={styles.upgradeSubtitle}>Pro Feature</Text>

            <View style={styles.upgradeCard}>
              <Text style={styles.upgradeDescription}>
                Save your quotes as reusable assembly templates and speed up your workflow.
              </Text>

              <View style={styles.benefitsList}>
                <View style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>⚡</Text>
                  <Text style={styles.benefitText}>
                    Pre-built material calculators for common tasks
                  </Text>
                </View>
                <View style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>💾</Text>
                  <Text style={styles.benefitText}>
                    Save your own quotes as custom assemblies
                  </Text>
                </View>
                <View style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>📌</Text>
                  <Text style={styles.benefitText}>
                    Build your personal template library
                  </Text>
                </View>
                <View style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>🎯</Text>
                  <Text style={styles.benefitText}>
                    Always-current pricing from live catalog
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              style={styles.upgradeButton}
              onPress={() => router.push("/(main)/settings")}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </Pressable>

            <Text style={styles.upgradeHint}>
              Go to Settings to upgrade and unlock assemblies
            </Text>
          </View>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Assembly Library",
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ paddingLeft: 16, paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 17, color: theme.colors.accent }}>
                ‹ Back
              </Text>
            </Pressable>
          ),
        }}
      />
      <Screen scroll={false} contentStyle={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerDescription}>
            Pre-built material calculators for common tasks
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search assemblies..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filteredAssemblies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <AssemblyListItem
              item={item}
              onPress={() => {
                const path = quoteId
                  ? `/(forms)/assembly/${item.id}?quoteId=${quoteId}`
                  : `/(forms)/assembly/${item.id}`;
                router.push(path as any);
              }}
              onLongPress={() => handleDeleteAssembly(item)}
              styles={styles}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searchQuery.trim()
                ? `No assemblies found for "${searchQuery}"`
                : "No assemblies available."}
            </Text>
          }
        />
      </Screen>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    headerContainer: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(0.5),
    },
    headerDescription: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
    },
    listContent: {
      padding: theme.spacing(2),
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardCustom: {
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    sub: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    empty: {
      textAlign: "center",
      color: theme.colors.muted,
      marginTop: theme.spacing(4),
    },
    searchContainer: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(2),
      backgroundColor: theme.colors.bg,
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      padding: theme.spacing(1.5),
      fontSize: 14,
      color: theme.colors.text,
    },
    upgradeContainer: {
      flex: 1,
      padding: theme.spacing(3),
      justifyContent: "center",
      alignItems: "center",
    },
    upgradeIcon: {
      fontSize: 64,
      marginBottom: theme.spacing(2),
    },
    upgradeTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
      textAlign: "center",
    },
    upgradeSubtitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.accent,
      marginBottom: theme.spacing(3),
      textAlign: "center",
    },
    upgradeCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      padding: theme.spacing(3),
      marginBottom: theme.spacing(3),
      borderWidth: 1,
      borderColor: theme.colors.border,
      width: "100%",
    },
    upgradeDescription: {
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing(3),
      textAlign: "center",
      lineHeight: 24,
    },
    benefitsList: {
      gap: theme.spacing(2),
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing(1.5),
    },
    benefitIcon: {
      fontSize: 20,
      marginTop: 2,
    },
    benefitText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    upgradeButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(2),
      borderRadius: theme.radius.xl,
      marginBottom: theme.spacing(1.5),
    },
    upgradeButtonText: {
      fontSize: 18,
      fontWeight: "700",
      color: "#000",
    },
    upgradeHint: {
      fontSize: 12,
      color: theme.colors.muted,
      textAlign: "center",
    },
  });
}
