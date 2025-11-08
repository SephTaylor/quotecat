// app/(main)/(tabs)/invoices.tsx
// Invoices list - Pro feature
import { useTheme } from "@/contexts/ThemeContext";
import {
  deleteInvoice,
  listInvoices,
  saveInvoice,
  updateInvoice,
  type Invoice,
} from "@/lib/invoices";
import { generateAndShareInvoicePDF, type PDFOptions } from "@/lib/pdf";
import { loadPreferences } from "@/lib/preferences";
import { canAccessAssemblies } from "@/lib/features";
import { getUserState } from "@/lib/user";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import type { InvoiceStatus } from "@/lib/types";
import { InvoiceStatusMeta } from "@/lib/types";
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
  const filterScrollRef = React.useRef<ScrollView>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | "all">("all");
  const [isPro, setIsPro] = useState(false);
  const [deletedInvoice, setDeletedInvoice] = useState<Invoice | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [editingStatusForInvoice, setEditingStatusForInvoice] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    const user = await getUserState();
    const hasAccess = canAccessAssemblies(user);
    setIsPro(hasAccess);

    if (hasAccess) {
      const data = await listInvoices();
      setInvoices(data);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleUpgrade = () => {
    Alert.alert(
      "Pro Feature",
      "Invoices are a Pro feature. Sign in to access invoice management.",
      [{ text: "OK", style: "cancel" }],
    );
  };

  const handleDeleteInvoice = useCallback((invoice: Invoice) => {
    Alert.alert(
      "Delete Invoice",
      `Are you sure you want to delete invoice ${invoice.invoiceNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletedInvoice(invoice);
            setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
            setShowUndo(true);

            // Auto-dismiss undo after 5 seconds and permanently delete
            setTimeout(async () => {
              if (deletedInvoice?.id === invoice.id) {
                await deleteInvoice(invoice.id);
                setDeletedInvoice(null);
                setShowUndo(false);
              }
            }, 5000);
          },
        },
      ]
    );
  }, [deletedInvoice]);

  const handleUndoDelete = useCallback(async () => {
    if (deletedInvoice) {
      setInvoices((prev) => [...prev, deletedInvoice]);
      setDeletedInvoice(null);
      setShowUndo(false);
    }
  }, [deletedInvoice]);

  const handleExportInvoice = useCallback(async (invoice: Invoice) => {
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
      Alert.alert("Success!", "Invoice exported successfully");
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
    } catch (error) {
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
    } catch (error) {
      Alert.alert("Error", "Failed to copy invoice");
    }
  }, [load]);

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
            <Text style={styles.lockedTitle}>Pro Feature</Text>
            <Text style={styles.lockedDescription}>
              Invoice management is available with a Pro account. Create, track, and manage invoices from your quotes.
            </Text>
            <Pressable style={styles.upgradeButton} onPress={handleUpgrade}>
              <Text style={styles.upgradeButtonText}>Learn More</Text>
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
          onDismiss={() => {
            setShowUndo(false);
            setDeletedInvoice(null);
          }}
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
  });
}
