// lib/usageTracking.ts
// Usage event tracking for Team tier detection and analytics

import { supabase } from "./supabase";
import { getCurrentUserId } from "./auth";
import { getDeviceId, getDeviceInfo } from "./device";

/**
 * Event types for usage tracking
 */
export const UsageEventTypes = {
  // Auth events
  SIGN_IN: "sign_in",
  SIGN_OUT: "sign_out",

  // Quote events
  QUOTE_CREATED: "quote_created",
  QUOTE_UPDATED: "quote_updated",
  QUOTE_DELETED: "quote_deleted",

  // Export events
  PDF_EXPORTED: "pdf_exported",
  CSV_EXPORTED: "csv_exported",

  // Sync events
  CLOUD_SYNC: "cloud_sync",

  // Session events
  APP_OPENED: "app_opened",
  APP_BACKGROUNDED: "app_backgrounded",
} as const;

type UsageEventType = typeof UsageEventTypes[keyof typeof UsageEventTypes];

/**
 * Log a usage event to Supabase
 * Non-blocking - failures are logged but don't interrupt user flow
 */
export async function logUsageEvent(
  eventType: UsageEventType,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      // Don't log events for non-authenticated users
      return;
    }

    const deviceInfo = await getDeviceInfo();

    const event = {
      user_id: userId,
      event_type: eventType,
      metadata: {
        ...metadata,
        device_id: deviceInfo.deviceId,
        platform: deviceInfo.platform,
        os_version: deviceInfo.osVersion,
        app_version: deviceInfo.appVersion,
        timestamp: new Date().toISOString(),
      },
    };

    // Non-blocking insert
    supabase
      .from("usage_events")
      .insert(event)
      .then(({ error }) => {
        if (error) {
          console.warn("Failed to log usage event:", error);
        }
      })
      .catch((error) => {
        console.warn("Usage event logging error:", error);
      });
  } catch (error) {
    console.warn("Usage event tracking error:", error);
  }
}

/**
 * Get device count for current user
 * Returns number of unique devices that have synced quotes
 */
export async function getDeviceCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return 0;
    }

    // Query distinct device_ids from quotes table
    const { data, error } = await supabase
      .from("quotes")
      .select("device_id")
      .eq("user_id", userId)
      .not("device_id", "is", null);

    if (error) {
      console.error("Failed to get device count:", error);
      return 0;
    }

    if (!data || data.length === 0) {
      return 0;
    }

    // Count unique device IDs
    const uniqueDevices = new Set(
      data.map((row: any) => row.device_id).filter(Boolean)
    );

    return uniqueDevices.size;
  } catch (error) {
    console.error("Device count error:", error);
    return 0;
  }
}

/**
 * Get list of devices for current user
 * Returns device IDs with last activity time
 */
export async function getDeviceList(): Promise<
  Array<{
    deviceId: string;
    lastActive: string;
    quotesCount: number;
  }>
> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    // Query quotes grouped by device_id
    const { data, error } = await supabase
      .from("quotes")
      .select("device_id, synced_at")
      .eq("user_id", userId)
      .not("device_id", "is", null)
      .order("synced_at", { ascending: false });

    if (error) {
      console.error("Failed to get device list:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by device_id
    const deviceMap = new Map<
      string,
      { lastActive: string; quotesCount: number }
    >();

    for (const row of data) {
      const deviceId = row.device_id as string;
      const syncedAt = row.synced_at as string;

      if (!deviceMap.has(deviceId)) {
        deviceMap.set(deviceId, {
          lastActive: syncedAt,
          quotesCount: 1,
        });
      } else {
        const existing = deviceMap.get(deviceId)!;
        existing.quotesCount++;
        // Keep most recent sync time
        if (new Date(syncedAt) > new Date(existing.lastActive)) {
          existing.lastActive = syncedAt;
        }
      }
    }

    // Convert to array
    return Array.from(deviceMap.entries()).map(([deviceId, info]) => ({
      deviceId,
      lastActive: info.lastActive,
      quotesCount: info.quotesCount,
    }));
  } catch (error) {
    console.error("Device list error:", error);
    return [];
  }
}

/**
 * Check if user shows signs of multi-user/team usage
 * Returns true if:
 * - 3+ unique devices
 * - OR 2+ devices with activity in last 7 days
 */
export async function shouldSuggestTeamTier(): Promise<boolean> {
  try {
    const devices = await getDeviceList();

    if (devices.length >= 3) {
      return true;
    }

    if (devices.length >= 2) {
      // Check if multiple devices active in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentlyActiveDevices = devices.filter((device) => {
        return new Date(device.lastActive) > sevenDaysAgo;
      });

      if (recentlyActiveDevices.length >= 2) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Team tier check error:", error);
    return false;
  }
}
