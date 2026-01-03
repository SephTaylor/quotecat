// lib/invoicesSQLite.ts
// SQLite-based invoice storage - replaces AsyncStorage implementation

import type { Invoice, Quote, Contract } from "@/lib/types";
export type { Invoice } from "@/lib/types";
import { getQuoteById } from "@/lib/quotes";
import { getContractById } from "@/lib/contracts";
import { loadPreferences, updateInvoiceSettings } from "@/lib/preferences";
import {
  listInvoicesDB,
  getInvoiceByIdDB,
  saveInvoiceDB,
  saveInvoicesBatchDB,
  deleteInvoiceDB,
  getInvoiceCountDB,
} from "@/lib/database";

/**
 * Generate next invoice number using user preferences
 */
async function generateInvoiceNumber(): Promise<string> {
  const prefs = await loadPreferences();
  const { prefix, nextNumber } = prefs.invoice;
  await updateInvoiceSettings({ nextNumber: nextNumber + 1 });
  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

/**
 * Check if an invoice is overdue and update its status if needed
 */
function checkOverdueStatus(invoice: Invoice): Invoice {
  if (invoice.status !== "unpaid" && invoice.status !== "partial") {
    return invoice;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(invoice.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return { ...invoice, status: "overdue" as const };
  }

  return invoice;
}

/**
 * List all invoices, sorted by most recent first
 */
export async function listInvoices(): Promise<Invoice[]> {
  const invoices = listInvoicesDB({ limit: 1000 });

  // Check and update overdue statuses
  const checked = invoices.map((inv) => {
    const updated = checkOverdueStatus(inv);
    // If status changed, save it
    if (updated.status !== inv.status) {
      saveInvoiceDB({ ...updated, updatedAt: new Date().toISOString() });
    }
    return updated;
  });

  return checked.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const invoice = getInvoiceByIdDB(id);
  if (!invoice || invoice.deletedAt) return null;

  const updated = checkOverdueStatus(invoice);
  if (updated.status !== invoice.status) {
    saveInvoiceDB({ ...updated, updatedAt: new Date().toISOString() });
  }

  return updated;
}

/**
 * Create an invoice from a quote (with percentage option)
 */
export async function createInvoiceFromQuote(
  quoteId: string,
  dueDate: Date,
  percentage: number = 100
): Promise<Invoice | null> {
  const quote = await getQuoteById(quoteId);
  if (!quote) return null;

  const now = new Date().toISOString();
  const invoiceNumber = await generateInvoiceNumber();

  const isPartial = percentage < 100;

  const invoice: Invoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    quoteId,
    invoiceNumber,
    name: quote.name,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    clientPhone: quote.clientPhone,
    clientAddress: quote.clientAddress,
    items: quote.items,
    labor: quote.labor,
    materialEstimate: quote.materialEstimate,
    overhead: quote.overhead,
    markupPercent: quote.markupPercent,
    taxPercent: quote.taxPercent,
    notes: quote.notes,
    invoiceDate: now,
    dueDate: dueDate.toISOString(),
    status: "unpaid",
    currency: quote.currency,
    createdAt: now,
    updatedAt: now,
    percentage: isPartial ? percentage : undefined,
    isPartialInvoice: isPartial,
  };

  saveInvoiceDB(invoice);

  // Auto-sync to cloud
  import("@/lib/invoicesSync").then(({ isInvoiceSyncAvailable, uploadInvoice }) => {
    isInvoiceSyncAvailable().then((available) => {
      if (available) {
        uploadInvoice(invoice).catch(console.error);
      }
    });
  });

  return invoice;
}

/**
 * Create an invoice from a contract
 */
export async function createInvoiceFromContract(
  contractId: string,
  dueDate: Date,
  percentage: number = 100
): Promise<Invoice | null> {
  const contract = await getContractById(contractId);
  if (!contract) return null;

  const now = new Date().toISOString();
  const invoiceNumber = await generateInvoiceNumber();

  const isPartial = percentage < 100;

  const invoice: Invoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    contractId,
    invoiceNumber,
    name: contract.projectName,
    clientName: contract.clientName,
    clientEmail: contract.clientEmail,
    clientPhone: contract.clientPhone,
    clientAddress: contract.clientAddress,
    items: contract.materials,
    labor: contract.labor,
    materialEstimate: contract.materialEstimate,
    markupPercent: contract.markupPercent,
    taxPercent: contract.taxPercent,
    invoiceDate: now,
    dueDate: dueDate.toISOString(),
    status: "unpaid",
    currency: contract.currency,
    createdAt: now,
    updatedAt: now,
    percentage: isPartial ? percentage : undefined,
    isPartialInvoice: isPartial,
  };

  saveInvoiceDB(invoice);

  import("@/lib/invoicesSync").then(({ isInvoiceSyncAvailable, uploadInvoice }) => {
    isInvoiceSyncAvailable().then((available) => {
      if (available) {
        uploadInvoice(invoice).catch(console.error);
      }
    });
  });

  return invoice;
}

/**
 * Quick invoice data type
 */
export type QuickInvoiceData = {
  name: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  total: number;
  notes?: string;
  dueDate: Date;
  currency?: "USD" | "CRC" | "CAD" | "EUR";
};

/**
 * Create a quick invoice without a quote
 */
export async function createQuickInvoice(data: QuickInvoiceData): Promise<Invoice> {
  const now = new Date().toISOString();
  const invoiceNumber = await generateInvoiceNumber();

  const invoice: Invoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    invoiceNumber,
    name: data.name,
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    clientPhone: data.clientPhone,
    clientAddress: data.clientAddress,
    items: [
      {
        id: `item_${Date.now()}`,
        name: data.name,
        unitPrice: data.total,
        qty: 1,
      },
    ],
    labor: 0,
    notes: data.notes,
    invoiceDate: now,
    dueDate: data.dueDate.toISOString(),
    status: "unpaid",
    currency: data.currency || "USD",
    createdAt: now,
    updatedAt: now,
  };

  saveInvoiceDB(invoice);

  import("@/lib/invoicesSync").then(({ isInvoiceSyncAvailable, uploadInvoice }) => {
    isInvoiceSyncAvailable().then((available) => {
      if (available) {
        uploadInvoice(invoice).catch(console.error);
      }
    });
  });

  return invoice;
}

/**
 * Update an invoice
 */
export async function updateInvoice(
  id: string,
  updates: Partial<Invoice>
): Promise<Invoice | null> {
  const current = getInvoiceByIdDB(id);
  if (!current || current.deletedAt) return null;

  const updated: Invoice = {
    ...current,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  saveInvoiceDB(updated);

  import("@/lib/invoicesSync").then(({ isInvoiceSyncAvailable, uploadInvoice }) => {
    isInvoiceSyncAvailable().then((available) => {
      if (available) {
        uploadInvoice(updated).catch(console.error);
      }
    });
  });

  return updated;
}

/**
 * Save an invoice locally without cloud sync (used by sync)
 */
export async function saveInvoiceLocally(invoice: Invoice): Promise<Invoice> {
  const updated = {
    ...invoice,
    updatedAt: invoice.updatedAt || new Date().toISOString(),
  };
  saveInvoiceDB(updated);
  return updated;
}

/**
 * Batch save invoices (used by sync)
 */
export async function saveInvoicesBatch(invoices: Invoice[]): Promise<void> {
  if (invoices.length === 0) return;
  saveInvoicesBatchDB(invoices);
}

/**
 * Delete an invoice (soft delete)
 */
export async function deleteInvoice(id: string): Promise<void> {
  deleteInvoiceDB(id);

  import("@/lib/invoicesSync").then(({ isInvoiceSyncAvailable, deleteInvoiceFromCloud }) => {
    isInvoiceSyncAvailable().then((available) => {
      if (available) {
        deleteInvoiceFromCloud(id).catch(console.error);
      }
    });
  });
}

/**
 * Mark invoice as paid
 */
export async function markInvoiceAsPaid(
  id: string,
  paidDate: Date = new Date()
): Promise<Invoice | null> {
  return updateInvoice(id, {
    status: "paid",
    paidDate: paidDate.toISOString(),
  });
}

/**
 * Mark invoice as partially paid
 */
export async function markInvoiceAsPartiallyPaid(
  id: string,
  paidAmount: number
): Promise<Invoice | null> {
  return updateInvoice(id, {
    status: "partial",
    paidAmount,
  });
}

/**
 * Calculate invoice total
 */
export function calculateInvoiceTotal(invoice: Invoice): number {
  const materialsTotal =
    invoice.items?.reduce((sum, item) => sum + item.qty * item.unitPrice, 0) ||
    0;
  const laborTotal = invoice.labor || 0;
  const estimateTotal = invoice.materialEstimate || 0;
  const overheadTotal = invoice.overhead || 0;

  let subtotal = materialsTotal + laborTotal + estimateTotal + overheadTotal;

  if (invoice.markupPercent) {
    subtotal = subtotal * (1 + invoice.markupPercent / 100);
  }

  if (invoice.taxPercent) {
    subtotal = subtotal * (1 + invoice.taxPercent / 100);
  }

  if (invoice.percentage && invoice.percentage < 100) {
    subtotal = subtotal * (invoice.percentage / 100);
  }

  return subtotal;
}

/**
 * Get count of invoices
 */
export function getInvoiceCount(): number {
  return getInvoiceCountDB(false);
}
