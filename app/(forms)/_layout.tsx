// app/(forms)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Forms layout:
 * - Stack navigator handles safe areas when headerShown=true
 * - Individual screens configure their own headers
 * - No SafeAreaView here to avoid double safe area padding
 */
export default function FormsLayout() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack
        screenOptions={{
          headerShown: false, // Hidden by default, screens can override
          presentation: "card", // Ensures proper navigation stack behavior
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      />
    </View>
  );
}
