// lib/clientsSync.ts
// Cloud sync service for clients (Pro/Premium feature)

import { supabase } from "./supabase";
// Note: clients functions are imported dynamically to avoid circular dependency
import type { Client } from "./types";
import { getCurrentUserId } from "./authUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_METADATA_KEY = "@quotecat/clients_sync_metadata";

type SyncMetadata = {
  lastSyncAt: string | null;
  hasMigrated: boolean;
  syncEnabled: boolean;
};

/**
 * Get sync metadata from storage
 */
async function getSyncMetadata(): Promise<SyncMetadata> {
  try {
    const json = await AsyncStorage.getItem(SYNC_METADATA_KEY);
    if (!json) {
      return {
        lastSyncAt: null,
        hasMigrated: false,
        syncEnabled: true,
      };
    }
    return JSON.parse(json);
  } catch (error) {
    console.error("Failed to load clients sync metadata:", error);
    return {
      lastSyncAt: null,
      hasMigrated: false,
      syncEnabled: true,
    };
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
 * Download all clients from Supabase for current user
 */
export async function downloadClients(): Promise<Client[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot download clients: user not authenticated");
      return [];
    }

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to download clients:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map Supabase data to local Client type
    const clients: Client[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email || undefined,
      phone: row.phone || undefined,
      address: row.address || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

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
 * Sync clients bi-directionally (download from cloud, merge with local, upload changes)
 * Conflict resolution: last-write-wins based on updatedAt
 */
export async function syncClients(): Promise<{
  success: boolean;
  downloaded: number;
  uploaded: number;
}> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync clients: user not authenticated");
      return { success: false, downloaded: 0, uploaded: 0 };
    }

    let downloaded = 0;
    let uploaded = 0;

    // Download cloud clients
    const cloudClients = await downloadClients();

    // Get local clients (dynamic import to avoid circular dependency)
    const { getClients, saveClient } = await import("./clients");
    const localClients = await getClients();

    // Build maps for efficient lookup
    const cloudMap = new Map(cloudClients.map((c) => [c.id, c]));
    const localMap = new Map(localClients.map((c) => [c.id, c]));

    // Process cloud clients (download new or updated)
    for (const cloudClient of cloudClients) {
      const localClient = localMap.get(cloudClient.id);

      if (!localClient) {
        // New client from cloud - save locally
        await saveClient(cloudClient);
        downloaded++;
      } else {
        // Client exists in both - check which is newer
        const cloudUpdated = new Date(cloudClient.updatedAt).getTime();
        const localUpdated = new Date(localClient.updatedAt).getTime();

        if (cloudUpdated > localUpdated) {
          // Cloud is newer - update local
          await saveClient(cloudClient);
          downloaded++;
        }
      }
    }

    // Process local clients (upload new or updated)
    for (const localClient of localClients) {
      const cloudClient = cloudMap.get(localClient.id);

      if (!cloudClient) {
        // New local client - upload to cloud
        const success = await uploadClient(localClient);
        if (success) uploaded++;
      } else {
        // Client exists in both - check which is newer
        const cloudUpdated = new Date(cloudClient.updatedAt).getTime();
        const localUpdated = new Date(localClient.updatedAt).getTime();

        if (localUpdated > cloudUpdated) {
          // Local is newer - upload to cloud
          const success = await uploadClient(localClient);
          if (success) uploaded++;
        }
      }
    }

    // Update sync metadata
    const metadata = await getSyncMetadata();
    await saveSyncMetadata({
      ...metadata,
      lastSyncAt: new Date().toISOString(),
    });

    console.log(
      `✅ Clients sync complete: ${downloaded} downloaded, ${uploaded} uploaded`
    );

    return { success: true, downloaded, uploaded };
  } catch (error) {
    console.error("Clients sync error:", error);
    return { success: false, downloaded: 0, uploaded: 0 };
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
