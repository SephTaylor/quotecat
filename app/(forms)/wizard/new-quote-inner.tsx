import { Stack, useRouter, type Href } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "@/constants/theme";
import { saveQuote, type QuoteItem } from "@/lib/quotes";
import { CATEGORIES, PRODUCTS_SEED } from "@/modules/catalog/seed";

import { BottomBar, Screen } from "@/modules/core/ui";

import { MaterialsPicker, useSelection } from "@/modules/materials";
import { mergeById } from "@/modules/quotes/merge";
import { formatMoney } from "@/modules/settings/money";

type Step = "basics" | "materials" | "review";
type NewQuoteState = { title: string };

export default function NewQuoteWizard() {
  const router = useRouter();

  // Reused across steps
  const { selection, inc, dec, units, subtotal } = useSelection();

  const [step, setStep] = useState<Step>("basics");
  const [state, setState] = useState<NewQuoteState>({ title: "" });

  const idx = useMemo(
    () => (step === "basics" ? 0 : step === "materials" ? 1 : 2),
    [step],
  );
  const stepTitle =
    step === "basics"
      ? "Basics"
      : step === "materials"
        ? "Materials"
        : "Review";
  const canNext =
    step === "basics"
      ? !!state.title.trim()
      : step === "materials"
        ? units > 0
        : true;

  const back = () => {
    if (step === "materials") setStep("basics");
    else if (step === "review") setStep("materials");
  };

  const next = async () => {
    if (!canNext) return;

    if (step === "basics") return setStep("materials");
    if (step === "materials") return setStep("review");

    // Finish → create quote
    const adds: QuoteItem[] = Array.from(selection.values()).map((it: any) => {
      const { product, qty } = it;
      const q = (qty ?? 0) as number;
      return {
        id: product.id,
        name: product.name,
        unitPrice: product.unitPrice,
        qty: q,
      };
    });

    const merged = mergeById([], adds);
    const id = "q-" + Date.now().toString(36);

    await saveQuote({
      id,
      name: state.title.trim() || "Untitled Project",
      items: merged,
      labor: 0,
    } as any);

    router.replace(`/quote/${id}` as Href);
  };

  const nextLabel = idx + 1 < 3 ? "Next" : "Create Quote";
  const sub = subtotal; // number

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <Screen>
        <View style={styles.header}>
          <Text style={styles.stepBadge}>{idx + 1}/3</Text>
          <Text style={styles.h1}>{stepTitle}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {step === "basics" && (
            <View style={styles.section}>
              <Text style={styles.label}>Quote title</Text>
              <TextInput
                placeholder="e.g., Master bedroom remodel"
                value={state.title}
                onChangeText={(t) => setState({ title: t })}
                style={styles.input}
                returnKeyType="next"
                onSubmitEditing={() => setStep("materials")}
              />
              <Text style={styles.helper}>You can rename later.</Text>
            </View>
          )}

          {step === "materials" && (
            <View style={styles.section}>
              <MaterialsPicker
                categories={CATEGORIES}
                itemsByCategory={PRODUCTS_SEED}
                selection={selection}
                onInc={inc}
                onDec={dec}
              />
            </View>
          )}

          {step === "review" && (
            <View style={styles.section}>
              <Text style={styles.h2}>Review</Text>
              <Text style={styles.helper}>
                {units} unit{units === 1 ? "" : "s"} selected — materials
                subtotal {formatMoney ? formatMoney(sub) : sub.toFixed(2)}
              </Text>

              <View style={{ marginTop: 8 }}>
                {Array.from(selection.values()).map((it: any) => {
                  const { product, qty } = it;
                  const q = (qty ?? 0) as number;
                  const line = q * product.unitPrice;
                  return (
                    <View key={product.id} style={styles.row}>
                      <Text style={styles.rowName}>{product.name}</Text>
                      <Text style={styles.rowRight}>
                        {q} ×{" "}
                        {formatMoney
                          ? formatMoney(product.unitPrice)
                          : product.unitPrice.toFixed(2)}{" "}
                        = {formatMoney ? formatMoney(line) : line.toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </Screen>

      <BottomBar>
        <Pressable
          onPress={back}
          disabled={step === "basics"}
          style={[styles.secondaryBtn, step === "basics" && styles.disabled]}
        >
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={next}
          disabled={!canNext}
          style={[styles.primaryBtn, !canNext && styles.primaryIdle]}
        >
          <Text style={styles.primaryText}>{nextLabel}</Text>
        </Pressable>
      </BottomBar>
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16 },
  stepBadge: { color: theme.colors.muted, fontWeight: "700", marginBottom: 4 },
  h1: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  h2: { fontSize: 16, fontWeight: "800", color: theme.colors.text },

  content: { padding: 16, gap: 16, paddingBottom: 120 },
  section: { paddingHorizontal: 16, paddingVertical: 16 },

  label: { fontWeight: "700", color: theme.colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
  },
  helper: { color: theme.colors.muted, fontSize: 12, marginTop: 6 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowName: { color: theme.colors.text, flexShrink: 1, paddingRight: 12 },
  rowRight: { color: theme.colors.text, fontWeight: "600" },

  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.card,
  },
  disabled: { opacity: 0.5 },
  secondaryText: { fontWeight: "800", color: theme.colors.text },

  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  primaryIdle: { opacity: 0.95 },
  primaryText: { fontWeight: "800", color: "#000" },
});
