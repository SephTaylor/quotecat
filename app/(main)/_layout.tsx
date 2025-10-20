// app/(main)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Main app layout:
 * - SafeAreaView respects device notches/status bar
 * - Only handles top edge (bottom handled by tab bar)
 * - Stack navigator enables headers for non-tab screens like settings
 */
export default function MainLayout() {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      edges={["top", "left", "right"]}
    >
      <Stack
        screenOptions={{
          headerShown: false, // Hidden by default, individual screens can override
        }}
      />
    </SafeAreaView>
  );
}
