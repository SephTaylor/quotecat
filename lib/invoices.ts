// lib/invoices.ts
// Invoice storage and management

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Invoice, Quote } from "@/lib/types";
import { getQuoteById } from "@/lib/quotes";
import { loadPreferences, updateInvoiceSettings } from "@/lib/preferences";
import {
  uploadInvoice,
  deleteInvoiceFromCloud,
  isInvoiceSyncAvailable,
} from "@/lib/invoicesSync";

/**
 * Data for creating a quick invoice (without a quote)
 * Simplified: just client, description, amount
 */
export type QuickInvoiceData = {
  clientName: string;
  jobDescription: string;
  amount: number;
  notes?: string;
  dueDate?: Date;
};

const INVOICE_STORAGE_KEY = "@quotecat/invoices";

/**
 * Generate next invoice number using user preferences
 * Format: PREFIX-###  (e.g., INV-001, 2025-001, etc.)
 */
async function generateInvoiceNumber(): Promise<string> {
  const prefs = await loadPreferences();
  const { prefix, nextNumber } = prefs.invoice;

  // Increment the next number in preferences
  await updateInvoiceSettings({ nextNumber: nextNumber + 1 });

  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

/**
 * Check if an invoice is overdue and update its status if needed
 */
async function checkAndUpdateOverdueStatus(invoice: Invoice): Promise<Invoice> {
  // Only check unpaid and partial invoices
  if (invoice.status !== "unpaid" && invoice.status !== "partial") {
    return invoice;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(invoice.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  // If due date has passed, mark as overdue
  if (dueDate < today) {
    const updated = { ...invoice, status: "overdue" as const };
    await updateInvoice(invoice.id, { status: "overdue" });
    return updated;
  }

  return invoice;
}

/**
 * List all invoices, sorted by most recent first
 * Filters out soft-deleted invoices
 * Automatically updates overdue invoices
 */
export async function listInvoices(): Promise<Invoice[]> {
  try {
    const json = await AsyncStorage.getItem(INVOICE_STORAGE_KEY);
    if (!json) return [];

    let invoices = JSON.parse(json) as Invoice[];

    // Filter out deleted invoices
    invoices = invoices.filter((inv) => !inv.deletedAt);

    // Check and update overdue statuses
    invoices = await Promise.all(invoices.map(checkAndUpdateOverdueStatus));

    return invoices.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Failed to list invoices:", error);
    return [];
  }
}

/**
 * Get invoice by ID
 * Returns null if invoice is deleted or not found
 * Automatically updates overdue status if needed
 */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const invoices = await listInvoices();
  const invoice = invoices.find((inv) => inv.id === id && !inv.deletedAt) || null;

  if (invoice) {
    return await checkAndUpdateOverdueStatus(invoice);
  }

  return null;
}

/**
 * Save invoice (create or update)
 * Automatically syncs to cloud for Pro/Premium users
 */
export async function saveInvoice(invoice: Invoice): Promise<void> {
  const json = await AsyncStorage.getItem(INVOICE_STORAGE_KEY);
  const allInvoices = json ? (JSON.parse(json) as Invoice[]) : [];

  const existingIndex = allInvoices.findIndex((inv) => inv.id === invoice.id);

  const now = new Date().toISOString();
  const invoiceToSave = {
    ...invoice,
    updatedAt: now,
    createdAt: invoice.createdAt || now,
  };

  if (existingIndex >= 0) {
    allInvoices[existingIndex] = invoiceToSave;
  } else {
    allInvoices.push(invoiceToSave);
  }

  await AsyncStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(allInvoices));

  // Auto-sync to cloud for Pro/Premium users (non-blocking)
  isInvoiceSyncAvailable().then((available) => {
    if (available) {
      uploadInvoice(invoiceToSave).catch((error) => {
        console.warn("Background invoice cloud sync failed:", error);
      });
    }
  });
}

/**
 * Delete invoice by ID (soft delete - sets deletedAt timestamp)
 * Automatically syncs deletion to cloud for Pro/Premium users
 */
export async function deleteInvoice(id: string): Promise<void> {
  const json = await AsyncStorage.getItem(INVOICE_STORAGE_KEY);
  if (!json) return;

  const allInvoices = JSON.parse(json) as Invoice[];
  const invoice = allInvoices.find((inv) => inv.id === id);

  if (!invoice) {
    throw new Error(`Invoice ${id} not found`);
  }

  // Soft delete: set deletedAt timestamp
  invoice.deletedAt = new Date().toISOString();
  invoice.updatedAt = invoice.deletedAt;

  await AsyncStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(allInvoices));

  // Delete from cloud for Pro/Premium users (non-blocking)
  isInvoiceSyncAvailable().then((available) => {
    if (available) {
      deleteInvoiceFromCloud(id).catch((error) => {
        console.warn("Background invoice cloud deletion failed:", error);
      });
    }
  });
}

/**
 * Create invoice from quote
 * @param quoteId - ID of the quote to create invoice from
 * @param percentage - Percentage of quote total (default 100 = full invoice, 50 = 50% deposit)
 * @param customDueDate - Optional custom due date (defaults to 30 days from now)
 */
export async function createInvoiceFromQuote(
  quoteId: string,
  percentage: number = 100,
  customDueDate?: Date
): Promise<Invoice> {
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  const invoiceNumber = await generateInvoiceNumber();
  const now = new Date().toISOString();
  const dueDate = customDueDate || new Date();
  if (!customDueDate) {
    dueDate.setDate(dueDate.getDate() + 30); // Default: 30 days from now
  }

  // Calculate amounts based on percentage
  const multiplier = percentage / 100;

  // Create invoice with adjusted amounts if partial
  const invoice: Invoice = {
    id: `inv_${Date.now()}`,
    quoteId: quote.id,
    invoiceNumber,
    type: "from_quote",

    // Copy quote data
    name: quote.name,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    clientPhone: quote.clientPhone,
    clientAddress: quote.clientAddress,
    items: percentage === 100
      ? quote.items
      : quote.items.map(item => ({
          ...item,
          qty: item.qty * multiplier, // Reduce quantity for partial invoice
        })),
    labor: quote.labor * multiplier,
    materialEstimate: quote.materialEstimate ? quote.materialEstimate * multiplier : undefined,
    overhead: quote.overhead ? quote.overhead * multiplier : undefined,
    markupPercent: quote.markupPercent,
    taxPercent: quote.taxPercent,
    notes: percentage === 100
      ? quote.notes
      : `${percentage}% Down Payment Invoice${quote.notes ? `\n\n${quote.notes}` : ''}`,

    // Invoice-specific
    invoiceDate: now,
    dueDate: dueDate.toISOString(),
    status: "unpaid",
    percentage: percentage === 100 ? undefined : percentage,
    isPartialInvoice: percentage !== 100,

    // Metadata
    createdAt: now,
    updatedAt: now,
    currency: quote.currency,
  };

  await saveInvoice(invoice);
  return invoice;
}

/**
 * Update invoice
 */
export async function updateInvoice(id: string, updates: Partial<Invoice>): Promise<void> {
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    throw new Error(`Invoice ${id} not found`);
  }

  const updated = {
    ...invoice,
    ...updates,
    id: invoice.id, // Prevent ID changes
    updatedAt: new Date().toISOString(),
  };

  await saveInvoice(updated);
}

/**
 * Create a quick invoice (without a quote)
 * For emergency repairs, labor-only jobs, flat-rate services, etc.
 * Simple: just client, description, and total amount
 */
export async function createQuickInvoice(data: QuickInvoiceData): Promise<Invoice> {
  const invoiceNumber = await generateInvoiceNumber();
  const now = new Date().toISOString();
  const dueDate = data.dueDate || new Date();
  if (!data.dueDate) {
    dueDate.setDate(dueDate.getDate() + 30); // Default: 30 days from now
  }

  const invoice: Invoice = {
    id: `inv_${Date.now()}`,
    invoiceNumber,
    type: "quick",

    // Invoice data - simple flat amount as single line item
    name: data.jobDescription,
    clientName: data.clientName,
    jobDescription: data.jobDescription,
    items: [
      {
        id: `item_${Date.now()}`,
        name: data.jobDescription,
        qty: 1,
        unitPrice: data.amount,
      },
    ],
    labor: 0,
    notes: data.notes,

    // Invoice-specific
    invoiceDate: now,
    dueDate: dueDate.toISOString(),
    status: "unpaid",

    // Metadata
    createdAt: now,
    updatedAt: now,
    currency: "USD",
  };

  await saveInvoice(invoice);
  return invoice;
}
