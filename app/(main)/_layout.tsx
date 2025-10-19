// app/(main)/_layout.tsx
import { Slot } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Main app layout:
 * - SafeAreaView respects device notches/status bar
 * - Only handles top edge (bottom handled by tab bar)
 * - Expo Router's Stack.Screen adds the header
 */
export default function MainLayout() {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      edges={['top', 'left', 'right']}
    >
      <Slot />
    </SafeAreaView>
  );
}
