// lib/assembliesSync.ts
// Cloud sync service for assemblies (Pro/Premium feature)

import { supabase } from "./supabase";
import { getCurrentUserId } from "./authUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Import types from assemblies module
import type { Assembly } from "@/modules/assemblies/types";

const SYNC_METADATA_KEY = "@quotecat/assemblies_sync_metadata";
const SYNC_LOCK_KEY = "@quotecat/assemblies_sync_lock";
const MAX_ASSEMBLIES_PER_BATCH = 50;
const SYNC_COOLDOWN_MS = 5000;

let syncInProgress = false;

type SyncMetadata = {
  lastSyncAt: string | null;
  hasMigrated: boolean;
};

/**
 * Safe timestamp extractor - returns 0 for invalid dates
 */
function safeGetTimestamp(dateString?: string): number {
  if (!dateString) return 0;
  const time = new Date(dateString).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function getSyncLock(): Promise<{ inProgress: boolean; startedAt: string | null }> {
  try {
    const json = await AsyncStorage.getItem(SYNC_LOCK_KEY);
    if (!json) return { inProgress: false, startedAt: null };
    return JSON.parse(json);
  } catch {
    return { inProgress: false, startedAt: null };
  }
}

async function setSyncLock(inProgress: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_LOCK_KEY, JSON.stringify({
      inProgress,
      startedAt: inProgress ? new Date().toISOString() : null,
    }));
  } catch (error) {
    console.error("Failed to set assemblies sync lock:", error);
  }
}

async function clearStaleLock(): Promise<void> {
  try {
    const lock = await getSyncLock();
    if (lock.inProgress && lock.startedAt) {
      const elapsed = Date.now() - new Date(lock.startedAt).getTime();
      if (elapsed > 60 * 1000) {
        console.warn("⚠️ Clearing stale assemblies sync lock (>1 min old)");
        await setSyncLock(false);
      }
    }
  } catch (error) {
    console.error("Error checking stale assemblies lock:", error);
  }
}

async function checkSyncCooldown(): Promise<boolean> {
  try {
    const metadata = await getSyncMetadata();
    if (!metadata.lastSyncAt) return true;

    const elapsed = Date.now() - new Date(metadata.lastSyncAt).getTime();
    if (elapsed < SYNC_COOLDOWN_MS) {
      console.log(`⏳ Assemblies sync cooldown: ${Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)}s remaining`);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function getSyncMetadata(): Promise<SyncMetadata> {
  const defaults: SyncMetadata = { lastSyncAt: null, hasMigrated: false };
  try {
    const json = await AsyncStorage.getItem(SYNC_METADATA_KEY);
    if (!json) return defaults;
    const parsed = JSON.parse(json);
    return {
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
      hasMigrated: typeof parsed.hasMigrated === 'boolean' ? parsed.hasMigrated : false,
    };
  } catch {
    return defaults;
  }
}

async function saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error("Failed to save assemblies sync metadata:", error);
  }
}

/**
 * Upload a single assembly to Supabase
 */
export async function uploadAssembly(assembly: Assembly): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot upload assembly: user not authenticated");
      return false;
    }

    // Only sync items with fixed qty (filter out qtyFn items which can't be serialized)
    const syncableItems = assembly.items
      .filter(item => 'qty' in item)
      .map(item => ({
        productId: item.productId,
        qty: 'qty' in item ? item.qty : 0,
      }));

    const supabaseAssembly = {
      id: assembly.id,
      user_id: userId,
      name: assembly.name,
      description: assembly.description || null,
      category: assembly.category || null,
      items: syncableItems,
      created_at: assembly.createdAt || new Date().toISOString(),
      updated_at: assembly.updatedAt || new Date().toISOString(),
      deleted_at: null,
    };

    const { error } = await supabase
      .from("assemblies")
      .upsert(supabaseAssembly, { onConflict: "id" });

    if (error) {
      console.error("Failed to upload assembly:", error);
      return false;
    }

    console.log(`✅ Uploaded assembly: ${assembly.name} (${assembly.id})`);
    return true;
  } catch (error) {
    console.error("Upload assembly error:", error);
    return false;
  }
}

/**
 * Download assemblies from Supabase
 */
export async function downloadAssemblies(since?: string): Promise<Assembly[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot download assemblies: user not authenticated");
      return [];
    }

    let query = supabase
      .from("assemblies")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (since) {
      query = query.gt("updated_at", since);
      console.log(`📥 Incremental sync: fetching assemblies updated since ${since}`);
    }

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(MAX_ASSEMBLIES_PER_BATCH);

    if (error) {
      console.error("Failed to download assemblies:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map to local Assembly type
    const assemblies: Assembly[] = [];
    for (const row of data) {
      try {
        if (!row || !row.id) continue;

        // Parse items from JSONB
        const items = Array.isArray(row.items)
          ? row.items.map((item: any) => ({
              productId: item.productId,
              qty: item.qty || 0,
            }))
          : [];

        assemblies.push({
          id: row.id,
          name: row.name || "",
          description: row.description || undefined,
          category: row.category || undefined,
          items,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      } catch (parseError) {
        console.error(`Failed to parse assembly ${row?.id}:`, parseError);
      }
    }

    console.log(`✅ Downloaded ${assemblies.length} assemblies from cloud`);
    return assemblies;
  } catch (error) {
    console.error("Download assemblies error:", error);
    return [];
  }
}

/**
 * Delete an assembly from cloud
 */
export async function deleteAssemblyFromCloud(assemblyId: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from("assemblies")
      .delete()
      .eq("id", assemblyId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to delete assembly from cloud:", error);
      return false;
    }

    console.log(`✅ Deleted assembly from cloud: ${assemblyId}`);
    return true;
  } catch (error) {
    console.error("Delete assembly from cloud error:", error);
    return false;
  }
}

/**
 * Migrate local assemblies to cloud (one-time operation)
 */
export async function migrateLocalAssembliesToCloud(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  try {
    const metadata = await getSyncMetadata();
    if (metadata.hasMigrated) {
      console.log("Assemblies migration already completed");
      return { success: true, uploaded: 0, failed: 0 };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot migrate assemblies: user not authenticated");
      return { success: false, uploaded: 0, failed: 0 };
    }

    // Dynamic import to avoid circular dependency
    const { listAssemblies } = await import("@/modules/assemblies/storage");
    const localAssemblies = await listAssemblies();

    if (localAssemblies.length === 0) {
      console.log("No local assemblies to migrate");
      await saveSyncMetadata({ ...metadata, hasMigrated: true });
      return { success: true, uploaded: 0, failed: 0 };
    }

    console.log(`🔄 Migrating ${localAssemblies.length} assemblies to cloud...`);

    let uploaded = 0;
    let failed = 0;

    for (const assembly of localAssemblies) {
      const success = await uploadAssembly(assembly);
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

    console.log(`✅ Assemblies migration complete: ${uploaded} uploaded, ${failed} failed`);
    return { success: true, uploaded, failed };
  } catch (error) {
    console.error("Assemblies migration error:", error);
    return { success: false, uploaded: 0, failed: 0 };
  }
}

/**
 * Sync assemblies bi-directionally
 */
export async function syncAssemblies(): Promise<{
  success: boolean;
  downloaded: number;
  uploaded: number;
}> {
  await clearStaleLock();

  const canSync = await checkSyncCooldown();
  if (!canSync) {
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  if (syncInProgress) {
    console.warn("Assemblies sync already in progress (memory lock), skipping");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  const persistentLock = await getSyncLock();
  if (persistentLock.inProgress) {
    console.warn("Assemblies sync already in progress (persistent lock), skipping");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  syncInProgress = true;
  await setSyncLock(true);

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync assemblies: user not authenticated");
      return { success: false, downloaded: 0, uploaded: 0 };
    }

    const metadata = await getSyncMetadata();
    const lastSyncAt = metadata.lastSyncAt;
    const isInitialSync = !lastSyncAt;

    if (isInitialSync) {
      console.log("🔄 Starting initial full assemblies sync...");
    } else {
      console.log(`🔄 Starting incremental assemblies sync since ${lastSyncAt}`);
    }

    let downloaded = 0;
    let uploaded = 0;

    // Download from cloud
    const cloudAssemblies = await downloadAssemblies(lastSyncAt || undefined);

    // Get local assemblies
    const {
      listAssemblies,
      saveAssemblyLocally,
      saveAssembliesBatch,
      getLocallyDeletedAssemblyIds,
      clearDeletedAssemblyIds,
    } = await import("@/modules/assemblies/storage");

    const localAssemblies = await listAssemblies();

    // Build maps
    const cloudMap = new Map(cloudAssemblies.map((a) => [a.id, a]));
    const localMap = new Map(localAssemblies.map((a) => [a.id, a]));

    // Handle locally deleted assemblies
    const locallyDeletedIds = new Set(await getLocallyDeletedAssemblyIds());
    if (locallyDeletedIds.size > 0) {
      console.log(`🗑️ Found ${locallyDeletedIds.size} locally deleted assemblies to clean up`);
      for (const deletedId of locallyDeletedIds) {
        try {
          await deleteAssemblyFromCloud(deletedId);
        } catch (error) {
          // Continue
        }
      }
      await clearDeletedAssemblyIds();
    }

    // Process cloud assemblies -> local
    const assembliesToSave: Assembly[] = [];
    for (const cloudAssembly of cloudAssemblies) {
      if (locallyDeletedIds.has(cloudAssembly.id)) {
        continue; // Skip deleted
      }

      const localAssembly = localMap.get(cloudAssembly.id);

      if (!localAssembly) {
        assembliesToSave.push(cloudAssembly);
        downloaded++;
      } else {
        const cloudUpdated = safeGetTimestamp(cloudAssembly.updatedAt);
        const localUpdated = safeGetTimestamp(localAssembly.updatedAt);

        if (cloudUpdated > localUpdated && cloudUpdated > 0) {
          assembliesToSave.push(cloudAssembly);
          downloaded++;
        }
      }
    }

    // Batch save downloaded assemblies
    if (assembliesToSave.length > 0) {
      try {
        await saveAssembliesBatch(assembliesToSave);
        console.log(`✅ Batch saved ${assembliesToSave.length} assemblies locally`);
      } catch (error) {
        console.error("Failed to batch save assemblies:", error);
        for (const assembly of assembliesToSave) {
          try {
            await saveAssemblyLocally(assembly);
          } catch (e) {
            console.error(`Failed to save assembly ${assembly.id}:`, e);
          }
        }
      }
    }

    // Process local assemblies -> cloud
    for (const localAssembly of localAssemblies) {
      const cloudAssembly = cloudMap.get(localAssembly.id);

      if (!cloudAssembly) {
        // New local assembly - upload
        const success = await uploadAssembly(localAssembly);
        if (success) uploaded++;
      } else {
        // Exists in both - check if local is newer
        if (lastSyncAt) {
          const localUpdated = safeGetTimestamp(localAssembly.updatedAt);
          const lastSync = safeGetTimestamp(lastSyncAt);
          if (localUpdated <= lastSync) {
            continue; // Skip unchanged
          }
        }

        const cloudUpdated = safeGetTimestamp(cloudAssembly.updatedAt);
        const localUpdated = safeGetTimestamp(localAssembly.updatedAt);

        if (localUpdated > cloudUpdated && localUpdated > 0) {
          const success = await uploadAssembly(localAssembly);
          if (success) uploaded++;
        }
      }
    }

    await saveSyncMetadata({
      ...metadata,
      lastSyncAt: new Date().toISOString(),
    });

    const syncType = isInitialSync ? "Initial sync" : "Incremental sync";
    console.log(`✅ Assemblies ${syncType} complete: ${downloaded} downloaded, ${uploaded} uploaded`);

    return { success: true, downloaded, uploaded };
  } catch (error) {
    console.error("Assemblies sync error:", error);
    return { success: false, downloaded: 0, uploaded: 0 };
  } finally {
    syncInProgress = false;
    await setSyncLock(false);
  }
}

/**
 * Check if assemblies have been migrated
 */
export async function hasAssembliesMigrated(): Promise<boolean> {
  const metadata = await getSyncMetadata();
  return metadata.hasMigrated;
}
