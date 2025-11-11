// app/(main)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";

/**
 * Main app layout:
 * - SafeAreaView respects device notches/status bar/navigation bars
 * - Drawer navigation handles top edge (header shown)
 * - Handles left/right/bottom edges for proper Android nav bar support
 * - Stack navigator enables headers for non-tab screens like settings
 * - GradientBackground applied globally to entire app
 */
export default function MainLayout() {
  const { theme } = useTheme();

  return (
    <GradientBackground>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "transparent" }}
        edges={["left", "right", "bottom"]}
      >
        <Stack
          screenOptions={{
            headerShown: false, // Hidden by default, individual screens can override
          }}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}
