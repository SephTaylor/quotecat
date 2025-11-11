// lib/device.ts
// Device tracking for multi-device usage patterns and Team tier upsells

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "@quotecat/device_id";

/**
 * Get or generate a unique device ID
 * Persists across app sessions
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Check for existing device ID
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

    if (deviceId) {
      return deviceId;
    }

    // Generate new device ID
    // Format: platform-timestamp-random
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 11);
    const platform = Platform.OS;

    deviceId = `${platform}-${timestamp}-${random}`;

    // Store for future use
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);

    return deviceId;
  } catch (error) {
    console.error("Failed to get device ID:", error);
    // Fallback to temporary ID
    return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Get device information for analytics
 */
export async function getDeviceInfo(): Promise<{
  deviceId: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  deviceName?: string;
}> {
  const deviceId = await getDeviceId();

  return {
    deviceId,
    platform: Platform.OS,
    osVersion: Platform.Version.toString(),
    appVersion: Application.nativeApplicationVersion || "unknown",
    deviceName: await getDeviceName(),
  };
}

/**
 * Get device name for display (e.g., "iPhone 15 Pro", "Samsung Galaxy S23")
 */
async function getDeviceName(): Promise<string | undefined> {
  try {
    if (Platform.OS === "ios") {
      // iOS device name is available
      return await Application.getIosIdForVendorAsync();
    } else if (Platform.OS === "android") {
      // Android device model
      return `${Application.androidManufacturer || "Android"} ${
        Application.androidModel || "Device"
      }`;
    }
    return undefined;
  } catch (error) {
    console.error("Failed to get device name:", error);
    return undefined;
  }
}

/**
 * Reset device ID (for testing)
 */
export async function resetDeviceId(): Promise<void> {
  await AsyncStorage.removeItem(DEVICE_ID_KEY);
  console.log("🗑️ Device ID reset");
}
