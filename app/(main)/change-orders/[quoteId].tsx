// app/(main)/change-orders/[quoteId].tsx
// List screen for viewing all change orders for a quote

import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { useChangeOrders } from "@/modules/changeOrders/hooks";
import { ChangeOrderCard } from "@/modules/changeOrders/ui/ChangeOrderCard";
import { formatNetChange } from "@/modules/changeOrders/diff";
import type { ChangeOrder } from "@/modules/changeOrders";

export default function ChangeOrdersListScreen() {
  const params = useLocalSearchParams<{ quoteId?: string }>();
  const quoteId = params.quoteId;
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { changeOrders, loading, netChange, refresh } = useChangeOrders(quoteId ?? "");

  // Refresh when screen comes into focus (e.g., returning from detail screen)
  useFocusEffect(
    useCallback(() => {
      if (quoteId) {
        refresh();
      }
    }, [quoteId, refresh])
  );

  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  const handleViewCO = (co: ChangeOrder) => {
    router.push(`/(main)/change-order/${co.id}?quoteId=${quoteId}` as never);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Change Orders",
            headerShown: true,
            headerTitleAlign: "center",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </>
    );
  }

  if (!quoteId) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Change Orders",
            headerShown: true,
            headerTitleAlign: "center",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View style={styles.center}>
          <Text style={styles.errorText}>Quote not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Change Orders",
          headerShown: true,
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Change Orders</Text>
            <Text style={styles.summaryValue}>{changeOrders.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Net Change</Text>
            <Text
              style={[
                styles.summaryNetValue,
                netChange > 0 && styles.netPositive,
                netChange < 0 && styles.netNegative,
              ]}
            >
              {formatNetChange(netChange)}
            </Text>
          </View>
        </View>

        {/* Empty State */}
        {changeOrders.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={48} color={theme.colors.muted} />
            <Text style={styles.emptyText}>No change orders</Text>
            <Text style={styles.emptySubtext}>
              Edit the quote to create a change order
            </Text>
          </View>
        )}

        {/* Change Orders List */}
        {changeOrders.length > 0 && (
          <View style={styles.list}>
            {changeOrders.map((co) => (
              <ChangeOrderCard
                key={co.id}
                changeOrder={co}
                theme={theme}
                onPress={() => handleViewCO(co)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], insets: { bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    content: {
      padding: theme.spacing(2),
      paddingBottom: Math.max(theme.spacing(4), insets.bottom),
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.bg,
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    backButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.md,
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#000",
    },
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing(1.5),
    },
    summaryNetValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    netPositive: {
      color: "#22C55E",
    },
    netNegative: {
      color: "#EF4444",
    },
    emptyCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(6),
      alignItems: "center",
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginTop: theme.spacing(2),
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: theme.spacing(1),
      textAlign: "center",
    },
    list: {
      gap: theme.spacing(1.5),
    },
  });
}
