// hooks/useInvoiceList.ts
// Extracted hook for invoice list state and operations

import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
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
import { listQuotes, type Quote } from "@/lib/quotes";
import type { Contract, InvoiceStatus } from "@/lib/types";
import { generateAndShareInvoicePDF, type PDFOptions } from "@/lib/pdf";
import { loadPreferences } from "@/lib/preferences";
import { canAccessAssemblies } from "@/lib/features";
import { getUserState } from "@/lib/user";
import { getCompanyLogo } from "@/lib/logo";

export function useInvoiceList() {
  const router = useRouter();
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();

  // State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | "all">("all");
  const [isPro, setIsPro] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [deletedInvoice, setDeletedInvoice] = useState<Invoice | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [editingStatusForInvoice, setEditingStatusForInvoice] = useState<Invoice | null>(null);
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [showContractPicker, setShowContractPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [availableQuotes, setAvailableQuotes] = useState<Quote[]>([]);
  const [availableContracts, setAvailableContracts] = useState<Contract[]>([]);

  // Multi-select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load data
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
          (c) => c.status === "signed"
        );
        setAvailableContracts(signedContracts);
      }
    }
  }, []);

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Sign in handler
  const handleSignIn = useCallback(() => {
    router.push("/(auth)/sign-in" as any);
  }, [router]);

  // Delete handler with undo support
  const handleDeleteInvoice = useCallback(async (invoice: Invoice) => {
    setDeletedInvoice(invoice);
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
    await deleteInvoice(invoice.id);
    setShowUndo(true);
  }, []);

  // Undo delete handler
  const handleUndoDelete = useCallback(async () => {
    if (deletedInvoice) {
      await saveInvoice(deletedInvoice);
      await load();
      setDeletedInvoice(null);
      setShowUndo(false);
    }
  }, [deletedInvoice, load]);

  // Dismiss undo handler
  const handleDismissUndo = useCallback(() => {
    setDeletedInvoice(null);
    setShowUndo(false);
  }, []);

  // Export PDF handler
  const handleExportInvoice = useCallback(async (invoice: Invoice) => {
    try {
      const prefs = await loadPreferences();
      const user = await getUserState();
      const userIsPro = canAccessAssemblies(user);

      let logoBase64: string | undefined;
      try {
        const logo = await getCompanyLogo();
        if (logo?.base64) {
          logoBase64 = logo.base64.replace(/^data:image\/\w+;base64,/, "");
        }
      } catch {
        // Logo loading failed, continue without it
      }

      const pdfOptions: PDFOptions = {
        includeBranding: !userIsPro,
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

  // Status update handlers
  const handleUpdateStatus = useCallback((invoice: Invoice) => {
    setEditingStatusForInvoice(invoice);
  }, []);

  const handleSaveStatus = useCallback(
    async (newStatus: InvoiceStatus) => {
      if (!editingStatusForInvoice) return;
      try {
        await updateInvoice(editingStatusForInvoice.id, { status: newStatus });
        await load();
        setEditingStatusForInvoice(null);
      } catch {
        Alert.alert("Error", "Failed to update status");
      }
    },
    [editingStatusForInvoice, load]
  );

  const handleCloseStatusModal = useCallback(() => {
    setEditingStatusForInvoice(null);
  }, []);

  // View handler
  const handleViewInvoice = useCallback(
    (invoice: Invoice) => {
      router.push(`/invoice/${invoice.id}` as any);
    },
    [router]
  );

  // Copy handler
  const handleCopyInvoice = useCallback(
    async (invoice: Invoice) => {
      try {
        const now = new Date().toISOString();
        const newInvoice: Invoice = {
          ...invoice,
          id: `inv_${Date.now()}`,
          invoiceNumber: `${invoice.invoiceNumber}-COPY`,
          createdAt: now,
          updatedAt: now,
        };

        await saveInvoice(newInvoice);
        await load();
        Alert.alert("Success", "Invoice copied successfully");
      } catch {
        Alert.alert("Error", "Failed to copy invoice");
      }
    },
    [load]
  );

  // Quote selection handler
  const handleSelectQuote = useCallback(
    async (quote: Quote) => {
      try {
        setShowQuotePicker(false);
        const newInvoice = await createInvoiceFromQuote(quote.id);
        await load();
        router.push(`/invoice/${newInvoice.id}` as any);
      } catch {
        Alert.alert("Error", "Failed to create invoice");
      }
    },
    [load, router]
  );

  // Contract selection handler
  const handleSelectContract = useCallback(
    async (contract: Contract) => {
      try {
        setShowContractPicker(false);
        const newInvoice = await createInvoiceFromContract(contract.id);
        await load();
        router.push(`/invoice/${newInvoice.id}` as any);
      } catch {
        Alert.alert("Error", "Failed to create invoice from contract");
      }
    },
    [load, router]
  );

  // Source selection handler
  const handleSelectSource = useCallback((source: "quote" | "contract") => {
    setShowSourcePicker(false);
    if (source === "quote") {
      setShowQuotePicker(true);
    } else {
      setShowContractPicker(true);
    }
  }, []);

  // Picker close handlers
  const handleCloseQuotePicker = useCallback(() => {
    setShowQuotePicker(false);
  }, []);

  const handleCloseContractPicker = useCallback(() => {
    setShowContractPicker(false);
  }, []);

  const handleCloseSourcePicker = useCallback(() => {
    setShowSourcePicker(false);
  }, []);

  // Create new invoice handler
  const handleCreateInvoice = useCallback(() => {
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
  }, [isPremium, availableContracts.length, availableQuotes.length]);

  // Multi-select handlers
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectInvoice = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const enterSelectMode = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    Alert.alert(
      "Delete Invoices",
      `Are you sure you want to delete ${selectedIds.size} invoice${selectedIds.size === 1 ? "" : "s"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            for (const id of selectedIds) {
              await deleteInvoice(id);
            }
            setSelectedIds(new Set());
            setSelectMode(false);
            await load();
          },
        },
      ]
    );
  }, [selectedIds, load]);

  const handleBulkUpdateStatus = useCallback(async () => {
    if (selectedIds.size === 0) return;

    Alert.alert(
      `Set Status`,
      `Set status for ${selectedIds.size} invoice${selectedIds.size === 1 ? "" : "s"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unpaid",
          onPress: async () => {
            for (const id of selectedIds) {
              await updateInvoice(id, { status: "unpaid" });
            }
            setSelectedIds(new Set());
            setSelectMode(false);
            await load();
          },
        },
        {
          text: "Paid",
          onPress: async () => {
            for (const id of selectedIds) {
              await updateInvoice(id, { status: "paid" });
            }
            setSelectedIds(new Set());
            setSelectMode(false);
            await load();
          },
        },
      ]
    );
  }, [selectedIds, load]);

  // Filtered invoices
  const filteredInvoices = (() => {
    let filtered = invoices;

    if (selectedStatus !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(query) ||
          invoice.name.toLowerCase().includes(query) ||
          invoice.clientName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  })();

  return {
    // State
    invoices,
    filteredInvoices,
    refreshing,
    searchQuery,
    selectedStatus,
    isPro,
    isPremium,
    deletedInvoice,
    showUndo,
    editingStatusForInvoice,
    showQuotePicker,
    showContractPicker,
    showSourcePicker,
    availableQuotes,
    availableContracts,
    selectMode,
    selectedIds,

    // Setters
    setSearchQuery,
    setSelectedStatus,

    // Handlers
    onRefresh,
    handleSignIn,
    handleDeleteInvoice,
    handleUndoDelete,
    handleDismissUndo,
    handleExportInvoice,
    handleUpdateStatus,
    handleSaveStatus,
    handleCloseStatusModal,
    handleViewInvoice,
    handleCopyInvoice,
    handleSelectQuote,
    handleSelectContract,
    handleSelectSource,
    handleCloseQuotePicker,
    handleCloseContractPicker,
    handleCloseSourcePicker,
    handleCreateInvoice,
    toggleSelectMode,
    toggleSelectInvoice,
    enterSelectMode,
    handleBulkDelete,
    handleBulkUpdateStatus,
  };
}
