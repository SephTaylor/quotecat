// lib/pricebookSync.ts
// Cloud sync service for pricebook items (Premium feature)
// Syncs with webapp's pricebook_items table

import { supabase } from "./supabase";
import type { PricebookItem } from "./types";
import { getCurrentUserId } from "./authUtils";
import { getUserState } from "./user";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_METADATA_KEY = "@quotecat/pricebook_sync_metadata";
const SYNC_LOCK_KEY = "@quotecat/pricebook_sync_lock";
const MAX_ITEMS_PER_BATCH = 50;
const MAX_ITEMS_INITIAL_SYNC = 200;
const SYNC_COOLDOWN_MS = 5000;

let syncInProgress = false;

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
    console.error("Failed to set pricebook sync lock:", error);
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
    const elapsed = Date.now() - lastSync;

    if (elapsed < SYNC_COOLDOWN_MS) {
      console.log(`⏳ Pricebook sync cooldown: ${Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)}s remaining`);
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
        console.warn("⚠️ Clearing stale pricebook sync lock (>1 min old)");
        await setSyncLock(false);
      }
    }
  } catch (error) {
    console.error("Error checking stale pricebook lock:", error);
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

type SyncMetadata = {
  lastSyncAt: string | null;
  hasMigrated: boolean;
  syncEnabled: boolean;
};

/**
 * Get sync metadata from storage
 */
async function getSyncMetadata(): Promise<SyncMetadata> {
  const defaultMetadata: SyncMetadata = {
    lastSyncAt: null,
    hasMigrated: false,
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
      hasMigrated: typeof parsed.hasMigrated === 'boolean' ? parsed.hasMigrated : false,
      syncEnabled: typeof parsed.syncEnabled === 'boolean' ? parsed.syncEnabled : true,
    };
  } catch (error) {
    console.error("Failed to load pricebook sync metadata:", error);
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
    console.error("Failed to save pricebook sync metadata:", error);
  }
}

/**
 * Check if user has Premium tier (required for pricebook)
 */
async function isPremiumUser(): Promise<boolean> {
  try {
    const user = await getUserState();
    return user.tier === "premium";
  } catch {
    return false;
  }
}

/**
 * Upload a single pricebook item to Supabase
 */
export async function uploadPricebookItem(item: PricebookItem): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot upload pricebook item: user not authenticated");
      return false;
    }

    if (!(await isPremiumUser())) {
      console.warn("Cannot upload pricebook item: Premium tier required");
      return false;
    }

    // Map local PricebookItem to Supabase schema
    const supabaseItem = {
      id: item.id,
      user_id: userId,
      name: item.name,
      description: item.description || null,
      category: item.category || null,
      unit_price: item.unitPrice,
      unit_type: item.unitType || null,
      sku: item.sku || null,
      is_active: item.isActive !== false,
      source: item.source || "custom",
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    };

    const { error } = await supabase
      .from("pricebook_items")
      .upsert(supabaseItem, { onConflict: "id" });

    if (error) {
      console.error("Failed to upload pricebook item:", error);
      return false;
    }

    console.log(`✅ Uploaded pricebook item: ${item.name} (${item.id})`);
    return true;
  } catch (error) {
    console.error("Upload pricebook item error:", error);
    return false;
  }
}

/**
 * Download pricebook items from Supabase for current user
 */
export async function downloadPricebookItems(since?: string, isInitialSync = false): Promise<PricebookItem[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot download pricebook items: user not authenticated");
      return [];
    }

    let query = supabase
      .from("pricebook_items")
      .select("*")
      .eq("user_id", userId);

    // Only fetch active items (or all for sync purposes)
    // Note: webapp may not have deleted_at column, so we check is_active instead

    if (since) {
      query = query.gt("updated_at", since);
      console.log(`📥 Incremental pricebook sync: fetching items updated since ${since}`);
    }

    const limit = isInitialSync ? MAX_ITEMS_INITIAL_SYNC : MAX_ITEMS_PER_BATCH;

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to download pricebook items:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map Supabase data to local PricebookItem type
    const items: PricebookItem[] = [];
    for (const row of data) {
      try {
        if (!row || !row.id) {
          console.warn("Skipping invalid pricebook row:", row);
          continue;
        }

        items.push({
          id: row.id,
          name: row.name || "",
          description: row.description || undefined,
          category: row.category || undefined,
          unitPrice: parseFloat(row.unit_price) || 0,
          unitType: row.unit_type || undefined,
          sku: row.sku || undefined,
          isActive: row.is_active !== false,
          source: row.source || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      } catch (parseError) {
        console.error(`Failed to parse pricebook item ${row?.id}:`, parseError);
      }
    }

    console.log(`✅ Downloaded ${items.length} pricebook items from cloud`);
    return items;
  } catch (error) {
    console.error("Download pricebook items error:", error);
    return [];
  }
}

/**
 * Migrate local pricebook items to cloud (one-time operation)
 */
export async function migrateLocalPricebookToCloud(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  try {
    const metadata = await getSyncMetadata();
    if (metadata.hasMigrated) {
      console.log("Pricebook migration already completed");
      return { success: true, uploaded: 0, failed: 0 };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot migrate pricebook: user not authenticated");
      return { success: false, uploaded: 0, failed: 0 };
    }

    if (!(await isPremiumUser())) {
      console.warn("Cannot migrate pricebook: Premium tier required");
      return { success: false, uploaded: 0, failed: 0 };
    }

    const { getPricebookItems } = await import("./pricebook");
    const localItems = await getPricebookItems();

    if (localItems.length === 0) {
      console.log("No local pricebook items to migrate");
      await saveSyncMetadata({ ...metadata, hasMigrated: true });
      return { success: true, uploaded: 0, failed: 0 };
    }

    console.log(`🔄 Migrating ${localItems.length} pricebook items to cloud...`);

    let uploaded = 0;
    let failed = 0;

    for (const item of localItems) {
      const success = await uploadPricebookItem(item);
      if (success) {
        uploaded++;
      } else {
        failed++;
      }
    }

    await saveSyncMetadata({
      ...metadata,
      hasMigrated: true,
      lastSyncAt: new Date().toISOString(),
    });

    console.log(`✅ Pricebook migration complete: ${uploaded} uploaded, ${failed} failed`);
    return { success: true, uploaded, failed };
  } catch (error) {
    console.error("Pricebook migration error:", error);
    return { success: false, uploaded: 0, failed: 0 };
  }
}

/**
 * Sync pricebook items bi-directionally
 */
export async function syncPricebook(): Promise<{
  success: boolean;
  downloaded: number;
  uploaded: number;
}> {
  await clearStaleLock();

  const canSync = await checkSyncCooldown();
  if (!canSync) {
    console.warn("Pricebook sync skipped: cooldown active");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  if (syncInProgress) {
    console.warn("Pricebook sync already in progress (memory lock), skipping");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  const persistentLock = await getSyncLock();
  if (persistentLock.inProgress) {
    console.warn("Pricebook sync already in progress (persistent lock), skipping");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  syncInProgress = true;
  await setSyncLock(true);

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync pricebook: user not authenticated");
      return { success: false, downloaded: 0, uploaded: 0 };
    }

    if (!(await isPremiumUser())) {
      console.warn("Cannot sync pricebook: Premium tier required");
      return { success: false, downloaded: 0, uploaded: 0 };
    }

    const metadata = await getSyncMetadata();
    const lastSyncAt = metadata.lastSyncAt;
    const isInitialSync = !lastSyncAt;

    if (isInitialSync) {
      console.log("🔄 Starting initial full pricebook sync...");
    } else {
      console.log(`🔄 Starting incremental pricebook sync since ${lastSyncAt}`);
    }

    let downloaded = 0;
    let uploaded = 0;

    // Download cloud items
    const cloudItems = await downloadPricebookItems(lastSyncAt || undefined, isInitialSync);
    console.log(`📥 Fetched ${cloudItems.length} pricebook items from cloud`);

    // Get local items
    const { getPricebookItems, savePricebookItemLocally, savePricebookItemsBatch } = await import("./pricebook");
    const localItems = await getPricebookItems();

    // Build maps for lookup
    const cloudMap = new Map(cloudItems.map((i) => [i.id, i]));
    const localMap = new Map(localItems.map((i) => [i.id, i]));

    // Collect items to save locally
    const itemsToSave: PricebookItem[] = [];
    for (const cloudItem of cloudItems) {
      try {
        const localItem = localMap.get(cloudItem.id);

        if (!localItem) {
          itemsToSave.push(cloudItem);
          downloaded++;
        } else {
          const cloudUpdated = safeGetTimestamp(cloudItem.updatedAt);
          const localUpdated = safeGetTimestamp(localItem.updatedAt);

          if (cloudUpdated > localUpdated && cloudUpdated > 0) {
            itemsToSave.push(cloudItem);
            downloaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to process cloud pricebook item ${cloudItem.id}:`, error);
      }
    }

    // Batch save
    if (itemsToSave.length > 0) {
      try {
        await savePricebookItemsBatch(itemsToSave);
        console.log(`✅ Batch saved ${itemsToSave.length} pricebook items locally`);
      } catch (error) {
        console.error("Failed to batch save pricebook items:", error);
        for (const item of itemsToSave) {
          try {
            await savePricebookItemLocally(item);
          } catch (e) {
            console.error(`Failed to save pricebook item ${item.id}:`, e);
          }
        }
      }
    }

    // Upload local items
    for (const localItem of localItems) {
      try {
        if (lastSyncAt) {
          const localUpdated = safeGetTimestamp(localItem.updatedAt);
          const lastSync = safeGetTimestamp(lastSyncAt);
          if (localUpdated <= lastSync) continue;
        }

        const cloudItem = cloudMap.get(localItem.id);

        if (!cloudItem) {
          const success = await uploadPricebookItem(localItem);
          if (success) uploaded++;
        } else {
          const cloudUpdated = safeGetTimestamp(cloudItem.updatedAt);
          const localUpdated = safeGetTimestamp(localItem.updatedAt);

          if (localUpdated > cloudUpdated && localUpdated > 0) {
            const success = await uploadPricebookItem(localItem);
            if (success) uploaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to sync local pricebook item ${localItem.id}:`, error);
      }
    }

    await saveSyncMetadata({
      ...metadata,
      lastSyncAt: new Date().toISOString(),
    });

    const syncType = isInitialSync ? "Initial sync" : "Incremental sync";
    console.log(`✅ Pricebook ${syncType} complete: ${downloaded} downloaded, ${uploaded} uploaded`);

    return { success: true, downloaded, uploaded };
  } catch (error) {
    console.error("Pricebook sync error:", error);
    return { success: false, downloaded: 0, uploaded: 0 };
  } finally {
    syncInProgress = false;
    await setSyncLock(false);
  }
}

/**
 * Delete a pricebook item from cloud
 */
export async function deletePricebookItemFromCloud(itemId: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot delete pricebook item from cloud: user not authenticated");
      return false;
    }

    const { error } = await supabase
      .from("pricebook_items")
      .delete()
      .eq("id", itemId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to delete pricebook item from cloud:", error);
      return false;
    }

    console.log(`✅ Deleted pricebook item from cloud: ${itemId}`);
    return true;
  } catch (error) {
    console.error("Delete pricebook item from cloud error:", error);
    return false;
  }
}

/**
 * Check if pricebook sync is available (user must be Premium)
 */
export async function isPricebookSyncAvailable(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  return isPremiumUser();
}

/**
 * Get last sync timestamp
 */
export async function getPricebookLastSyncTime(): Promise<Date | null> {
  const metadata = await getSyncMetadata();
  return metadata.lastSyncAt ? new Date(metadata.lastSyncAt) : null;
}
