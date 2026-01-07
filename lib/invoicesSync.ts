// lib/invoicesSync.ts
// Cloud sync service for invoices (Pro/Premium feature)

import { supabase } from "./supabase";
import type { Invoice } from "./types";
import { getCurrentUserId } from "./authUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  listInvoicesDB,
  getInvoiceByIdDB,
  saveInvoiceDB,
  saveInvoicesBatchDB,
  deleteInvoiceDB,
  getLocallyDeletedInvoiceIdsDB,
} from "./database";
const SYNC_METADATA_KEY = "@quotecat/invoices_sync_metadata";
const SYNC_LOCK_KEY = "@quotecat/invoices_sync_lock";
const MAX_INVOICES_PER_BATCH = 50; // Batch size for incremental sync
const MAX_INVOICES_INITIAL_SYNC = 200; // Limit for first-time full sync
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
    console.error("Failed to set invoices sync lock:", error);
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
      console.log(`⏳ Invoices sync cooldown: ${Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)}s remaining`);
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
        console.warn("⚠️ Clearing stale invoices sync lock (>1 min old)");
        await setSyncLock(false);
      }
    }
  } catch (error) {
    console.error("Error checking stale invoices lock:", error);
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
      console.warn("Invalid invoices sync metadata format, using defaults");
      return defaultMetadata;
    }

    return {
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
      hasMigrated: typeof parsed.hasMigrated === 'boolean' ? parsed.hasMigrated : false,
      syncEnabled: typeof parsed.syncEnabled === 'boolean' ? parsed.syncEnabled : true,
    };
  } catch (error) {
    console.error("Failed to load invoices sync metadata:", error);
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
    console.error("Failed to save invoices sync metadata:", error);
  }
}

/**
 * Get all local invoices (for sync) - NOW USING SQLITE
 */
function getLocalInvoices(): Invoice[] {
  return listInvoicesDB({ limit: 1000 });
}

/**
 * Save invoice locally (without triggering cloud sync - used during sync)
 */
function saveInvoiceLocally(invoice: Invoice): void {
  saveInvoiceDB(invoice);
}

/**
 * Batch save multiple invoices locally - EFFICIENT with SQLite
 */
function saveInvoicesBatchLocal(invoices: Invoice[]): void {
  if (invoices.length === 0) return;
  saveInvoicesBatchDB(invoices);
}

/**
 * Get a local invoice by ID
 */
function getLocalInvoiceById(id: string): Invoice | null {
  return getInvoiceByIdDB(id);
}

/**
 * Mark a local invoice as deleted
 */
function markLocalInvoiceDeleted(id: string): void {
  deleteInvoiceDB(id);
}

/**
 * Upload a single invoice to Supabase
 */
export async function uploadInvoice(invoice: Invoice): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot upload invoice: user not authenticated");
      return false;
    }

    // Map local Invoice to Supabase schema
    const supabaseInvoice = {
      id: invoice.id,
      user_id: userId,
      quote_id: invoice.quoteId || null,
      invoice_number: invoice.invoiceNumber,
      name: invoice.name,
      client_name: invoice.clientName || null,
      items: invoice.items,
      labor: invoice.labor,
      material_estimate: invoice.materialEstimate || null,
      overhead: invoice.overhead || null,
      markup_percent: invoice.markupPercent || null,
      notes: invoice.notes || null,
      invoice_date: invoice.invoiceDate,
      due_date: invoice.dueDate,
      status: invoice.status,
      paid_date: invoice.paidDate || null,
      paid_amount: invoice.paidAmount || null,
      percentage: invoice.percentage || null,
      is_partial_invoice: invoice.isPartialInvoice || false,
      currency: invoice.currency,
      created_at: invoice.createdAt,
      updated_at: invoice.updatedAt,
      synced_at: new Date().toISOString(),
      deleted_at: invoice.deletedAt || null,
    };

    // Upsert (insert or update)
    const { error } = await supabase
      .from("invoices")
      .upsert(supabaseInvoice, { onConflict: "id" });

    if (error) {
      console.error("Failed to upload invoice:", error);
      return false;
    }

    console.log(`✅ Uploaded invoice: ${invoice.invoiceNumber} (${invoice.id})`);
    return true;
  } catch (error) {
    console.error("Upload invoice error:", error);
    return false;
  }
}

/**
 * Get IDs of deleted invoices from cloud (for syncing deletions across devices)
 * @param since - Only fetch deletions after this timestamp (incremental sync)
 */
async function getDeletedInvoiceIds(since?: string): Promise<string[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    let query = supabase
      .from("invoices")
      .select("id")
      .eq("user_id", userId)
      .not("deleted_at", "is", null);

    // Incremental: only fetch deletions since last sync
    if (since) {
      query = query.gt("updated_at", since);
    }

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(MAX_INVOICES_PER_BATCH);

    if (error) {
      console.error("Failed to fetch deleted invoice IDs:", error);
      return [];
    }

    return (data || []).map((row: { id: string }) => row.id);
  } catch (error) {
    console.error("Get deleted invoice IDs error:", error);
    return [];
  }
}

/**
 * Download invoices from Supabase for current user
 * @param since - Only fetch invoices updated after this timestamp (incremental sync)
 * @param isInitialSync - If true, this is a first-time sync (higher limit)
 */
export async function downloadInvoices(since?: string, isInitialSync = false): Promise<Invoice[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot download invoices: user not authenticated");
      return [];
    }

    let query = supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null);

    // Incremental sync: only fetch invoices updated since last sync
    if (since) {
      query = query.gt("updated_at", since);
      console.log(`📥 Incremental sync: fetching invoices updated since ${since}`);
    }

    const limit = isInitialSync ? MAX_INVOICES_INITIAL_SYNC : MAX_INVOICES_PER_BATCH;

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to download invoices:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map Supabase data to local Invoice type with validation
    const invoices: Invoice[] = [];
    for (const row of data) {
      try {
        // Skip invalid rows
        if (!row || !row.id) {
          console.warn("Skipping invalid invoice row:", row);
          continue;
        }

        const invoice: Invoice = {
          id: row.id,
          quoteId: row.quote_id || undefined,
          invoiceNumber: row.invoice_number || "",
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
          notes: row.notes || undefined,
          invoiceDate: row.invoice_date,
          dueDate: row.due_date,
          status: row.status || "unpaid",
          paidDate: row.paid_date || undefined,
          paidAmount: row.paid_amount ? parseFloat(row.paid_amount) : undefined,
          percentage: row.percentage ? parseFloat(row.percentage) : undefined,
          isPartialInvoice: row.is_partial_invoice || false,
          currency: row.currency || "USD",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at || undefined,
        };

        invoices.push(invoice);
      } catch (parseError) {
        console.error(`Failed to parse invoice ${row?.id}:`, parseError);
        // Continue with next invoice instead of failing entire sync
      }
    }

    console.log(`✅ Downloaded ${invoices.length} invoices from cloud`);
    return invoices;
  } catch (error) {
    console.error("Download invoices error:", error);
    return [];
  }
}

/**
 * Delete an invoice from cloud (soft delete - sets deleted_at timestamp)
 */
export async function deleteInvoiceFromCloud(
  invoiceId: string
): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot delete invoice from cloud: user not authenticated");
      return false;
    }

    const { error } = await supabase
      .from("invoices")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to delete invoice from cloud:", error);
      return false;
    }

    console.log(`✅ Deleted invoice from cloud: ${invoiceId}`);
    return true;
  } catch (error) {
    console.error("Delete invoice from cloud error:", error);
    return false;
  }
}

/**
 * Check if invoice sync is available (user must be authenticated)
 */
export async function isInvoiceSyncAvailable(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return !!userId;
}

/**
 * Migrate local invoices to cloud (one-time operation on first Pro/Premium login)
 */
export async function migrateLocalInvoicesToCloud(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  try {
    const metadata = await getSyncMetadata();
    if (metadata.hasMigrated) {
      console.log("Invoices migration already completed");
      return { success: true, uploaded: 0, failed: 0 };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot migrate invoices: user not authenticated");
      return { success: false, uploaded: 0, failed: 0 };
    }

    // Get all local invoices
    const localInvoices = await getLocalInvoices();

    if (localInvoices.length === 0) {
      console.log("No local invoices to migrate");
      await saveSyncMetadata({ ...metadata, hasMigrated: true });
      return { success: true, uploaded: 0, failed: 0 };
    }

    console.log(`🔄 Migrating ${localInvoices.length} invoices to cloud...`);

    let uploaded = 0;
    let failed = 0;

    // Upload each invoice
    for (const invoice of localInvoices) {
      const success = await uploadInvoice(invoice);
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
      `✅ Invoices migration complete: ${uploaded} uploaded, ${failed} failed`
    );

    return { success: true, uploaded, failed };
  } catch (error) {
    console.error("Invoices migration error:", error);
    return { success: false, uploaded: 0, failed: 0 };
  }
}

/**
 * Check if invoices migration has been completed
 */
export async function hasInvoicesMigrated(): Promise<boolean> {
  const metadata = await getSyncMetadata();
  return metadata.hasMigrated;
}

/**
 * Sync invoices bi-directionally with INCREMENTAL sync
 * - Only fetches invoices changed since last sync (huge performance win at scale)
 * - Conflict resolution: last-write-wins based on updatedAt
 * - Also syncs deletions across devices
 * - Uses local-only saves to prevent sync loops
 * - Has cooldown to prevent rapid re-syncing
 */
export async function syncInvoices(): Promise<{
  success: boolean;
  downloaded: number;
  uploaded: number;
  deleted: number;
}> {
  // Clear any stale locks from crashed syncs
  await clearStaleLock();

  // Check cooldown
  const canSync = await checkSyncCooldown();
  if (!canSync) {
    console.warn("Invoice sync skipped: cooldown active");
    return { success: false, downloaded: 0, uploaded: 0, deleted: 0 };
  }

  // Check both memory and persistent locks
  if (syncInProgress) {
    console.warn("Invoice sync already in progress (memory lock), skipping");
    return { success: false, downloaded: 0, uploaded: 0, deleted: 0 };
  }

  const persistentLock = await getSyncLock();
  if (persistentLock.inProgress) {
    console.warn("Invoice sync already in progress (persistent lock), skipping");
    return { success: false, downloaded: 0, uploaded: 0, deleted: 0 };
  }

  // Set both locks
  syncInProgress = true;
  await setSyncLock(true);

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync invoices: user not authenticated");
      return { success: false, downloaded: 0, uploaded: 0, deleted: 0 };
    }

    // Get sync metadata to determine if this is initial or incremental sync
    const metadata = await getSyncMetadata();
    const lastSyncAt = metadata.lastSyncAt;
    const isInitialSync = !lastSyncAt;

    if (isInitialSync) {
      console.log("🔄 Starting initial full invoices sync...");
    } else {
      console.log(`🔄 Starting incremental invoices sync since ${lastSyncAt}`);
    }

    let downloaded = 0;
    let uploaded = 0;
    let deleted = 0;

    // Step 1: Sync deletions (limited to prevent memory issues)
    const deletedIds = await getDeletedInvoiceIds(lastSyncAt || undefined);
    const deletionsToProcess = deletedIds.slice(0, 10); // Limit to 10
    for (const deletedId of deletionsToProcess) {
      try {
        const localInvoice = await getLocalInvoiceById(deletedId);
        if (localInvoice && !localInvoice.deletedAt) {
          await markLocalInvoiceDeleted(deletedId);
          deleted++;
        }
      } catch (error) {
        // Silently continue
      }
    }

    // Step 2: Download cloud invoices (incremental - only changed since lastSyncAt)
    const cloudInvoices = await downloadInvoices(lastSyncAt || undefined, isInitialSync);
    console.log(`📥 Fetched ${cloudInvoices.length} invoices from cloud`);

    // Step 3: Get local invoices
    const localInvoices = await getLocalInvoices();

    // Build maps for efficient lookup
    const cloudMap = new Map(cloudInvoices.map((inv) => [inv.id, inv]));
    const localMap = new Map(localInvoices.map((inv) => [inv.id, inv]));

    // Step 4: Get locally deleted invoice IDs to avoid re-downloading them
    const locallyDeletedIds = new Set(getLocallyDeletedInvoiceIdsDB());
    if (locallyDeletedIds.size > 0) {
      console.log(`🗑️ Found ${locallyDeletedIds.size} locally deleted invoices to skip`);
    }

    // Step 5: Collect cloud invoices to save locally (instead of saving one by one)
    // This is MUCH more efficient - reads storage once, writes once
    const invoicesToSave: Invoice[] = [];
    for (const cloudInvoice of cloudInvoices) {
      try {
        // Skip invoices that were deleted locally (prevents resurrection)
        if (locallyDeletedIds.has(cloudInvoice.id)) {
          console.log(`⏭️ Skipping locally deleted invoice: ${cloudInvoice.id}`);
          continue;
        }

        const localInvoice = localMap.get(cloudInvoice.id);

        if (!localInvoice) {
          // New invoice from cloud - queue for batch save
          invoicesToSave.push(cloudInvoice);
          downloaded++;
        } else {
          // Invoice exists in both - check which is newer (use safe timestamp)
          const cloudUpdated = safeGetTimestamp(cloudInvoice.updatedAt);
          const localUpdated = safeGetTimestamp(localInvoice.updatedAt);

          if (cloudUpdated > localUpdated && cloudUpdated > 0) {
            // Cloud is newer - queue for batch save
            invoicesToSave.push(cloudInvoice);
            downloaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to process cloud invoice ${cloudInvoice.id}:`, error);
        // Continue with next invoice
      }
    }

    // Batch save all invoices at once - EFFICIENT with SQLite
    if (invoicesToSave.length > 0) {
      try {
        saveInvoicesBatchLocal(invoicesToSave);
        console.log(`✅ Batch saved ${invoicesToSave.length} invoices locally`);
      } catch (error) {
        console.error("Failed to batch save invoices:", error);
        // Fall back to individual saves on batch failure
        for (const invoice of invoicesToSave) {
          saveInvoiceLocally(invoice);
        }
      }
    }

    // Step 5: Process local invoices (upload new or updated since last sync)
    for (const localInvoice of localInvoices) {
      try {
        // For incremental sync, only upload invoices modified since last sync
        if (lastSyncAt) {
          const localUpdated = safeGetTimestamp(localInvoice.updatedAt);
          const lastSync = safeGetTimestamp(lastSyncAt);

          // Skip invoices that haven't changed since last sync
          if (localUpdated <= lastSync) {
            continue;
          }
        }

        const cloudInvoice = cloudMap.get(localInvoice.id);

        if (!cloudInvoice) {
          // New local invoice - upload to cloud
          const success = await uploadInvoice(localInvoice);
          if (success) uploaded++;
        } else {
          // Invoice exists in both - check which is newer (use safe timestamp)
          const cloudUpdated = safeGetTimestamp(cloudInvoice.updatedAt);
          const localUpdated = safeGetTimestamp(localInvoice.updatedAt);

          if (localUpdated > cloudUpdated && localUpdated > 0) {
            // Local is newer - upload to cloud
            const success = await uploadInvoice(localInvoice);
            if (success) uploaded++;
          }
        }
      } catch (error) {
        console.error(`Failed to sync local invoice ${localInvoice.id}:`, error);
        // Continue with next invoice
      }
    }

    // Update sync metadata with current timestamp
    await saveSyncMetadata({
      ...metadata,
      lastSyncAt: new Date().toISOString(),
    });

    const syncType = isInitialSync ? "Initial sync" : "Incremental sync";
    console.log(
      `✅ Invoices ${syncType} complete: ${downloaded} downloaded, ${uploaded} uploaded, ${deleted} deleted`
    );

    return { success: true, downloaded, uploaded, deleted };
  } catch (error) {
    console.error("Invoices sync error:", error);
    return { success: false, downloaded: 0, uploaded: 0, deleted: 0 };
  } finally {
    // Always release both locks
    syncInProgress = false;
    await setSyncLock(false);
  }
}
