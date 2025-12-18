// app/(main)/(tabs)/invoices.tsx
// Invoices list - Pro feature
import { useTheme } from "@/contexts/ThemeContext";
import {
  deleteInvoice,
  listInvoices,
  saveInvoice,
  updateInvoice,
  createInvoiceFromQuote,
  createInvoiceFromContract,
  type Invoice,
} from "@/lib/invoices";
import { listContracts } from "@/lib/contracts";
import type { Contract, InvoiceStatus } from "@/lib/types";
import { InvoiceStatusMeta } from "@/lib/types";
import { generateAndShareInvoicePDF, type PDFOptions } from "@/lib/pdf";
import { loadPreferences } from "@/lib/preferences";
import { canAccessAssemblies } from "@/lib/features";
import { getUserState } from "@/lib/user";
import { getCompanyLogo } from "@/lib/logo";
import { Stack, useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { listQuotes, type Quote } from "@/lib/quotes";
import { calculateTotal } from "@/lib/validation";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GradientBackground } from "@/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import { SwipeableInvoiceItem } from "@/components/SwipeableInvoiceItem";
import { UndoSnackbar } from "@/components/UndoSnackbar";

export default function InvoicesList() {
  const router = useRouter();
  const { theme } = useTheme();
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();
  const filterScrollRef = React.useRef<ScrollView>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | "all">("all");
  const [isPro, setIsPro] = useState(false);
  const [deletedInvoice, setDeletedInvoice] = useState<Invoice | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [editingStatusForInvoice, setEditingStatusForInvoice] = useState<Invoice | null>(null);
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [showContractPicker, setShowContractPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [availableQuotes, setAvailableQuotes] = useState<Quote[]>([]);
  const [availableContracts, setAvailableContracts] = useState<Contract[]>([]);
  const [isPremium, setIsPremium] = useState(false);

  const load = useCallback(async () => {
    const user = await getUserState();
    const hasAccess = canAccessAssemblies(user);
    setIsPro(hasAccess);
    const premium = user.tier === "premium";
    setIsPremium(premium);

    if (hasAccess) {
      const [invoiceData, quoteData] = await Promise.all([
        listInvoices(),
        listQuotes(),
      ]);
      setInvoices(invoiceData);
      // Filter quotes that can be invoiced (approved or completed)
      const invoiceable = quoteData.filter(
        (q) => q.status === "approved" || q.status === "completed"
      );
      setAvailableQuotes(invoiceable);

      // For Premium users, also load signed contracts
      if (premium) {
        const contractData = await listContracts();
        // Filter to only signed contracts
        const signedContracts = contractData.filter(
          (c) => c.status === "signed" || c.status === "completed"
        );
        setAvailableContracts(signedContracts);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Watch for trigger param to open picker
  useEffect(() => {
    if (trigger === "create" && isPro) {
      // For Premium users with contracts available, show source picker
      if (isPremium && availableContracts.length > 0) {
        setShowSourcePicker(true);
      } else if (availableQuotes.length > 0) {
        // Pro users or Premium without contracts go straight to quote picker
        setShowQuotePicker(true);
      } else {
        Alert.alert(
          "No Quotes Available",
          "You need approved or completed quotes to create invoices. Go to the Quotes screen to create quotes first.",
          [{ text: "OK" }]
        );
      }
      router.setParams({ trigger: undefined });
    }
  }, [trigger, isPro, isPremium, availableQuotes.length, availableContracts.length, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSignIn = () => {
    router.push("/(auth)/sign-in" as any);
  };

  const handleDeleteInvoice = useCallback(async (invoice: Invoice) => {
    // Store for undo
    setDeletedInvoice(invoice);
    // Optimistically remove from list
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
    // Delete from storage immediately
    await deleteInvoice(invoice.id);
    // Show undo snackbar
    setShowUndo(true);
  }, []);

  const handleUndoDelete = useCallback(async () => {
    if (deletedInvoice) {
      // Restore the invoice to storage
      await saveInvoice(deletedInvoice);
      // Reload list
      await load();
      // Clear state
      setDeletedInvoice(null);
      setShowUndo(false);
    }
  }, [deletedInvoice, load]);

  const handleDismissUndo = useCallback(() => {
    // Just clear state - deletion already happened
    setDeletedInvoice(null);
    setShowUndo(false);
  }, []);

  const handleExportInvoice = useCallback(async (invoice: Invoice) => {
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
      };

      await generateAndShareInvoicePDF(invoice, pdfOptions);
    } catch (error) {
      console.error("Failed to export invoice PDF:", error);
      Alert.alert(
        "Export Failed",
        error instanceof Error ? error.message : "Failed to export PDF"
      );
    }
  }, []);

  const handleUpdateStatus = useCallback((invoice: Invoice) => {
    setEditingStatusForInvoice(invoice);
  }, []);

  const handleSaveStatus = useCallback(async (newStatus: InvoiceStatus) => {
    if (!editingStatusForInvoice) return;
    try {
      await updateInvoice(editingStatusForInvoice.id, { status: newStatus });
      await load();
      setEditingStatusForInvoice(null);
    } catch {
      Alert.alert("Error", "Failed to update status");
    }
  }, [editingStatusForInvoice, load]);

  const handleViewInvoice = useCallback((invoice: Invoice) => {
    router.push(`/invoice/${invoice.id}` as any);
  }, [router]);

  const handleCopyInvoice = useCallback(async (invoice: Invoice) => {
    try {
      // Create a copy of the invoice with a new ID and number
      const now = new Date().toISOString();
      const newInvoice: Invoice = {
        ...invoice,
        id: `inv_${Date.now()}`,
        invoiceNumber: `${invoice.invoiceNumber}-COPY`,
        createdAt: now,
        updatedAt: now,
      };

      // Save the copied invoice
      await saveInvoice(newInvoice);

      // Reload the list
      await load();

      Alert.alert("Success", "Invoice copied successfully");
    } catch {
      Alert.alert("Error", "Failed to copy invoice");
    }
  }, [load]);

  const handleSelectQuote = useCallback(async (quote: Quote) => {
    try {
      setShowQuotePicker(false);
      const newInvoice = await createInvoiceFromQuote(quote.id);
      await load();
      router.push(`/invoice/${newInvoice.id}` as any);
    } catch {
      Alert.alert("Error", "Failed to create invoice");
    }
  }, [load, router]);

  const handleSelectContract = useCallback(async (contract: Contract) => {
    try {
      setShowContractPicker(false);
      const newInvoice = await createInvoiceFromContract(contract.id);
      await load();
      router.push(`/invoice/${newInvoice.id}` as any);
    } catch {
      Alert.alert("Error", "Failed to create invoice from contract");
    }
  }, [load, router]);

  const handleSelectSource = useCallback((source: "quote" | "contract") => {
    setShowSourcePicker(false);
    if (source === "quote") {
      setShowQuotePicker(true);
    } else {
      setShowContractPicker(true);
    }
  }, []);

  // Filter invoices based on search query and status
  const filteredInvoices = React.useMemo(() => {
    let filtered = invoices;

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === selectedStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(query) ||
          invoice.name.toLowerCase().includes(query) ||
          invoice.clientName?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [invoices, searchQuery, selectedStatus]);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // If not Pro, show locked state
  if (!isPro) {
    return (
      <>
        <Stack.Screen options={{ title: "Invoices", headerTitleAlign: "center" }} />
        <GradientBackground>
          <View style={styles.lockedContainer}>
            <Ionicons name="lock-closed" size={64} color={theme.colors.muted} />
            <Text style={styles.lockedTitle}>Invoices</Text>
            <Text style={styles.lockedDescription}>
              Create, track, and manage invoices from your quotes.
            </Text>
            <Pressable style={styles.upgradeButton} onPress={handleSignIn}>
              <Text style={styles.upgradeButtonText}>Sign In</Text>
            </Pressable>
          </View>
        </GradientBackground>
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Invoices", headerTitleAlign: "center" }} />
      <GradientBackground>
        {/* Status Filters */}
        <ScrollView
          ref={filterScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
          style={styles.filterScrollView}
        >
          <FilterChip
            label="All"
            active={selectedStatus === "all"}
            onPress={() => setSelectedStatus("all")}
            theme={theme}
          />
          <FilterChip
            label="Unpaid"
            active={selectedStatus === "unpaid"}
            onPress={() => setSelectedStatus("unpaid")}
            color={InvoiceStatusMeta.unpaid.color}
            theme={theme}
          />
          <FilterChip
            label="Partial"
            active={selectedStatus === "partial"}
            onPress={() => setSelectedStatus("partial")}
            color={InvoiceStatusMeta.partial.color}
            theme={theme}
          />
          <FilterChip
            label="Paid"
            active={selectedStatus === "paid"}
            onPress={() => setSelectedStatus("paid")}
            color={InvoiceStatusMeta.paid.color}
            theme={theme}
          />
          <FilterChip
            label="Overdue"
            active={selectedStatus === "overdue"}
            onPress={() => setSelectedStatus("overdue")}
            color={InvoiceStatusMeta.overdue.color}
            theme={theme}
          />
        </ScrollView>

        {/* Search */}
        <View style={styles.topBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search invoices..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Invoice List */}
        <FlatList
          data={filteredInvoices}
          keyExtractor={(inv) => inv.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <SwipeableInvoiceItem
              item={item}
              onPress={() => handleViewInvoice(item)}
              onDelete={() => handleDeleteInvoice(item)}
              onExport={() => handleExportInvoice(item)}
              onUpdateStatus={() => handleUpdateStatus(item)}
              onCopy={() => handleCopyInvoice(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {selectedStatus === "all" && searchQuery === ""
                  ? "No invoices yet"
                  : searchQuery !== ""
                  ? "No matches"
                  : `No ${selectedStatus} invoices`}
              </Text>
              <Text style={styles.emptyDescription}>
                {selectedStatus === "all" && searchQuery === ""
                  ? "Create invoices from quote review screens"
                  : searchQuery !== ""
                  ? "Try a different search term"
                  : "Create invoices from quote review screens"}
              </Text>
            </View>
          }
        />
        <UndoSnackbar
          visible={showUndo}
          message={`Deleted invoice ${deletedInvoice?.invoiceNumber}`}
          onUndo={handleUndoDelete}
          onDismiss={handleDismissUndo}
        />

        {/* Status Selector Modal */}
        <Modal
          visible={editingStatusForInvoice !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingStatusForInvoice(null)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setEditingStatusForInvoice(null)}
          >
            <View style={styles.modalContainer}>
              <Pressable
                style={styles.statusModal}
                onPress={(e) => e.stopPropagation()}
              >
                <Text style={styles.modalTitle}>Update Status</Text>
                <Text style={styles.modalSubtitle}>
                  Current: {editingStatusForInvoice ? InvoiceStatusMeta[editingStatusForInvoice.status].label : ''}
                </Text>

                {(["unpaid", "partial", "paid", "overdue"] as const).map((status) => (
                  <Pressable
                    key={status}
                    style={[
                      styles.statusOption,
                      editingStatusForInvoice?.status === status && styles.statusOptionActive,
                    ]}
                    onPress={() => handleSaveStatus(status)}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        editingStatusForInvoice?.status === status && styles.statusOptionTextActive,
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

        {/* Quote Picker Modal */}
        <Modal
          visible={showQuotePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowQuotePicker(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowQuotePicker(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.quotePickerModal}>
                <Text style={styles.modalTitle}>Select Quote to Invoice</Text>
                <Text style={styles.modalSubtitle}>
                  Choose an approved or completed quote
                </Text>

                <ScrollView style={styles.quoteList} nestedScrollEnabled>
                  {availableQuotes.map((quote) => (
                    <Pressable
                      key={quote.id}
                      style={styles.quoteOption}
                      onPress={() => handleSelectQuote(quote)}
                    >
                      <View style={styles.quoteOptionContent}>
                        <Text style={styles.quoteOptionTitle}>{quote.name}</Text>
                        <Text style={styles.quoteOptionSubtitle}>
                          {quote.clientName} • ${calculateTotal(quote).toFixed(2)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                    </Pressable>
                  ))}
                </ScrollView>

                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setShowQuotePicker(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Source Picker Modal (Premium only) */}
        <Modal
          visible={showSourcePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSourcePicker(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowSourcePicker(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.sourcePickerModal}>
                <Text style={styles.modalTitle}>Create Invoice From</Text>
                <Text style={styles.modalSubtitle}>
                  Choose the source for your invoice
                </Text>

                <Pressable
                  style={styles.sourceOption}
                  onPress={() => handleSelectSource("quote")}
                >
                  <View style={styles.sourceOptionIcon}>
                    <Ionicons name="document-text-outline" size={24} color={theme.colors.accent} />
                  </View>
                  <View style={styles.sourceOptionContent}>
                    <Text style={styles.sourceOptionTitle}>From Quote</Text>
                    <Text style={styles.sourceOptionSubtitle}>
                      {availableQuotes.length} approved quote{availableQuotes.length !== 1 ? "s" : ""} available
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                </Pressable>

                <Pressable
                  style={styles.sourceOption}
                  onPress={() => handleSelectSource("contract")}
                >
                  <View style={[styles.sourceOptionIcon, { backgroundColor: "#5856D620" }]}>
                    <Ionicons name="document-lock-outline" size={24} color="#5856D6" />
                  </View>
                  <View style={styles.sourceOptionContent}>
                    <Text style={styles.sourceOptionTitle}>From Contract</Text>
                    <Text style={styles.sourceOptionSubtitle}>
                      {availableContracts.length} signed contract{availableContracts.length !== 1 ? "s" : ""} available
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                </Pressable>

                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setShowSourcePicker(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Contract Picker Modal */}
        <Modal
          visible={showContractPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowContractPicker(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowContractPicker(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.quotePickerModal}>
                <Text style={styles.modalTitle}>Select Contract to Invoice</Text>
                <Text style={styles.modalSubtitle}>
                  Choose a signed contract
                </Text>

                <ScrollView style={styles.quoteList} nestedScrollEnabled>
                  {availableContracts.map((contract) => (
                    <Pressable
                      key={contract.id}
                      style={styles.quoteOption}
                      onPress={() => handleSelectContract(contract)}
                    >
                      <View style={styles.quoteOptionContent}>
                        <Text style={styles.quoteOptionTitle}>{contract.projectName}</Text>
                        <Text style={styles.quoteOptionSubtitle}>
                          {contract.clientName} • ${contract.total.toFixed(2)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                    </Pressable>
                  ))}
                </ScrollView>

                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setShowContractPicker(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </GradientBackground>
    </GestureHandlerRootView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  color,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    topBar: {
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      backgroundColor: theme.colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterScrollView: {
      flexGrow: 0,
      flexShrink: 0,
    },
    filterContainer: {
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      gap: theme.spacing(1),
    },
    filterChip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(0.75),
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    filterChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    filterChipTextActive: {
      color: "#000",
    },
    listContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(10),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing(4),
      marginTop: theme.spacing(8),
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
      lineHeight: 20,
      maxWidth: 300,
    },
    lockedContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing(4),
    },
    lockedTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
    },
    lockedDescription: {
      fontSize: 15,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 320,
      marginBottom: theme.spacing(3),
    },
    upgradeButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    upgradeButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContainer: {
      width: "100%",
      paddingHorizontal: theme.spacing(3),
      justifyContent: "center",
      alignItems: "center",
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
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    modalSubtitle: {
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
    quotePickerModal: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      width: "100%",
      maxWidth: 400,
      maxHeight: 500,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quoteList: {
      maxHeight: 300,
      marginBottom: theme.spacing(2),
    },
    quoteOption: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    quoteOptionContent: {
      flex: 1,
    },
    quoteOptionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    quoteOptionSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    cancelButton: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    sourcePickerModal: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      width: "100%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sourceOption: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
    },
    sourceOptionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.accent + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    sourceOptionContent: {
      flex: 1,
    },
    sourceOptionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    sourceOptionSubtitle: {
      fontSize: 13,
      color: theme.colors.muted,
    },
  });
}
