// app/(forms)/quote/[id]/edit.tsx
import { theme } from "@/constants/theme";
import { getQuoteById, updateQuote, type Quote } from "@/lib/quotes";
import { FormInput, FormScreen } from "@/modules/core/ui";
import { parseMoney } from "@/modules/settings/money";
import type { QuoteStatus } from "@/lib/types";
import { QuoteStatusMeta } from "@/lib/types";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
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
  const [labor, setLabor] = useState<string>(""); // empty string to show placeholder
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [pinned, setPinned] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (q) {
      setQuote(q);
      setName(q.name || "");
      setClientName(q.clientName || "");
      // Only set labor if it's non-zero, otherwise leave empty to show placeholder
      setLabor(q.labor && q.labor !== 0 ? String(q.labor) : "");
      setStatus(q.status || "draft");
      setPinned(q.pinned || false);
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
    await updateQuote(id, {
      name,
      clientName,
      labor: parseMoney(labor),
      status,
      pinned,
    });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: "Edit Quote" }} />
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

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Status</Text>
        <View style={styles.statusGrid}>
          {(Object.keys(QuoteStatusMeta) as QuoteStatus[]).map((s) => (
            <Pressable
              key={s}
              style={[
                styles.statusChip,
                status === s && styles.statusChipActive,
                status === s && {
                  backgroundColor: QuoteStatusMeta[s].color,
                  borderColor: QuoteStatusMeta[s].color,
                },
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

        <Pressable style={styles.pinToggle} onPress={() => setPinned(!pinned)}>
          <Text style={styles.pinIcon}>{pinned ? "⭐" : "☆"}</Text>
          <Text style={styles.pinText}>
            {pinned ? "Pinned to Dashboard" : "Pin to Dashboard"}
          </Text>
        </Pressable>

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
    </>
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
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  statusChip: {
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1),
    borderRadius: 999,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusChipActive: {
    borderWidth: 2,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
  },
  statusChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  pinToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pinIcon: {
    fontSize: 20,
    marginRight: theme.spacing(1.5),
  },
  pinText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },
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
