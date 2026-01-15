// modules/quotes/useQuoteForm.ts
// Hook for managing quote form state, calculations, and persistence

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Alert } from "react-native";
import {
  getQuoteById,
  updateQuote,
  deleteQuote,
  saveQuote,
} from "./storageSQLite";
import type { Quote } from "@/lib/types";
import { loadPreferences } from "@/lib/preferences";
import { parseMoney } from "@/modules/settings/money";
import type { QuoteStatus, QuoteItem } from "@/lib/types";
import { createSnapshot, calculateDiff, type QuoteSnapshot } from "@/modules/changeOrders";
import { getUserState } from "@/lib/user";
import { canAccessChangeOrders } from "@/lib/features";
import { RefreshEvents, REFRESH_QUOTES_LIST } from "@/lib/refreshEvents";
import { calculateQuoteTotals } from "@/lib/calculations";

export type QuoteFormState = {
  name: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  labor: string;
  materialEstimate: string;
  status: QuoteStatus;
  pinned: boolean;
  items: QuoteItem[];
  markupPercent: string;
  taxPercent: string;
  notes: string;
  followUpDate: string;
  tier: string;
};

export type QuoteCalculations = {
  materialsFromItems: number;
  materialsEstimateValue: number;
  laborValue: number;
  subtotal: number;
  markupAmount: number;
  taxAmount: number;
  total: number;
};

type UseQuoteFormOptions = {
  quoteId: string | undefined;
  onNavigateBack: () => void;
  onNavigateToQuotes?: () => void;
};

export function useQuoteForm({ quoteId, onNavigateBack, onNavigateToQuotes }: UseQuoteFormOptions) {
  // Use onNavigateToQuotes if provided, otherwise fall back to onNavigateBack
  const navigateToQuotes = onNavigateToQuotes || onNavigateBack;
  // Form state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [labor, setLabor] = useState("");
  const [materialEstimate, setMaterialEstimate] = useState("");
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [pinned, setPinned] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [markupPercent, setMarkupPercent] = useState("");
  const [taxPercent, setTaxPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [changeHistory, setChangeHistory] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [tier, setTier] = useState("");
  const [isNewQuote, setIsNewQuote] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Change order detection
  const originalSnapshotRef = useRef<QuoteSnapshot | null>(null);
  const [shouldTrackChanges, setShouldTrackChanges] = useState(false);

  // Calculate totals using centralized calculation function (single source of truth)
  const calculations = useMemo<QuoteCalculations>(() => {
    // Build a Quote-like object for the calculation function
    const quoteData = {
      items,
      materialEstimate: parseMoney(materialEstimate),
      labor: parseMoney(labor),
      markupPercent: parseFloat(markupPercent) || 0,
      taxPercent: parseFloat(taxPercent) || 0,
    };

    // Use centralized calculation - same formula as portal and storage
    const calc = calculateQuoteTotals(quoteData as any);

    return {
      materialsFromItems: calc.materialsFromItems,
      materialsEstimateValue: calc.materialEstimate,
      laborValue: calc.labor,
      subtotal: calc.subtotal,
      markupAmount: calc.markupAmount,
      taxAmount: calc.taxAmount,
      total: calc.total,
    };
  }, [items, materialEstimate, labor, markupPercent, taxPercent]);

  // Load quote data
  const load = useCallback(async () => {
    if (!quoteId) return;

    // For brand new quotes (ID = "new"), just load defaults
    if (quoteId === "new") {
      const prefs = await loadPreferences();
      const defaultTax = prefs.pricing?.defaultTaxPercent || 0;
      const defaultMarkup = prefs.pricing?.defaultMarkupPercent || 0;
      setTaxPercent(defaultTax > 0 ? defaultTax.toString() : "");
      setMarkupPercent(defaultMarkup > 0 ? defaultMarkup.toString() : "");
      setIsNewQuote(true);
      setIsLoaded(true);
      return;
    }

    const q = await getQuoteById(quoteId);
    if (q) {
      setQuote(q);
      setName(q.name || "");
      setClientName(q.clientName || "");
      setClientEmail(q.clientEmail || "");
      setClientPhone(q.clientPhone || "");
      setClientAddress(q.clientAddress || "");
      setLabor(q.labor && q.labor !== 0 ? q.labor.toFixed(2) : "");
      setMaterialEstimate(
        q.materialEstimate && q.materialEstimate !== 0
          ? q.materialEstimate.toFixed(2)
          : ""
      );
      setStatus(q.status || "draft");
      setPinned(q.pinned || false);
      setItems(q.items ?? []);
      setNotes(q.notes || "");
      setChangeHistory(q.changeHistory || "");
      setFollowUpDate(q.followUpDate || "");
      setTier(q.tier || "");

      // Check if this is a newly created empty quote
      const isDefaultName = !q.name || q.name === "Untitled";
      const isDefaultClient = !q.clientName || q.clientName === "Unnamed Client";
      const hasNoItems = !q.items || q.items.length === 0;
      const isNew = isDefaultName && isDefaultClient && q.labor === 0 && hasNoItems;
      setIsNewQuote(isNew);

      // For new quotes, apply default tax/markup from preferences
      if (isNew) {
        const prefs = await loadPreferences();
        const defaultTax = prefs.pricing?.defaultTaxPercent || 0;
        const defaultMarkup = prefs.pricing?.defaultMarkupPercent || 0;
        setTaxPercent(defaultTax > 0 ? defaultTax.toString() : "");
        setMarkupPercent(defaultMarkup > 0 ? defaultMarkup.toString() : "");
      } else {
        setMarkupPercent(
          q.markupPercent && q.markupPercent !== 0 ? q.markupPercent.toString() : ""
        );
        setTaxPercent(
          q.taxPercent && q.taxPercent !== 0 ? q.taxPercent.toString() : ""
        );
      }

      // For approved/completed quotes, take a snapshot for change order detection (Premium only)
      // Only create snapshot on FIRST load - don't overwrite when returning from materials screen
      const isAccepted = q.status === "approved" || q.status === "completed";
      const userState = await getUserState();
      const hasCOAccess = canAccessChangeOrders(userState);

      if (isAccepted && !isNew && hasCOAccess) {
        // Only create snapshot if we don't have one yet
        if (!originalSnapshotRef.current) {
          originalSnapshotRef.current = createSnapshot(q);
        }
        setShouldTrackChanges(true);
      } else {
        originalSnapshotRef.current = null;
        setShouldTrackChanges(false);
      }

      setIsLoaded(true);
    }
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  // Get current form data as an object
  const getFormData = useCallback(() => {
    return {
      name: name.trim() || "Untitled",
      clientName: clientName.trim() || "Unnamed Client",
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      labor: parseMoney(labor),
      materialEstimate: parseMoney(materialEstimate) || undefined,
      markupPercent: parseFloat(markupPercent) || undefined,
      taxPercent: parseFloat(taxPercent) || undefined,
      notes: notes.trim() || undefined,
      changeHistory: changeHistory.trim() || undefined,
      followUpDate: followUpDate || undefined,
      status,
      pinned,
      items,
    };
  }, [
    name,
    clientName,
    clientEmail,
    clientPhone,
    clientAddress,
    labor,
    materialEstimate,
    markupPercent,
    changeHistory,
    taxPercent,
    notes,
    followUpDate,
    status,
    pinned,
    items,
  ]);

  // Save quote
  const handleSave = useCallback(async () => {
    if (!quoteId) return;
    await updateQuote(quoteId, getFormData());
    RefreshEvents.emit(REFRESH_QUOTES_LIST);
    Alert.alert("Saved", "Quote saved successfully.", [{ text: "OK" }]);
  }, [quoteId, getFormData]);

  // Save without alert (for auto-save scenarios)
  const saveQuietly = useCallback(async () => {
    if (!quoteId) return;
    await updateQuote(quoteId, getFormData());
  }, [quoteId, getFormData]);

  // Handle navigation back (with auto-save or delete if required fields missing)
  const handleGoBack = useCallback(async () => {
    if (!quoteId) {
      onNavigateBack();
      return;
    }

    // Check current form state for required fields
    const formNameEmpty = !name.trim() || name.trim() === "Untitled";
    const formClientEmpty = !clientName.trim() || clientName.trim() === "Unnamed Client";
    // Check if user has entered ANY data (for "lose data" warning)
    const formHasData =
      name.trim() ||
      clientName.trim() ||
      clientEmail.trim() ||
      clientPhone.trim() ||
      clientAddress.trim() ||
      labor.trim() ||
      materialEstimate.trim() ||
      markupPercent.trim() ||
      taxPercent.trim() ||
      notes.trim() ||
      followUpDate.trim() ||
      tier.trim() ||
      items.length > 0;

    // If ID is "new", quote was never created in storage
    if (quoteId === "new") {
      // No data entered - just go back
      if (!formHasData) {
        onNavigateBack();
        return;
      }
      // Has required fields - create and save the quote
      if (!formNameEmpty && !formClientEmpty) {
        const realId = `quote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const now = new Date().toISOString();
        await saveQuote({
          ...getFormData(),
          id: realId,
          currency: "USD",
          createdAt: now,
          updatedAt: now,
        });
        RefreshEvents.emit(REFRESH_QUOTES_LIST);
        // Navigate to quotes list to show the new quote
        navigateToQuotes();
        return;
      }
      // Has some data but missing required fields - warn user
      Alert.alert(
        "Required Fields Missing",
        "Job name and client name are required. Your changes will be lost if you go back.",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => onNavigateBack(),
          },
        ]
      );
      return;
    }

    // For existing quotes (not "new"), fetch fresh data
    const storedQuote = await getQuoteById(quoteId);

    // Check if stored quote is essentially empty (new/untitled)
    const storedNameEmpty = !storedQuote?.name || storedQuote.name === "Untitled";
    const storedClientEmpty = !storedQuote?.clientName || storedQuote.clientName === "Unnamed Client";
    const storedHasNoItems = !storedQuote?.items || storedQuote.items.length === 0;
    const storedHasNoLabor = !storedQuote?.labor || storedQuote.labor === 0;
    const storedIsNew = storedNameEmpty && storedClientEmpty && storedHasNoLabor && storedHasNoItems;

    // Case 1: Stored is new, form is completely empty - silently delete
    if (storedIsNew && !formHasData) {
      try {
        await deleteQuote(quoteId);
      } catch {
        // Quote may not exist yet (race condition) - that's fine
      }
      onNavigateBack();
      return;
    }

    // Case 2: Required fields filled - save and go back
    if (!formNameEmpty && !formClientEmpty) {
      await updateQuote(quoteId, getFormData());
      RefreshEvents.emit(REFRESH_QUOTES_LIST);
      onNavigateBack();
      return;
    }

    // Case 3: Has some data but missing required fields - warn user
    if (storedIsNew && formHasData && (formNameEmpty || formClientEmpty)) {
      Alert.alert(
        "Required Fields Missing",
        "Job name and client name are required. Your changes will be lost if you go back.",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteQuote(quoteId);
              } catch {
                // Quote may not exist - that's fine
              }
              onNavigateBack();
            },
          },
        ]
      );
      return;
    }

    // Case 4: Existing quote - save what we have
    await updateQuote(quoteId, getFormData());
    RefreshEvents.emit(REFRESH_QUOTES_LIST);
    onNavigateBack();
  }, [
    quoteId,
    name,
    clientName,
    clientEmail,
    clientPhone,
    clientAddress,
    labor,
    materialEstimate,
    markupPercent,
    taxPercent,
    notes,
    followUpDate,
    tier,
    items,
    getFormData,
    onNavigateBack,
  ]);

  // Validate required fields
  const validateRequiredFields = useCallback((): boolean => {
    if (!name.trim()) {
      Alert.alert("Required Field", "Please enter a project name.");
      return false;
    }
    if (!clientName.trim()) {
      Alert.alert("Required Field", "Please enter a client name.");
      return false;
    }
    return true;
  }, [name, clientName]);

  // Update items
  const updateItems = useCallback(
    async (newItems: QuoteItem[]) => {
      setItems(newItems);
      if (quoteId) {
        await updateQuote(quoteId, { items: newItems });
      }
    },
    [quoteId]
  );

  // Ensure quote exists in storage (for navigation to materials screen)
  // Returns the actual quote ID (may differ from quoteId if it was "new")
  const ensureQuoteExists = useCallback(async (): Promise<string | null> => {
    if (!quoteId) return null;

    const existing = await getQuoteById(quoteId);
    const quoteData = getFormData();

    if (existing) {
      await updateQuote(quoteId, quoteData);
      return quoteId;
    } else {
      // Generate a proper ID if quoteId is "new" or invalid
      const realId = quoteId === "new"
        ? `quote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        : quoteId;
      const now = new Date().toISOString();
      await saveQuote({
        ...quoteData,
        id: realId,
        currency: "USD",
        createdAt: now,
        updatedAt: now,
      });
      return realId;
    }
  }, [quoteId, getFormData]);

  // Check for material changes (for change order detection)
  const checkForChanges = useCallback(() => {
    if (!shouldTrackChanges || !originalSnapshotRef.current || !quote) {
      return null;
    }

    // Build current quote state
    const currentQuote: Quote = {
      ...quote,
      ...getFormData(),
    };

    const diff = calculateDiff(originalSnapshotRef.current, currentQuote);
    return diff.hasMaterialChanges ? diff : null;
  }, [shouldTrackChanges, quote, getFormData]);

  // Reset snapshot after CO is created
  const resetSnapshot = useCallback(() => {
    if (quote) {
      originalSnapshotRef.current = createSnapshot({
        ...quote,
        ...getFormData(),
      } as Quote);
    }
  }, [quote, getFormData]);

  // Get IDs of items that are new (not in original snapshot)
  const getNewItemIds = useCallback((): Set<string> => {
    if (!shouldTrackChanges || !originalSnapshotRef.current) {
      return new Set();
    }

    // Build set of original item IDs
    const originalIds = new Set<string>();
    originalSnapshotRef.current.items.forEach((item) => {
      const key = item.productId || `manual:${item.name}`;
      originalIds.add(key);
    });

    // Find items not in original
    const newIds = new Set<string>();
    items.forEach((item) => {
      const key = item.productId || `manual:${item.name}`;
      if (!originalIds.has(key)) {
        newIds.add(item.id || key);
      }
    });

    return newIds;
  }, [shouldTrackChanges, items]);

  // Input formatters
  const formatLaborInput = (text: string): string => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    if (parts.length === 2 && parts[1].length > 2) {
      return parts[0] + "." + parts[1].slice(0, 2);
    }
    return cleaned;
  };

  const formatMoneyOnBlur = (value: string): string => {
    if (!value || value === "") return "";
    if (!value.includes(".")) return value + ".00";
    const parts = value.split(".");
    if (parts[1].length === 1) return value + "0";
    return value;
  };

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    const limited = digits.slice(0, 10);
    if (limited.length === 0) return "";
    if (limited.length <= 3) return `(${limited}`;
    if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  };

  const formatPercentInput = (text: string): string => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    return cleaned;
  };

  return {
    // State
    quote,
    isLoaded,
    isNewQuote,
    setIsNewQuote,

    // Form fields
    name,
    setName,
    clientName,
    setClientName,
    clientEmail,
    setClientEmail,
    clientPhone,
    setClientPhone,
    clientAddress,
    setClientAddress,
    labor,
    setLabor,
    materialEstimate,
    setMaterialEstimate,
    status,
    setStatus,
    pinned,
    setPinned,
    items,
    setItems,
    markupPercent,
    setMarkupPercent,
    taxPercent,
    setTaxPercent,
    notes,
    setNotes,
    changeHistory,
    setChangeHistory,
    followUpDate,
    setFollowUpDate,
    tier,
    setTier,

    // Calculated values
    calculations,

    // Actions
    load,
    handleSave,
    saveQuietly,
    handleGoBack,
    validateRequiredFields,
    updateItems,
    ensureQuoteExists,
    getFormData,

    // Change order detection
    shouldTrackChanges,
    checkForChanges,
    resetSnapshot,
    getNewItemIds,

    // Formatters
    formatLaborInput,
    formatMoneyOnBlur,
    formatPhoneNumber,
    formatPercentInput,
  };
}
