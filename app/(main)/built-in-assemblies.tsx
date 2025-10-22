// app/(main)/built-in-assemblies.tsx
// Browse built-in assembly templates
import { useTheme } from "@/contexts/ThemeContext";
import { useAssemblies, validateAssembly } from "@/modules/assemblies";
import type { Assembly } from "@/modules/assemblies";
import { useProducts } from "@/modules/catalog";
import { Stack, useRouter } from "expo-router";
import React, { useState, useMemo } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function BuiltInAssembliesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { assemblies } = useAssemblies();
  const { products } = useProducts();
  const [searchQuery, setSearchQuery] = useState("");
  const [invalidAssemblies, setInvalidAssemblies] = useState<Set<string>>(new Set());

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Validate assemblies when products load
  React.useEffect(() => {
    if (assemblies.length > 0 && products.length > 0) {
      const invalid = new Set<string>();
      assemblies.forEach((asm) => {
        const result = validateAssembly(asm, products);
        if (!result.isValid) {
          invalid.add(asm.id);
        }
      });
      setInvalidAssemblies(invalid);
    }
  }, [assemblies, products]);

  // Filter built-in assemblies
  const builtInAssemblies = useMemo(() => {
    const builtin = assemblies.filter((a) => !a.id.startsWith("custom-"));
    if (!searchQuery.trim()) return builtin;
    const query = searchQuery.toLowerCase();
    return builtin.filter((a) => a.name.toLowerCase().includes(query));
  }, [assemblies, searchQuery]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Built-In Assemblies",
          headerShown: true,
          headerBackTitle: "Manager",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
        }}
      />
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search assemblies..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Assembly List */}
        <FlatList
          data={builtInAssemblies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isInvalid = invalidAssemblies.has(item.id);
            return (
              <Pressable
                style={[styles.card, isInvalid && styles.cardInvalid]}
                onPress={() => router.push(`/(main)/assembly/${item.id}` as any)}
              >
                <Text style={styles.cardTitle}>
                  {isInvalid && "⚠️ "}
                  {item.name}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.items.length} material{item.items.length !== 1 ? "s" : ""}
                </Text>
                {isInvalid && (
                  <Text style={styles.warningText}>
                    Needs review - some products unavailable
                  </Text>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Results</Text>
              <Text style={styles.emptyDescription}>
                No built-in assemblies match "{searchQuery}"
              </Text>
            </View>
          }
        />
      </View>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    searchContainer: {
      position: "relative",
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(1),
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      paddingRight: 40,
    },
    clearButton: {
      position: "absolute",
      right: 24,
      top: 24,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.muted,
      justifyContent: "center",
      alignItems: "center",
    },
    clearButtonText: {
      color: theme.colors.bg,
      fontSize: 14,
      fontWeight: "700",
    },
    listContent: {
      padding: theme.spacing(2),
      paddingTop: theme.spacing(1),
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
    },
    cardInvalid: {
      borderColor: "#FFC107",
      borderWidth: 2,
      backgroundColor: "#FFF3CD",
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    cardMeta: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    warningText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#856404",
      marginTop: 4,
    },
    emptyCard: {
      padding: theme.spacing(3),
      alignItems: "center",
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 8,
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
    },
  });
}
