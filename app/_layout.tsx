// app/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" translucent={false} backgroundColor="#fff" />
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: "#fff" },
        }}
      >
        {/* Home list at / */}
        <Stack.Screen name="index" options={{ title: "QuoteCat" }} />

        {/* Create form at /new-quote (root) */}
        <Stack.Screen name="new-quote" options={{ title: "New Quote" }} />

        {/* Create form at /quote/new (nested) */}
        <Stack.Screen name="quote/new" options={{ title: "New Quote" }} />

        {/* If/when you add these files, you can uncomment:
        <Stack.Screen name="quote/[id]/index" options={{ title: "Quote" }} />
        <Stack.Screen name="quote/[id]/edit"  options={{ title: "Edit Quote" }} />
        */}
      </Stack>
    </SafeAreaProvider>
  );
}
