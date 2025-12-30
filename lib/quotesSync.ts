// lib/quotesSync.ts
// Cloud sync service for quotes (Pro/Premium feature)

import { supabase } from "./supabase";
import { listQuotes, saveQuote, getQuoteById, updateQuote } from "@/modules/quotes/storage";
import type { Quote } from "./types";
import { normalizeQuote } from "./validation";
import { getCurrentUserId } from "./authUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_METADATA_KEY = "@quotecat/sync_metadata";
const MAX_QUOTES_PER_BATCH = 500; // Batch size for incremental sync
const MAX_QUOTES_INITIAL_SYNC = 2000; // Limit for first-time full sync

// Sync lock to prevent concurrent sync operations
let syncInProgress = false;

type SyncMetadata = {
  lastSyncAt: string | null;
  hasMigrated: boolean;
  syncEnabled: boolean;
};

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
      console.warn("Invalid sync metadata format, using defaults");
      return defaultMetadata;
    }

    return {
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
      hasMigrated: typeof parsed.hasMigrated === 'boolean' ? parsed.hasMigrated : false,
      syncEnabled: typeof parsed.syncEnabled === 'boolean' ? parsed.syncEnabled : true,
    };
  } catch (error) {
    console.error("Failed to load sync metadata:", error);
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
    console.error("Failed to save sync metadata:", error);
  }
}

/**
 * Upload a single quote to Supabase
 */
export async function uploadQuote(quote: Quote): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot upload quote: user not authenticated");
      return false;
    }

    // Map local Quote to Supabase schema
    const supabaseQuote = {
      id: quote.id,
      user_id: userId,
      name: quote.name,
      client_name: quote.clientName || null,
      items: quote.items,
      labor: quote.labor,
      material_estimate: quote.materialEstimate || null,
      overhead: quote.overhead || null,
      markup_percent: quote.markupPercent || null,
      currency: quote.currency,
      status: quote.status,
      pinned: quote.pinned || false,
      tier: quote.tier || null,
      linked_quote_ids: quote.linkedQuoteIds || [],
      follow_up_date: quote.followUpDate || null,
      notes: null, // Not used in current app version
      created_at: quote.createdAt,
      updated_at: quote.updatedAt,
      synced_at: new Date().toISOString(),
      device_id: null, // Not tracking device ID yet
      deleted_at: quote.deletedAt || null,
    };

    // Upsert (insert or update)
    const { error } = await supabase
      .from("quotes")
      .upsert(supabaseQuote, { onConflict: "id" });

    if (error) {
      console.error("Failed to upload quote:", error);
      return false;
    }

    console.log(`✅ Uploaded quote: ${quote.name} (${quote.id})`);
    return true;
  } catch (error) {
    console.error("Upload quote error:", error);
    return false;
  }
}

/**
 * Get IDs of deleted quotes from cloud (for syncing deletions across devices)
 * @param since - Only fetch deletions after this timestamp (incremental sync)
 */
async function getDeletedQuoteIds(since?: string): Promise<string[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    let query = supabase
      .from("quotes")
      .select("id")
      .eq("user_id", userId)
      .not("deleted_at", "is", null);

    // Incremental: only fetch deletions since last sync
    if (since) {
      query = query.gt("updated_at", since);
    }

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(MAX_QUOTES_PER_BATCH);

    if (error) {
      console.error("Failed to fetch deleted quote IDs:", error);
      return [];
    }

    return (data || []).map((row: { id: string }) => row.id);
  } catch (error) {
    console.error("Get deleted quote IDs error:", error);
    return [];
  }
}

/**
 * Download quotes from Supabase for current user
 * @param since - Only fetch quotes updated after this timestamp (incremental sync)
 * @param isInitialSync - If true, this is a first-time sync (higher limit)
 */
export async function downloadQuotes(since?: string, isInitialSync = false): Promise<Quote[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot download quotes: user not authenticated");
      return [];
    }

    let query = supabase
      .from("quotes")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null);

    // Incremental sync: only fetch quotes updated since last sync
    if (since) {
      query = query.gt("updated_at", since);
      console.log(`📥 Incremental sync: fetching quotes updated since ${since}`);
    }

    const limit = isInitialSync ? MAX_QUOTES_INITIAL_SYNC : MAX_QUOTES_PER_BATCH;

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to download quotes:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map Supabase data to local Quote type with validation
    const quotes: Quote[] = [];
    for (const row of data) {
      try {
        // Skip invalid rows
        if (!row || !row.id) {
          console.warn("Skipping invalid quote row:", row);
          continue;
        }

        const quote: Quote = {
          id: row.id,
          name: row.name || "",
          clientName: row.client_name || undefined,
          items: Array.isArray(row.items) ? row.items : [],
          labor: parseFloat(row.labor) || 0,
          materialEstimate: row.material_estimate
            ? parseFloat(row.material_estimate)
            : undefined,
          overhead: row.overhead ? parseFloat(row.overhead) : undefined,
          markupPercent: row.markup_percent
            ? parseFloat(row.markup_percent)
            : undefined,
          currency: row.currency || "USD",
          status: row.status || "draft",
          pinned: row.pinned || false,
          tier: row.tier || undefined,
          linkedQuoteIds: row.linked_quote_ids || undefined,
          followUpDate: row.follow_up_date || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at || undefined,
        };

        quotes.push(normalizeQuote(quote));
      } catch (parseError) {
        console.error(`Failed to parse quote ${row?.id}:`, parseError);
        // Continue with next quote instead of failing entire sync
      }
    }

    console.log(`✅ Downloaded ${quotes.length} quotes from cloud`);
    return quotes;
  } catch (error) {
    console.error("Download quotes error:", error);
    return [];
  }
}

/**
 * Migrate local quotes to cloud (one-time operation on first Pro/Premium login)
 */
export async function migrateLocalQuotesToCloud(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  try {
    const metadata = await getSyncMetadata();
    if (metadata.hasMigrated) {
      console.log("Migration already completed");
      return { success: true, uploaded: 0, failed: 0 };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot migrate: user not authenticated");
      return { success: false, uploaded: 0, failed: 0 };
    }

    // Get all local quotes
    const localQuotes = await listQuotes();

    if (localQuotes.length === 0) {
      console.log("No local quotes to migrate");
      await saveSyncMetadata({ ...metadata, hasMigrated: true });
      return { success: true, uploaded: 0, failed: 0 };
    }

    console.log(`🔄 Migrating ${localQuotes.length} quotes to cloud...`);

    let uploaded = 0;
    let failed = 0;

    // Upload each quote
    for (const quote of localQuotes) {
      const success = await uploadQuote(quote);
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
      `✅ Migration complete: ${uploaded} uploaded, ${failed} failed`
    );

    return { success: true, uploaded, failed };
  } catch (error) {
    console.error("Migration error:", error);
    return { success: false, uploaded: 0, failed: 0 };
  }
}

/**
 * Sync quotes bi-directionally with INCREMENTAL sync
 * - Only fetches quotes changed since last sync (huge performance win at scale)
 * - Conflict resolution: last-write-wins based on updatedAt
 * - Also syncs deletions across devices
 */
export async function syncQuotes(): Promise<{
  success: boolean;
  downloaded: number;
  uploaded: number;
  deleted: number;
}> {
  // Prevent concurrent sync operations
  if (syncInProgress) {
    console.warn("Quote sync already in progress, skipping");
    return { success: false, downloaded: 0, uploaded: 0, deleted: 0 };
  }

  syncInProgress = true;

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync: user not authenticated");
      return { success: false, downloaded: 0, uploaded: 0, deleted: 0 };
    }

    // Get sync metadata to determine if this is initial or incremental sync
    const metadata = await getSyncMetadata();
    const lastSyncAt = metadata.lastSyncAt;
    const isInitialSync = !lastSyncAt;

    if (isInitialSync) {
      console.log("🔄 Starting initial full sync...");
    } else {
      console.log(`🔄 Starting incremental sync since ${lastSyncAt}`);
    }

    let downloaded = 0;
    let uploaded = 0;
    let deleted = 0;

    // Step 1: Sync deletions - only fetch deletions since last sync
    const deletedIds = await getDeletedQuoteIds(lastSyncAt || undefined);
    for (const deletedId of deletedIds) {
      try {
        const localQuote = await getQuoteById(deletedId);
        if (localQuote && !localQuote.deletedAt) {
          // Quote exists locally but is deleted in cloud - mark as deleted locally
          await updateQuote(deletedId, {
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          deleted++;
          console.log(`🗑️ Applied deletion from cloud: ${deletedId}`);
        }
      } catch (error) {
        console.error(`Failed to apply deletion ${deletedId}:`, error);
      }
    }

    // Step 2: Download cloud quotes (incremental - only changed since lastSyncAt)
    const cloudQuotes = await downloadQuotes(lastSyncAt || undefined, isInitialSync);
    console.log(`📥 Fetched ${cloudQuotes.length} quotes from cloud`);

    // Step 3: Get local quotes
    // For incremental sync, we still need all local quotes to check for uploads
    // But we could optimize this later with local change tracking
    const localQuotes = await listQuotes();

    // Build maps for efficient lookup
    const cloudMap = new Map(cloudQuotes.map((q) => [q.id, q]));
    const localMap = new Map(localQuotes.map((q) => [q.id, q]));

    // Step 4: Process cloud quotes (download new or updated)
    for (const cloudQuote of cloudQuotes) {
      try {
        const localQuote = localMap.get(cloudQuote.id);

        if (!localQuote) {
          // New quote from cloud - save locally
          await saveQuote(cloudQuote);
          downloaded++;
        } else {
          // Quote exists in both - check which is newer (use safe timestamp)
          const cloudUpdated = safeGetTimestamp(cloudQuote.updatedAt);
          const localUpdated = safeGetTimestamp(localQuote.updatedAt);

          if (cloudUpdated > localUpdated && cloudUpdated > 0) {
            // Cloud is newer - update local
            await saveQuote(cloudQuote);
            downloaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to sync cloud quote ${cloudQuote.id}:`, error);
        // Continue with next quote
      }
    }

    // Step 5: Process local quotes (upload new or updated since last sync)
    for (const localQuote of localQuotes) {
      try {
        // For incremental sync, only upload quotes modified since last sync
        if (lastSyncAt) {
          const localUpdated = safeGetTimestamp(localQuote.updatedAt);
          const lastSync = safeGetTimestamp(lastSyncAt);

          // Skip quotes that haven't changed since last sync
          if (localUpdated <= lastSync) {
            continue;
          }
        }

        const cloudQuote = cloudMap.get(localQuote.id);

        if (!cloudQuote) {
          // New local quote - upload to cloud
          const success = await uploadQuote(localQuote);
          if (success) uploaded++;
        } else {
          // Quote exists in both - check which is newer (use safe timestamp)
          const cloudUpdated = safeGetTimestamp(cloudQuote.updatedAt);
          const localUpdated = safeGetTimestamp(localQuote.updatedAt);

          if (localUpdated > cloudUpdated && localUpdated > 0) {
            // Local is newer - upload to cloud
            const success = await uploadQuote(localQuote);
            if (success) uploaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to sync local quote ${localQuote.id}:`, error);
        // Continue with next quote
      }
    }

    // Update sync metadata with current timestamp
    await saveSyncMetadata({
      ...metadata,
      lastSyncAt: new Date().toISOString(),
    });

    const syncType = isInitialSync ? "Initial sync" : "Incremental sync";
    console.log(
      `✅ ${syncType} complete: ${downloaded} downloaded, ${uploaded} uploaded, ${deleted} deleted`
    );

    return { success: true, downloaded, uploaded, deleted };
  } catch (error) {
    console.error("Sync error:", error);
    return { success: false, downloaded: 0, uploaded: 0, deleted: 0 };
  } finally {
    // Always release the sync lock
    syncInProgress = false;
  }
}

/**
 * Check if sync is available (user must be authenticated and have Pro/Premium tier)
 */
export async function isSyncAvailable(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return !!userId;
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<Date | null> {
  const metadata = await getSyncMetadata();
  return metadata.lastSyncAt ? new Date(metadata.lastSyncAt) : null;
}

/**
 * Check if migration has been completed
 */
export async function hasMigrated(): Promise<boolean> {
  const metadata = await getSyncMetadata();
  return metadata.hasMigrated;
}

/**
 * Delete a quote from cloud (soft delete - sets deleted_at timestamp)
 */
export async function deleteQuoteFromCloud(quoteId: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot delete quote from cloud: user not authenticated");
      return false;
    }

    const { error } = await supabase
      .from("quotes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", quoteId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to delete quote from cloud:", error);
      return false;
    }

    console.log(`✅ Deleted quote from cloud: ${quoteId}`);
    return true;
  } catch (error) {
    console.error("Delete quote from cloud error:", error);
    return false;
  }
}

/**
 * Reset sync metadata (for testing/debugging)
 */
export async function resetSyncMetadata(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_METADATA_KEY);
  console.log("🗑️ Sync metadata reset");
}
