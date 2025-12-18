// modules/quotes/useQuoteForm.ts
// Hook for managing quote form state, calculations, and persistence

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import {
  getQuoteById,
  updateQuote,
  deleteQuote,
  saveQuote,
  type Quote,
} from "@/lib/quotes";
import { loadPreferences } from "@/lib/preferences";
import { parseMoney } from "@/modules/settings/money";
import type { QuoteStatus, QuoteItem } from "@/lib/types";

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
};

export function useQuoteForm({ quoteId, onNavigateBack }: UseQuoteFormOptions) {
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
  const [followUpDate, setFollowUpDate] = useState("");
  const [tier, setTier] = useState("");
  const [isNewQuote, setIsNewQuote] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Calculate totals
  const calculations = useMemo<QuoteCalculations>(() => {
    const materialsFromItems = items.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0
    );
    const materialsEstimateValue = parseMoney(materialEstimate);
    const laborValue = parseMoney(labor);
    const markupPercentValue = parseFloat(markupPercent) || 0;
    const taxPercentValue = parseFloat(taxPercent) || 0;

    const subtotal = materialsFromItems + materialsEstimateValue + laborValue;
    const markupAmount = (subtotal * markupPercentValue) / 100;
    const subtotalWithMarkup = subtotal + markupAmount;
    const taxAmount = (subtotalWithMarkup * taxPercentValue) / 100;
    const total = subtotalWithMarkup + taxAmount;

    return {
      materialsFromItems,
      materialsEstimateValue,
      laborValue,
      subtotal,
      markupAmount,
      taxAmount,
      total,
    };
  }, [items, materialEstimate, labor, markupPercent, taxPercent]);

  // Load quote data
  const load = useCallback(async () => {
    if (!quoteId) return;
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
    Alert.alert("Saved", "Quote saved successfully.", [{ text: "OK" }]);
  }, [quoteId, getFormData]);

  // Save without alert (for auto-save scenarios)
  const saveQuietly = useCallback(async () => {
    if (!quoteId) return;
    await updateQuote(quoteId, getFormData());
  }, [quoteId, getFormData]);

  // Handle navigation back (with auto-save or delete if empty)
  const handleGoBack = useCallback(async () => {
    const isNameEmpty = !name.trim() || name.trim() === "Untitled";
    const isClientEmpty = !clientName.trim() || clientName.trim() === "Unnamed Client";

    if (isNewQuote && isNameEmpty && isClientEmpty && !labor.trim() && items.length === 0) {
      // Delete empty new quote
      if (quoteId) {
        await deleteQuote(quoteId);
      }
    } else if (quoteId) {
      // Save changes before going back
      await updateQuote(quoteId, getFormData());
    }
    onNavigateBack();
  }, [
    quoteId,
    name,
    clientName,
    labor,
    items,
    isNewQuote,
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
  const ensureQuoteExists = useCallback(async () => {
    if (!quoteId) return;

    const existing = await getQuoteById(quoteId);
    const quoteData = getFormData();

    if (existing) {
      await updateQuote(quoteId, quoteData);
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
    }
  }, [quoteId, getFormData]);

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

    // Formatters
    formatLaborInput,
    formatMoneyOnBlur,
    formatPhoneNumber,
    formatPercentInput,
  };
}
