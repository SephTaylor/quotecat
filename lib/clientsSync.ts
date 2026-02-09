// lib/clientsSync.ts
// Cloud sync service for clients (Pro/Premium feature)

import { supabase } from "./supabase";
// Note: clients functions are imported dynamically to avoid circular dependency
import type { Client } from "./types";
import { getCurrentUserId } from "./authUtils";
import { getTechContext } from "./team";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocallyDeletedClientIdsDB } from "./database";

const SYNC_METADATA_KEY = "@quotecat/clients_sync_metadata";
const SYNC_LOCK_KEY = "@quotecat/clients_sync_lock";
const MAX_CLIENTS_PER_BATCH = 50; // Batch size for incremental sync
const MAX_CLIENTS_INITIAL_SYNC = 200; // Limit for first-time full sync
const SYNC_COOLDOWN_MS = 5000; // Minimum 5 seconds between syncs

// Memory lock for current session
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
    console.error("Failed to set clients sync lock:", error);
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
      console.log(`⏳ Clients sync cooldown: ${Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)}s remaining`);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Clear stale sync lock (if sync was stuck for more than 5 minutes)
 */
async function clearStaleLock(): Promise<void> {
  try {
    const lock = await getSyncLock();
    if (lock.inProgress && lock.startedAt) {
      const started = new Date(lock.startedAt).getTime();
      const elapsed = Date.now() - started;
      if (elapsed > 60 * 1000) { // 1 minute
        console.warn("⚠️ Clearing stale clients sync lock (>1 min old)");
        await setSyncLock(false);
      }
    }
  } catch (error) {
    console.error("Error checking stale clients lock:", error);
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
    if (!json) {
      return defaultMetadata;
    }

    const parsed = JSON.parse(json);

    // Validate parsed data has expected structure
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn("Invalid clients sync metadata format, using defaults");
      return defaultMetadata;
    }

    return {
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
      hasMigrated: typeof parsed.hasMigrated === 'boolean' ? parsed.hasMigrated : false,
      syncEnabled: typeof parsed.syncEnabled === 'boolean' ? parsed.syncEnabled : true,
    };
  } catch (error) {
    console.error("Failed to load clients sync metadata:", error);
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
    console.error("Failed to save clients sync metadata:", error);
  }
}

/**
 * Upload a single client to Supabase
 * For techs, clients are owned by the team owner (user_id = owner_id)
 */
export async function uploadClient(client: Client): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot upload client: user not authenticated");
      return false;
    }

    // Check if user is a tech - if so, use owner's user_id
    const techContext = await getTechContext(userId);
    const effectiveUserId = techContext.isTech && techContext.ownerId
      ? techContext.ownerId
      : userId;

    // Map local Client to Supabase schema
    const supabaseClient = {
      id: client.id,
      user_id: effectiveUserId,
      name: client.name,
      email: client.email || null,
      phone: client.phone || null,
      address: client.address || null,
      notes: client.notes || null,
      created_at: client.createdAt,
      updated_at: client.updatedAt,
      synced_at: new Date().toISOString(),
      deleted_at: null,
    };

    // Upsert (insert or update)
    const { error } = await supabase
      .from("clients")
      .upsert(supabaseClient, { onConflict: "id" });

    if (error) {
      console.error("Failed to upload client:", error);
      return false;
    }

    console.log(`✅ Uploaded client: ${client.name} (${client.id})`);
    return true;
  } catch (error) {
    console.error("Upload client error:", error);
    return false;
  }
}

/**
 * Download clients from Supabase for current user
 * For techs, downloads clients owned by the team owner
 * @param since - Only fetch clients updated after this timestamp (incremental sync)
 * @param isInitialSync - If true, this is a first-time sync (higher limit)
 */
export async function downloadClients(since?: string, isInitialSync = false): Promise<Client[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot download clients: user not authenticated");
      return [];
    }

    // Check if user is a tech - if so, use owner's user_id
    const techContext = await getTechContext(userId);
    const effectiveUserId = techContext.isTech && techContext.ownerId
      ? techContext.ownerId
      : userId;

    if (techContext.isTech) {
      console.log(`🔄 Downloading clients from team owner (${techContext.ownerCompanyName})...`);
    }

    let query = supabase
      .from("clients")
      .select("*")
      .eq("user_id", effectiveUserId)
      .is("deleted_at", null);

    // Incremental sync: only fetch clients updated since last sync
    if (since) {
      query = query.gt("updated_at", since);
      console.log(`📥 Incremental sync: fetching clients updated since ${since}`);
    }

    const limit = isInitialSync ? MAX_CLIENTS_INITIAL_SYNC : MAX_CLIENTS_PER_BATCH;

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to download clients:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map Supabase data to local Client type with validation
    const clients: Client[] = [];
    for (const row of data) {
      try {
        // Skip invalid rows
        if (!row || !row.id) {
          console.warn("Skipping invalid client row:", row);
          continue;
        }

        clients.push({
          id: row.id,
          name: row.name || "",
          email: row.email || undefined,
          phone: row.phone || undefined,
          address: row.address || undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      } catch (parseError) {
        console.error(`Failed to parse client ${row?.id}:`, parseError);
        // Continue with next client instead of failing entire sync
      }
    }

    console.log(`✅ Downloaded ${clients.length} clients from cloud`);
    return clients;
  } catch (error) {
    console.error("Download clients error:", error);
    return [];
  }
}

/**
 * Migrate local clients to cloud (one-time operation on first Pro/Premium login)
 */
export async function migrateLocalClientsToCloud(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  try {
    const metadata = await getSyncMetadata();
    if (metadata.hasMigrated) {
      console.log("Clients migration already completed");
      return { success: true, uploaded: 0, failed: 0 };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot migrate clients: user not authenticated");
      return { success: false, uploaded: 0, failed: 0 };
    }

    // Get all local clients (dynamic import to avoid circular dependency)
    const { getClients } = await import("./clients");
    const localClients = await getClients();

    if (localClients.length === 0) {
      console.log("No local clients to migrate");
      await saveSyncMetadata({ ...metadata, hasMigrated: true });
      return { success: true, uploaded: 0, failed: 0 };
    }

    console.log(`🔄 Migrating ${localClients.length} clients to cloud...`);

    let uploaded = 0;
    let failed = 0;

    // Upload each client
    for (const client of localClients) {
      const success = await uploadClient(client);
      if (success) {
        uploaded++;
      } else {
        failed++;
      }
    }

    // Mark migration as complete
    await saveSyncMetadata({
      ...metadata,
      hasMigrated: true,
      lastSyncAt: new Date().toISOString(),
    });

    console.log(
      `✅ Clients migration complete: ${uploaded} uploaded, ${failed} failed`
    );

    return { success: true, uploaded, failed };
  } catch (error) {
    console.error("Clients migration error:", error);
    return { success: false, uploaded: 0, failed: 0 };
  }
}

/**
 * Sync clients bi-directionally with INCREMENTAL sync
 * - Only fetches clients changed since last sync (huge performance win at scale)
 * - Conflict resolution: last-write-wins based on updatedAt
 * - Uses local-only saves to prevent sync loops
 * - Has cooldown to prevent rapid re-syncing
 */
export async function syncClients(): Promise<{
  success: boolean;
  downloaded: number;
  uploaded: number;
}> {
  // Clear any stale locks from crashed syncs
  await clearStaleLock();

  // Check cooldown
  const canSync = await checkSyncCooldown();
  if (!canSync) {
    console.warn("Client sync skipped: cooldown active");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  // Check both memory and persistent locks
  if (syncInProgress) {
    console.warn("Client sync already in progress (memory lock), skipping");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  const persistentLock = await getSyncLock();
  if (persistentLock.inProgress) {
    console.warn("Client sync already in progress (persistent lock), skipping");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  // Set both locks
  syncInProgress = true;
  await setSyncLock(true);

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync clients: user not authenticated");
      return { success: false, downloaded: 0, uploaded: 0 };
    }

    // Check if user is a tech - if so, sync with owner's data
    const techContext = await getTechContext(userId);

    // Get sync metadata to determine if this is initial or incremental sync
    const metadata = await getSyncMetadata();
    const lastSyncAt = metadata.lastSyncAt;
    const isInitialSync = !lastSyncAt;

    if (techContext.isTech) {
      console.log(`🔄 Syncing clients with team owner (${techContext.ownerCompanyName})...`);
    } else if (isInitialSync) {
      console.log("🔄 Starting initial full clients sync...");
    } else {
      console.log(`🔄 Starting incremental clients sync since ${lastSyncAt}`);
    }

    let downloaded = 0;
    let uploaded = 0;

    // Download cloud clients (incremental - only changed since lastSyncAt)
    const cloudClients = await downloadClients(lastSyncAt || undefined, isInitialSync);
    console.log(`📥 Fetched ${cloudClients.length} clients from cloud`);

    // Get local clients (dynamic import to avoid circular dependency)
    // Use saveClientsBatch for efficient batch saving!
    const { getClients, saveClientLocally, saveClientsBatch } = await import("./clients");
    const localClients = await getClients();

    // Build maps for efficient lookup
    const cloudMap = new Map(cloudClients.map((c) => [c.id, c]));
    const localMap = new Map(localClients.map((c) => [c.id, c]));

    // Build name map for deduplication (lowercase for case-insensitive matching)
    const localNameMap = new Map<string, Client>();
    for (const client of localClients) {
      const normalizedName = client.name.toLowerCase().trim();
      if (normalizedName) {
        localNameMap.set(normalizedName, client);
      }
    }

    // Get locally deleted client IDs to avoid re-downloading them
    const locallyDeletedIds = new Set(getLocallyDeletedClientIdsDB());
    if (locallyDeletedIds.size > 0) {
      console.log(`🗑️ Found ${locallyDeletedIds.size} locally deleted clients to skip`);

      // Clean up orphans: delete from cloud any clients that were deleted locally
      for (const deletedId of locallyDeletedIds) {
        try {
          await deleteClientFromCloud(deletedId);
        } catch (error) {
          // Silently continue - might already be deleted or not exist
        }
      }
    }

    // Collect cloud clients to save locally (instead of saving one by one)
    // This is MUCH more efficient - reads storage once, writes once
    const clientsToSave: Client[] = [];
    for (const cloudClient of cloudClients) {
      try {
        // Skip clients that were deleted locally (prevents resurrection)
        if (locallyDeletedIds.has(cloudClient.id)) {
          console.log(`⏭️ Skipping locally deleted client: ${cloudClient.id}`);
          continue;
        }

        const localClient = localMap.get(cloudClient.id);

        if (!localClient) {
          // Check for duplicate by name (case-insensitive)
          const normalizedName = cloudClient.name.toLowerCase().trim();
          const existingByName = localNameMap.get(normalizedName);

          if (existingByName) {
            // Duplicate detected - client with same name exists with different ID
            // Merge: use local ID but update with cloud data if cloud is newer
            const cloudUpdated = safeGetTimestamp(cloudClient.updatedAt);
            const localUpdated = safeGetTimestamp(existingByName.updatedAt);

            if (cloudUpdated > localUpdated && cloudUpdated > 0) {
              // Cloud data is newer - update local client with cloud data but keep local ID
              const mergedClient: Client = {
                ...cloudClient,
                id: existingByName.id, // Keep local ID to avoid duplicate
              };
              clientsToSave.push(mergedClient);
              downloaded++;
              console.log(`🔀 Merged duplicate client "${cloudClient.name}" (cloud ID: ${cloudClient.id} → local ID: ${existingByName.id})`);
            } else {
              console.log(`⏭️ Skipping duplicate client "${cloudClient.name}" (local is newer or same)`);
            }
          } else {
            // Truly new client from cloud - queue for batch save
            clientsToSave.push(cloudClient);
            downloaded++;
          }
        } else {
          // Client exists in both - check which is newer (use safe timestamp)
          const cloudUpdated = safeGetTimestamp(cloudClient.updatedAt);
          const localUpdated = safeGetTimestamp(localClient.updatedAt);

          if (cloudUpdated > localUpdated && cloudUpdated > 0) {
            // Cloud is newer - queue for batch save
            clientsToSave.push(cloudClient);
            downloaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to process cloud client ${cloudClient.id}:`, error);
        // Continue with next client
      }
    }

    // Batch save all clients at once (1 read + 1 write instead of N reads + N writes)
    if (clientsToSave.length > 0) {
      try {
        await saveClientsBatch(clientsToSave);
        console.log(`✅ Batch saved ${clientsToSave.length} clients locally`);
      } catch (error) {
        console.error("Failed to batch save clients:", error);
        // Fall back to individual saves on batch failure
        for (const client of clientsToSave) {
          try {
            await saveClientLocally(client);
          } catch (e) {
            console.error(`Failed to save client ${client.id}:`, e);
          }
        }
      }
    }

    // Process local clients (upload new or updated since last sync)
    for (const localClient of localClients) {
      try {
        // For incremental sync, skip clients that haven't changed locally since last sync
        if (lastSyncAt) {
          const localUpdated = safeGetTimestamp(localClient.updatedAt);
          const lastSync = safeGetTimestamp(lastSyncAt);

          if (localUpdated <= lastSync) {
            continue;
          }
        }

        const cloudClient = cloudMap.get(localClient.id);

        if (!cloudClient) {
          // New local client that doesn't exist in cloud - upload
          const success = await uploadClient(localClient);
          if (success) uploaded++;
        } else {
          // Client exists in both - only upload if local is newer
          const cloudUpdated = safeGetTimestamp(cloudClient.updatedAt);
          const localUpdated = safeGetTimestamp(localClient.updatedAt);

          if (localUpdated > cloudUpdated && localUpdated > 0) {
            // Local is newer - upload to cloud
            const success = await uploadClient(localClient);
            if (success) uploaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to sync local client ${localClient.id}:`, error);
        // Continue with next client
      }
    }

    // Update sync metadata with current timestamp
    await saveSyncMetadata({
      ...metadata,
      lastSyncAt: new Date().toISOString(),
    });

    const syncType = isInitialSync ? "Initial sync" : "Incremental sync";
    console.log(
      `✅ Clients ${syncType} complete: ${downloaded} downloaded, ${uploaded} uploaded`
    );

    return { success: true, downloaded, uploaded };
  } catch (error) {
    console.error("Clients sync error:", error);
    return { success: false, downloaded: 0, uploaded: 0 };
  } finally {
    // Always release both locks
    syncInProgress = false;
    await setSyncLock(false);
  }
}

/**
 * Delete a client from cloud (soft delete)
 * For techs, deletes from the team owner's data
 */
export async function deleteClientFromCloud(clientId: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot delete client from cloud: user not authenticated");
      return false;
    }

    // Check if user is a tech - if so, use owner's user_id
    const techContext = await getTechContext(userId);
    const effectiveUserId = techContext.isTech && techContext.ownerId
      ? techContext.ownerId
      : userId;

    // Use hard delete instead of soft delete to avoid RLS issues with UPDATE
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("user_id", effectiveUserId);

    if (error) {
      console.error("Failed to delete client from cloud:", error);
      return false;
    }

    console.log(`✅ Deleted client from cloud: ${clientId}`);
    return true;
  } catch (error) {
    console.error("Delete client from cloud error:", error);
    return false;
  }
}

/**
 * Check if sync is available (user must be authenticated)
 */
export async function isClientsSyncAvailable(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return !!userId;
}

/**
 * Get last sync timestamp
 */
export async function getClientsLastSyncTime(): Promise<Date | null> {
  const metadata = await getSyncMetadata();
  return metadata.lastSyncAt ? new Date(metadata.lastSyncAt) : null;
}

/**
 * Remove duplicate clients (keeps the one with most recent updatedAt)
 * Call this once to clean up existing duplicates
 */
export async function deduplicateClients(): Promise<{
  removed: number;
  kept: number;
}> {
  try {
    const { getClients, deleteClient } = await import("./clients");
    const allClients = await getClients();

    // Group clients by normalized name
    const nameGroups = new Map<string, Client[]>();
    for (const client of allClients) {
      const normalizedName = client.name.toLowerCase().trim();
      if (!normalizedName) continue;

      const group = nameGroups.get(normalizedName) || [];
      group.push(client);
      nameGroups.set(normalizedName, group);
    }

    let removed = 0;
    let kept = 0;

    // For each group with duplicates, keep the newest and delete the rest
    for (const [name, clients] of nameGroups) {
      if (clients.length <= 1) {
        kept += clients.length;
        continue;
      }

      // Sort by updatedAt descending (newest first)
      clients.sort((a, b) => {
        const aTime = safeGetTimestamp(a.updatedAt);
        const bTime = safeGetTimestamp(b.updatedAt);
        return bTime - aTime;
      });

      // Keep the first (newest), delete the rest
      const [keeper, ...duplicates] = clients;
      console.log(`🔀 Keeping "${keeper.name}" (${keeper.id}), removing ${duplicates.length} duplicate(s)`);
      kept++;

      for (const dup of duplicates) {
        try {
          await deleteClient(dup.id);
          removed++;
          console.log(`  🗑️ Removed duplicate: ${dup.id}`);
        } catch (error) {
          console.error(`  ❌ Failed to remove duplicate ${dup.id}:`, error);
        }
      }
    }

    console.log(`✅ Deduplication complete: kept ${kept}, removed ${removed}`);
    return { removed, kept };
  } catch (error) {
    console.error("Deduplication error:", error);
    return { removed: 0, kept: 0 };
  }
}
