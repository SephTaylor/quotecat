// app/(main)/invoice/[id].tsx
// Invoice detail/view screen
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  TouchableOpacity,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { InvoiceStatusMeta } from "@/lib/types";
import {
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  recordPayment,
  listInvoicePayments,
  deletePayment,
} from "@/lib/invoices";
import type { InvoicePayment } from "@/lib/types";
import { calculateInvoiceTotals } from "@/lib/calculations";
import { generateAndShareInvoicePDF, type PDFOptions } from "@/lib/pdf";
import { loadPreferences } from "@/lib/preferences";
import { getUserState } from "@/lib/user";
import { canAccessAssemblies } from "@/lib/features";
import { getCompanyLogo } from "@/lib/logo";
import { FormScreen } from "@/modules/core/ui";
import { HeaderBackButton } from "@/components/HeaderBackButton";

/**
 * Format phone number as (xxx) xxx-xxxx
 */
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  const limited = digits.slice(0, 10);
  if (limited.length === 0) return "";
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);

  // Editing states
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingClientName, setEditingClientName] = useState(false);
  const [editingClientEmail, setEditingClientEmail] = useState(false);
  const [editingClientPhone, setEditingClientPhone] = useState(false);
  const [editingClientAddress, setEditingClientAddress] = useState(false);
  const [editingTaxPercent, setEditingTaxPercent] = useState(false);
  const [editingMarkupPercent, setEditingMarkupPercent] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [tempDueDate, setTempDueDate] = useState<Date>(new Date());
  const [tempNotes, setTempNotes] = useState("");
  const [tempClientName, setTempClientName] = useState("");
  const [tempClientEmail, setTempClientEmail] = useState("");
  const [tempClientPhone, setTempClientPhone] = useState("");
  const [tempClientAddress, setTempClientAddress] = useState("");
  const [tempTaxPercent, setTempTaxPercent] = useState("");
  const [tempMarkupPercent, setTempMarkupPercent] = useState("");
  const [tempProjectName, setTempProjectName] = useState("");
  const [tempInvoiceNumber, setTempInvoiceNumber] = useState("");

  // Payment modal state
  const [editingPayment, setEditingPayment] = useState(false);
  const [tempPaymentAmount, setTempPaymentAmount] = useState("");
  const [tempPaymentMethod, setTempPaymentMethod] = useState("");
  const [tempPaymentDate, setTempPaymentDate] = useState<Date>(new Date());
  const [tempPaymentNote, setTempPaymentNote] = useState("");
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Refs for TextInput focus
  const projectInputRef = useRef<TextInput>(null);
  const clientInputRef = useRef<TextInput>(null);

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const data = await getInvoiceById(invoiceId);
      setInvoice(data);

      // Load payment history - first sync from cloud, then load local
      if (data) {
        // Try to sync payments from cloud (for Pro/Premium users)
        try {
          const { syncPaymentsForInvoice } = await import("@/lib/invoicesSync");
          await syncPaymentsForInvoice(invoiceId);
        } catch {
          // Cloud sync failed or not available, continue with local data
        }

        // Load payments from local database (now includes any synced cloud payments)
        const paymentHistory = listInvoicePayments(invoiceId);
        setPayments(paymentHistory);
      }
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

  // Initialize tempNotes when invoice loads
  useEffect(() => {
    if (invoice) {
      setTempNotes(invoice.notes || "");
    }
  }, [invoice?.notes]);

  const handleExportPDF = useCallback(async () => {
    if (!invoice) return;

    try {
      // Load user preferences to check tier and get company details
      const prefs = await loadPreferences();
      const user = await getUserState();
      const isPro = canAccessAssemblies(user);

      // Load logo
      let logoBase64: string | undefined;
      try {
        const logo = await getCompanyLogo();
        if (logo?.base64) {
          // Strip data URL prefix - PDF template adds it back
          logoBase64 = logo.base64.replace(/^data:image\/\w+;base64,/, '');
        }
      } catch {
        // Logo loading failed, continue without it
      }

      const pdfOptions: PDFOptions = {
        includeBranding: !isPro, // Free tier shows branding
        companyDetails: prefs.company,
        logoBase64,
        // Pro/Premium users can add payment methods to invoices
        paymentMethods: isPro ? prefs.paymentMethods : undefined,
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

  const handleUpdateStatus = useCallback(() => {
    if (!invoice) return;
    setEditingStatus(true);
  }, [invoice]);

  const handleSaveStatus = useCallback(async (newStatus: InvoiceStatus) => {
    if (!invoice) return;
    try {
      await updateInvoice(invoice.id, { status: newStatus });
      await loadInvoice();
      setEditingStatus(false);
    } catch {
      Alert.alert("Error", "Failed to update status");
    }
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

  // Edit handlers
  const handleEditDueDate = useCallback(() => {
    if (!invoice) return;
    const dueDate = new Date(invoice.dueDate);
    setTempDueDate(dueDate);
    setEditingDueDate(true);
  }, [invoice]);

  const handleSaveDueDate = useCallback(async (date: Date) => {
    if (!invoice) return;
    try {
      await updateInvoice(invoice.id, { dueDate: date.toISOString() });
      await loadInvoice();
      setEditingDueDate(false);
    } catch {
      Alert.alert("Error", "Failed to update due date");
    }
  }, [invoice, loadInvoice]);

  const handleEditNotes = useCallback(() => {
    if (!invoice) return;
    setTempNotes(invoice.notes || "");
    setEditingNotes(true);
  }, [invoice]);

  const handleSaveNotes = useCallback(async () => {
    if (!invoice) return;
    // Only save if notes actually changed
    if (tempNotes === invoice.notes) return;
    try {
      await updateInvoice(invoice.id, { notes: tempNotes });
      await loadInvoice();
    } catch {
      Alert.alert("Error", "Failed to update notes");
    }
  }, [invoice, tempNotes, loadInvoice]);

  const handleEditClientName = useCallback(() => {
    if (!invoice) return;
    setTempClientName(invoice.clientName || "");
    setEditingClientName(true);
    // Android: manually focus after modal opens
    if (Platform.OS === 'android') {
      setTimeout(() => clientInputRef.current?.focus(), 100);
    }
  }, [invoice]);

  const handleSaveClientName = useCallback(async () => {
    if (!invoice) return;
    try {
      await updateInvoice(invoice.id, { clientName: tempClientName });
      await loadInvoice();
      setEditingClientName(false);
    } catch {
      Alert.alert("Error", "Failed to update client name");
    }
  }, [invoice, tempClientName, loadInvoice]);

  const handleEditClientEmail = useCallback(() => {
    if (!invoice) return;
    setTempClientEmail(invoice.clientEmail || "");
    setEditingClientEmail(true);
  }, [invoice]);

  const handleSaveClientEmail = useCallback(async () => {
    if (!invoice) return;
    try {
      await updateInvoice(invoice.id, { clientEmail: tempClientEmail });
      await loadInvoice();
      setEditingClientEmail(false);
    } catch {
      Alert.alert("Error", "Failed to update client email");
    }
  }, [invoice, tempClientEmail, loadInvoice]);

  const handleEditClientPhone = useCallback(() => {
    if (!invoice) return;
    setTempClientPhone(invoice.clientPhone || "");
    setEditingClientPhone(true);
  }, [invoice]);

  const handleSaveClientPhone = useCallback(async () => {
    if (!invoice) return;
    try {
      await updateInvoice(invoice.id, { clientPhone: tempClientPhone });
      await loadInvoice();
      setEditingClientPhone(false);
    } catch {
      Alert.alert("Error", "Failed to update client phone");
    }
  }, [invoice, tempClientPhone, loadInvoice]);

  const handleEditClientAddress = useCallback(() => {
    if (!invoice) return;
    setTempClientAddress(invoice.clientAddress || "");
    setEditingClientAddress(true);
  }, [invoice]);

  const handleSaveClientAddress = useCallback(async () => {
    if (!invoice) return;
    try {
      await updateInvoice(invoice.id, { clientAddress: tempClientAddress });
      await loadInvoice();
      setEditingClientAddress(false);
    } catch {
      Alert.alert("Error", "Failed to update client address");
    }
  }, [invoice, tempClientAddress, loadInvoice]);

  const handleEditTaxPercent = useCallback(() => {
    if (!invoice) return;
    setTempTaxPercent(invoice.taxPercent?.toString() || "");
    setEditingTaxPercent(true);
  }, [invoice]);

  const handleSaveTaxPercent = useCallback(async () => {
    if (!invoice) return;
    try {
      const taxValue = parseFloat(tempTaxPercent) || 0;
      await updateInvoice(invoice.id, { taxPercent: taxValue });
      await loadInvoice();
      setEditingTaxPercent(false);
    } catch {
      Alert.alert("Error", "Failed to update tax percent");
    }
  }, [invoice, tempTaxPercent, loadInvoice]);

  const handleEditMarkupPercent = useCallback(() => {
    if (!invoice) return;
    setTempMarkupPercent(invoice.markupPercent?.toString() || "");
    setEditingMarkupPercent(true);
  }, [invoice]);

  const handleSaveMarkupPercent = useCallback(async () => {
    if (!invoice) return;
    try {
      const markupValue = parseFloat(tempMarkupPercent) || 0;
      await updateInvoice(invoice.id, { markupPercent: markupValue });
      await loadInvoice();
      setEditingMarkupPercent(false);
    } catch {
      Alert.alert("Error", "Failed to update markup percent");
    }
  }, [invoice, tempMarkupPercent, loadInvoice]);

  const handleEditProjectName = useCallback(() => {
    if (!invoice) return;
    setTempProjectName(invoice.name || "");
    setEditingProjectName(true);
    // Android: manually focus after modal opens
    if (Platform.OS === 'android') {
      setTimeout(() => projectInputRef.current?.focus(), 100);
    }
  }, [invoice]);

  const handleSaveProjectName = useCallback(async () => {
    if (!invoice) return;
    try {
      await updateInvoice(invoice.id, { name: tempProjectName });
      await loadInvoice();
      setEditingProjectName(false);
    } catch {
      Alert.alert("Error", "Failed to update project name");
    }
  }, [invoice, tempProjectName, loadInvoice]);

  const handleEditInvoiceNumber = useCallback(() => {
    if (!invoice) return;
    setTempInvoiceNumber(invoice.invoiceNumber || "");
    setEditingInvoiceNumber(true);
    // Android: manually focus after modal opens
    if (Platform.OS === 'android') {
      setTimeout(() => projectInputRef.current?.focus(), 100);
    }
  }, [invoice]);

  const handleSaveInvoiceNumber = useCallback(async () => {
    if (!invoice) return;
    try {
      await updateInvoice(invoice.id, { invoiceNumber: tempInvoiceNumber });
      await loadInvoice();
      setEditingInvoiceNumber(false);
    } catch {
      Alert.alert("Error", "Failed to update invoice number");
    }
  }, [invoice, tempInvoiceNumber, loadInvoice]);

  const handleOpenPaymentModal = useCallback(() => {
    if (!invoice) return;
    // Calculate remaining balance
    const totals = calculateInvoiceTotals(invoice);
    const remaining = totals.total - (invoice.paidAmount || 0);
    setTempPaymentAmount(remaining.toFixed(2));
    setTempPaymentMethod("");
    setTempPaymentDate(new Date());
    setTempPaymentNote("");
    setEditingPayment(true);
  }, [invoice]);

  const handleRecordPayment = useCallback(async () => {
    if (!invoice) return;

    const amount = parseFloat(tempPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    if (!tempPaymentMethod) {
      Alert.alert("Error", "Please select a payment method");
      return;
    }

    setRecordingPayment(true);
    try {
      // Use the new recordPayment function that creates a payment record
      await recordPayment(
        invoice.id,
        amount,
        tempPaymentMethod,
        tempPaymentDate,
        tempPaymentNote || undefined
      );

      await loadInvoice();
      setEditingPayment(false);
      Alert.alert("Success", "Payment recorded successfully");
    } catch {
      Alert.alert("Error", "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  }, [invoice, tempPaymentAmount, tempPaymentMethod, tempPaymentDate, tempPaymentNote, loadInvoice]);

  const handleDeletePayment = useCallback((payment: InvoicePayment) => {
    if (!invoice) return;

    Alert.alert(
      "Delete Payment",
      `Delete payment of $${payment.amount.toFixed(2)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePayment(payment.id, invoice.id);
              await loadInvoice();
            } catch {
              Alert.alert("Error", "Failed to delete payment");
            }
          },
        },
      ]
    );
  }, [invoice, loadInvoice]);

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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
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
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Invoice not found</Text>
          <Text style={styles.emptyDescription}>
            This invoice may have been deleted
          </Text>
        </View>
      </>
    );
  }

  // Use centralized calculation (markup on line items only, not material estimate)
  const totals = calculateInvoiceTotals(invoice);
  const { materialsFromItems, materialEstimate, labor, subtotal, markupAmount, taxAmount, total } = totals;

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
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
        }}
      />
      <FormScreen
        scroll
        bottomBar={
          <View style={styles.bottomButtons}>
            {invoice.status !== "paid" && (
              <Pressable style={styles.paymentButton} onPress={handleOpenPaymentModal}>
                <Text style={styles.paymentButtonIcon}>$</Text>
              </Pressable>
            )}

            <Pressable style={styles.exportButton} onPress={handleExportPDF}>
              <Ionicons name="document-outline" size={20} color="#000" />
              <Text style={styles.exportButtonText}>PDF</Text>
            </Pressable>

            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#FFF" />
            </Pressable>
          </View>
        }
        bottomBarStyle={{
          paddingTop: theme.spacing(1),
          paddingBottom: theme.spacing(1),
        }}
      >
          {/* Header Card */}
          <View style={styles.headerCard}>
            {invoice.isPartialInvoice && invoice.percentage && (
              <View style={styles.partialBadgeContainer}>
                <Text style={styles.partialBadge}>{invoice.percentage}% Down Payment</Text>
              </View>
            )}
            <View style={styles.headerRow}>
              <Pressable onPress={handleEditInvoiceNumber} style={styles.invoiceNumberContainer}>
                <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                <Text style={styles.editTextSmall}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={handleUpdateStatus}
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${statusMeta.color}20` },
                ]}
              >
                <Text style={[styles.statusText, { color: statusMeta.color }]}>
                  {statusMeta.label}
                </Text>
              </Pressable>
            </View>

            <View style={styles.dividerLight} />

            {/* Project Name - Editable */}
            <Pressable
              style={styles.editableRow}
              onPress={handleEditProjectName}
            >
              <View style={styles.editableRowContent}>
                <Text style={styles.infoLabel}>Project</Text>
                <Text style={styles.infoValue}>{invoice.name}</Text>
              </View>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>

            {/* Client Name - Editable */}
            <Pressable
              style={styles.editableRow}
              onPress={handleEditClientName}
            >
              <View style={styles.editableRowContent}>
                <Text style={styles.infoLabel}>Client</Text>
                <Text style={[styles.infoValue, !invoice.clientName && styles.infoPlaceholder]}>
                  {invoice.clientName || "Tap to add"}
                </Text>
              </View>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>

            {/* Client Contact Details - Editable */}
            <Pressable
              style={styles.editableRow}
              onPress={handleEditClientEmail}
            >
              <View style={styles.editableRowContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={[styles.infoValue, !invoice.clientEmail && styles.infoPlaceholder]}>
                  {invoice.clientEmail || "Tap to add"}
                </Text>
              </View>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>

            <Pressable
              style={styles.editableRow}
              onPress={handleEditClientPhone}
            >
              <View style={styles.editableRowContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={[styles.infoValue, !invoice.clientPhone && styles.infoPlaceholder]}>
                  {invoice.clientPhone || "Tap to add"}
                </Text>
              </View>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>

            <Pressable
              style={styles.editableRow}
              onPress={handleEditClientAddress}
            >
              <View style={styles.editableRowContent}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={[styles.infoValue, !invoice.clientAddress && styles.infoPlaceholder]}>
                  {invoice.clientAddress || "Tap to add"}
                </Text>
              </View>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>

            <View style={styles.dividerLight} />

            {/* Dates */}
            <View style={styles.dateRow}>
              <View style={styles.dateColumn}>
                <Text style={styles.dateLabel}>Invoice Date</Text>
                <Text style={styles.dateValue}>{formattedInvoiceDate}</Text>
              </View>
              <TouchableOpacity
                onPress={handleEditDueDate}
                style={styles.editableDateColumn}
                activeOpacity={0.7}
              >
                <View style={styles.dueDateHeader}>
                  <Text style={styles.dateLabel}>Due Date</Text>
                  <Text style={styles.editText}>Edit</Text>
                </View>
                <Text style={styles.dateValue}>
                  {formattedDueDate}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>
              {invoice.paidAmount && invoice.paidAmount > 0 && invoice.paidAmount < total
                ? "Balance Due"
                : "Total Amount"}
            </Text>
            <Text style={styles.totalValue}>
              ${(total - (invoice.paidAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {/* Payment History - show if there are payment records OR legacy paidAmount */}
            {(() => {
              const trackedTotal = payments.reduce((sum, p) => sum + p.amount, 0);
              const legacyAmount = (invoice.paidAmount || 0) - trackedTotal;
              const hasPayments = payments.length > 0 || legacyAmount > 0;
              const paymentCount = payments.length + (legacyAmount > 0 ? 1 : 0);

              if (!hasPayments) return null;

              return (
                <View style={styles.paymentSummary}>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Invoice Total</Text>
                    <Text style={styles.paymentSummaryValue}>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={styles.paymentHistoryHeader}>
                    <Text style={[styles.paymentSummaryLabel, styles.paymentReceivedLabel]}>
                      Payments ({paymentCount})
                    </Text>
                  </View>
                  {/* Legacy payment (recorded before payment history feature) */}
                  {legacyAmount > 0 && (
                    <View style={styles.paymentHistoryItem}>
                      <View style={styles.paymentHistoryLeft}>
                        <Text style={styles.paymentHistoryAmount}>
                          -${legacyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                        <Text style={styles.paymentHistoryDetails}>
                          {invoice.paidDate
                            ? new Date(invoice.paidDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "Previous"}
                          {invoice.paidMethod && (
                            ` • ${invoice.paidMethod.charAt(0).toUpperCase() + invoice.paidMethod.slice(1).replace('_', ' ')}`
                          )}
                        </Text>
                      </View>
                    </View>
                  )}
                  {/* Individual payment records */}
                  {payments.map((payment) => (
                    <Pressable
                      key={payment.id}
                      style={styles.paymentHistoryItem}
                      onLongPress={() => handleDeletePayment(payment)}
                    >
                      <View style={styles.paymentHistoryLeft}>
                        <Text style={styles.paymentHistoryAmount}>
                          -${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                        <Text style={styles.paymentHistoryDetails}>
                          {new Date(payment.paymentDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {payment.paymentMethod && (
                            ` • ${payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1).replace('_', ' ')}`
                          )}
                        </Text>
                        {payment.notes && (
                          <Text style={styles.paymentHistoryNotes} numberOfLines={1}>
                            {payment.notes}
                          </Text>
                        )}
                      </View>
                      <View style={styles.paymentHistoryRight}>
                        <Ionicons name="trash-outline" size={16} color={theme.colors.muted} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              );
            })()}
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
                      {item.qty} × ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <Text style={styles.lineItemTotal}>
                    ${(item.qty * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Items Subtotal</Text>
                <Text style={styles.subtotalValue}>${materialsFromItems.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            </View>
          )}

          {/* Labor, Materials, Overhead */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Costs</Text>

            {invoice.labor > 0 && (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Labor</Text>
                <Text style={styles.costValue}>${invoice.labor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}

            {(invoice.materialEstimate ?? 0) > 0 && (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Material Estimate</Text>
                <Text style={styles.costValue}>
                  ${invoice.materialEstimate!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            <Pressable style={styles.costRow} onPress={handleEditMarkupPercent}>
              <View style={styles.costRowLeft}>
                <Text style={styles.costLabel}>
                  Markup ({invoice.markupPercent?.toFixed(0) || "0"}%)
                </Text>
                <Text style={styles.editTextSmall}>Edit</Text>
              </View>
              <Text style={styles.costValue}>${markupAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </Pressable>

            <Pressable style={styles.costRow} onPress={handleEditTaxPercent}>
              <View style={styles.costRowLeft}>
                <Text style={styles.costLabel}>
                  Tax ({invoice.taxPercent?.toFixed(2) || "0.00"}%)
                </Text>
                <Text style={styles.editTextSmall}>Edit</Text>
              </View>
              <Text style={styles.costValue}>${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </Pressable>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={tempNotes}
              onChangeText={setTempNotes}
              onBlur={handleSaveNotes}
              placeholder="Add notes..."
              placeholderTextColor={theme.colors.muted}
              multiline
              textAlignVertical="top"
            />
          </View>
      </FormScreen>

        {/* Edit Modals */}
        {/* Due Date Picker */}
        {editingDueDate && Platform.OS === 'ios' && (
          <Modal
            visible={editingDueDate}
            transparent
            animationType="slide"
            onRequestClose={() => setEditingDueDate(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setEditingDueDate(false)}
            >
              <Pressable
                style={styles.datePickerModal}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setEditingDueDate(false)}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.modalTitle}>Select Due Date</Text>
                  <Pressable onPress={() => handleSaveDueDate(tempDueDate)}>
                    <Text style={styles.modalDone}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={tempDueDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => date && setTempDueDate(date)}
                  textColor={theme.colors.text}
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Android Date Picker (Native calendar) */}
        {editingDueDate && Platform.OS === 'android' && (
          <DateTimePicker
            value={tempDueDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setEditingDueDate(false);
              if (event.type === 'set' && date) {
                handleSaveDueDate(date);
              }
            }}
          />
        )}

        {/* Project Name Editor */}
        <Modal
          visible={editingProjectName}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingProjectName(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlayCentered}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingProjectName(false);
              }}
            >
              <View style={styles.inputModalContainer}>
                <Pressable
                  style={styles.inputModal}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.modalTitleCentered}>Project Name</Text>
                  <TextInput
                    ref={projectInputRef}
                    style={styles.textInput}
                    value={tempProjectName}
                    onChangeText={setTempProjectName}
                    placeholder="Enter project name"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus={Platform.OS === 'ios'}
                  />
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => setEditingProjectName(false)}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonSave]}
                      onPress={handleSaveProjectName}
                    >
                      <Text style={styles.modalButtonSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Invoice Number Editor */}
        <Modal
          visible={editingInvoiceNumber}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingInvoiceNumber(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlayCentered}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingInvoiceNumber(false);
              }}
            >
              <View style={styles.inputModalContainer}>
                <Pressable
                  style={styles.inputModal}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.modalTitleCentered}>Invoice Number</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tempInvoiceNumber}
                    onChangeText={setTempInvoiceNumber}
                    placeholder="Enter invoice number"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus={Platform.OS === 'ios'}
                  />
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => setEditingInvoiceNumber(false)}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonSave]}
                      onPress={handleSaveInvoiceNumber}
                    >
                      <Text style={styles.modalButtonSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Client Name Editor */}
        <Modal
          visible={editingClientName}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingClientName(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlayCentered}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingClientName(false);
              }}
            >
              <View style={styles.inputModalContainer}>
                <Pressable
                  style={styles.inputModal}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.modalTitleCentered}>Client Name</Text>
                  <TextInput
                    ref={clientInputRef}
                    style={styles.textInput}
                    value={tempClientName}
                    onChangeText={setTempClientName}
                    placeholder="Enter client name"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus={Platform.OS === 'ios'}
                  />
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => setEditingClientName(false)}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonSave]}
                      onPress={handleSaveClientName}
                    >
                      <Text style={styles.modalButtonSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Client Email Editor */}
        <Modal
          visible={editingClientEmail}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingClientEmail(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlayCentered}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingClientEmail(false);
              }}
            >
              <View style={styles.inputModalContainer}>
                <Pressable
                  style={styles.inputModal}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.modalTitleCentered}>Client Email</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tempClientEmail}
                    onChangeText={setTempClientEmail}
                    placeholder="client@example.com"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus={Platform.OS === 'ios'}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => setEditingClientEmail(false)}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonSave]}
                      onPress={handleSaveClientEmail}
                    >
                      <Text style={styles.modalButtonSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Client Phone Editor */}
        <Modal
          visible={editingClientPhone}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingClientPhone(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlayCentered}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingClientPhone(false);
              }}
            >
              <View style={styles.inputModalContainer}>
                <Pressable
                  style={styles.inputModal}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.modalTitleCentered}>Client Phone</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tempClientPhone}
                    onChangeText={(text) => setTempClientPhone(formatPhoneNumber(text))}
                    placeholder="(555) 123-4567"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus={Platform.OS === 'ios'}
                    keyboardType="phone-pad"
                  />
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => setEditingClientPhone(false)}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonSave]}
                      onPress={handleSaveClientPhone}
                    >
                      <Text style={styles.modalButtonSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Client Address Editor */}
        <Modal
          visible={editingClientAddress}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingClientAddress(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlayCentered}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingClientAddress(false);
              }}
            >
              <View style={styles.inputModalContainer}>
                <Pressable
                  style={styles.inputModal}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.modalTitleCentered}>Client Address</Text>
                  <TextInput
                    style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                    value={tempClientAddress}
                    onChangeText={setTempClientAddress}
                    placeholder="123 Main St, City, State ZIP"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus={Platform.OS === 'ios'}
                    multiline
                  />
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => setEditingClientAddress(false)}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonSave]}
                      onPress={handleSaveClientAddress}
                    >
                      <Text style={styles.modalButtonSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Tax Percent Editor */}
        <Modal
          visible={editingTaxPercent}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingTaxPercent(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlayCentered}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingTaxPercent(false);
              }}
            >
              <View style={styles.inputModalContainer}>
                <Pressable
                  style={styles.inputModal}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.modalTitleCentered}>Tax Percentage</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tempTaxPercent}
                    onChangeText={setTempTaxPercent}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus={Platform.OS === 'ios'}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => setEditingTaxPercent(false)}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonSave]}
                      onPress={handleSaveTaxPercent}
                    >
                      <Text style={styles.modalButtonSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Markup Percent Editor */}
        <Modal
          visible={editingMarkupPercent}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingMarkupPercent(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlayCentered}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingMarkupPercent(false);
              }}
            >
              <View style={styles.inputModalContainer}>
                <Pressable
                  style={styles.inputModal}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.modalTitleCentered}>Markup Percentage</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tempMarkupPercent}
                    onChangeText={setTempMarkupPercent}
                    placeholder="0"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus={Platform.OS === 'ios'}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => setEditingMarkupPercent(false)}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonSave]}
                      onPress={handleSaveMarkupPercent}
                    >
                      <Text style={styles.modalButtonSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Status Selector */}
        <Modal
          visible={editingStatus}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingStatus(false)}
        >
          <Pressable
            style={styles.modalOverlayCentered}
            onPress={() => setEditingStatus(false)}
          >
            <View style={styles.inputModalContainer}>
              <Pressable
                style={styles.statusModal}
                onPress={(e) => e.stopPropagation()}
              >
                <Text style={styles.modalTitleCentered}>Update Status</Text>
                <Text style={styles.statusModalSubtitle}>
                  Current: {InvoiceStatusMeta[invoice?.status || "unpaid"].label}
                </Text>

                {(["unpaid", "partial", "paid", "overdue"] as const).map((status) => (
                  <Pressable
                    key={status}
                    style={[
                      styles.statusOption,
                      invoice?.status === status && styles.statusOptionActive,
                    ]}
                    onPress={() => handleSaveStatus(status)}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        invoice?.status === status && styles.statusOptionTextActive,
                      ]}
                    >
                      {InvoiceStatusMeta[status].label}
                    </Text>
                  </Pressable>
                ))}
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Payment Modal */}
        <Modal
          visible={editingPayment}
          transparent
          animationType="slide"
          onRequestClose={() => setEditingPayment(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingPayment(false);
              }}
            >
              <Pressable
                style={styles.paymentModal}
                onPress={() => Keyboard.dismiss()}
              >
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setEditingPayment(false)}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.modalTitle}>Record Payment</Text>
                  <Pressable onPress={handleRecordPayment} disabled={recordingPayment}>
                    <Text style={[styles.modalDone, recordingPayment && { opacity: 0.5 }]}>
                      {recordingPayment ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.paymentFormContent}>
                  {/* Amount */}
                  <View style={styles.paymentField}>
                    <Text style={styles.paymentFieldLabel}>Amount</Text>
                    <View style={styles.amountInputContainer}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.amountInput}
                        value={tempPaymentAmount}
                        onChangeText={setTempPaymentAmount}
                        onBlur={() => {
                          const num = parseFloat(tempPaymentAmount);
                          if (!isNaN(num)) {
                            setTempPaymentAmount(num.toFixed(2));
                          }
                        }}
                        placeholder="0.00"
                        placeholderTextColor={theme.colors.muted}
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                    </View>
                  </View>

                  {/* Payment Method */}
                  <View style={styles.paymentField}>
                    <Text style={styles.paymentFieldLabel}>Payment Method</Text>
                    <View style={styles.paymentMethodGrid}>
                      {[
                        { value: "cash", label: "Cash" },
                        { value: "check", label: "Check" },
                        { value: "card", label: "Card" },
                        { value: "bank_transfer", label: "Bank" },
                        { value: "zelle", label: "Zelle" },
                        { value: "venmo", label: "Venmo" },
                        { value: "cashapp", label: "Cash App" },
                        { value: "other", label: "Other" },
                      ].map((method) => (
                        <Pressable
                          key={method.value}
                          style={[
                            styles.paymentMethodOption,
                            tempPaymentMethod === method.value && styles.paymentMethodOptionActive,
                          ]}
                          onPress={() => setTempPaymentMethod(method.value)}
                        >
                          <Text
                            style={[
                              styles.paymentMethodText,
                              tempPaymentMethod === method.value && styles.paymentMethodTextActive,
                            ]}
                          >
                            {method.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Payment Date */}
                  <View style={styles.paymentField}>
                    <Text style={styles.paymentFieldLabel}>Payment Date</Text>
                    <Pressable
                      style={styles.dateButton}
                      onPress={() => setShowPaymentDatePicker(true)}
                    >
                      <Text style={styles.dateButtonText}>
                        {tempPaymentDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color={theme.colors.muted} />
                    </Pressable>
                  </View>

                  {/* Note */}
                  <View style={styles.paymentField}>
                    <Text style={styles.paymentFieldLabel}>Note (optional)</Text>
                    <TextInput
                      style={styles.noteInput}
                      value={tempPaymentNote}
                      onChangeText={setTempPaymentNote}
                      placeholder="Check #1234, partial payment, etc."
                      placeholderTextColor={theme.colors.muted}
                      multiline
                    />
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Payment Date Picker */}
        {showPaymentDatePicker && Platform.OS === 'ios' && (
          <Modal
            visible={showPaymentDatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowPaymentDatePicker(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowPaymentDatePicker(false)}
            >
              <Pressable
                style={styles.datePickerModal}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setShowPaymentDatePicker(false)}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.modalTitle}>Payment Date</Text>
                  <Pressable onPress={() => setShowPaymentDatePicker(false)}>
                    <Text style={styles.modalDone}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={tempPaymentDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => date && setTempPaymentDate(date)}
                  textColor={theme.colors.text}
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {showPaymentDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={tempPaymentDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowPaymentDatePicker(false);
              if (event.type === 'set' && date) {
                setTempPaymentDate(date);
              }
            }}
          />
        )}
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
    headerCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(3),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    partialBadgeContainer: {
      alignSelf: "flex-start",
      backgroundColor: `${theme.colors.accent}20`,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radius.sm,
      marginBottom: theme.spacing(1.5),
    },
    partialBadge: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: theme.spacing(2),
    },
    invoiceNumberContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    invoiceNumber: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    editTextSmall: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.accent,
      opacity: 0.7,
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
    dividerLight: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing(1.5),
    },
    infoRow: {
      marginBottom: theme.spacing(1),
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.muted,
      textTransform: "uppercase",
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.text,
    },
    infoPlaceholder: {
      color: theme.colors.muted,
      fontStyle: "italic",
    },
    clientDetails: {
      marginTop: theme.spacing(0.5),
      marginBottom: theme.spacing(1),
      paddingLeft: theme.spacing(0.5),
    },
    clientDetailText: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: 2,
    },
    editableRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    editableRowContent: {
      flex: 1,
    },
    editText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    dateRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing(2),
    },
    dateColumn: {
      flex: 1,
    },
    editableDateColumn: {
      flex: 1,
      minHeight: 50,
    },
    dateLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.muted,
      textTransform: "uppercase",
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    dateValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    dueDateHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    section: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    lineItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(0.75),
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
      marginVertical: theme.spacing(1),
    },
    subtotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: theme.spacing(0.5),
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
      alignItems: "center",
      paddingVertical: theme.spacing(0.5),
    },
    costRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
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
    notesPlaceholder: {
      color: theme.colors.muted,
      fontStyle: "italic",
    },
    notesInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      fontSize: 14,
      color: theme.colors.text,
      minHeight: 100,
      lineHeight: 20,
    },
    totalCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
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
      gap: theme.spacing(1),
      width: "100%",
    },
    exportButton: {
      flex: 2,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.25),
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
    deleteButton: {
      flex: 1,
      backgroundColor: "#ef4444",
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.25),
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: theme.spacing(0.75),
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFF",
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalOverlayCentered: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalOverlayInner: {
      flex: 1,
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    datePickerModal: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      width: "100%",
      paddingBottom: theme.spacing(4),
    },
    textEditorModal: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      margin: theme.spacing(2),
      padding: theme.spacing(2),
      height: 300,
    },
    inputModalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.spacing(3),
    },
    inputModal: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(4),
      width: "100%",
      maxWidth: 400,
      minWidth: 300,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    modalTitleCentered: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
      textAlign: "center",
    },
    modalCancel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    modalDone: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    textEditor: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      fontSize: 16,
      color: theme.colors.text,
      marginTop: theme.spacing(2),
    },
    textInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(2),
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing(3),
      minHeight: 48,
    },
    modalButtons: {
      flexDirection: "row",
      gap: theme.spacing(2),
    },
    modalButton: {
      flex: 1,
      paddingVertical: theme.spacing(2),
      paddingHorizontal: theme.spacing(2),
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    modalButtonCancel: {
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modalButtonSave: {
      backgroundColor: theme.colors.accent,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonSaveText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    statusModal: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      width: "100%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statusModalSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(2),
      textAlign: "center",
    },
    statusOption: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statusOptionActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    statusOptionText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "center",
    },
    statusOptionTextActive: {
      color: "#000",
      fontWeight: "700",
    },
    // Payment button styles
    paymentButton: {
      flex: 1,
      backgroundColor: "#34C759",
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.25),
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: theme.spacing(0.75),
    },
    paymentButtonIcon: {
      fontSize: 20,
      fontWeight: "800",
      color: "#FFF",
    },
    // Payment summary in total card
    paymentSummary: {
      marginTop: theme.spacing(2),
      paddingTop: theme.spacing(2),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    paymentSummaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: theme.spacing(0.5),
    },
    paymentSummaryLabel: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    paymentSummaryValue: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    paymentReceivedLabel: {
      color: "#34C759",
    },
    paymentReceivedValue: {
      color: "#34C759",
    },
    paymentHistoryHeader: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
    },
    paymentHistoryItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
    },
    paymentHistoryLeft: {
      flex: 1,
    },
    paymentHistoryRight: {
      paddingLeft: theme.spacing(1),
      opacity: 0.5,
    },
    paymentHistoryAmount: {
      fontSize: 14,
      fontWeight: "700",
      color: "#34C759",
    },
    paymentHistoryDetails: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    paymentHistoryNotes: {
      fontSize: 11,
      fontStyle: "italic",
      color: theme.colors.muted,
      marginTop: 2,
    },
    // Payment modal styles
    paymentModal: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      margin: theme.spacing(2),
      maxHeight: "85%",
    },
    paymentFormContent: {
      padding: theme.spacing(3),
    },
    paymentField: {
      marginBottom: theme.spacing(3),
    },
    paymentFieldLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    amountInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
    },
    currencySymbol: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.muted,
      marginRight: theme.spacing(0.5),
    },
    amountInput: {
      flex: 1,
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.text,
      paddingVertical: theme.spacing(2),
    },
    paymentMethodGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing(1),
    },
    paymentMethodOption: {
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(2),
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    paymentMethodOptionActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    paymentMethodText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    paymentMethodTextActive: {
      color: "#000",
    },
    dateButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: theme.spacing(2),
      paddingHorizontal: theme.spacing(2),
    },
    dateButtonText: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
    },
    noteInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(2),
      fontSize: 14,
      color: theme.colors.text,
      minHeight: 60,
      textAlignVertical: "top",
    },
  });
}
