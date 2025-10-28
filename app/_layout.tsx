// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { useEffect } from "react";
import { initAnalytics, trackEvent, AnalyticsEvents } from "@/lib/app-analytics";

function RootNavigator() {
  const { mode } = useTheme();

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false, // Hidden by default, individual screens can override
          presentation: "card",
        }}
      />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize analytics on app start
    initAnalytics().then(() => {
      trackEvent(AnalyticsEvents.APP_OPENED);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
