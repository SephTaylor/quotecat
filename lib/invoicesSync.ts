// lib/invoicesSync.ts
// Cloud sync service for invoices (Pro/Premium feature)

import { supabase } from "./supabase";
import type { Invoice } from "./types";
import { getCurrentUserId } from "./authUtils";

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
 */
async function getDeletedInvoiceIds(): Promise<string[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("id")
      .eq("user_id", userId)
      .not("deleted_at", "is", null);

    if (error) {
      console.error("Failed to fetch deleted invoice IDs:", error);
      return [];
    }

    return (data || []).map((row: any) => row.id);
  } catch (error) {
    console.error("Get deleted invoice IDs error:", error);
    return [];
  }
}

/**
 * Download all invoices from Supabase for current user
 */
export async function downloadInvoices(): Promise<Invoice[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot download invoices: user not authenticated");
      return [];
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to download invoices:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map Supabase data to local Invoice type
    const invoices: Invoice[] = data.map((row: any) => {
      const invoice: Invoice = {
        id: row.id,
        quoteId: row.quote_id || undefined,
        invoiceNumber: row.invoice_number,
        name: row.name,
        clientName: row.client_name || undefined,
        items: row.items || [],
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

      return invoice;
    });

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
 * Get all local invoices including deleted ones (for sync comparison)
 */
async function getAllLocalInvoicesIncludingDeleted(): Promise<Invoice[]> {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  const INVOICE_STORAGE_KEY = "@quotecat/invoices";

  const json = await AsyncStorage.getItem(INVOICE_STORAGE_KEY);
  if (!json) return [];

  try {
    return JSON.parse(json) as Invoice[];
  } catch {
    return [];
  }
}

/**
 * Sync invoices - upload local deletions to cloud
 * This ensures deleted invoices are removed from the cloud
 */
export async function syncInvoices(): Promise<{
  success: boolean;
  deleted: number;
}> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync invoices: user not authenticated");
      return { success: false, deleted: 0 };
    }

    let deleted = 0;

    // Get all local invoices including deleted ones
    const allLocalInvoices = await getAllLocalInvoicesIncludingDeleted();

    // Sync any locally deleted invoices to cloud
    for (const invoice of allLocalInvoices) {
      if (invoice.deletedAt) {
        const success = await deleteInvoiceFromCloud(invoice.id);
        if (success) {
          deleted++;
          console.log(`🗑️ Synced invoice deletion to cloud: ${invoice.id}`);
        }
      }
    }

    console.log(`✅ Invoice sync complete: ${deleted} deleted`);
    return { success: true, deleted };
  } catch (error) {
    console.error("Invoice sync error:", error);
    return { success: false, deleted: 0 };
  }
}
