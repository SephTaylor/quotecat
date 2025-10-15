// components/ProductQuickAdd.tsx
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

// ⬇️ go up two levels from app/components → project root → lib
import { formatMoney } from "../lib/money";
import { Product, searchProducts } from "../lib/products";

type Props = {
  onAdd: (item: {
    productId: string;
    name: string;
    unitPrice: number;
    qty: number;
    unit?: string;
  }) => void;
  currency?: string;
};

export default function ProductQuickAdd({ onAdd, currency = "USD" }: Props) {
  const [q, setQ] = useState("");
  const results = useMemo(() => searchProducts(q), [q]);

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search products (name or category)…"
        autoCapitalize="none"
        style={{
          borderWidth: 1, borderColor: "#ddd", borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 10,
        }}
      />
      <FlatList
        data={results}
        keyExtractor={(p: Product) => p.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              onAdd({
                productId: item.id,
                name: item.name,
                unitPrice: item.unitPrice,
                qty: 1,
                unit: item.unit,
              })
            }
            style={{
              paddingVertical: 10, paddingHorizontal: 12,
              borderBottomWidth: 1, borderBottomColor: "#eee",
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <View style={{ maxWidth: "70%" }}>
              <Text style={{ fontWeight: "600" }}>{item.name}</Text>
              <Text style={{ opacity: 0.7, fontSize: 12 }}>
                {item.category} • per {item.unit}
              </Text>
            </View>
            <Text style={{ fontWeight: "700" }}>
              {formatMoney(item.unitPrice, currency)}
            </Text>
          </Pressable>
        )}
        style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12, maxHeight: 240 }}
        ListEmptyComponent={<Text style={{ padding: 12, opacity: 0.6 }}>No matches.</Text>}
      />
    </View>
  );
}
