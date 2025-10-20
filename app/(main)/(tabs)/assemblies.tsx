// app/(main)/assemblies.tsx
import { useTheme } from "@/contexts/ThemeContext";
import { Screen } from "@/modules/core/ui";
import { useAssemblies } from "@/modules/assemblies";
import { Stack, useRouter } from "expo-router";
import React, { memo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Assembly } from "@/modules/assemblies";

// Memoized assembly list item for performance
const AssemblyListItem = memo(
  ({
    item,
    onPress,
    styles,
  }: {
    item: Assembly;
    onPress: () => void;
    styles: ReturnType<typeof createStyles>;
  }) => {
    const materialCount = item.items.length;
    return (
      <Pressable style={styles.card} onPress={onPress}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.sub}>
          {materialCount} material{materialCount !== 1 ? "s" : ""}
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

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

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

        <FlatList
          data={assemblies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <AssemblyListItem
              item={item}
              onPress={() => router.push(`/(forms)/assembly/${item.id}` as any)}
              styles={styles}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No assemblies available.</Text>
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
  });
}
