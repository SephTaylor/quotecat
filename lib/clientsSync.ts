// lib/clientsSync.ts
// Cloud sync service for clients (Pro/Premium feature)

import { supabase } from "./supabase";
// Note: clients functions are imported dynamically to avoid circular dependency
import type { Client } from "./types";
import { getCurrentUserId } from "./authUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_METADATA_KEY = "@quotecat/clients_sync_metadata";
const MAX_CLIENTS_PER_BATCH = 500; // Batch size for incremental sync
const MAX_CLIENTS_INITIAL_SYNC = 2000; // Limit for first-time full sync

// Sync lock to prevent concurrent sync operations
let syncInProgress = false;

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
 */
export async function uploadClient(client: Client): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot upload client: user not authenticated");
      return false;
    }

    // Map local Client to Supabase schema
    const supabaseClient = {
      id: client.id,
      user_id: userId,
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

    let query = supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
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
 */
export async function syncClients(): Promise<{
  success: boolean;
  downloaded: number;
  uploaded: number;
}> {
  // Prevent concurrent sync operations
  if (syncInProgress) {
    console.warn("Client sync already in progress, skipping");
    return { success: false, downloaded: 0, uploaded: 0 };
  }

  syncInProgress = true;

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync clients: user not authenticated");
      return { success: false, downloaded: 0, uploaded: 0 };
    }

    // Get sync metadata to determine if this is initial or incremental sync
    const metadata = await getSyncMetadata();
    const lastSyncAt = metadata.lastSyncAt;
    const isInitialSync = !lastSyncAt;

    if (isInitialSync) {
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
    const { getClients, saveClient } = await import("./clients");
    const localClients = await getClients();

    // Build maps for efficient lookup
    const cloudMap = new Map(cloudClients.map((c) => [c.id, c]));
    const localMap = new Map(localClients.map((c) => [c.id, c]));

    // Process cloud clients (download new or updated)
    for (const cloudClient of cloudClients) {
      try {
        const localClient = localMap.get(cloudClient.id);

        if (!localClient) {
          // New client from cloud - save locally
          await saveClient(cloudClient);
          downloaded++;
        } else {
          // Client exists in both - check which is newer (use safe timestamp)
          const cloudUpdated = safeGetTimestamp(cloudClient.updatedAt);
          const localUpdated = safeGetTimestamp(localClient.updatedAt);

          if (cloudUpdated > localUpdated && cloudUpdated > 0) {
            // Cloud is newer - update local
            await saveClient(cloudClient);
            downloaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to sync cloud client ${cloudClient.id}:`, error);
        // Continue with next client
      }
    }

    // Process local clients (upload new or updated since last sync)
    for (const localClient of localClients) {
      try {
        // For incremental sync, only upload clients modified since last sync
        if (lastSyncAt) {
          const localUpdated = safeGetTimestamp(localClient.updatedAt);
          const lastSync = safeGetTimestamp(lastSyncAt);

          // Skip clients that haven't changed since last sync
          if (localUpdated <= lastSync) {
            continue;
          }
        }

        const cloudClient = cloudMap.get(localClient.id);

        if (!cloudClient) {
          // New local client - upload to cloud
          const success = await uploadClient(localClient);
          if (success) uploaded++;
        } else {
          // Client exists in both - check which is newer (use safe timestamp)
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
    // Always release the sync lock
    syncInProgress = false;
  }
}

/**
 * Delete a client from cloud (soft delete)
 */
export async function deleteClientFromCloud(clientId: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot delete client from cloud: user not authenticated");
      return false;
    }

    // Use hard delete instead of soft delete to avoid RLS issues with UPDATE
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("user_id", userId);

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
