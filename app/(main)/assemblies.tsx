// app/(main)/assemblies.tsx
import { theme } from "@/constants/theme";
import { Screen } from "@/modules/core/ui";
import { useAssemblies } from "@/modules/assemblies";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function AssembliesScreen() {
  const router = useRouter();
  const { assemblies, loading, reload } = useAssemblies();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator size="large" />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assemblies Library</Text>
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
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/(forms)/assembly/${item.id}` as any)}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.sub}>
              {item.items.length} material{item.items.length !== 1 ? "s" : ""}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No assemblies available.</Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14,
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
