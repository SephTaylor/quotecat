// app/(main)/invoice/[id].tsx
// Invoice detail/view screen
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import type { Invoice } from "@/lib/types";
import { InvoiceStatusMeta } from "@/lib/types";
import {
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} from "@/lib/invoices";
import { generateAndShareInvoicePDF, type PDFOptions } from "@/lib/pdf";
import { loadPreferences } from "@/lib/preferences";
import { getUserState } from "@/lib/user";
import { canAccessAssemblies } from "@/lib/features";
import { BottomBar } from "@/modules/core/ui";

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const data = await getInvoiceById(invoiceId);
      setInvoice(data);
    } catch (error) {
      console.error("Failed to load invoice:", error);
      Alert.alert("Error", "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleExportPDF = useCallback(async () => {
    if (!invoice) return;

    try {
      // Load user preferences to check tier and get company details
      const prefs = await loadPreferences();
      const user = await getUserState();
      const isPro = canAccessAssemblies(user);

      const pdfOptions: PDFOptions = {
        includeBranding: !isPro, // Free tier shows branding
        companyDetails: prefs.company,
      };

      await generateAndShareInvoicePDF(invoice, pdfOptions);
    } catch (error) {
      console.error("Failed to export invoice PDF:", error);
      Alert.alert(
        "Export Failed",
        error instanceof Error ? error.message : "Failed to export PDF"
      );
    }
  }, [invoice]);

  const handleUpdateStatus = useCallback(async () => {
    if (!invoice) return;

    const statusOptions = ["unpaid", "partial", "paid", "overdue"] as const;
    const buttons = statusOptions.map((status) => ({
      text: InvoiceStatusMeta[status].label,
      onPress: async () => {
        await updateInvoice(invoice.id, { status });
        await loadInvoice();
      },
    }));

    buttons.push({ text: "Cancel", onPress: () => {}, style: "cancel" } as any);

    Alert.alert(
      "Update Status",
      `Current status: ${InvoiceStatusMeta[invoice.status].label}`,
      buttons
    );
  }, [invoice, loadInvoice]);

  const handleDelete = useCallback(() => {
    if (!invoice) return;

    Alert.alert(
      "Delete Invoice",
      `Are you sure you want to delete invoice ${invoice.invoiceNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteInvoice(invoice.id);
            router.back();
          },
        },
      ]
    );
  }, [invoice, router]);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Invoice",
            headerShown: true,
            headerTitleAlign: "center",
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          }}
        />
        <GradientBackground>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        </GradientBackground>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Invoice",
            headerShown: true,
            headerTitleAlign: "center",
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          }}
        />
        <GradientBackground>
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Invoice not found</Text>
            <Text style={styles.emptyDescription}>
              This invoice may have been deleted
            </Text>
          </View>
        </GradientBackground>
      </>
    );
  }

  // Calculate totals
  const itemsTotal = invoice.items.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  );
  const subtotal =
    itemsTotal +
    (invoice.labor || 0) +
    (invoice.materialEstimate || 0) +
    (invoice.overhead || 0);
  const markup = invoice.markupPercent
    ? subtotal * (invoice.markupPercent / 100)
    : 0;
  const total = subtotal + markup;

  // Format dates
  const invoiceDate = new Date(invoice.invoiceDate);
  const dueDate = new Date(invoice.dueDate);
  const formattedInvoiceDate = invoiceDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedDueDate = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const statusMeta = InvoiceStatusMeta[invoice.status];

  return (
    <>
      <Stack.Screen
        options={{
          title: invoice.invoiceNumber,
          headerShown: true,
          headerTitleAlign: "center",
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ paddingLeft: 16, paddingVertical: 8, backgroundColor: 'transparent' }}
            >
              <Text style={{ fontSize: 17, color: theme.colors.accent }}>
                ‹ Back
              </Text>
            </Pressable>
          ),
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
        }}
      />
      <GradientBackground>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                {invoice.isPartialInvoice && invoice.percentage && (
                  <Text style={styles.partialBadge}>{invoice.percentage}% Down Payment</Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${statusMeta.color}20` },
                ]}
              >
                <Text style={[styles.statusText, { color: statusMeta.color }]}>
                  {statusMeta.label}
                </Text>
              </View>
            </View>

            <Text style={styles.invoiceName}>{invoice.name}</Text>
            {invoice.clientName && (
              <Text style={styles.clientName}>{invoice.clientName}</Text>
            )}

            <View style={styles.dateRow}>
              <View>
                <Text style={styles.dateLabel}>Invoice Date</Text>
                <Text style={styles.dateValue}>{formattedInvoiceDate}</Text>
              </View>
              <View style={styles.dateRight}>
                <Text style={[styles.dateLabel, styles.dateRightText]}>Due Date</Text>
                <Text style={[styles.dateValue, styles.dateRightText]}>
                  {formattedDueDate}
                </Text>
              </View>
            </View>
          </View>

          {/* Line Items */}
          {invoice.items.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Line Items</Text>
              {invoice.items.map((item, index) => (
                <View key={index} style={styles.lineItem}>
                  <View style={styles.lineItemLeft}>
                    <Text style={styles.lineItemName}>{item.name}</Text>
                    <Text style={styles.lineItemDetails}>
                      {item.qty} × ${item.unitPrice.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.lineItemTotal}>
                    ${(item.qty * item.unitPrice).toFixed(2)}
                  </Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Items Subtotal</Text>
                <Text style={styles.subtotalValue}>${itemsTotal.toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Labor, Materials, Overhead */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Costs</Text>

            {invoice.labor > 0 && (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Labor</Text>
                <Text style={styles.costValue}>${invoice.labor.toFixed(2)}</Text>
              </View>
            )}

            {(invoice.materialEstimate ?? 0) > 0 && (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Material Estimate</Text>
                <Text style={styles.costValue}>
                  ${invoice.materialEstimate!.toFixed(2)}
                </Text>
              </View>
            )}

            {(invoice.overhead ?? 0) > 0 && (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Overhead</Text>
                <Text style={styles.costValue}>${invoice.overhead!.toFixed(2)}</Text>
              </View>
            )}

            {invoice.markupPercent != null && invoice.markupPercent > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>
                    Markup ({invoice.markupPercent.toFixed(0)}%)
                  </Text>
                  <Text style={styles.costValue}>${markup.toFixed(2)}</Text>
                </View>
              </>
            )}
          </View>

          {/* Notes */}
          {invoice.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          )}

          {/* Total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>

          {/* Spacer for bottom bar */}
          <View style={{ height: 100 }} />
        </ScrollView>

        <BottomBar>
          <View style={styles.bottomButtons}>
            <Pressable style={styles.iconButton} onPress={handleUpdateStatus}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" />
              <Text style={styles.iconButtonText}>Status</Text>
            </Pressable>

            <Pressable style={styles.exportButton} onPress={handleExportPDF}>
              <Ionicons name="document-outline" size={24} color="#000" />
              <Text style={styles.exportButtonText}>Export PDF</Text>
            </Pressable>

            <Pressable style={styles.iconButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#FFF" />
              <Text style={styles.iconButtonText}>Delete</Text>
            </Pressable>
          </View>
        </BottomBar>
      </GradientBackground>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing(4),
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
    },
    scrollContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(12),
    },
    headerCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      marginBottom: theme.spacing(3),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: theme.spacing(2),
    },
    invoiceNumber: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.accent,
      marginBottom: theme.spacing(0.5),
    },
    partialBadge: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    statusBadge: {
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.75),
      borderRadius: theme.radius.md,
    },
    statusText: {
      fontSize: 14,
      fontWeight: "700",
    },
    invoiceName: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    clientName: {
      fontSize: 15,
      color: theme.colors.muted,
      marginBottom: theme.spacing(2),
    },
    dateRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: theme.spacing(2),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    dateLabel: {
      fontSize: 12,
      color: theme.colors.muted,
      marginBottom: 4,
    },
    dateValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    dateRight: {
      alignItems: "flex-end",
    },
    dateRightText: {
      textAlign: "right",
    },
    section: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      marginBottom: theme.spacing(3),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    lineItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(1.5),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    lineItemLeft: {
      flex: 1,
    },
    lineItemName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    lineItemDetails: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    lineItemTotal: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginLeft: theme.spacing(2),
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing(2),
    },
    subtotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: theme.spacing(1),
    },
    subtotalLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    subtotalValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    costRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(1),
    },
    costLabel: {
      fontSize: 14,
      color: theme.colors.text,
    },
    costValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    notesText: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    totalCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      marginBottom: theme.spacing(3),
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    totalLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.5),
    },
    totalValue: {
      fontSize: 32,
      fontWeight: "700",
      color: theme.colors.text,
    },
    bottomButtons: {
      flexDirection: "row",
      gap: theme.spacing(2),
      width: "100%",
    },
    iconButton: {
      flex: 1,
      backgroundColor: theme.colors.muted,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.5),
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#FFF",
      marginTop: 4,
    },
    exportButton: {
      flex: 2,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.5),
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: theme.spacing(1),
    },
    exportButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
}
