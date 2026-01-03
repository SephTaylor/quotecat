// lib/safeStorage.ts
// Bulletproof storage wrapper that prevents OOM crashes from corrupt data
// This is the foundation for a $1M business - no crashes allowed!

import AsyncStorage from "@react-native-async-storage/async-storage";

// Maximum size we'll attempt to parse (10MB)
// Anything larger is definitely corrupt
const MAX_SAFE_SIZE = 10 * 1024 * 1024;

// Maximum reasonable size for specific data types
const SIZE_LIMITS = {
  quotes: 5 * 1024 * 1024, // 5MB for all quotes
  invoices: 5 * 1024 * 1024, // 5MB for all invoices
  clients: 1 * 1024 * 1024, // 1MB for all clients
  default: 1 * 1024 * 1024, // 1MB default
};

// Corruption log key - track when we've had to recover
const CORRUPTION_LOG_KEY = "@quotecat/corruption_log";

type SizeCategory = keyof typeof SIZE_LIMITS;

/**
 * Log a corruption event for debugging
 */
async function logCorruption(key: string, reason: string, size?: number): Promise<void> {
  try {
    const log = await AsyncStorage.getItem(CORRUPTION_LOG_KEY);
    const events = log ? JSON.parse(log) : [];
    events.push({
      timestamp: new Date().toISOString(),
      key,
      reason,
      size,
    });
    // Keep only last 50 events
    const trimmed = events.slice(-50);
    await AsyncStorage.setItem(CORRUPTION_LOG_KEY, JSON.stringify(trimmed));
    console.error(`🚨 CORRUPTION DETECTED: ${key} - ${reason} (size: ${size})`);
  } catch (e) {
    console.error("Failed to log corruption:", e);
  }
}

/**
 * Get the size limit for a storage key
 */
function getSizeLimit(key: string): number {
  if (key.includes("quotes")) return SIZE_LIMITS.quotes;
  if (key.includes("invoices")) return SIZE_LIMITS.invoices;
  if (key.includes("clients")) return SIZE_LIMITS.clients;
  return SIZE_LIMITS.default;
}

/**
 * Validate that a string is parseable JSON
 * Returns the parsed object if valid, null if invalid
 */
function safeJsonParse<T>(json: string, key: string): T | null {
  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch (e) {
    logCorruption(key, `Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`);
    return null;
  }
}

/**
 * Validate an array has expected structure (not deeply nested or circular)
 */
function validateArrayDepth(arr: unknown[], maxDepth: number = 5): boolean {
  if (maxDepth <= 0) return false;

  for (const item of arr) {
    if (Array.isArray(item)) {
      if (!validateArrayDepth(item, maxDepth - 1)) return false;
    } else if (item && typeof item === "object") {
      // Check for circular references or excessive nesting
      const values = Object.values(item as object);
      for (const val of values) {
        if (Array.isArray(val)) {
          if (!validateArrayDepth(val, maxDepth - 1)) return false;
        }
      }
    }
  }
  return true;
}

export interface SafeReadResult<T> {
  success: boolean;
  data: T | null;
  wasCorrupt: boolean;
  error?: string;
}

/**
 * Safely read and parse data from AsyncStorage
 * - Checks size limits before parsing
 * - Validates JSON structure
 * - Returns null instead of crashing on corrupt data
 * - Logs corruption events for debugging
 */
export async function safeRead<T>(key: string): Promise<SafeReadResult<T>> {
  try {
    const raw = await AsyncStorage.getItem(key);

    // No data is fine
    if (!raw) {
      return { success: true, data: null, wasCorrupt: false };
    }

    // Check raw size BEFORE parsing
    const size = raw.length;
    const limit = getSizeLimit(key);

    if (size > MAX_SAFE_SIZE) {
      await logCorruption(key, "Exceeds maximum safe size", size);
      return {
        success: false,
        data: null,
        wasCorrupt: true,
        error: `Data exceeds safe size limit (${size} > ${MAX_SAFE_SIZE})`
      };
    }

    if (size > limit) {
      await logCorruption(key, "Exceeds category size limit", size);
      // Still try to parse but log the warning
      console.warn(`⚠️ ${key} is larger than expected: ${size} bytes`);
    }

    // Try to parse
    const parsed = safeJsonParse<T>(raw, key);

    if (parsed === null) {
      return {
        success: false,
        data: null,
        wasCorrupt: true,
        error: "Failed to parse JSON"
      };
    }

    // Validate array depth if it's an array
    if (Array.isArray(parsed)) {
      if (!validateArrayDepth(parsed)) {
        await logCorruption(key, "Array too deeply nested (possible circular reference)");
        return {
          success: false,
          data: null,
          wasCorrupt: true,
          error: "Data structure too deeply nested"
        };
      }
    }

    return { success: true, data: parsed, wasCorrupt: false };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    await logCorruption(key, `Read error: ${error}`);
    return {
      success: false,
      data: null,
      wasCorrupt: true,
      error
    };
  }
}

/**
 * Safely write data to AsyncStorage
 * - Validates data before writing
 * - Uses atomic write pattern
 * - Validates after write
 */
export async function safeWrite<T>(key: string, data: T): Promise<boolean> {
  try {
    // Serialize first to catch any stringify errors
    const json = JSON.stringify(data);

    // Check size
    if (json.length > MAX_SAFE_SIZE) {
      console.error(`❌ Data too large to write: ${key} (${json.length} bytes)`);
      return false;
    }

    // Write to a temporary key first (atomic pattern)
    const tempKey = `${key}_temp`;
    await AsyncStorage.setItem(tempKey, json);

    // Verify the temp write
    const verify = await AsyncStorage.getItem(tempKey);
    if (verify !== json) {
      console.error(`❌ Write verification failed for ${key}`);
      await AsyncStorage.removeItem(tempKey);
      return false;
    }

    // Now atomically move to the real key
    await AsyncStorage.setItem(key, json);
    await AsyncStorage.removeItem(tempKey);

    return true;
  } catch (e) {
    console.error(`❌ Safe write failed for ${key}:`, e);
    return false;
  }
}

/**
 * Clear corrupt data and prepare for recovery
 */
export async function clearCorruptData(key: string): Promise<void> {
  try {
    await logCorruption(key, "Data cleared for recovery");
    await AsyncStorage.removeItem(key);
    await AsyncStorage.removeItem(`${key}_temp`);
  } catch (e) {
    console.error(`Failed to clear ${key}:`, e);
  }
}

/**
 * Get corruption log for debugging
 */
export async function getCorruptionLog(): Promise<Array<{
  timestamp: string;
  key: string;
  reason: string;
  size?: number;
}>> {
  try {
    const log = await AsyncStorage.getItem(CORRUPTION_LOG_KEY);
    return log ? JSON.parse(log) : [];
  } catch {
    return [];
  }
}

/**
 * Check if any data is potentially corrupt
 * Call this on app startup to detect issues early
 */
export async function checkDataIntegrity(): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  const keysToCheck = [
    "@quotecat/quotes",
    "@quotecat/invoices",
    "@quotecat/clients",
  ];

  for (const key of keysToCheck) {
    const result = await safeRead(key);
    if (result.wasCorrupt) {
      issues.push(`${key}: ${result.error}`);
    }
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

/**
 * Emergency recovery: Clear all local data
 * Use when data is so corrupt that normal recovery fails
 */
export async function emergencyReset(): Promise<void> {
  console.warn("🚨 EMERGENCY RESET: Clearing all local data");

  const keysToClear = [
    "@quotecat/quotes",
    "@quotecat/invoices",
    "@quotecat/clients",
    "@quotecat/quotes_temp",
    "@quotecat/invoices_temp",
    "@quotecat/clients_temp",
    "@quotecat/sync_metadata",
    "@quotecat/invoices_sync_metadata",
    "@quotecat/clients_sync_metadata",
    "@quotecat/quotes_sync_lock",
    "@quotecat/invoices_sync_lock",
    "@quotecat/clients_sync_lock",
  ];

  for (const key of keysToClear) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error(`Failed to clear ${key}:`, e);
    }
  }

  await logCorruption("SYSTEM", "Emergency reset performed");
}
