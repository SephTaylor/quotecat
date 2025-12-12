// app/(forms)/quote/[id]/edit.tsx
import { useTheme } from "@/contexts/ThemeContext";
import {
  getQuoteById,
  updateQuote,
  deleteQuote,
  saveQuote,
  type Quote,
} from "@/lib/quotes";
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
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SwipeableMaterialItem } from "@/components/SwipeableMaterialItem";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { HeaderIconButton } from "@/components/HeaderIconButton";

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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState<string>("");

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
      setMarkupPercent(q.markupPercent && q.markupPercent !== 0 ? q.markupPercent.toString() : "");
      setTaxPercent(q.taxPercent && q.taxPercent !== 0 ? q.taxPercent.toString() : "");
      setNotes(q.notes || "");
      // Check if this is a newly created empty quote
      setIsNewQuote(!q.name && !q.clientName && q.labor === 0);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

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
    if (isNewQuote && !name.trim() && !clientName.trim() && !labor.trim()) {
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
      if (isNewQuote && !name.trim() && !clientName.trim() && !labor.trim()) {
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

        <Text style={styles.label}>Client name *</Text>
        <FormInput
          placeholder="Who's the lucky customer?"
          value={clientName}
          onChangeText={(text) => {
            setClientName(text);
            if (text.trim()) setIsNewQuote(false);
          }}
          autoCapitalize="words"
        />

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
          onChangeText={setClientPhone}
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
                status,
                pinned,
                items,
              };

              if (existing) {
                // Update existing quote
                await updateQuote(id, quoteData);
              } else {
                // Create new quote
                await saveQuote({ ...quoteData, id });
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
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    label: { fontSize: 12, color: theme.colors.text, marginBottom: 6, fontWeight: "600" },
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
  });
}
