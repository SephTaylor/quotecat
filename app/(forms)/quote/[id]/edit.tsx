// app/(forms)/quote/[id]/edit.tsx
import { useTheme } from "@/contexts/ThemeContext";
import {
  getQuoteById,
  updateQuote,
  deleteQuote,
  saveQuote,
  type Quote,
} from "@/lib/quotes";
import { getClients, type Client } from "@/lib/clients";
import { getUserState } from "@/lib/user";
import { canAccessAssemblies } from "@/lib/features";
import { loadPreferences } from "@/lib/preferences";
import { FormInput, FormScreen } from "@/modules/core/ui";
import { parseMoney } from "@/modules/settings/money";
import { getItemId } from "@/lib/validation";
import type { QuoteStatus, QuoteItem } from "@/lib/types";
import { QuoteStatusMeta } from "@/lib/types";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SwipeableMaterialItem } from "@/components/SwipeableMaterialItem";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { HeaderIconButton } from "@/components/HeaderIconButton";

/**
 * Format phone number as (xxx) xxx-xxxx
 */
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");

  // Limit to 10 digits
  const limited = digits.slice(0, 10);

  // Format based on length
  if (limited.length === 0) return "";
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

export default function EditQuote() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const [, setQuote] = useState<Quote | null>(null);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [labor, setLabor] = useState<string>(""); // empty string to show placeholder
  const [materialEstimate, setMaterialEstimate] = useState<string>(""); // Quick estimate for materials
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [pinned, setPinned] = useState(false);
  const [isNewQuote, setIsNewQuote] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [markupPercent, setMarkupPercent] = useState<string>(""); // Markup percentage
  const [taxPercent, setTaxPercent] = useState<string>(""); // Tax percentage
  const [notes, setNotes] = useState<string>(""); // Notes / additional details
  const [followUpDate, setFollowUpDate] = useState<string>(""); // Follow-up date
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState<string>("");

  // Client picker state
  const [isPro, setIsPro] = useState(false);
  const [savedClients, setSavedClients] = useState<Client[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientPickerSearch, setClientPickerSearch] = useState("");

  // Undo functionality for material deletion
  const [showUndoSnackbar, setShowUndoSnackbar] = useState(false);
  const [deletedItem, setDeletedItem] = useState<QuoteItem | null>(null);
  const [deletedItemIndex, setDeletedItemIndex] = useState<number>(-1);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Calculate quote totals
  const calculations = React.useMemo(() => {
    const materialsFromItems = items.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0
    );
    const materialsEstimateValue = parseMoney(materialEstimate);
    const laborValue = parseMoney(labor);
    const markupPercentValue = parseFloat(markupPercent) || 0;
    const taxPercentValue = parseFloat(taxPercent) || 0;

    // Subtotal before markup
    const subtotal = materialsFromItems + materialsEstimateValue + laborValue;

    // Calculate markup
    const markupAmount = (subtotal * markupPercentValue) / 100;

    // Subtotal with markup (before tax)
    const subtotalWithMarkup = subtotal + markupAmount;

    // Calculate tax
    const taxAmount = (subtotalWithMarkup * taxPercentValue) / 100;

    // Final total
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

  const load = useCallback(async () => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (q) {
      setQuote(q);
      setName(q.name || "");
      setClientName(q.clientName || "");
      setClientEmail(q.clientEmail || "");
      setClientPhone(q.clientPhone || "");
      setClientAddress(q.clientAddress || "");
      // Only set labor if it's non-zero, otherwise leave empty to show placeholder
      setLabor(q.labor && q.labor !== 0 ? q.labor.toFixed(2) : "");
      // Load material estimate if present
      setMaterialEstimate(q.materialEstimate && q.materialEstimate !== 0 ? q.materialEstimate.toFixed(2) : "");
      setStatus(q.status || "draft");
      setPinned(q.pinned || false);
      setItems(q.items ?? []);
      setNotes(q.notes || "");
      setFollowUpDate(q.followUpDate || "");

      // Check if this is a newly created empty quote
      // Consider it "new" if name is empty or just "Untitled", client is empty or "Unnamed Client",
      // labor is 0, and there are no items
      const isDefaultName = !q.name || q.name === "Untitled";
      const isDefaultClient = !q.clientName || q.clientName === "Unnamed Client";
      const hasNoItems = !q.items || q.items.length === 0;
      const isNew = isDefaultName && isDefaultClient && q.labor === 0 && hasNoItems;
      setIsNewQuote(isNew);

      // For new quotes, apply default tax/markup from preferences if not already set
      if (isNew) {
        const prefs = await loadPreferences();
        const defaultTax = prefs.pricing?.defaultTaxPercent || 0;
        const defaultMarkup = prefs.pricing?.defaultMarkupPercent || 0;
        setTaxPercent(defaultTax > 0 ? defaultTax.toString() : "");
        setMarkupPercent(defaultMarkup > 0 ? defaultMarkup.toString() : "");
      } else {
        // For existing quotes, use saved values
        setMarkupPercent(q.markupPercent && q.markupPercent !== 0 ? q.markupPercent.toString() : "");
        setTaxPercent(q.taxPercent && q.taxPercent !== 0 ? q.taxPercent.toString() : "");
      }
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Load Pro status and saved clients
  useEffect(() => {
    const loadProAndClients = async () => {
      const user = await getUserState();
      const proStatus = canAccessAssemblies(user);
      setIsPro(proStatus);
      if (proStatus) {
        const clients = await getClients();
        setSavedClients(clients);
      }
    };
    loadProAndClients();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  // Filter saved clients based on current input (for autocomplete)
  const filteredClients = React.useMemo(() => {
    if (!clientName.trim() || !isPro || savedClients.length === 0) return [];
    const query = clientName.toLowerCase();
    return savedClients.filter(
      (c) =>
        c.name.toLowerCase().includes(query) &&
        c.name.toLowerCase() !== query // Don't show if exact match
    ).slice(0, 5); // Limit to 5 suggestions
  }, [clientName, isPro, savedClients]);

  // Filter saved clients for picker modal
  const pickerFilteredClients = React.useMemo(() => {
    if (!clientPickerSearch.trim()) return savedClients;
    const query = clientPickerSearch.toLowerCase();
    return savedClients.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
    );
  }, [clientPickerSearch, savedClients]);

  // Handle selecting a client from suggestions or picker
  const handleSelectClient = (client: Client) => {
    setClientName(client.name);
    setClientEmail(client.email || "");
    setClientPhone(client.phone || "");
    setClientAddress(client.address || "");
    setShowClientSuggestions(false);
    setShowClientPicker(false);
    setClientPickerSearch("");
    setIsNewQuote(false);
  };

  const validateRequiredFields = (): boolean => {
    if (!name.trim()) {
      Alert.alert("Required Field", "Please enter a project name.");
      return false;
    }

    if (!clientName.trim()) {
      Alert.alert("Required Field", "Please enter a client name.");
      return false;
    }

    return true;
  };

  const handleGoBack = async () => {
    // If this is a new quote that hasn't been modified, delete it
    // Check all fields including items to determine if the quote is truly empty
    const isNameEmpty = !name.trim() || name.trim() === "Untitled";
    const isClientEmpty = !clientName.trim() || clientName.trim() === "Unnamed Client";
    if (isNewQuote && isNameEmpty && isClientEmpty && !labor.trim() && items.length === 0) {
      if (id) {
        await deleteQuote(id);
      }
    } else if (id) {
      // Save any changes before going back
      await updateQuote(id, {
        name: name.trim() || "Untitled",
        clientName: clientName.trim() || "Unnamed Client",
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        labor: parseMoney(labor),
        materialEstimate: parseMoney(materialEstimate),
        markupPercent: parseFloat(markupPercent) || 0,
        taxPercent: parseFloat(taxPercent) || 0,
        notes: notes.trim() || undefined,
        followUpDate: followUpDate || undefined,
        status,
        pinned,
        items,
      });
    }
    router.back();
  };


  const handleUpdateItemQty = async (itemId: string, delta: number) => {
    if (!id) return;

    const updatedItems = items.map((item) => {
      const currentId = getItemId(item);
      if (currentId === itemId) {
        const newQty = Math.max(0, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }).filter((item) => item.qty > 0); // Remove items with 0 quantity

    setItems(updatedItems);

    // Save to storage
    await updateQuote(id, { items: updatedItems });
  };

  const handleStartEditingQty = (itemId: string, currentQty: number) => {
    setEditingItemId(itemId);
    setEditingQty(""); // Start with empty input so user doesn't have to clear
  };

  const handleQtyChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    setEditingQty(cleaned);
  };

  const handleFinishEditingQty = async (itemId: string) => {
    if (!id) return;

    const newQty = parseInt(editingQty, 10);

    // Only update if valid number was entered and it's greater than 0
    if (!isNaN(newQty) && newQty > 0) {
      const updatedItems = items.map((item) => {
        const currentId = getItemId(item);
        if (currentId === itemId) {
          return { ...item, qty: newQty };
        }
        return item;
      });
      setItems(updatedItems);
      await updateQuote(id, { items: updatedItems });
    } else if (!isNaN(newQty) && newQty === 0) {
      // Only delete if explicitly set to 0
      const updatedItems = items.filter((item) => {
        const currentId = getItemId(item);
        return currentId !== itemId;
      });
      setItems(updatedItems);
      await updateQuote(id, { items: updatedItems });
    }
    // If invalid/empty (isNaN), do nothing - keep original value

    setEditingItemId(null);
    setEditingQty("");
  };

  // Handle material deletion with undo functionality
  const handleDeleteItem = async (itemId: string) => {
    if (!id) return;

    const itemIndex = items.findIndex((item) => getItemId(item) === itemId);
    if (itemIndex === -1) return;

    const itemToDelete = items[itemIndex];
    setDeletedItem(itemToDelete);
    setDeletedItemIndex(itemIndex);

    const updatedItems = items.filter((item) => getItemId(item) !== itemId);
    setItems(updatedItems);
    await updateQuote(id, { items: updatedItems });

    setShowUndoSnackbar(true);
  };

  // Handle undo of material deletion
  const handleUndoDelete = async () => {
    if (!id || !deletedItem || deletedItemIndex === -1) return;

    const restoredItems = [...items];
    restoredItems.splice(deletedItemIndex, 0, deletedItem);
    setItems(restoredItems);
    await updateQuote(id, { items: restoredItems });

    setDeletedItem(null);
    setDeletedItemIndex(-1);
    setShowUndoSnackbar(false);
  };

  // Handle dismissal of undo snackbar
  const handleDismissUndo = () => {
    setShowUndoSnackbar(false);
    setDeletedItem(null);
    setDeletedItemIndex(-1);
  };

  const formatLaborInput = (text: string) => {
    // Remove non-numeric characters except decimal point
    const cleaned = text.replace(/[^0-9.]/g, "");

    // Ensure only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }

    // Limit decimal places to 2
    if (parts.length === 2 && parts[1].length > 2) {
      return parts[0] + "." + parts[1].slice(0, 2);
    }

    return cleaned;
  };

  const formatMoneyOnBlur = (value: string): string => {
    if (!value || value === "") return "";

    // If there's no decimal point, add .00
    if (!value.includes(".")) {
      return value + ".00";
    }

    // If there's a decimal but only one digit after it, add a zero
    const parts = value.split(".");
    if (parts[1].length === 1) {
      return value + "0";
    }

    // Otherwise return as is (already has 2 decimal places)
    return value;
  };

  // Handle cleanup when navigating away
  useEffect(() => {
    return () => {
      // Only cleanup on unmount, not on every re-render
      // Check all fields including items to determine if the quote is truly empty
      const isNameEmpty = !name.trim() || name.trim() === "Untitled";
      const isClientEmpty = !clientName.trim() || clientName.trim() === "Unnamed Client";
      if (isNewQuote && isNameEmpty && isClientEmpty && !labor.trim() && items.length === 0) {
        if (id) {
          deleteQuote(id).catch(() => {
            // Silently handle error on cleanup
          });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on unmount

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerTintColor: theme.colors.accent,
          headerLeft: () => <HeaderBackButton onPress={handleGoBack} />,
          headerRight: () => <HeaderIconButton onPress={() => setPinned(!pinned)} icon={pinned ? "⭐" : "☆"} />,
          headerTitle: () => (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: theme.colors.text }}>
                Edit Quote
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.colors.accent, marginTop: 2 }}>
                Total: ${calculations.total.toFixed(2)}
              </Text>
            </View>
          ),
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
        }}
      />
      <FormScreen
        scroll
        contentStyle={{
          // FormScreen already provides default padding, no overrides needed
        }}
        bottomBar={
          <Pressable
            style={styles.reviewBtn}
            onPress={async () => {
              if (!id) return;

              // Validate required fields before proceeding
              if (!validateRequiredFields()) {
                return;
              }

              await updateQuote(id, {
                name: name.trim(),
                clientName: clientName.trim(),
                clientEmail: clientEmail.trim() || undefined,
                clientPhone: clientPhone.trim() || undefined,
                clientAddress: clientAddress.trim() || undefined,
                labor: parseMoney(labor),
                materialEstimate: parseMoney(materialEstimate),
                markupPercent: parseFloat(markupPercent) || 0,
                taxPercent: parseFloat(taxPercent) || 0,
                notes: notes.trim() || undefined,
                followUpDate: followUpDate || undefined,
                status,
                pinned,
                items,
              });
              router.push(`/quote/${id}/review`);
            }}
          >
            <Text style={styles.reviewText}>Review & Export</Text>
          </Pressable>
        }
      >
        <Text style={styles.label}>Status</Text>
        <View style={styles.statusChips}>
          {(Object.keys(QuoteStatusMeta) as QuoteStatus[]).map((s) => (
            <Pressable
              key={s}
              style={[
                styles.statusChip,
                status === s && styles.statusChipActive,
              ]}
              onPress={() => setStatus(s)}
            >
              <Text
                style={[
                  styles.statusChipText,
                  status === s && styles.statusChipTextActive,
                ]}
              >
                {QuoteStatusMeta[s].label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Project name *</Text>
        <FormInput
          placeholder="The job that pays the bills..."
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (text.trim()) setIsNewQuote(false);
          }}
        />

        <View style={{ height: theme.spacing(2) }} />

        <View style={styles.labelRow}>
          <Text style={styles.label}>Client name *</Text>
          {isPro && savedClients.length > 0 && (
            <Pressable
              onPress={() => setShowClientPicker(true)}
              hitSlop={8}
            >
              <Text style={styles.browseTag}>Browse</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.clientInputContainer}>
          <FormInput
            placeholder="Who's the lucky customer?"
            value={clientName}
            onChangeText={(text) => {
              setClientName(text);
              if (text.trim()) setIsNewQuote(false);
              setShowClientSuggestions(true);
            }}
            onFocus={() => {
              if (isPro && savedClients.length > 0) {
                setShowClientSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay hiding to allow tap on suggestion
              setTimeout(() => setShowClientSuggestions(false), 200);
            }}
            autoCapitalize="words"
          />
          {/* Client suggestions dropdown */}
          {showClientSuggestions && filteredClients.length > 0 && (
            <View style={styles.suggestionsDropdown}>
              {filteredClients.map((client) => (
                <Pressable
                  key={client.id}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectClient(client)}
                >
                  <Text style={styles.suggestionName}>{client.name}</Text>
                  {(client.email || client.phone) && (
                    <Text style={styles.suggestionDetail}>
                      {[client.email, client.phone].filter(Boolean).join(" · ")}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Client email</Text>
        <FormInput
          placeholder="client@example.com"
          value={clientEmail}
          onChangeText={setClientEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Client phone</Text>
        <FormInput
          placeholder="(555) 123-4567"
          value={clientPhone}
          onChangeText={(text) => setClientPhone(formatPhoneNumber(text))}
          keyboardType="phone-pad"
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Client address</Text>
        <FormInput
          placeholder="123 Main St, City, State ZIP"
          value={clientAddress}
          onChangeText={setClientAddress}
          multiline
          numberOfLines={2}
          style={{ height: 60, textAlignVertical: "top" }}
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.h2}>Items</Text>

        <View style={{ height: theme.spacing(2) }} />

        {items.length > 0 && (
          <>
            <GestureHandlerRootView style={styles.itemsList}>
              {items.map((item, index) => (
                <SwipeableMaterialItem
                  key={item.id}
                  item={{
                    id: getItemId(item),
                    name: item.name,
                    unitPrice: item.unitPrice,
                    qty: item.qty,
                  }}
                  onDelete={() => handleDeleteItem(getItemId(item))}
                  isLastItem={index === items.length - 1}
                  editingItemId={editingItemId}
                  editingQty={editingQty}
                  onStartEditingQty={handleStartEditingQty}
                  onFinishEditingQty={handleFinishEditingQty}
                  onQtyChange={handleQtyChange}
                  onUpdateQty={handleUpdateItemQty}
                />
              ))}
            </GestureHandlerRootView>
            <View style={{ height: theme.spacing(2) }} />
          </>
        )}

        <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
          <Pressable
            onPress={async () => {
              if (!id) return;

              // Check if quote exists, if not create it
              const existing = await getQuoteById(id);
              const quoteData = {
                name: name.trim() || "Untitled",
                clientName: clientName.trim() || "Unnamed Client",
                clientEmail: clientEmail.trim() || undefined,
                clientPhone: clientPhone.trim() || undefined,
                clientAddress: clientAddress.trim() || undefined,
                labor: parseMoney(labor),
                materialEstimate: parseMoney(materialEstimate),
                markupPercent: parseFloat(markupPercent) || 0,
                taxPercent: parseFloat(taxPercent) || 0,
                notes: notes.trim() || undefined,
                followUpDate: followUpDate || undefined,
                status,
                pinned,
                items,
              };

              if (existing) {
                // Update existing quote
                await updateQuote(id, quoteData);
              } else {
                // Create new quote with required fields
                const now = new Date().toISOString();
                await saveQuote({
                  ...quoteData,
                  id,
                  currency: "USD",
                  createdAt: now,
                  updatedAt: now,
                });
              }

              router.push(`/quote/${id}/materials`);
            }}
            style={({ pressed }) => ({
              flex: 1,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontWeight: "800", color: theme.colors.text }}>
              Add materials
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              if (!id) return;
              // Save current state before navigating
              await updateQuote(id, {
                name: name.trim() || "Untitled",
                clientName: clientName.trim(),
                clientEmail: clientEmail.trim() || undefined,
                clientPhone: clientPhone.trim() || undefined,
                clientAddress: clientAddress.trim() || undefined,
                labor: parseMoney(labor),
                materialEstimate: parseMoney(materialEstimate),
                markupPercent: parseFloat(markupPercent) || 0,
                taxPercent: parseFloat(taxPercent) || 0,
                notes: notes.trim() || undefined,
                followUpDate: followUpDate || undefined,
                status,
                pinned,
              });
              // Navigate to assembly library with quote context
              router.push(`/(main)/assemblies-browse?quoteId=${id}` as any);
            }}
            style={({ pressed }) => ({
              flex: 1,
              borderWidth: 1,
              borderColor: theme.colors.accent,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontWeight: "800", color: theme.colors.accent }}>
              Add from Assembly
            </Text>
          </Pressable>
        </View>

        <View style={{ height: theme.spacing(3) }} />

        <Text style={styles.label}>Labor</Text>
        <FormInput
          placeholder="0.00"
          value={labor}
          onChangeText={(text) => setLabor(formatLaborInput(text))}
          onBlur={() => setLabor(formatMoneyOnBlur(labor))}
          keyboardType="decimal-pad"
        />

        <View style={{ height: theme.spacing(3) }} />

        <Text style={styles.h2}>Notes & Adjustments</Text>

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Notes</Text>
        <FormInput
          placeholder="Special instructions, conditions, etc..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Follow-up Date</Text>
        <Pressable
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={followUpDate ? styles.datePickerText : styles.datePickerPlaceholder}>
            {followUpDate
              ? new Date(followUpDate).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Set a follow-up reminder"}
          </Text>
          {followUpDate && (
            <Pressable
              onPress={() => setFollowUpDate("")}
              hitSlop={8}
              style={styles.clearDateButton}
            >
              <Text style={styles.clearDateText}>Clear</Text>
            </Pressable>
          )}
        </Pressable>

        {/* Date Picker - iOS */}
        {Platform.OS === "ios" && showDatePicker && (
          <Modal transparent animationType="fade" visible={showDatePicker}>
            <Pressable
              style={styles.datePickerOverlay}
              onPress={() => setShowDatePicker(false)}
            >
              <View style={styles.datePickerModal}>
                <View style={styles.datePickerHeader}>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.datePickerTitle}>Follow-up Date</Text>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerDone}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={followUpDate ? new Date(followUpDate) : new Date()}
                  mode="date"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    if (date) setFollowUpDate(date.toISOString());
                  }}
                  textColor={theme.colors.text}
                />
              </View>
            </Pressable>
          </Modal>
        )}

        {/* Date Picker - Android */}
        {Platform.OS === "android" && showDatePicker && (
          <DateTimePicker
            value={followUpDate ? new Date(followUpDate) : new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (event.type === "set" && date) {
                setFollowUpDate(date.toISOString());
              }
            }}
          />
        )}

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Materials (Quick Estimate)</Text>
        <FormInput
          placeholder="0.00"
          value={materialEstimate}
          onChangeText={(text) => setMaterialEstimate(formatLaborInput(text))}
          onBlur={() => setMaterialEstimate(formatMoneyOnBlur(materialEstimate))}
          keyboardType="decimal-pad"
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Markup Percentage</Text>
        <View style={styles.inputWithSuffix}>
          <FormInput
            placeholder="0"
            value={markupPercent}
            onChangeText={(text) => {
              // Only allow numbers and one decimal point
              const cleaned = text.replace(/[^0-9.]/g, "");
              const parts = cleaned.split(".");
              if (parts.length > 2) {
                setMarkupPercent(parts[0] + "." + parts.slice(1).join(""));
              } else {
                setMarkupPercent(cleaned);
              }
            }}
            keyboardType="decimal-pad"
            style={styles.inputWithSuffixField}
          />
          <Text style={styles.inputSuffix}>%</Text>
        </View>

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Tax Percentage</Text>
        <View style={styles.inputWithSuffix}>
          <FormInput
            placeholder="0"
            value={taxPercent}
            onChangeText={(text) => {
              // Only allow numbers and one decimal point
              const cleaned = text.replace(/[^0-9.]/g, "");
              const parts = cleaned.split(".");
              if (parts.length > 2) {
                setTaxPercent(parts[0] + "." + parts.slice(1).join(""));
              } else {
                setTaxPercent(cleaned);
              }
            }}
            keyboardType="decimal-pad"
            style={styles.inputWithSuffixField}
          />
          <Text style={styles.inputSuffix}>%</Text>
        </View>

        <View style={{ height: theme.spacing(3) }} />

        <View style={styles.totalsCard}>
          <Text style={styles.totalsTitle}>Quote Total</Text>

          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Materials (Items)</Text>
            <Text style={styles.totalsValue}>
              ${calculations.materialsFromItems.toFixed(2)}
            </Text>
          </View>

          {calculations.materialsEstimateValue > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Materials (Estimate)</Text>
              <Text style={styles.totalsValue}>
                ${calculations.materialsEstimateValue.toFixed(2)}
              </Text>
            </View>
          )}

          {calculations.laborValue > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Labor</Text>
              <Text style={styles.totalsValue}>
                ${calculations.laborValue.toFixed(2)}
              </Text>
            </View>
          )}


          <View style={styles.totalsDivider} />

          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabelBold}>Subtotal</Text>
            <Text style={styles.totalsValueBold}>
              ${calculations.subtotal.toFixed(2)}
            </Text>
          </View>

          {calculations.markupAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Markup ({markupPercent}%)
              </Text>
              <Text style={styles.totalsValue}>
                ${calculations.markupAmount.toFixed(2)}
              </Text>
            </View>
          )}

          {calculations.taxAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Tax ({taxPercent}%)
              </Text>
              <Text style={styles.totalsValue}>
                ${calculations.taxAmount.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.totalsDivider} />

          <View style={styles.totalsRow}>
            <Text style={styles.totalsFinalLabel}>Total</Text>
            <Text style={styles.totalsFinalValue}>
              ${calculations.total.toFixed(2)}
            </Text>
          </View>
        </View>
      </FormScreen>

      <UndoSnackbar
        visible={showUndoSnackbar}
        message={`Removed ${deletedItem?.name || "item"}`}
        onUndo={handleUndoDelete}
        onDismiss={handleDismissUndo}
      />

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowClientPicker(false);
          setClientPickerSearch("");
        }}
      >
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => {
            setShowClientPicker(false);
            setClientPickerSearch("");
          }}
        >
          <Pressable style={styles.pickerContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Select Client</Text>

            {/* Search */}
            <View style={styles.pickerSearchContainer}>
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search clients..."
                placeholderTextColor={theme.colors.muted}
                value={clientPickerSearch}
                onChangeText={setClientPickerSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Client List */}
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {pickerFilteredClients.length === 0 ? (
                <Text style={styles.pickerEmptyText}>
                  {clientPickerSearch ? "No clients found" : "No saved clients"}
                </Text>
              ) : (
                pickerFilteredClients.map((client) => (
                  <Pressable
                    key={client.id}
                    style={styles.pickerItem}
                    onPress={() => handleSelectClient(client)}
                  >
                    <Text style={styles.pickerItemName}>{client.name}</Text>
                    {(client.email || client.phone) && (
                      <Text style={styles.pickerItemDetail}>
                        {[client.email, client.phone].filter(Boolean).join(" · ")}
                      </Text>
                    )}
                    {client.address && (
                      <Text style={styles.pickerItemAddress} numberOfLines={1}>
                        {client.address}
                      </Text>
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>

            {/* Cancel Button */}
            <Pressable
              style={styles.pickerCancelBtn}
              onPress={() => {
                setShowClientPicker(false);
                setClientPickerSearch("");
              }}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    label: { fontSize: 12, color: theme.colors.text, marginBottom: 6, fontWeight: "600" },
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    browseTag: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    clientInputContainer: {
      position: "relative",
      zIndex: 10,
    },
    suggestionsDropdown: {
      position: "absolute",
      top: 50,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 20,
    },
    suggestionItem: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    suggestionName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    suggestionDetail: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    inputWithSuffix: {
      position: "relative",
    },
    inputWithSuffixField: {
      paddingRight: theme.spacing(5),
    },
    inputSuffix: {
      position: "absolute",
      right: theme.spacing(2),
      top: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      lineHeight: 48,
    },
    h2: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 6,
    },
    helper: { fontSize: 12, color: theme.colors.muted },
    statusChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing(1),
    },
    statusChip: {
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.75),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statusChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    statusChipTextActive: {
      color: "#000", // Black on orange accent (good contrast)
      fontWeight: "700",
    },
    reviewBtn: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      height: 48,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    reviewText: { fontSize: 16, fontWeight: "800", color: "#000" }, // Black on orange accent (good contrast)
    assemblyBtn: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing(2),
      height: 48,
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    assemblyText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    itemsList: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    itemRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing(1),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemInfo: {
      flex: 1,
      marginRight: theme.spacing(1.5),
    },
    itemName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    itemPrice: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    itemControls: {
      alignItems: "flex-end",
      gap: theme.spacing(1),
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    stepBtn: {
      height: 28,
      width: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.card,
    },
    stepText: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.text,
    },
    qtyText: {
      minWidth: 24,
      textAlign: "center",
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 14,
    },
    qtyInput: {
      minWidth: 40,
      height: 36,
      textAlign: "center",
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 14,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      paddingHorizontal: 4,
      paddingVertical: 0,
      textAlignVertical: "center",
    },
    itemTotal: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    totalsCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    totalsTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    totalsLabel: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    totalsValue: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "600",
    },
    totalsLabelBold: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "700",
    },
    totalsValueBold: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "700",
    },
    totalsDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing(1.5),
    },
    totalsFinalLabel: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
    },
    totalsFinalValue: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    // Client Picker Modal styles
    pickerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    pickerContent: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      padding: theme.spacing(3),
      width: "85%",
      maxWidth: 400,
      maxHeight: "70%",
    },
    pickerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    pickerSearchContainer: {
      marginBottom: theme.spacing(2),
    },
    pickerSearchInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    pickerList: {
      maxHeight: 300,
    },
    pickerEmptyText: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      paddingVertical: theme.spacing(3),
    },
    pickerItem: {
      paddingVertical: theme.spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    pickerItemName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    pickerItemDetail: {
      fontSize: 13,
      color: theme.colors.muted,
      marginTop: 2,
    },
    pickerItemAddress: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    pickerCancelBtn: {
      marginTop: theme.spacing(2),
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    pickerCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    // Date picker styles
    datePickerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    datePickerText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    datePickerPlaceholder: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    clearDateButton: {
      paddingHorizontal: theme.spacing(1),
    },
    clearDateText: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: "600",
    },
    datePickerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    datePickerModal: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 20,
    },
    datePickerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    datePickerTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text,
    },
    datePickerCancel: {
      fontSize: 17,
      color: theme.colors.muted,
    },
    datePickerDone: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.accent,
    },
  });
}
