// app/modal.tsx
import { Stack, router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../constants/theme";

export default function AppModal() {
  const insets = useSafeAreaInsets();

  return (
    <>
      {/* Full-screen modal: no native header */}
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          s.container,
          {
            backgroundColor: colors.bg,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={s.card}>
          <Text style={s.title}>Modal</Text>
          <Text style={s.body}>
            This modal follows the global theme and respects safe areas.
          </Text>

          <Pressable
            style={s.primary}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            android_ripple={
              Platform.OS === "android"
                ? { color: "rgba(0,0,0,0.06)", borderless: false }
                : undefined
            }
            accessibilityRole="button"
            accessibilityLabel="Close modal"
          >
            <Text style={s.primaryText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    marginTop: 16,
    backgroundColor: "#fff", // keep cards white for contrast
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border, // was #E6EAF2
    padding: 16,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text }, // was #111
  body: { color: colors.text, opacity: 0.7 }, // was #444
  primary: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand, // was #F9C80E
  },
  primaryText: { color: colors.text, fontWeight: "700" }, // was #000
});
