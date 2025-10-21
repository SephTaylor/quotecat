// app/(main)/assemblies.tsx
import { useTheme } from "@/contexts/ThemeContext";
import { Screen } from "@/modules/core/ui";
import { useAssemblies } from "@/modules/assemblies";
import { deleteAssembly } from "@/modules/assemblies/storage";
import { Stack, useRouter } from "expo-router";
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
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { assemblies, loading, reload } = useAssemblies();
  const [refreshing, setRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Assemblies Library",
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

  return (
    <>
      <Stack.Screen options={{ title: "Assemblies Library" }} />
      <Screen scroll={false} contentStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerSub}>
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
              onPress={() => router.push(`/(forms)/assembly/${item.id}` as any)}
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
    header: {
      padding: theme.spacing(2),
      paddingTop: theme.spacing(1),
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerSub: {
      fontSize: 13,
      color: theme.colors.muted,
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
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 14,
      color: theme.colors.text,
    },
  });
}
