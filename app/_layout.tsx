import { Stack } from "expo-router";
import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const colors = { bg: "#F7F7F7", text: "#000000" }; // simple palette

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitle: "QuoteCat", // plain black text title
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "QuoteCat" }} />
        <Stack.Screen name="new-quote" options={{ title: "New Quote" }} />
        <Stack.Screen name="materials" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}