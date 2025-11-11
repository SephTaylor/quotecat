// app/(forms)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";

/**
 * Forms layout:
 * - SafeAreaView respects device notches/status bar
 * - Stack navigator allows headers to show
 * - Individual screens configure their own headers
 * - GradientBackground applied to all form screens
 */
export default function FormsLayout() {
  const { theme } = useTheme();

  return (
    <GradientBackground>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "transparent" }}
        edges={Platform.OS === "android" ? ["left", "right"] : ["top", "left", "right"]}
      >
        <Stack
          screenOptions={{
            headerShown: false, // Hidden by default, screens can override
            presentation: "card", // Ensures proper navigation stack behavior
          }}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}
