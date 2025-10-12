// app/quote/new.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

// ✅ correct relative paths:
import ProductQuickAdd from "../../components/ProductQuickAdd";
import { formatMoney } from "../../lib/money";
import { getCurrency } from "../../lib/settings";


type QuoteItem = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  unit?: string;
};

export default function NewQuoteScreen() {
  const [currency, setCurrency] = useState("USD");
  const [items, setItems] = useState<QuoteItem[]>([]);

  useEffect(() => {
    (async () => setCurrency((await getCurrency()) ?? "USD"))();
  }, []);

  function handleAddProduct(p: QuoteItem) {
    setItems(prev => {
      const clone = [...prev];
      const idx = clone.findIndex(i => i.productId === p.productId);
      if (idx >= 0) {
        clone[idx] = { ...clone[idx], qty: (clone[idx].qty ?? 0) + 1 };
      } else {
        clone.push({ ...p, qty: p.qty ?? 1 });
      }
      return clone;
    });
  }

  function inc(i: number) {
    setItems(prev => {
      const clone = [...prev];
      clone[i] = { ...clone[i], qty: clone[i].qty + 1 };
      return clone;
    });
  }

  function dec(i: number) {
    setItems(prev => {
      const clone = [...prev];
      const nextQty = Math.max(0, clone[i].qty - 1);
      if (nextQty === 0) clone.splice(i, 1);
      else clone[i] = { ...clone[i], qty: nextQty };
      return clone;
    });
  }

  const materialTotal = useMemo(
    () => items.reduce((sum, it) => sum + it.unitPrice * (it.qty ?? 1), 0),
    [items]
  );

  function saveQuote() {
    // Replace with your real save flow later
    Alert.alert("Saved (demo)", `Items: ${items.length}\nTotal: ${formatMoney(materialTotal, currency)}`);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>New Quote</Text>

      <ProductQuickAdd onAdd={handleAddProduct} currency={currency} />

      <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12, overflow: "hidden" }}>
        {items.length === 0 ? (
          <Text style={{ padding: 12, opacity: 0.7 }}>No items yet. Use search above to add products.</Text>
        ) : (
          items.map((it, i) => (
            <View
              key={`${it.productId}-${i}`}
              style={{
                padding: 12,
                borderBottomWidth: i === items.length - 1 ? 0 : 1,
                borderBottomColor: "#eee",
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "600", flex: 1, paddingRight: 8 }}>{it.name}</Text>
                <Text style={{ fontWeight: "700" }}>
                  {formatMoney(it.unitPrice * (it.qty ?? 1), currency)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
                <Text style={{ opacity: 0.7 }}>
                  {formatMoney(it.unitPrice, currency)} / {it.unit ?? "ea"}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pressable
                    onPress={() => dec(i)}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ddd" }}
                  >
                    <Text>-</Text>
                  </Pressable>
                  <Text style={{ minWidth: 24, textAlign: "center", fontWeight: "700" }}>{it.qty}</Text>
                  <Pressable
                    onPress={() => inc(i)}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ddd" }}
                  >
                    <Text>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "700" }}>
          Material: {formatMoney(materialTotal, currency)}
        </Text>
        <Pressable
          onPress={saveQuote}
          style={{ backgroundColor: "#1e90ff", paddingVertical: 14, borderRadius: 12, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Save Quote</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
