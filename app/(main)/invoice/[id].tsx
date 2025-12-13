// app/(main)/invoice/[id].tsx
// Invoice detail/view screen
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
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
} from "@/lib/invoices";
import { generateAndShareInvoicePDF, type PDFOptions } from "@/lib/pdf";
import { loadPreferences } from "@/lib/preferences";
import { getUserState } from "@/lib/user";
import { canAccessAssemblies } from "@/lib/features";
import { FormScreen } from "@/modules/core/ui";

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

  // Editing states
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingClientName, setEditingClientName] = useState(false);
  const [editingClientEmail, setEditingClientEmail] = useState(false);
  const [editingClientPhone, setEditingClientPhone] = useState(false);
  const [editingClientAddress, setEditingClientAddress] = useState(false);
  const [editingTaxPercent, setEditingTaxPercent] = useState(false);
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
  const [tempProjectName, setTempProjectName] = useState("");
  const [tempInvoiceNumber, setTempInvoiceNumber] = useState("");

  // Refs for TextInput focus
  const projectInputRef = useRef<TextInput>(null);
  const clientInputRef = useRef<TextInput>(null);

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
    } catch (error) {
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
    } catch (error) {
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
    try {
      await updateInvoice(invoice.id, { notes: tempNotes });
      await loadInvoice();
      setEditingNotes(false);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      Alert.alert("Error", "Failed to update tax percent");
    }
  }, [invoice, tempTaxPercent, loadInvoice]);

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
    } catch (error) {
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
    } catch (error) {
      Alert.alert("Error", "Failed to update invoice number");
    }
  }, [invoice, tempInvoiceNumber, loadInvoice]);

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
  const subtotalWithMarkup = subtotal + markup;
  const tax = invoice.taxPercent
    ? subtotalWithMarkup * (invoice.taxPercent / 100)
    : 0;
  const total = subtotalWithMarkup + tax;

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
              style={{ paddingLeft: 16, paddingVertical: 8 }}
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
      <FormScreen
        scroll
        bottomBar={
          <View style={styles.bottomButtons}>
            <Pressable style={styles.exportButton} onPress={handleExportPDF}>
              <Ionicons name="document-outline" size={24} color="#000" />
              <Text style={styles.exportButtonText}>Export PDF</Text>
            </Pressable>

            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#FFF" />
              <Text style={styles.deleteButtonText}>Delete</Text>
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

            <View style={styles.divider} />
            <Pressable style={styles.costRow} onPress={handleEditTaxPercent}>
              <View style={styles.costRowLeft}>
                <Text style={styles.costLabel}>
                  Tax ({invoice.taxPercent?.toFixed(2) || "0.00"}%)
                </Text>
                <Text style={styles.editTextSmall}>Edit</Text>
              </View>
              <Text style={styles.costValue}>${tax.toFixed(2)}</Text>
            </Pressable>
          </View>

          {/* Notes */}
          <TouchableOpacity
            style={styles.section}
            onPress={handleEditNotes}
            activeOpacity={0.9}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.editText}>Edit</Text>
            </View>
            <Text style={[styles.notesText, !invoice.notes && styles.notesPlaceholder]}>
              {invoice.notes || "Tap to add notes"}
            </Text>
          </TouchableOpacity>

          {/* Total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
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

        {/* Notes Editor */}
        <Modal
          visible={editingNotes}
          transparent
          animationType="slide"
          onRequestClose={() => setEditingNotes(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <Pressable
              style={styles.modalOverlayInner}
              onPress={() => {
                Keyboard.dismiss();
                setEditingNotes(false);
              }}
            >
              <Pressable
                style={styles.textEditorModal}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setEditingNotes(false)}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.modalTitle}>Edit Notes</Text>
                  <Pressable onPress={handleSaveNotes}>
                    <Text style={styles.modalDone}>Save</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.textEditor}
                  value={tempNotes}
                  onChangeText={setTempNotes}
                  placeholder="Add notes..."
                  placeholderTextColor={theme.colors.muted}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

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
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
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
      alignItems: "center",
      paddingVertical: theme.spacing(1),
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
    totalCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      marginBottom: 0,
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
      justifyContent: "inherit",
      alignItems: "inherit",
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
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      width: "100%",
      height: "50%",
      padding: theme.spacing(2),
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
      padding: theme.spacing(3),
      width: "100%",
      maxWidth: 400,
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
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    modalButtons: {
      flexDirection: "row",
      gap: theme.spacing(2),
    },
    modalButton: {
      flex: 1,
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
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
  });
}
