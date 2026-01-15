// app/(forms)/quote/[id]/edit.tsx
import { useTheme } from "@/contexts/ThemeContext";
import { updateQuote, getQuoteById } from "@/lib/quotes";
import { getClients, getAndClearLastCreatedClientId, getClientById, createClient, type Client } from "@/lib/clients";
import { getUserState } from "@/lib/user";
import { canAccessAssemblies } from "@/lib/features";
import { FormInput, FormScreen } from "@/modules/core/ui";
import { getItemId } from "@/lib/validation";
import type { QuoteStatus, QuoteItem } from "@/lib/types";
import { QuoteStatusMeta } from "@/lib/types";
import { useQuoteForm } from "@/modules/quotes";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SwipeableMaterialItem } from "@/components/SwipeableMaterialItem";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Ionicons } from "@expo/vector-icons";
import { mergeById } from "@/modules/quotes/merge";
import { formatNetChange } from "@/modules/changeOrders/diff";

export default function EditQuote() {
  const { theme } = useTheme();
  const { id, newItems: newItemsParam } = useLocalSearchParams<{ id?: string; newItems?: string }>();
  const router = useRouter();

  // Track the real quote ID after first save (avoids router.replace flash)
  const [realQuoteId, setRealQuoteId] = useState<string | null>(null);
  const effectiveId = realQuoteId || id;

  // Use the extracted form hook - pass effectiveId so it uses the real ID after first save
  const form = useQuoteForm({
    quoteId: effectiveId,
    onNavigateBack: () => router.back(),
    onNavigateToQuotes: () => router.replace("/(main)/(tabs)/quotes" as any),
  });

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

  // Track if we've already prompted to save client this session
  const hasPromptedSaveClient = React.useRef(false);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Destructure commonly used values from form hook
  const {
    quote,
    name, setName,
    clientName, setClientName,
    clientEmail, setClientEmail,
    clientPhone, setClientPhone,
    clientAddress, setClientAddress,
    labor, setLabor,
    materialEstimate, setMaterialEstimate,
    status, setStatus,
    pinned, setPinned,
    items, setItems,
    markupPercent, setMarkupPercent,
    taxPercent, setTaxPercent,
    notes, setNotes,
    changeHistory, setChangeHistory,
    followUpDate, setFollowUpDate,
    tier,
    setIsNewQuote,
    calculations,
    load,
    handleSave,
    handleGoBack,
    validateRequiredFields,
    ensureQuoteExists,
    formatLaborInput,
    formatMoneyOnBlur,
    formatPhoneNumber,
    // Change order detection
    shouldTrackChanges,
    checkForChanges,
    resetSnapshot,
    getNewItemIds,
    getFormData,
  } = form;

  // Load Pro status and saved clients
  useEffect(() => {
    const loadProAndClients = async () => {
      try {
        const user = await getUserState();
        const proStatus = canAccessAssemblies(user);
        setIsPro(proStatus);
        if (proStatus) {
          const clients = await getClients();
          setSavedClients(clients);
        }
      } catch (error) {
        console.error("Failed to load Pro status or clients:", error);
        // Continue with default state (not Pro)
      }
    };
    loadProAndClients();
  }, []);

  // Track if we've processed the newItemsParam to avoid re-processing
  const processedNewItemsRef = React.useRef<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const loadAndMerge = async () => {
        // First, always load the base quote data
        await load();

        // Then, if we have new items from materials, merge them
        if (newItemsParam && newItemsParam !== processedNewItemsRef.current) {
          processedNewItemsRef.current = newItemsParam;
          try {
            const newItems = JSON.parse(newItemsParam) as QuoteItem[];
            console.log("CO mode (in focus): received", newItems.length, "items to merge");
            if (newItems.length > 0 && effectiveId) {
              // Fetch current quote from storage to get existing items
              const currentQuote = await getQuoteById(effectiveId);
              const existingItems = currentQuote?.items ?? [];
              console.log("CO mode (in focus): existing items:", existingItems.length);

              // Merge existing items with new items
              const merged = mergeById(existingItems, newItems);
              console.log("CO mode (in focus): merged result:", merged.length, "items");

              // Update form state with merged items
              setItems(merged);
            }
          } catch (e) {
            console.error("Failed to merge new items:", e);
          }
        }
      };

      loadAndMerge();

      // Check if a new client was just created and auto-select it
      const checkNewClient = async () => {
        try {
          const newClientId = await getAndClearLastCreatedClientId();
          if (newClientId) {
            const client = await getClientById(newClientId);
            if (client) {
              setClientName(client.name);
              setClientEmail(client.email || "");
              setClientPhone(client.phone || "");
              setClientAddress(client.address || "");
              setIsNewQuote(false);
              // Refresh the clients list
              const clients = await getClients();
              setSavedClients(clients);
            }
          }
        } catch (error) {
          console.error("Failed to check/load new client:", error);
        }
      };
      checkNewClient();
    }, [load, setClientName, setClientEmail, setClientPhone, setClientAddress, setIsNewQuote, effectiveId, newItemsParam, setItems]),
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

  // Check if current client name is new (not in saved clients)
  const isNewClientName = React.useMemo(() => {
    if (!clientName.trim() || !isPro) return false;
    const query = clientName.toLowerCase().trim();
    return !savedClients.some(c => c.name.toLowerCase().trim() === query);
  }, [clientName, isPro, savedClients]);

  // Prompt to save client if it's a new one (called before save/review)
  const maybePromptToSaveClient = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      // Skip if not Pro, no client name, already exists, or already prompted
      if (!isPro || !isNewClientName || hasPromptedSaveClient.current) {
        resolve();
        return;
      }

      hasPromptedSaveClient.current = true;

      Alert.alert(
        "Save this client?",
        `Would you like to save "${clientName.trim()}" to your client list for future quotes?`,
        [
          {
            text: "Not Now",
            style: "cancel",
            onPress: () => resolve(),
          },
          {
            text: "Save Client",
            onPress: async () => {
              try {
                const newClient = await createClient({
                  name: clientName.trim(),
                  email: clientEmail.trim() || undefined,
                  phone: clientPhone.trim() || undefined,
                  address: clientAddress.trim() || undefined,
                });
                setSavedClients(prev => [newClient, ...prev]);
              } catch (error) {
                console.error("Failed to save client:", error);
              }
              resolve();
            },
          },
        ]
      );
    });
  }, [isPro, isNewClientName, clientName, clientEmail, clientPhone, clientAddress]);

  // Helper to format change history entry for notes
  const formatChangeHistory = useCallback((diff: NonNullable<ReturnType<typeof checkForChanges>>) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const lines: string[] = [];
    lines.push("---");
    lines.push("Change History");
    lines.push("");
    lines.push(`[${dateStr} - ${timeStr}]`);

    // List added/changed items
    diff.items.forEach((item) => {
      if (item.qtyBefore === 0) {
        // Newly added
        lines.push(`Added: ${item.name} (${item.qtyAfter}) ${formatNetChange(item.lineDelta)}`);
      } else if (item.qtyAfter === 0) {
        // Removed
        lines.push(`Removed: ${item.name} (${item.qtyBefore}) ${formatNetChange(item.lineDelta)}`);
      } else {
        // Quantity changed
        lines.push(`Changed: ${item.name} (${item.qtyBefore} → ${item.qtyAfter}) ${formatNetChange(item.lineDelta)}`);
      }
    });

    // Labor change
    if (diff.laborDelta !== 0) {
      lines.push(`Labor: ${formatNetChange(diff.laborDelta)}`);
    }

    lines.push(`Net change: ${formatNetChange(diff.netChange)}`);
    lines.push("---");

    return lines.join("\n");
  }, []);

  // Simplified save handler - saves directly, auto-logs changes
  const handleSaveWithChangeDetection = useCallback(async () => {
    // Validate required fields first
    if (!validateRequiredFields()) return;

    // Prompt to save new client before proceeding
    await maybePromptToSaveClient();

    // If this is a new quote (no real ID yet), create it first
    if (id === "new" && !realQuoteId) {
      const newId = await ensureQuoteExists();
      if (newId) {
        // Store the real ID in state (no router.replace to avoid screen flash)
        setRealQuoteId(newId);

        // Check if new quote is being created with approved status - need to create snapshot
        const isApprovedOnCreate = status === "approved" || status === "completed";
        if (isPro && isApprovedOnCreate) {
          // Fetch the just-created quote to get its items
          const newQuote = await getQuoteById(newId);
          const itemsToSnapshot = newQuote?.items?.length ? newQuote.items : items;

          if (itemsToSnapshot.length > 0) {
            const snapshot = JSON.stringify(itemsToSnapshot.map((item) => ({
              productId: item.productId,
              name: item.name,
              qty: item.qty,
              unitPrice: item.unitPrice,
            })));
            await updateQuote(newId, { approvedSnapshot: snapshot });
            Alert.alert("Saved", "Quote saved and approved. Future changes will be tracked.", [{ text: "OK" }]);
          } else {
            Alert.alert("Saved", "Quote saved and approved. Add items to enable change tracking.", [{ text: "OK" }]);
          }
        } else {
          Alert.alert("Saved", "Quote saved successfully.", [{ text: "OK" }]);
        }
      }
      return;
    }

    // Get current quote to check for approved snapshot
    const currentQuote = await getQuoteById(effectiveId!);
    const formData = getFormData();

    console.log("=== SAVE DEBUG ===");
    console.log("Quote ID:", effectiveId);
    console.log("Current quote status:", currentQuote?.status);
    console.log("Form status:", status);
    console.log("Has approvedSnapshot:", !!currentQuote?.approvedSnapshot);
    console.log("Current items count:", items.length);
    console.log("isPro (change tracking enabled):", isPro);

    // Check if quote is currently approved/completed AND has a snapshot to compare against
    // Only Pro/Premium users get change tracking
    // Only track when status is approved/completed (not while editing drafts)
    const isCurrentlyApproved = currentQuote?.status === "approved" || currentQuote?.status === "completed";
    if (isPro && isCurrentlyApproved && currentQuote?.approvedSnapshot) {
      console.log("Found approvedSnapshot, comparing...");
      try {
        const snapshotItems = JSON.parse(currentQuote.approvedSnapshot) as Array<{
          productId?: string;
          name: string;
          qty: number;
          unitPrice: number;
        }>;

        // Build maps for comparison
        const snapshotMap = new Map<string, typeof snapshotItems[0]>();
        snapshotItems.forEach((item) => {
          const key = item.productId || `manual:${item.name}`;
          snapshotMap.set(key, item);
        });

        // Use items from storage (currentQuote.items) to catch changes from assembly/pricebook
        // that save directly to storage without going through form state
        const currentItems = currentQuote.items || [];
        const currentMap = new Map<string, QuoteItem>();
        currentItems.forEach((item) => {
          const key = item.productId || `manual:${item.name}`;
          currentMap.set(key, item);
        });

        // Check for changes
        const changes: Array<{ type: string; name: string; detail: string; delta: number }> = [];

        // Find added and modified items
        currentMap.forEach((currentItem, key) => {
          const snapshotItem = snapshotMap.get(key);
          if (!snapshotItem) {
            // New item
            const delta = currentItem.unitPrice * currentItem.qty;
            changes.push({
              type: "Added",
              name: currentItem.name,
              detail: `(${currentItem.qty})`,
              delta,
            });
          } else if (snapshotItem.qty !== currentItem.qty) {
            // Quantity changed
            const qtyDelta = currentItem.qty - snapshotItem.qty;
            const delta = currentItem.unitPrice * qtyDelta;
            changes.push({
              type: "Changed",
              name: currentItem.name,
              detail: `(${snapshotItem.qty} → ${currentItem.qty})`,
              delta,
            });
          }
        });

        // Find removed items
        snapshotMap.forEach((snapshotItem, key) => {
          if (!currentMap.has(key)) {
            const delta = -(snapshotItem.unitPrice * snapshotItem.qty);
            changes.push({
              type: "Removed",
              name: snapshotItem.name,
              detail: `(${snapshotItem.qty})`,
              delta,
            });
          }
        });

        console.log("Changes detected:", changes.length);
        console.log("Changes:", JSON.stringify(changes, null, 2));

        // If there are changes, log them
        if (changes.length > 0) {
          const now = new Date();
          const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

          const lines = [
            "---",
            `[${dateStr} - ${timeStr}]`,
          ];

          let netChange = 0;
          changes.forEach((change) => {
            const sign = change.delta >= 0 ? "+" : "";
            lines.push(`${change.type}: ${change.name} ${change.detail} ${sign}$${Math.abs(change.delta).toFixed(2)}`);
            netChange += change.delta;
          });

          const netSign = netChange >= 0 ? "+" : "";
          lines.push(`Net change: ${netSign}$${Math.abs(netChange).toFixed(2)}`);
          lines.push("---");

          const changeEntry = lines.join("\n");
          const updatedHistory = changeHistory.trim()
            ? `${changeHistory.trim()}\n\n${changeEntry}`
            : changeEntry;
          setChangeHistory(updatedHistory);

          // Revert status to draft so user must re-approve after changes
          setStatus("draft");

          // Save with updated change history, draft status, and NEW snapshot
          // Use currentItems (from storage) to include assembly/pricebook items
          const newSnapshot = JSON.stringify(currentItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            qty: item.qty,
            unitPrice: item.unitPrice,
          })));

          await updateQuote(effectiveId!, {
            ...formData,
            items: currentItems, // Use storage items to preserve assembly/pricebook additions
            changeHistory: updatedHistory,
            status: "draft",
            approvedSnapshot: newSnapshot, // Update snapshot to current state
          });

          Alert.alert(
            "Changes Saved",
            "Your changes have been saved and logged. The quote status has been set back to Draft for your review.",
            [{ text: "OK" }]
          );
          return;
        }
      } catch (e) {
        console.error("Failed to parse approved snapshot:", e);
      }
    }

    // Check if we're setting status to approved/completed - need to create snapshot
    const wasApproved = currentQuote?.status === "approved" || currentQuote?.status === "completed";
    const isNowApproved = status === "approved" || status === "completed";

    // Handle case: quote is already approved but has no snapshot (was created empty, now has items)
    // This creates the initial baseline snapshot for change tracking
    if (isPro && isCurrentlyApproved && !currentQuote?.approvedSnapshot) {
      const currentItems = currentQuote?.items || [];
      if (currentItems.length > 0) {
        console.log("Creating initial snapshot for approved quote that had no snapshot");
        console.log("Items to snapshot:", currentItems.length);
        const snapshot = JSON.stringify(currentItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
        })));
        await updateQuote(effectiveId!, { ...formData, items: currentItems, approvedSnapshot: snapshot });
        Alert.alert("Saved", "Baseline snapshot created. Future changes will now be tracked.", [{ text: "OK" }]);
        return;
      }
    }

    // Only create snapshot for Pro/Premium users (they get change tracking)
    if (isPro && !wasApproved && isNowApproved) {
      // Creating snapshot when quote becomes approved
      // Use storage items to include assembly/pricebook additions
      const itemsToSnapshot = currentQuote?.items?.length ? currentQuote.items : items;
      console.log("Creating approvedSnapshot for newly approved quote");
      console.log("Items to snapshot count:", itemsToSnapshot.length);
      const snapshot = JSON.stringify(itemsToSnapshot.map((item) => ({
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
      })));
      console.log("Snapshot:", snapshot);

      await updateQuote(effectiveId!, { ...formData, items: itemsToSnapshot, approvedSnapshot: snapshot });
      console.log("Saved with approvedSnapshot");
      Alert.alert("Saved", "Quote saved and approved. Future changes will be tracked.", [{ text: "OK" }]);
      return;
    }

    // No changes or not tracking - just save normally
    console.log("Falling through to regular handleSave()");
    await handleSave();
  }, [id, realQuoteId, effectiveId, items, status, isPro, handleSave, validateRequiredFields, ensureQuoteExists, maybePromptToSaveClient, changeHistory, setChangeHistory, setStatus, getFormData]);

  const handleUpdateItemQty = async (itemId: string, delta: number) => {
    if (!effectiveId) return;

    const updatedItems = items.map((item) => {
      const currentId = getItemId(item);
      if (currentId === itemId) {
        const newQty = Math.max(0, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }).filter((item) => item.qty > 0); // Remove items with 0 quantity

    setItems(updatedItems);

    // Only auto-save if NOT tracking changes (i.e., not approved/completed quote)
    // For approved/completed quotes, changes are saved via CO flow
    if (!shouldTrackChanges) {
      await updateQuote(effectiveId, { items: updatedItems });
    }
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
    if (!effectiveId) return;

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
      // Only auto-save if NOT tracking changes
      if (!shouldTrackChanges) {
        await updateQuote(effectiveId, { items: updatedItems });
      }
    } else if (!isNaN(newQty) && newQty === 0) {
      // Only delete if explicitly set to 0
      const updatedItems = items.filter((item) => {
        const currentId = getItemId(item);
        return currentId !== itemId;
      });
      setItems(updatedItems);
      // Only auto-save if NOT tracking changes
      if (!shouldTrackChanges) {
        await updateQuote(effectiveId, { items: updatedItems });
      }
    }
    // If invalid/empty (isNaN), do nothing - keep original value

    setEditingItemId(null);
    setEditingQty("");
  };

  // Handle material deletion with undo functionality
  const handleDeleteItem = async (itemId: string) => {
    if (!effectiveId) return;

    const itemIndex = items.findIndex((item) => getItemId(item) === itemId);
    if (itemIndex === -1) return;

    const itemToDelete = items[itemIndex];
    setDeletedItem(itemToDelete);
    setDeletedItemIndex(itemIndex);

    const updatedItems = items.filter((item) => getItemId(item) !== itemId);
    setItems(updatedItems);
    // Only auto-save if NOT tracking changes
    if (!shouldTrackChanges) {
      await updateQuote(effectiveId, { items: updatedItems });
    }

    setShowUndoSnackbar(true);
  };

  // Handle undo of material deletion
  const handleUndoDelete = async () => {
    if (!effectiveId || !deletedItem || deletedItemIndex === -1) return;

    const restoredItems = [...items];
    restoredItems.splice(deletedItemIndex, 0, deletedItem);
    setItems(restoredItems);
    // Only auto-save if NOT tracking changes
    if (!shouldTrackChanges) {
      await updateQuote(effectiveId, { items: restoredItems });
    }

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

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerTintColor: theme.colors.accent,
          headerLeft: () => <HeaderBackButton onPress={handleGoBack} />,
          headerTitle: () => (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: theme.colors.text }}>
                {tier ? `Edit Quote - ${tier}` : "Edit Quote"}
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
          <View style={styles.bottomBarRow}>
            <Pressable
              style={styles.saveBtn}
              onPress={handleSaveWithChangeDetection}
            >
              <Ionicons name="save-outline" size={20} color={theme.colors.accent} />
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
            <Pressable
              style={styles.reviewBtn}
              onPress={async () => {
                if (!effectiveId) return;
                if (!validateRequiredFields()) return;
                // Prompt to save new client before proceeding
                await maybePromptToSaveClient();
                const newId = await ensureQuoteExists();
                if (!newId) return;
                // Store real ID in state if this was a new quote
                if (id === "new" && !realQuoteId) {
                  setRealQuoteId(newId);
                }
                router.push(`/quote/${newId}/review`);
              }}
            >
              <Ionicons name="document-text-outline" size={20} color="#000" />
              <Text style={styles.reviewText}>Review & Export</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={styles.label}>Status</Text>
        <View style={styles.statusChips}>
          {(Object.keys(QuoteStatusMeta) as QuoteStatus[]).map((s) => {
            const statusColor = QuoteStatusMeta[s].color;
            const isActive = status === s;
            return (
            <Pressable
              key={s}
              style={[
                styles.statusChip,
                isActive && { backgroundColor: statusColor, borderColor: statusColor },
              ]}
              onPress={() => setStatus(s)}
            >
              <Text
                style={[
                  styles.statusChipText,
                  isActive && styles.statusChipTextActive,
                ]}
              >
                {QuoteStatusMeta[s].label}
              </Text>
            </Pressable>
            );
          })}
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
          {isPro && savedClients.length === 0 && (
            <Pressable
              onPress={() => router.push(`/(main)/client-manager?returnTo=${effectiveId}` as any)}
              hitSlop={8}
            >
              <Text style={styles.browseTag}>+ Add clients</Text>
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
              setTimeout(() => {
                setShowClientSuggestions(false);
                // Auto-fill contact info if name exactly matches a saved client
                if (isPro && clientName.trim()) {
                  const exactMatch = savedClients.find(
                    (c) => c.name.toLowerCase() === clientName.trim().toLowerCase()
                  );
                  if (exactMatch && !clientEmail && !clientPhone && !clientAddress) {
                    // Only auto-fill if contact fields are empty (don't overwrite user input)
                    setClientEmail(exactMatch.email || "");
                    setClientPhone(exactMatch.phone || "");
                    setClientAddress(exactMatch.address || "");
                  }
                }
              }, 200);
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
              {items.map((item, index) => {
                const itemId = getItemId(item);
                return (
                  <SwipeableMaterialItem
                    key={item.id || `item-${index}`}
                    item={{
                      id: itemId,
                      name: item.name,
                      unitPrice: item.unitPrice,
                      qty: item.qty,
                    }}
                    onDelete={() => handleDeleteItem(itemId)}
                    isLastItem={index === items.length - 1}
                    editingItemId={editingItemId}
                    editingQty={editingQty}
                    onStartEditingQty={handleStartEditingQty}
                    onFinishEditingQty={handleFinishEditingQty}
                    onQtyChange={handleQtyChange}
                    onUpdateQty={handleUpdateItemQty}
                  />
                );
              })}
            </GestureHandlerRootView>
            <View style={{ height: theme.spacing(2) }} />
          </>
        )}

        <Pressable
          onPress={async () => {
            if (!effectiveId) return;
            // Require job name and client name before allowing materials
            if (!validateRequiredFields()) return;
            const newId = await ensureQuoteExists();
            if (!newId) return;
            // Store real ID in state if this was a new quote
            if (id === "new" && !realQuoteId) {
              setRealQuoteId(newId);
            }
            router.push(`/quote/${newId}/materials` as any);
          }}
          style={({ pressed }) => ({
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

        <Text style={styles.label}>Markup %</Text>
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
        <Text style={styles.helper}>Applied to line items only</Text>

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Tax %</Text>
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

        <View style={{ height: theme.spacing(3) }} />

        <View style={styles.totalsCard}>
          <Text style={styles.totalsTitle}>Quote Total</Text>

          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Materials (Items)</Text>
            <Text style={styles.totalsValue}>
              ${calculations.materialsFromItems.toFixed(2)}
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

        {/* Change History Section - only show for Pro/Premium users with history */}
        {isPro && changeHistory.trim() && (
          <>
            <View style={{ height: theme.spacing(3) }} />
            <Text style={styles.h2}>Change History</Text>
            <View style={{ height: theme.spacing(2) }} />
            <View style={styles.changeHistoryCard}>
              <Text style={styles.changeHistoryText}>{changeHistory}</Text>
            </View>
          </>
        )}
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
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Client</Text>
              <Pressable
                style={styles.pickerNewBtn}
                onPress={() => {
                  setShowClientPicker(false);
                  setClientPickerSearch("");
                  router.push(`/(main)/client-manager?returnTo=${effectiveId}&createNew=true` as any);
                }}
              >
                <Text style={styles.pickerNewBtnText}>+</Text>
              </Pressable>
            </View>

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
      color: "#FFFFFF", // White text on colored backgrounds
    },
    bottomBarRow: {
      flexDirection: "row",
      gap: theme.spacing(2),
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 48,
      paddingHorizontal: theme.spacing(3),
      borderRadius: theme.radius.xl,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.card,
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    reviewBtn: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
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
    // Change History styles
    changeHistoryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    changeHistoryText: {
      fontSize: 13,
      color: theme.colors.muted,
      fontFamily: "monospace",
      lineHeight: 20,
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
    pickerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(2),
    },
    pickerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    pickerNewBtn: {
      padding: theme.spacing(1),
    },
    pickerNewBtnText: {
      fontSize: 24,
      fontWeight: "600",
      color: theme.colors.accent,
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
