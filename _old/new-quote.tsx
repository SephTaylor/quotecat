// app/new-quote.tsx
import { Stack, router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialsPicker from "../components/MaterialsPicker";
import { formatMoney } from "../lib/money";
import { saveQuote } from "../lib/quotes";
import { getCurrency } from "../lib/settings";
// ✅ Import the SAME MaterialItem type that MaterialsPicker uses
import type { MaterialItem as PickerMaterialItem } from "../components/seed-catalog";

type Errors = {
  clientName?: string;
  projectName?: string;
  labor?: string;
};

// ✅ Locally extend the picker’s MaterialItem with qty (and keep productId)
type WithQty = PickerMaterialItem & {
  qty?: number;
};

export default function NewQuote() {
  const insets = useSafeAreaInsets();

  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [labor, setLabor] = useState(""); // typed by user
  const [saving, setSaving] = useState(false);

  // Materials (picker-driven)
  const [currency, setCurrency] = useState("USD");
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materials, setMaterials] = useState<WithQty[]>([]);

  useEffect(() => {
    (async () => setCurrency((await getCurrency()) ?? "USD"))();
  }, []);

  const materialTotal = useMemo(
    () => materials.reduce((s, it) => s + (it.unitPrice ?? 0) * (it.qty ?? 1), 0),
    [materials]
  );

  // Parse with empty → 0 fallback
  const parsedLabor = useMemo(
    () => Number((labor || "0").replace(/[^0-9.]/g, "")),
    [labor]
  );

  const { errors, isValid } = useMemo(() => {
    const errs: Errors = {};
    if (!clientName.trim()) errs.clientName = "Required";
    if (!projectName.trim()) errs.projectName = "Required";
    if (!Number.isFinite(parsedLabor) || parsedLabor < 0)
      errs.labor = "Enter a non-negative number";
    return { errors: errs, isValid: Object.keys(errs).length === 0 };
  }, [clientName, projectName, parsedLabor]);

  const openMaterials = useCallback(() => setMaterialsOpen(true), []);
  const closeMaterials = useCallback(() => setMaterialsOpen(false), []);

  const onSave = useCallback(async () => {
    if (!isValid) {
      Alert.alert("Please fix the fields marked in red.");
      return;
    }
    try {
      setSaving(true);
      await saveQuote({
        clientName: clientName.trim(),
        projectName: projectName.trim(),
        labor: parsedLabor || 0,
        material: materialTotal || 0, // computed from picker
        // materials, // uncomment when your backend accepts line items
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  }, [clientName, projectName, parsedLabor, materialTotal, isValid]);

  const moneyKeyboard: "default" | "numeric" | "decimal-pad" =
    Platform.OS === "ios" ? "decimal-pad" : "numeric";

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: "height" })}
      style={{ flex: 1 }}
    >
      <Stack.Screen options={{ title: "New Quote" }} />

      <ScrollView
        contentContainerStyle={[
          s.container,
          { paddingBottom: insets.bottom + 96 }, // ensures content clears sticky footer
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <LabeledInput
          label="Client"
          placeholder="Client name"
          value={clientName}
          onChangeText={setClientName}
          error={errors.clientName}
        />
        <LabeledInput
          label="Project"
          placeholder="Project name"
          value={projectName}
          onChangeText={setProjectName}
          error={errors.projectName}
        />
        <LabeledInput
          label="Labor"
          placeholder="0"
          value={labor}
          onChangeText={setLabor}
          keyboardType={moneyKeyboard}
          error={errors.labor}
        />

        {/* Materials section */}
        <View style={{ marginBottom: 14 }}>
          <Text style={s.label}>Materials</Text>

          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "#ccc",
              padding: 12,
              gap: 8,
            }}
          >
            <Text style={{ fontWeight: "700" }}>
              Total: {formatMoney(materialTotal, currency)}
            </Text>

            <Pressable
              onPress={openMaterials}
              style={{
                backgroundColor: "#f3f4f6",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#e5e7eb",
              }}
            >
              <Text style={{ fontWeight: "700" }}>Add / Edit Materials</Text>
            </Pressable>

            {materials.length > 0 && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: "#eee",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {materials.map((it, i) => (
                  <View
                    key={String(it.productId ?? i)}
                    style={{
                      padding: 10,
                      borderBottomWidth: i === materials.length - 1 ? 0 : 1,
                      borderBottomColor: "#eee",
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ maxWidth: "70%" }}>
                      {it.name} × {it.qty ?? 1}
                    </Text>
                    <Text style={{ fontWeight: "700" }}>
                      {formatMoney((it.unitPrice ?? 0) * (it.qty ?? 1), currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky footer Save (always above bottom safe area) */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8, // key line to avoid gesture bar overlap
          backgroundColor: "#fff",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "#ddd",
        }}
      >
        <Button
          title={saving ? "Saving…" : "Save"}
          onPress={onSave}
          disabled={saving}
        />
      </View>

      {/* Materials modal */}
      <MaterialsPicker
        visible={materialsOpen}
        currency={currency}
        items={materials}                      // ✔ matches PickerMaterialItem[]
        onChange={(next) => setMaterials(next as WithQty[])} // keep qty typing
        onClose={closeMaterials}
      />
    </KeyboardAvoidingView>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  error?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        style={[s.input, props.error && s.inputError]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        keyboardType={props.keyboardType}
        selectTextOnFocus
        autoCapitalize="none"
      />
      {!!props.error && <Text style={s.errorText}>{props.error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: 16 },
  label: { fontSize: 13, color: "#666", marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputError: { borderColor: "#d33" },
  errorText: { marginTop: 6, color: "#d33" },
});
