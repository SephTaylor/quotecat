// CategoryChips.tsx
import React, { useEffect, useRef } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

type Props = {
  categories: string[];
  selected: string;
  onChange: (c: string) => void;
};

export default function CategoryChips({
  categories,
  selected,
  onChange,
}: Props) {
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    const i = categories.indexOf(selected);
    if (i >= 0) listRef.current?.scrollToIndex({ index: i, animated: true });
  }, [selected, categories]);

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
        backgroundColor: "#fff",
      }}
    >
      <FlatList
        ref={listRef}
        data={categories}
        keyExtractor={(c) => c}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
        }}
        renderItem={({ item }) => {
          const isActive = item === selected;
          return (
            <Pressable
              onPress={() => onChange(item)}
              style={({ pressed }) => [
                {
                  // IMPORTANT: no flex: 1 — keeps intrinsic “pill” width
                  alignSelf: "flex-start",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  backgroundColor: "#fff",
                  borderColor: "#e5e7eb",
                },
                isActive && {
                  backgroundColor: "#2563eb", // SELECTED color (blue)
                  borderColor: "#2563eb",
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text
                style={[
                  { fontWeight: "600", color: "#111827" },
                  isActive && { color: "#fff" }, // white text when selected
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
