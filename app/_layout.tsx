// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { TechContextProvider } from "@/contexts/TechContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { initAnalytics, trackEvent, AnalyticsEvents } from "@/lib/app-analytics";
import { initializeAuth } from "@/lib/auth";
import {
  checkCrashLoopAndReset,
  performStartupIntegrityCheck,
  recoverFromCloud,
  markStartupSuccess
} from "@/lib/dataIntegrity";
import { migrateAsyncStorageToSQLite } from "@/lib/asyncStorageMigration";
import { repairAssemblies } from "@/lib/assemblyRepair";

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

// Loading screen shown during integrity check
function LoadingScreen({ message }: { message: string }) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FBD800" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 16,
    fontSize: 16,
  },
});

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Starting up...");

  useEffect(() => {
    // Initialize app with crash loop detection FIRST
    const init = async () => {
      try {
        // Step 0: Check for crash loop BEFORE any data reads
        // This must happen first to break infinite crash loops
        const wasReset = await checkCrashLoopAndReset();
        if (wasReset) {
          console.log("🔄 App was reset due to crash loop");
          setLoadingMessage("Recovering from crash...");
        }

        // Step 1: Initialize analytics
        try {
          await initAnalytics();
          trackEvent(AnalyticsEvents.APP_OPENED);
        } catch (e) {
          console.error("Analytics init error:", e);
        }

        // Step 1.5: Migrate from AsyncStorage to SQLite (one-time)
        // This MUST happen before any data reads to prevent OOM crashes
        setLoadingMessage("Optimizing storage...");
        try {
          const migrationResult = await migrateAsyncStorageToSQLite();
          if (migrationResult.migrated) {
            const total = migrationResult.quotes + migrationResult.invoices + migrationResult.clients;
            console.log(`📊 Migrated ${total} records to SQLite`);
          }
        } catch (e) {
          console.error("SQLite migration error:", e);
          // Continue even if migration fails - we'll try again next launch
        }

        // Step 2: Check data integrity BEFORE auth
        setLoadingMessage("Checking data...");
        const integrityStatus = await performStartupIntegrityCheck();

        if (integrityStatus.needsRecovery) {
          // Data is corrupt and user is logged in - recover from cloud
          setLoadingMessage("Recovering data from cloud...");
          console.log("🔄 Recovering from cloud due to corrupt local data");
          await recoverFromCloud();
        }

        // Step 3: Initialize auth (which may trigger sync)
        setLoadingMessage("Connecting...");
        try {
          await initializeAuth();
        } catch (e) {
          console.error("Auth init error:", e);
        }

        // Step 3.5: Repair any assemblies with invalid product references
        // - Matches items to EXISTING pricebook entries only (no auto-creation)
        // - Removes broken seed assemblies (example data) entirely
        try {
          await repairAssemblies();
        } catch (e) {
          console.error("Assembly repair error:", e);
        }

        // Step 4: Mark startup as successful
        // This resets the crash counter so we don't trigger nuclear reset
        await markStartupSuccess();

        // Ready to show the app
        setIsInitialized(true);
      } catch (error) {
        console.error("App initialization error:", error);
        // Still show the app even if init fails
        setIsInitialized(true);
      }
    };

    init();
  }, []);

  // Show loading screen during initialization
  if (!isInitialized) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F97316' }}>
        <LoadingScreen message={loadingMessage} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F97316' }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeProvider>
            <TechContextProvider>
              <RootNavigator />
            </TechContextProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
