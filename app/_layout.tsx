// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { useEffect } from "react";
import { initAnalytics, trackEvent, AnalyticsEvents } from "@/lib/app-analytics";
import { initializeAuth } from "@/lib/auth";

function RootNavigator() {
  const { mode } = useTheme();

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false, // Hidden by default, individual screens can override
          presentation: "card",
          headerTitleAlign: 'center', // Center titles on all platforms (Android defaults to left)
        }}
      />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize analytics and auth on app start
    Promise.all([
      initAnalytics().then(() => {
        trackEvent(AnalyticsEvents.APP_OPENED);
      }),
      initializeAuth(), // Auto-login if session exists
    ]);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
