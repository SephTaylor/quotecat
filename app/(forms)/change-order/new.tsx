// app/(forms)/change-order/new.tsx
//
// Raise a change order against a signed contract.
//
// A change order is a modification to a signed contract, so this builds a NEW
// document rather than editing the parent. The contract is never touched: you
// cannot edit something two people have signed. See
// docs/CHANGE-ORDERS-CONTRACT.md.
//
// Deliberately not the January flow, which had the contractor edit an approved
// quote and inferred a change order from the difference. That was removed on
// 2026-01-08 because the quote appeared to revert and people thought they had
// lost work.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { AddItemRow } from "@/components/AddItemRow";
import { getContractById } from "@/lib/contracts";
import {
  createChangeOrderForContract,
  canAddChangeOrder,
  whyCannotAddChangeOrder,
} from "@/lib/changeOrders";
import type { Contract, QuoteItem } from "@/lib/types";

export default function NewChangeOrderScreen() {
  const params = useLocalSearchParams<{ contractId?: string }>();
  const contractId = params.contractId;
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [description, setDescription] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [labor, setLabor] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!contractId) {
        setLoading(false);
        return;
      }
      try {
        const c = await getContractById(contractId);
        if (!cancelled) setContract(c);
      } catch (error) {
        console.error("Failed to load contract for change order:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  const handleAddItem = useCallback((name: string, qty: number, price: number) => {
    setItems((prev) => [...prev, { name, qty, unitPrice: price }]);
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Preview of what this modification is worth, using the contract's own
  // markup and tax so the number here is the number that gets stored.
  const laborValue = parseFloat(labor) || 0;
  const materials = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const markupPercent = contract?.markupPercent ?? 0;
  const taxPercent = contract?.taxPercent ?? 0;
  const netChange =
    (materials * (1 + markupPercent / 100) + laborValue) * (1 + taxPercent / 100);

  const canSave = Boolean(description.trim()) && (items.length > 0 || laborValue !== 0);

  const handleSave = async () => {
    if (!contract || saving) return;

    if (!description.trim()) {
      Alert.alert("Describe the change", "A change order gets signed, so it needs to say what work it covers.");
      return;
    }
    if (items.length === 0 && laborValue === 0) {
      Alert.alert("Nothing to charge", "Add materials or labor, otherwise there is nothing for your customer to approve.");
      return;
    }

    setSaving(true);
    try {
      await createChangeOrderForContract(contract, {
        description: description.trim(),
        items,
        labor: laborValue,
        note: note.trim() || undefined,
      });
      router.back();
    } catch (error) {
      Alert.alert(
        "Could not create change order",
        error instanceof Error ? error.message : "Please try again."
      );
      setSaving(false);
    }
  };

  const screenOptions = {
    title: "New Change Order",
    headerShown: true,
    headerTitleAlign: "center" as const,
    headerStyle: { backgroundColor: theme.colors.bg },
    headerTintColor: theme.colors.accent,
    headerTitleStyle: { color: theme.colors.text },
    headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </>
    );
  }

  if (!contract) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>That contract could not be found.</Text>
        </View>
      </>
    );
  }

  // Same gate the contract screen uses, re-checked here because the contract
  // could have moved on since that screen loaded it.
  if (!canAddChangeOrder(contract)) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{whyCannotAddChangeOrder(contract)}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.contextCard}>
            <Text style={styles.contextLabel}>Modifying</Text>
            <Text style={styles.contextValue}>
              {contract.contractNumber} · {contract.projectName}
            </Text>
            <Text style={styles.contextHint}>
              The contract is not changed. This is a separate document your
              customer signs on its own.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>What changed</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Two extra outlets in the garage"
              placeholderTextColor={theme.colors.muted}
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Materials</Text>
            {items.map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.qty} × ${item.unitPrice.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  ${(item.qty * item.unitPrice).toFixed(2)}
                </Text>
                <Pressable
                  onPress={() => handleRemoveItem(index)}
                  hitSlop={8}
                  style={styles.itemDelete}
                >
                  <Ionicons name="close-circle" size={20} color={theme.colors.muted} />
                </Pressable>
              </View>
            ))}
            <AddItemRow onAddItem={handleAddItem} />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Labor</Text>
            <TextInput
              style={styles.input}
              value={labor}
              onChangeText={setLabor}
              placeholder="0.00"
              placeholderTextColor={theme.colors.muted}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Reason for change (optional)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Customer asked on site"
              placeholderTextColor={theme.colors.muted}
            />
          </View>

          <View style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Materials</Text>
              <Text style={styles.totalValue}>${materials.toFixed(2)}</Text>
            </View>
            {markupPercent > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Markup ({markupPercent}%)</Text>
                <Text style={styles.totalValue}>
                  ${(materials * (markupPercent / 100)).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Labor</Text>
              <Text style={styles.totalValue}>${laborValue.toFixed(2)}</Text>
            </View>
            {taxPercent > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({taxPercent}%)</Text>
                <Text style={styles.totalValue}>
                  $
                  {(
                    (materials * (1 + markupPercent / 100) + laborValue) *
                    (taxPercent / 100)
                  ).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={styles.grandLabel}>Change order total</Text>
              <Text style={styles.grandValue}>${netChange.toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable
            style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.saveButtonText}>Create Change Order</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(3),
      backgroundColor: theme.colors.bg,
    },
    errorText: {
      color: theme.colors.muted,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 21,
    },
    contextCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    contextLabel: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: theme.colors.muted,
      fontWeight: "700",
    },
    contextValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: 2,
    },
    contextHint: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: theme.spacing(1),
      lineHeight: 17,
    },
    section: { marginBottom: theme.spacing(2) },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.75),
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1.25),
      fontSize: 16,
      color: theme.colors.text,
    },
    multiline: { minHeight: 76, textAlignVertical: "top" },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1.25),
      marginBottom: theme.spacing(0.75),
      gap: theme.spacing(1),
    },
    itemMain: { flex: 1 },
    itemName: { fontSize: 15, color: theme.colors.text, fontWeight: "600" },
    itemMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 1 },
    itemTotal: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
    itemDelete: { padding: 2 },
    totalCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 3,
    },
    totalLabel: { fontSize: 14, color: theme.colors.muted },
    totalValue: { fontSize: 14, color: theme.colors.text },
    grandRow: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      marginTop: theme.spacing(1),
      paddingTop: theme.spacing(1),
    },
    grandLabel: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
    grandValue: { fontSize: 18, fontWeight: "800", color: theme.colors.accent },
    bottomBar: {
      padding: theme.spacing(2),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
    saveButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.75),
      alignItems: "center",
    },
    saveButtonDisabled: { opacity: 0.45 },
    saveButtonText: { fontSize: 16, fontWeight: "700", color: "#000" },
  });
}
