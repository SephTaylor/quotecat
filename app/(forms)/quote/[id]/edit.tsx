// app/(forms)/quote/[id]/edit.tsx
import { theme } from "@/constants/theme";
import { getQuoteById, saveQuote, type Quote } from "@/lib/quotes";
import { FormInput, FormScreen } from "@/modules/core/ui";
import { parseMoney } from "@/modules/settings/money";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function EditQuote() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  // Keep the state type, silence the unused value.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_quote, setQuote] = useState<Quote | null>(null);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [labor, setLabor] = useState<string>("0"); // keep as string for now

  const load = useCallback(async () => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (q) {
      setQuote(q);
      setName(q.name || "");
      setClientName(q.clientName || "");
      setLabor(String(q.labor ?? 0));
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

  const onDone = async () => {
    if (!id) return;
    await saveQuote({
      id,
      name,
      clientName,
      labor: parseMoney(labor),
    });
    router.back();
  };

  return (
    <FormScreen
      scroll
      contentStyle={{
        paddingHorizontal: theme.spacing(2),
        paddingTop: theme.spacing(2),
        paddingBottom: theme.spacing(2),
      }}
      bottomBar={
        <Pressable style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      }
    >
      <Text style={styles.label}>Project name</Text>
      <FormInput
        placeholder="e.g., Interior wall demo"
        value={name}
        onChangeText={setName}
      />

      <View style={{ height: theme.spacing(2) }} />

      <Text style={styles.label}>Client name</Text>
      <FormInput
        placeholder="e.g., Acme LLC"
        value={clientName}
        onChangeText={setClientName}
        autoCapitalize="words"
      />

      <View style={{ height: theme.spacing(2) }} />

      <Text style={styles.label}>Labor</Text>
      <FormInput
        placeholder="0.00"
        value={labor}
        onChangeText={setLabor}
        keyboardType="numeric"
        inputMode="decimal"
      />

      <View style={{ height: theme.spacing(3) }} />

      <Text style={styles.h2}>Items</Text>
      <Text style={styles.helper}>
        Use the Materials picker to add seed-only items. Categories are
        collapsed by default.
      </Text>

      <View style={{ height: theme.spacing(2) }} />
      <Pressable
        onPress={() => id && router.push(`/quote/${id}/materials`)}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.lg,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontWeight: "800", color: theme.colors.text }}>
          Add materials
        </Text>
      </Pressable>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: theme.colors.muted, marginBottom: 6 },
  h2: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 6,
  },
  helper: { fontSize: 12, color: theme.colors.muted },
  doneBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.xl,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  doneText: { fontSize: 16, fontWeight: "800", color: "#000" },
});
