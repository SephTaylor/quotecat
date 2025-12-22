// app/(main)/change-order/[id].tsx
// Detail screen for viewing a single change order

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import {
  getChangeOrderById,
  updateChangeOrder,
  deleteChangeOrder,
  approveChangeOrder,
  ChangeOrderStatusMeta,
  type ChangeOrder,
  type ChangeOrderStatus,
} from "@/modules/changeOrders";
import { ChangeOrderDiffView } from "@/modules/changeOrders/ui";
import { getQuoteById, updateQuote } from "@/lib/quotes";
import type { Quote } from "@/lib/types";
import { generateAndShareChangeOrderPDF, type PDFOptions } from "@/lib/pdf";
import { loadPreferences } from "@/lib/preferences";
import { getCompanyLogo } from "@/lib/logo";
import { getUserState } from "@/lib/user";

export default function ChangeOrderDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; quoteId?: string }>();
  const coId = params.id;
  const quoteId = params.quoteId;
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [changeOrder, setChangeOrder] = useState<ChangeOrder | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    if (!coId || !quoteId) return;

    setLoading(true);
    try {
      const [co, q] = await Promise.all([
        getChangeOrderById(quoteId, coId),
        getQuoteById(quoteId),
      ]);
      setChangeOrder(co ?? null);
      setQuote(q ?? null);
    } catch (error) {
      console.error("Failed to load change order:", error);
    } finally {
      setLoading(false);
    }
  }, [coId, quoteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (newStatus: ChangeOrderStatus) => {
    if (!changeOrder || !quoteId) return;

    const isApprove = newStatus === "approved";
    const isCancel = newStatus === "cancelled";

    Alert.alert(
      isApprove ? "Approve Change Order?" : isCancel ? "Cancel Change Order?" : "Update Status?",
      isApprove
        ? "This will apply the changes to the quote. The quote items and totals will be updated."
        : isCancel
        ? "This will cancel the change order. The quote will remain unchanged."
        : "Change the status of this change order?",
      [
        { text: "Go Back", style: "cancel" },
        {
          text: isApprove ? "Approve" : isCancel ? "Cancel CO" : "Confirm",
          style: isCancel ? "destructive" : "default",
          onPress: async () => {
            setUpdating(true);
            try {
              if (newStatus === "approved") {
                // Use approveChangeOrder to apply changes to the quote
                await approveChangeOrder(
                  quoteId,
                  changeOrder.id,
                  getQuoteById,
                  updateQuote
                );
              } else {
                // For cancel, just update the status
                await updateChangeOrder(quoteId, {
                  id: changeOrder.id,
                  status: newStatus,
                });
              }
              await loadData();
            } catch (error) {
              Alert.alert(
                "Error",
                error instanceof Error ? error.message : "Failed to update status"
              );
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleExportPDF = async () => {
    if (!changeOrder || !quote) return;

    setExporting(true);
    try {
      const [prefs, logo, userState] = await Promise.all([
        loadPreferences(),
        getCompanyLogo(),
        getUserState(),
      ]);

      const isPro = userState.tier === "pro" || userState.tier === "premium";
      const rawBase64 = logo?.base64?.replace(/^data:image\/\w+;base64,/, "");

      const options: PDFOptions = {
        includeBranding: !isPro,
        companyDetails: prefs.company,
        logoBase64: rawBase64,
      };

      await generateAndShareChangeOrderPDF(changeOrder, quote, options);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to export PDF"
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = () => {
    if (!changeOrder || !quoteId) return;

    if (changeOrder.status !== "pending") {
      Alert.alert("Cannot Delete", "Only pending change orders can be deleted.");
      return;
    }

    Alert.alert(
      "Delete Change Order?",
      "This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUpdating(true);
            try {
              await deleteChangeOrder(quoteId, changeOrder.id);
              router.back();
            } catch (error) {
              Alert.alert(
                "Error",
                error instanceof Error ? error.message : "Failed to delete"
              );
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Change Order",
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

  if (!changeOrder || !quote) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Change Order",
            headerShown: true,
            headerTitleAlign: "center",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View style={styles.center}>
          <Text style={styles.errorText}>Change order not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const statusMeta = ChangeOrderStatusMeta[changeOrder.status];
  const formattedDate = new Date(changeOrder.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  // Build diff data from change order
  const diffData = {
    items: changeOrder.items,
    laborBefore: changeOrder.laborBefore,
    laborAfter: changeOrder.laborAfter,
    laborDelta: changeOrder.laborAfter - changeOrder.laborBefore,
    netChange: changeOrder.netChange,
    quoteTotalBefore: changeOrder.quoteTotalBefore,
    quoteTotalAfter: changeOrder.quoteTotalAfter,
  };

  const formatMoney = (amount: number) => {
    const prefix = amount > 0 ? "+" : "";
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
  };

  // Format CO number with quote number if available
  const coDisplayNumber = changeOrder.quoteNumber
    ? `${changeOrder.quoteNumber}-CO-${changeOrder.number}`
    : `CO-${changeOrder.number}`;

  return (
    <>
      <Stack.Screen
        options={{
          title: coDisplayNumber,
          headerShown: true,
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerRight: () =>
            changeOrder.status === "pending" ? (
              <Pressable onPress={handleDelete} hitSlop={8} disabled={updating}>
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={updating ? theme.colors.muted : "#EF4444"}
                />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.coNumber}>{coDisplayNumber}</Text>
            <View style={[styles.badge, { backgroundColor: statusMeta.color + "20" }]}>
              <Text style={[styles.badgeText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          <Text style={styles.quoteName}>{quote.name || "Untitled Quote"}</Text>
          <Text style={styles.date}>{formattedDate}</Text>

          <View style={styles.netChangeRow}>
            <Text style={styles.netChangeLabel}>Net Change</Text>
            <Text
              style={[
                styles.netChangeValue,
                changeOrder.netChange > 0 && styles.netChangePositive,
                changeOrder.netChange < 0 && styles.netChangeNegative,
              ]}
            >
              {formatMoney(changeOrder.netChange)}
            </Text>
          </View>
        </View>

        {/* Note */}
        {changeOrder.note && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason</Text>
            <View style={styles.reasonCard}>
              <Text style={styles.reasonText}>{changeOrder.note}</Text>
            </View>
          </View>
        )}

        {/* Changes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changes</Text>
          <View style={styles.diffCard}>
            <ChangeOrderDiffView diff={diffData} theme={theme} />
          </View>
        </View>

        {/* Export */}
        <View style={styles.section}>
          <Pressable
            style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
            onPress={handleExportPDF}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={20} color="#FFF" />
                <Text style={styles.exportButtonText}>Export PDF</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Actions */}
        {changeOrder.status === "pending" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsCard}>
              <Pressable
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleStatusChange("approved")}
                disabled={updating}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.approveButtonText}>Approve</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => handleStatusChange("cancelled")}
                disabled={updating}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={styles.cancelButtonText}>Cancel CO</Text>
              </Pressable>
            </View>
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
    headerCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2.5),
      marginBottom: theme.spacing(2),
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    coNumber: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: "600",
    },
    quoteName: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: 4,
    },
    date: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: theme.spacing(2),
    },
    netChangeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: theme.spacing(2),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    netChangeLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    netChangeValue: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    netChangePositive: {
      color: "#22C55E",
    },
    netChangeNegative: {
      color: "#EF4444",
    },
    section: {
      marginBottom: theme.spacing(2),
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    reasonCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    reasonText: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    diffCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    actionsCard: {
      flexDirection: "row",
      gap: theme.spacing(2),
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing(1),
      paddingVertical: theme.spacing(1.75),
      borderRadius: theme.radius.md,
    },
    approveButton: {
      backgroundColor: "#22C55E",
    },
    approveButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFF",
    },
    cancelButton: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: "#EF4444",
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#EF4444",
    },
    exportButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing(1),
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(1.75),
      borderRadius: theme.radius.md,
    },
    exportButtonDisabled: {
      opacity: 0.6,
    },
    exportButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#000",
    },
  });
}
