// app/(forms)/quote/[id]/review.tsx
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
// Use a different local name to avoid the ESLint "named-as-default" warning
import { getQuoteById } from "@/lib/quotes";
import FormScreenComponent from "@/modules/core/ui/FormScreen";
import { useExportQuote } from "@/modules/quotes";
import { QuoteItemRow } from "@/modules/quotes/ui";
import { formatMoney } from "@/modules/settings/money";

type QuoteItem = {
  id?: string;
  name: string;
  qty: number;
  unitPrice: number;
  currency?: string;
};
type StoredQuote = {
  id: string;
  name: string;
  clientName?: string;
  items: QuoteItem[];
  labor: number;
};

export default function QuoteReviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const qid = Array.isArray(params.id) ? params.id[0] : (params.id ?? null);

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<StoredQuote | null>(null);
  const { exportToCsv, isExporting } = useExportQuote();

  useEffect(() => {
    (async () => {
      try {
        if (!qid) return;
        const q = await getQuoteById(qid);
        setQuote((q as StoredQuote) ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [qid]);

  const items: QuoteItem[] = useMemo(() => quote?.items ?? [], [quote]);
  const materialSubtotal = useMemo(
    () => items.reduce((s, it) => s + (it.unitPrice || 0) * (it.qty || 0), 0),
    [items],
  );
  const labor = quote?.labor ?? 0;
  const grandTotal = materialSubtotal + labor;

  const closeBar = (
    <View style={styles.footer}>
      <Button title="Close" onPress={() => router.back()} />
    </View>
  );

  const doneBar = (
    <View style={styles.footer}>
      <Button
        title={isExporting ? "Exporting..." : "Export CSV"}
        onPress={() => quote && exportToCsv(quote)}
        disabled={isExporting || !quote}
      />
      <Button title="Done" onPress={() => router.back()} />
    </View>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Review" }} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </>
    );
  }

  if (!qid) {
    return (
      <>
        <Stack.Screen options={{ title: "Review" }} />
        <FormScreenComponent
          scroll
          contentStyle={styles.body}
          bottomBar={closeBar}
        >
          <View>
            <Text style={styles.h2}>Missing quote id</Text>
            <Text>Open a quote from Home and try again.</Text>
          </View>
        </FormScreenComponent>
      </>
    );
  }

  if (!quote) {
    return (
      <>
        <Stack.Screen options={{ title: "Review" }} />
        <FormScreenComponent
          scroll
          contentStyle={styles.body}
          bottomBar={closeBar}
        >
          <View>
            <Text style={styles.h2}>Quote not found</Text>
            <Text>
              We couldn't load that quote. Try again from the Home screen.
            </Text>
          </View>
        </FormScreenComponent>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Review" }} />
      <FormScreenComponent
        scroll
        contentStyle={styles.body}
        bottomBar={doneBar}
      >
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <Text style={styles.h2}>Line items</Text>

          {items.length === 0 ? (
            <Text style={styles.muted}>No items yet.</Text>
          ) : (
            items.map((it, idx) => (
              <QuoteItemRow key={`${it.id ?? it.name}-${idx}`} item={it} />
            ))
          )}

          <View style={styles.divider} />

          <Text style={styles.h2}>Totals</Text>
          <View style={styles.totalsRow}>
            <Text style={styles.label}>Materials</Text>
            <Text style={styles.value}>{formatMoney(materialSubtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.label}>Labor</Text>
            <Text style={styles.value}>{formatMoney(labor)}</Text>
          </View>
          <View style={styles.totalsRowGrand}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{formatMoney(grandTotal)}</Text>
          </View>
        </ScrollView>
      </FormScreenComponent>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16 },
  h2: { fontSize: 18, fontWeight: "600" },
  muted: { color: "#666" },

  divider: { height: 16 },

  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  label: { color: "#333" },
  value: { fontWeight: "600" },

  totalsRowGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    marginTop: 6,
  },
  grandLabel: { fontSize: 16, fontWeight: "700" },
  grandValue: { fontSize: 16, fontWeight: "700" },

  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    backgroundColor: "white",
  },
});
