// app/(forms)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Forms layout:
 * - SafeAreaView respects device notches/status bar
 * - Stack navigator allows headers to show
 * - Individual screens configure their own headers
 */
export default function FormsLayout() {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      edges={["top", "left", "right"]}
    >
      <Stack
        screenOptions={{
          headerShown: false, // Hidden by default, screens can override
          presentation: "card", // Ensures proper navigation stack behavior
        }}
      />
    </SafeAreaView>
  );
}
