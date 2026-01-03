// lib/dataIntegrity.ts
// Data integrity check and automatic recovery system
// This runs on app startup BEFORE any other data access

import AsyncStorage from "@react-native-async-storage/async-storage";
import { checkDataIntegrity, emergencyReset, getCorruptionLog } from "./safeStorage";
import { getCurrentUserId } from "./authUtils";

// Key to track if we've had a crash and need nuclear reset
const CRASH_RECOVERY_KEY = "@quotecat/needs_nuclear_reset";
const STARTUP_COUNT_KEY = "@quotecat/startup_count";
const STARTUP_SUCCESS_KEY = "@quotecat/startup_success";
const MAX_STARTUP_ATTEMPTS = 3; // After 3 rapid crashes, do nuclear reset

// Key to track if we've completed startup integrity check
const INTEGRITY_CHECK_KEY = "@quotecat/last_integrity_check";
const RECOVERY_IN_PROGRESS_KEY = "@quotecat/recovery_in_progress";

/**
 * CRITICAL: Check for crash loop and nuclear reset BEFORE any other data access
 * This must be called at the very start of app initialization
 * Returns true if a nuclear reset was performed
 * OPTIMIZED: Uses multiGet for faster reads
 */
export async function checkCrashLoopAndReset(): Promise<boolean> {
  try {
    // Batch read for speed
    const keys = [STARTUP_COUNT_KEY, STARTUP_SUCCESS_KEY];
    const results = await AsyncStorage.multiGet(keys);
    const countStr = results[0][1];
    const successStr = results[1][1];

    const count = countStr ? parseInt(countStr, 10) : 0;
    const lastSuccess = successStr ? parseInt(successStr, 10) : 0;

    // If we succeeded recently, we're fine - no crash loop
    const now = Date.now();
    if (lastSuccess && now - lastSuccess < 60000) {
      // Successful startup within last minute, just increment
      await AsyncStorage.setItem(STARTUP_COUNT_KEY, "1");
      return false;
    }

    // If we've crashed too many times, do nuclear reset
    if (count >= MAX_STARTUP_ATTEMPTS) {
      console.warn(`🚨 CRASH LOOP DETECTED: ${count} failed startups`);
      console.warn("🔥 PERFORMING NUCLEAR RESET...");

      // Clear ALL quotecat data to break the crash loop
      const allKeys = await AsyncStorage.getAllKeys();
      const quotecatKeys = allKeys.filter(k => k.startsWith("@quotecat/"));

      // Remove all keys EXCEPT the startup counter (we'll reset it after)
      const keysToRemove = quotecatKeys.filter(k => k !== STARTUP_COUNT_KEY);
      await AsyncStorage.multiRemove(keysToRemove);

      // Reset the counter
      await AsyncStorage.setItem(STARTUP_COUNT_KEY, "0");

      console.log("✅ Nuclear reset complete - all local data cleared");
      return true;
    }

    // Increment the counter (we haven't succeeded yet)
    await AsyncStorage.setItem(STARTUP_COUNT_KEY, (count + 1).toString());
    return false;
  } catch (error) {
    console.error("Crash loop check failed:", error);
    // If even the counter read failed, something is very wrong
    // Try a blind reset
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const quotecatKeys = allKeys.filter(k => k.startsWith("@quotecat/"));
      await AsyncStorage.multiRemove(quotecatKeys);
      console.warn("🔥 Blind nuclear reset performed");
    } catch (e) {
      console.error("Even blind reset failed:", e);
    }
    return true;
  }
}

/**
 * Mark startup as successful
 * Call this AFTER the app has fully loaded without crashing
 */
export async function markStartupSuccess(): Promise<void> {
  try {
    await AsyncStorage.setItem(STARTUP_SUCCESS_KEY, Date.now().toString());
    await AsyncStorage.setItem(STARTUP_COUNT_KEY, "0");
    console.log("✅ Startup marked as successful");
  } catch (error) {
    console.error("Failed to mark startup success:", error);
  }
}

export type IntegrityStatus = {
  isHealthy: boolean;
  needsRecovery: boolean;
  issues: string[];
  recoveryInProgress: boolean;
};

/**
 * Check if a recovery is currently in progress
 * (Prevents infinite recovery loops)
 */
async function isRecoveryInProgress(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(RECOVERY_IN_PROGRESS_KEY);
    if (!value) return false;

    // Recovery shouldn't take more than 5 minutes
    const startTime = parseInt(value, 10);
    const elapsed = Date.now() - startTime;
    if (elapsed > 5 * 60 * 1000) {
      // Recovery timed out, clear the flag
      await AsyncStorage.removeItem(RECOVERY_IN_PROGRESS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark recovery as in progress
 */
async function markRecoveryStarted(): Promise<void> {
  await AsyncStorage.setItem(RECOVERY_IN_PROGRESS_KEY, Date.now().toString());
}

/**
 * Mark recovery as complete
 */
async function markRecoveryComplete(): Promise<void> {
  await AsyncStorage.removeItem(RECOVERY_IN_PROGRESS_KEY);
}

/**
 * Perform startup integrity check
 * OPTIMIZED: Only runs full check if we had a recent crash or haven't checked in a while
 */
export async function performStartupIntegrityCheck(): Promise<IntegrityStatus> {
  try {
    // Check if recovery is already in progress
    const recovering = await isRecoveryInProgress();
    if (recovering) {
      console.warn("⚠️ Recovery already in progress, waiting...");
      return {
        isHealthy: false,
        needsRecovery: false,
        issues: ["Recovery in progress"],
        recoveryInProgress: true,
      };
    }

    // OPTIMIZATION: Skip full integrity check if we had a successful startup recently
    // This makes normal app launches FAST
    const lastCheckStr = await AsyncStorage.getItem(INTEGRITY_CHECK_KEY);
    const startupCountStr = await AsyncStorage.getItem(STARTUP_COUNT_KEY);
    const startupCount = startupCountStr ? parseInt(startupCountStr, 10) : 0;

    if (lastCheckStr && startupCount <= 1) {
      const lastCheck = new Date(lastCheckStr).getTime();
      const hoursSinceCheck = (Date.now() - lastCheck) / (1000 * 60 * 60);

      // If we checked within the last 24 hours and startup count is low, skip
      if (hoursSinceCheck < 24) {
        console.log("⚡ Skipping integrity check (recent success)");
        return {
          isHealthy: true,
          needsRecovery: false,
          issues: [],
          recoveryInProgress: false,
        };
      }
    }

    // Run full integrity check (only after crashes or daily)
    console.log("🔍 Running full data integrity check...");
    const { healthy, issues } = await checkDataIntegrity();

    if (healthy) {
      console.log("✅ Data integrity check passed");
      await AsyncStorage.setItem(INTEGRITY_CHECK_KEY, new Date().toISOString());
      return {
        isHealthy: true,
        needsRecovery: false,
        issues: [],
        recoveryInProgress: false,
      };
    }

    // Data is corrupt!
    console.error("🚨 Data corruption detected:", issues);

    // Check if user is authenticated (can recover from cloud)
    const userId = await getCurrentUserId();
    const canRecoverFromCloud = !!userId;

    if (canRecoverFromCloud) {
      console.log("📡 User is authenticated, will recover from cloud");
      return {
        isHealthy: false,
        needsRecovery: true,
        issues,
        recoveryInProgress: false,
      };
    } else {
      // No cloud to recover from - just clear corrupt data
      console.log("🗑️ No cloud backup, clearing corrupt data");
      await emergencyReset();
      return {
        isHealthy: true, // We recovered by clearing
        needsRecovery: false,
        issues,
        recoveryInProgress: false,
      };
    }
  } catch (error) {
    console.error("Integrity check failed:", error);
    return {
      isHealthy: false,
      needsRecovery: true,
      issues: [`Check failed: ${error}`],
      recoveryInProgress: false,
    };
  }
}

/**
 * Recover data from cloud
 * This is the nuclear option - wipes local and rebuilds from cloud
 */
export async function recoverFromCloud(): Promise<boolean> {
  console.log("🔄 Starting cloud recovery...");

  try {
    await markRecoveryStarted();

    // Clear all local data
    await emergencyReset();

    // Import sync functions dynamically to avoid circular deps
    const { syncQuotes, resetSyncMetadata } = await import("./quotesSync");
    const { syncInvoices } = await import("./invoicesSync");
    const { syncClients } = await import("./clientsSync");

    // Reset sync metadata to force full sync
    await resetSyncMetadata();

    // Download fresh from cloud (sequential to avoid memory pressure)
    console.log("📥 Downloading quotes from cloud...");
    const quotesResult = await syncQuotes();

    await new Promise(resolve => setTimeout(resolve, 500));

    console.log("📥 Downloading invoices from cloud...");
    const invoicesResult = await syncInvoices();

    await new Promise(resolve => setTimeout(resolve, 500));

    console.log("📥 Downloading clients from cloud...");
    const clientsResult = await syncClients();

    const success = quotesResult.success && invoicesResult.success && clientsResult.success;

    if (success) {
      console.log("✅ Cloud recovery complete!");
      await AsyncStorage.setItem(INTEGRITY_CHECK_KEY, new Date().toISOString());
    } else {
      console.error("❌ Cloud recovery had some failures");
    }

    await markRecoveryComplete();
    return success;
  } catch (error) {
    console.error("Cloud recovery failed:", error);
    await markRecoveryComplete();
    return false;
  }
}

/**
 * Get the last integrity check timestamp
 */
export async function getLastIntegrityCheck(): Promise<Date | null> {
  try {
    const value = await AsyncStorage.getItem(INTEGRITY_CHECK_KEY);
    return value ? new Date(value) : null;
  } catch {
    return null;
  }
}

/**
 * Force a full data refresh from cloud
 * Use this when user suspects data issues
 */
export async function forceCloudRefresh(): Promise<boolean> {
  console.log("🔄 User requested force refresh from cloud");
  return recoverFromCloud();
}

/**
 * Get diagnostics for debugging data issues
 */
export async function getDataDiagnostics(): Promise<{
  lastIntegrityCheck: Date | null;
  corruptionLog: Array<{ timestamp: string; key: string; reason: string }>;
  storageSizes: Record<string, number>;
}> {
  const lastCheck = await getLastIntegrityCheck();
  const corruptionLog = await getCorruptionLog();

  // Get sizes of main storage keys
  const keysToCheck = [
    "@quotecat/quotes",
    "@quotecat/invoices",
    "@quotecat/clients",
  ];

  const storageSizes: Record<string, number> = {};
  for (const key of keysToCheck) {
    try {
      const data = await AsyncStorage.getItem(key);
      storageSizes[key] = data ? data.length : 0;
    } catch {
      storageSizes[key] = -1; // Error reading
    }
  }

  return {
    lastIntegrityCheck: lastCheck,
    corruptionLog,
    storageSizes,
  };
}
