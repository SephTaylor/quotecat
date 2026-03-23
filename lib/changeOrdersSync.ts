// lib/changeOrdersSync.ts
// Cloud sync service for change orders (Pro/Premium feature)

import { supabase } from "./supabase";
import { getCurrentUserId } from "./authUtils";
import { getUserState } from "./user";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChangeOrder } from "./types";
import {
  listAllChangeOrdersDB,
  getChangeOrderByIdDB,
  saveChangeOrderDB,
  type ChangeOrderDB,
} from "./database";

const SYNC_METADATA_KEY = "@quotecat/change_orders_sync";
const SYNC_LOCK_KEY = "@quotecat/change_orders_sync_lock";
const SYNC_COOLDOWN_MS = 5000;

// Memory lock for current session
let syncInProgress = false;

type SyncMetadata = {
  lastSyncAt: string | null;
  syncEnabled: boolean;
};

/**
 * Get persistent sync lock state
 */
async function getSyncLock(): Promise<{ inProgress: boolean; startedAt: string | null }> {
  try {
    const json = await AsyncStorage.getItem(SYNC_LOCK_KEY);
    if (!json) return { inProgress: false, startedAt: null };
    return JSON.parse(json);
  } catch {
    return { inProgress: false, startedAt: null };
  }
}

/**
 * Set persistent sync lock
 */
async function setSyncLock(inProgress: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_LOCK_KEY, JSON.stringify({
      inProgress,
      startedAt: inProgress ? new Date().toISOString() : null,
    }));
  } catch (error) {
    console.error("Failed to set change orders sync lock:", error);
  }
}

/**
 * Check if enough time has passed since last sync (cooldown)
 */
async function checkSyncCooldown(): Promise<boolean> {
  try {
    const metadata = await getSyncMetadata();
    if (!metadata.lastSyncAt) return true;

    const lastSync = new Date(metadata.lastSyncAt).getTime();
    const now = Date.now();
    const elapsed = now - lastSync;

    if (elapsed < SYNC_COOLDOWN_MS) {
      console.log(`⏳ Change orders sync cooldown: ${Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)}s remaining`);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Clear stale sync lock (if sync was stuck for more than 1 minute)
 */
async function clearStaleLock(): Promise<void> {
  try {
    const lock = await getSyncLock();
    if (lock.inProgress && lock.startedAt) {
      const started = new Date(lock.startedAt).getTime();
      const elapsed = Date.now() - started;
      if (elapsed > 60 * 1000) {
        console.warn("⚠️ Clearing stale change orders sync lock (>1 min old)");
        await setSyncLock(false);
      }
    }
  } catch (error) {
    console.error("Error checking stale lock:", error);
  }
}

/**
 * Safe timestamp extractor - returns 0 for invalid dates
 */
function safeGetTimestamp(dateString?: string): number {
  if (!dateString) return 0;
  const time = new Date(dateString).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Get sync metadata from storage
 */
async function getSyncMetadata(): Promise<SyncMetadata> {
  const defaultMetadata: SyncMetadata = {
    lastSyncAt: null,
    syncEnabled: true,
  };

  try {
    const json = await AsyncStorage.getItem(SYNC_METADATA_KEY);
    if (!json) return defaultMetadata;

    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) {
      return defaultMetadata;
    }

    return {
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
      syncEnabled: typeof parsed.syncEnabled === 'boolean' ? parsed.syncEnabled : true,
    };
  } catch (error) {
    console.error("Failed to load change orders sync metadata:", error);
    return defaultMetadata;
  }
}

/**
 * Save sync metadata to storage
 */
async function saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error("Failed to save change orders sync metadata:", error);
  }
}

/**
 * Check if change order sync is available (Pro/Premium only)
 */
export async function isChangeOrderSyncAvailable(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const userState = await getUserState();
  return userState?.tier === "pro" || userState?.tier === "premium";
}

/**
 * Convert local ChangeOrder to Supabase schema
 */
function localToCloud(co: ChangeOrder, userId: string) {
  return {
    id: co.id,
    user_id: userId,
    quote_id: co.quoteId,
    quote_number: co.quoteNumber || null,
    number: co.number,
    items: co.items,
    labor_before: co.laborBefore,
    labor_after: co.laborAfter,
    labor_delta: co.laborDelta,
    net_change: co.netChange,
    quote_total_before: co.quoteTotalBefore,
    quote_total_after: co.quoteTotalAfter,
    note: co.note || null,
    status: co.status,
    created_at: co.createdAt,
    updated_at: co.updatedAt,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Convert Supabase row to local ChangeOrder
 */
function cloudToLocal(row: any): ChangeOrder {
  return {
    id: row.id,
    quoteId: row.quote_id,
    quoteNumber: row.quote_number || undefined,
    number: row.number,
    items: row.items || [],
    laborBefore: parseFloat(row.labor_before) || 0,
    laborAfter: parseFloat(row.labor_after) || 0,
    laborDelta: parseFloat(row.labor_delta) || 0,
    netChange: parseFloat(row.net_change) || 0,
    quoteTotalBefore: parseFloat(row.quote_total_before) || 0,
    quoteTotalAfter: parseFloat(row.quote_total_after) || 0,
    note: row.note || undefined,
    status: row.status || "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert local ChangeOrder to ChangeOrderDB format for SQLite
 */
function changeOrderToDBRow(co: ChangeOrder, userId?: string): ChangeOrderDB {
  return {
    id: co.id,
    quoteId: co.quoteId,
    quoteNumber: co.quoteNumber,
    number: co.number,
    items: JSON.stringify(co.items || []),
    laborBefore: co.laborBefore,
    laborAfter: co.laborAfter,
    laborDelta: co.laborDelta,
    netChange: co.netChange,
    quoteTotalBefore: co.quoteTotalBefore,
    quoteTotalAfter: co.quoteTotalAfter,
    note: co.note,
    status: co.status,
    createdAt: co.createdAt,
    updatedAt: co.updatedAt,
    syncedAt: new Date().toISOString(),
    userId: userId,
  };
}

/**
 * Upload a single change order to Supabase
 */
export async function uploadChangeOrder(co: ChangeOrder): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot upload change order: user not authenticated");
      return false;
    }

    const supabaseCO = localToCloud(co, userId);

    const { error } = await supabase
      .from("change_orders")
      .upsert(supabaseCO, { onConflict: "id" });

    if (error) {
      console.error("Failed to upload change order:", error);
      return false;
    }

    console.log(`✅ Uploaded change order: CO-${co.number} (${co.id})`);
    return true;
  } catch (error) {
    console.error("Upload change order error:", error);
    return false;
  }
}

/**
 * Download change orders from Supabase (incremental)
 */
export async function downloadChangeOrders(since?: string): Promise<ChangeOrder[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot download change orders: user not authenticated");
      return [];
    }

    let query = supabase
      .from("change_orders")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (since) {
      query = query.gt("updated_at", since);
      console.log(`📥 Incremental change orders sync since ${since}`);
    }

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Failed to download change orders:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const changeOrders: ChangeOrder[] = [];
    for (const row of data) {
      try {
        if (!row || !row.id) continue;
        changeOrders.push(cloudToLocal(row));
      } catch (parseError) {
        console.error(`Failed to parse change order ${row?.id}:`, parseError);
      }
    }

    console.log(`✅ Downloaded ${changeOrders.length} change orders from cloud`);
    return changeOrders;
  } catch (error) {
    console.error("Download change orders error:", error);
    return [];
  }
}

/**
 * Soft delete a change order from cloud
 */
export async function deleteChangeOrderFromCloud(id: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot delete change order from cloud: user not authenticated");
      return false;
    }

    const { error } = await supabase
      .from("change_orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to delete change order from cloud:", error);
      return false;
    }

    console.log(`✅ Soft deleted change order from cloud: ${id}`);
    return true;
  } catch (error) {
    console.error("Delete change order from cloud error:", error);
    return false;
  }
}

/**
 * Sync change orders bi-directionally
 * - Downloads changes from cloud
 * - Uploads local changes to cloud
 * - Conflict resolution: last-write-wins based on updatedAt
 */
export async function syncChangeOrders(): Promise<{
  success: boolean;
  downloaded: number;
  uploaded: number;
}> {
  // Clear any stale locks
  await clearStaleLock();

  // Check cooldown
  const canSync = await checkSyncCooldown();
  if (!canSync) {
    console.warn("Change orders sync skipped: cooldown active");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  // Check memory lock
  if (syncInProgress) {
    console.warn("Change orders sync already in progress (memory lock)");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  // Check persistent lock
  const persistentLock = await getSyncLock();
  if (persistentLock.inProgress) {
    console.warn("Change orders sync already in progress (persistent lock)");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  // Set locks
  syncInProgress = true;
  await setSyncLock(true);

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync change orders: user not authenticated");
      return { success: false, downloaded: 0, uploaded: 0 };
    }

    const metadata = await getSyncMetadata();
    const lastSyncAt = metadata.lastSyncAt;
    const isInitialSync = !lastSyncAt;

    if (isInitialSync) {
      console.log("🔄 Starting initial change orders sync...");
    } else {
      console.log(`🔄 Incremental change orders sync since ${lastSyncAt}`);
    }

    let downloaded = 0;
    let uploaded = 0;

    // Step 1: Download cloud change orders
    const cloudCOs = await downloadChangeOrders(lastSyncAt || undefined);
    const cloudMap = new Map(cloudCOs.map((co) => [co.id, co]));

    // Step 2: Get local change orders
    const localCORows = listAllChangeOrdersDB();
    const localMap = new Map(localCORows.map((row) => [row.id, row]));

    // Step 3: Process cloud COs - save locally if newer
    for (const cloudCO of cloudCOs) {
      try {
        const localRow = localMap.get(cloudCO.id);

        if (!localRow) {
          // New from cloud - save locally
          saveChangeOrderDB(changeOrderToDBRow(cloudCO, userId));
          downloaded++;
        } else {
          // Exists in both - check which is newer
          const cloudUpdated = safeGetTimestamp(cloudCO.updatedAt);
          const localUpdated = safeGetTimestamp(localRow.updatedAt);

          if (cloudUpdated > localUpdated && cloudUpdated > 0) {
            // Cloud is newer - update local
            saveChangeOrderDB(changeOrderToDBRow(cloudCO, userId));
            downloaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to process cloud CO ${cloudCO.id}:`, error);
      }
    }

    // Step 4: Upload local COs that are newer or don't exist in cloud
    for (const localRow of localCORows) {
      try {
        // Skip if not updated since last sync (for incremental)
        if (lastSyncAt) {
          const localUpdated = safeGetTimestamp(localRow.updatedAt);
          const lastSync = safeGetTimestamp(lastSyncAt);
          if (localUpdated <= lastSync) continue;
        }

        const cloudCO = cloudMap.get(localRow.id);

        // Convert DB row to ChangeOrder
        const localCO: ChangeOrder = {
          id: localRow.id,
          quoteId: localRow.quoteId,
          quoteNumber: localRow.quoteNumber,
          number: localRow.number,
          items: JSON.parse(localRow.items || "[]"),
          laborBefore: localRow.laborBefore,
          laborAfter: localRow.laborAfter,
          laborDelta: localRow.laborDelta,
          netChange: localRow.netChange,
          quoteTotalBefore: localRow.quoteTotalBefore,
          quoteTotalAfter: localRow.quoteTotalAfter,
          note: localRow.note,
          status: localRow.status as ChangeOrder["status"],
          createdAt: localRow.createdAt,
          updatedAt: localRow.updatedAt,
        };

        if (!cloudCO) {
          // New local CO - upload to cloud
          const success = await uploadChangeOrder(localCO);
          if (success) uploaded++;
        } else {
          // Exists in both - upload if local is newer
          const cloudUpdated = safeGetTimestamp(cloudCO.updatedAt);
          const localUpdated = safeGetTimestamp(localRow.updatedAt);

          if (localUpdated > cloudUpdated && localUpdated > 0) {
            const success = await uploadChangeOrder(localCO);
            if (success) uploaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to sync local CO ${localRow.id}:`, error);
      }
    }

    // Update sync metadata
    await saveSyncMetadata({
      ...metadata,
      lastSyncAt: new Date().toISOString(),
    });

    const syncType = isInitialSync ? "Initial" : "Incremental";
    console.log(`✅ ${syncType} change orders sync: ${downloaded} downloaded, ${uploaded} uploaded`);

    return { success: true, downloaded, uploaded };
  } catch (error) {
    console.error("Change orders sync error:", error);
    return { success: false, downloaded: 0, uploaded: 0 };
  } finally {
    syncInProgress = false;
    await setSyncLock(false);
  }
}

/**
 * Get last sync timestamp
 */
export async function getLastChangeOrderSyncTime(): Promise<Date | null> {
  const metadata = await getSyncMetadata();
  return metadata.lastSyncAt ? new Date(metadata.lastSyncAt) : null;
}

/**
 * Reset sync metadata (for testing/debugging)
 */
export async function resetChangeOrderSyncMetadata(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_METADATA_KEY);
  console.log("🗑️ Change orders sync metadata reset");
}
