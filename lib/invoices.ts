// lib/invoices.ts
// Invoice storage and management - NOW USING SQLITE
// This fixes OOM crashes by loading data row-by-row instead of all at once

import type { Invoice, Quote, Contract, InvoicePayment } from "@/lib/types";
export type { Invoice, InvoicePayment } from "@/lib/types";
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
  listInvoicePaymentsDB,
  saveInvoicePaymentDB,
  deleteInvoicePaymentDB,
  getInvoicePaidTotalDB,
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
 * Stable sort comparator - sorts by updatedAt descending, then by id for determinism
 */
function stableSort(a: Invoice, b: Invoice): number {
  const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return a.id.localeCompare(b.id);
}

/**
 * Check if an invoice is overdue and update its status if needed
 */
function checkOverdueStatus(invoice: Invoice): { invoice: Invoice; changed: boolean } {
  if (invoice.status !== "unpaid" && invoice.status !== "partial") {
    return { invoice, changed: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(invoice.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return { invoice: { ...invoice, status: "overdue" as const }, changed: true };
  }

  return { invoice, changed: false };
}

/**
 * List all invoices, sorted by most recent first
 */
export async function listInvoices(): Promise<Invoice[]> {
  const invoices = listInvoicesDB({ limit: 1000 });

  // Check and update overdue statuses
  const processed = invoices.map((inv) => {
    const { invoice, changed } = checkOverdueStatus(inv);
    if (changed) {
      saveInvoiceDB({ ...invoice, updatedAt: new Date().toISOString() });
    }
    return invoice;
  });

  return processed.sort(stableSort);
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const invoice = getInvoiceByIdDB(id);
  if (!invoice || invoice.deletedAt) return null;

  const { invoice: updated, changed } = checkOverdueStatus(invoice);
  if (changed) {
    saveInvoiceDB({ ...updated, updatedAt: new Date().toISOString() });
  }

  return updated;
}

/**
 * Save invoice (create or update)
 */
export async function saveInvoice(invoice: Invoice): Promise<void> {
  const now = new Date().toISOString();
  const invoiceToSave = {
    ...invoice,
    updatedAt: now,
    createdAt: invoice.createdAt || now,
  };

  saveInvoiceDB(invoiceToSave);

  // Auto-sync to cloud for Pro/Premium users (non-blocking)
  import("@/lib/invoicesSync").then(({ isInvoiceSyncAvailable, uploadInvoice }) => {
    isInvoiceSyncAvailable().then((available) => {
      if (available) {
        uploadInvoice(invoiceToSave).catch((error) => {
          console.warn("Background invoice cloud sync failed:", error);
        });
      }
    });
  });
}

/**
 * Save invoice locally without cloud sync (used by sync)
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
 * Delete invoice by ID (soft delete)
 */
export async function deleteInvoice(id: string): Promise<void> {
  deleteInvoiceDB(id);

  // Delete from cloud for Pro/Premium users (non-blocking)
  import("@/lib/invoicesSync").then(({ isInvoiceSyncAvailable, deleteInvoiceFromCloud }) => {
    isInvoiceSyncAvailable().then((available) => {
      if (available) {
        deleteInvoiceFromCloud(id).catch((error) => {
          console.warn("Background invoice cloud deletion failed:", error);
        });
      }
    });
  });
}

/**
 * Create invoice from quote
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
    dueDate.setDate(dueDate.getDate() + 30);
  }

  const multiplier = percentage / 100;

  const invoice: Invoice = {
    id: `inv_${Date.now()}`,
    quoteId: quote.id,
    invoiceNumber,
    name: quote.name,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    clientPhone: quote.clientPhone,
    clientAddress: quote.clientAddress,
    items: percentage === 100
      ? quote.items
      : quote.items.map(item => ({
          ...item,
          qty: item.qty * multiplier,
        })),
    labor: quote.labor * multiplier,
    materialEstimate: quote.materialEstimate ? quote.materialEstimate * multiplier : undefined,
    overhead: quote.overhead ? quote.overhead * multiplier : undefined,
    markupPercent: quote.markupPercent,
    taxPercent: quote.taxPercent,
    notes: percentage === 100
      ? quote.notes
      : `${percentage}% Down Payment Invoice${quote.notes ? `\n\n${quote.notes}` : ''}`,
    invoiceDate: now,
    dueDate: dueDate.toISOString(),
    status: "unpaid",
    percentage: percentage === 100 ? undefined : percentage,
    isPartialInvoice: percentage !== 100,
    createdAt: now,
    updatedAt: now,
    currency: quote.currency,
  };

  await saveInvoice(invoice);
  return invoice;
}

/**
 * Create invoice from contract
 */
export async function createInvoiceFromContract(
  contractId: string,
  percentage: number = 100,
  customDueDate?: Date
): Promise<Invoice> {
  const contract = await getContractById(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  const invoiceNumber = await generateInvoiceNumber();
  const now = new Date().toISOString();
  const dueDate = customDueDate || new Date();
  if (!customDueDate) {
    dueDate.setDate(dueDate.getDate() + 30);
  }

  const multiplier = percentage / 100;

  const invoice: Invoice = {
    id: `inv_${Date.now()}`,
    quoteId: contract.quoteId,
    contractId: contract.id,
    invoiceNumber,
    name: contract.projectName,
    clientName: contract.clientName,
    clientEmail: contract.clientEmail,
    clientPhone: contract.clientPhone,
    clientAddress: contract.clientAddress,
    items: percentage === 100
      ? contract.materials
      : contract.materials.map(item => ({
          ...item,
          qty: item.qty * multiplier,
        })),
    labor: contract.labor * multiplier,
    materialEstimate: contract.materialEstimate ? contract.materialEstimate * multiplier : undefined,
    markupPercent: contract.markupPercent,
    taxPercent: contract.taxPercent,
    notes: percentage === 100
      ? undefined
      : `${percentage}% Down Payment Invoice`,
    invoiceDate: now,
    dueDate: dueDate.toISOString(),
    status: "unpaid",
    percentage: percentage === 100 ? undefined : percentage,
    isPartialInvoice: percentage !== 100,
    currency: "USD",
    createdAt: now,
    updatedAt: now,
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
    id: invoice.id,
    updatedAt: new Date().toISOString(),
  };

  await saveInvoice(updated);
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

  await saveInvoice(invoice);
  return invoice;
}

/**
 * Get quotes that need invoicing
 */
export async function getQuotesNeedingInvoice(): Promise<Quote[]> {
  const { listQuotes } = await import("@/lib/quotes");
  const { listContracts } = await import("@/lib/contracts");

  const allQuotes = await listQuotes();
  const completedQuotes = allQuotes.filter(q => q.status === "completed");

  if (completedQuotes.length === 0) return [];

  const invoices = await listInvoices();
  const invoicedQuoteIds = new Set(
    invoices.filter(inv => inv.quoteId).map(inv => inv.quoteId)
  );

  const contracts = await listContracts();
  const quotesWithContracts = new Set(
    contracts.filter(c => c.quoteId).map(c => c.quoteId)
  );

  return completedQuotes.filter(q =>
    !invoicedQuoteIds.has(q.id) && !quotesWithContracts.has(q.id)
  );
}

/**
 * Get contracts that need invoicing
 */
export async function getContractsNeedingInvoice(): Promise<Contract[]> {
  const { listContracts } = await import("@/lib/contracts");

  const allContracts = await listContracts();
  const completedContracts = allContracts.filter(c => c.status === "completed");

  if (completedContracts.length === 0) return [];

  const invoices = await listInvoices();
  const invoicedContractIds = new Set(
    invoices.filter(inv => inv.contractId).map(inv => inv.contractId)
  );

  return completedContracts.filter(c => !invoicedContractIds.has(c.id));
}

/**
 * Get count and total value of items needing invoicing
 */
export async function getToInvoiceStats(): Promise<{
  quoteCount: number;
  contractCount: number;
  totalValue: number;
}> {
  const { calculateQuoteTotal } = await import("@/lib/calculations");

  const [quotes, contracts] = await Promise.all([
    getQuotesNeedingInvoice(),
    getContractsNeedingInvoice(),
  ]);

  const quoteValue = quotes.reduce((sum, q) => sum + calculateQuoteTotal(q), 0);
  const contractValue = contracts.reduce((sum, c) => sum + c.total, 0);

  return {
    quoteCount: quotes.length,
    contractCount: contracts.length,
    totalValue: quoteValue + contractValue,
  };
}

/**
 * Get invoice count
 */
export function getInvoiceCount(): number {
  return getInvoiceCountDB(false);
}

// ============================================
// INVOICE PAYMENTS
// ============================================

/**
 * List all payments for an invoice
 */
export function listInvoicePayments(invoiceId: string): InvoicePayment[] {
  return listInvoicePaymentsDB(invoiceId);
}

/**
 * Record a new payment for an invoice
 */
export async function recordPayment(
  invoiceId: string,
  amount: number,
  paymentMethod?: string,
  paymentDate?: Date,
  notes?: string
): Promise<InvoicePayment> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const now = new Date().toISOString();
  // Generate UUID v4 for payment ID (required for Supabase cloud sync)
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  const payment: InvoicePayment = {
    id: uuid,
    invoiceId,
    amount,
    paymentMethod,
    paymentDate: paymentDate?.toISOString() || now,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  // Save the payment record locally
  saveInvoicePaymentDB(payment);

  // Upload payment to cloud for Pro/Premium users (non-blocking)
  import("@/lib/invoicesSync").then(({ isInvoiceSyncAvailable, uploadPayment }) => {
    isInvoiceSyncAvailable().then((available) => {
      if (available) {
        uploadPayment(payment).catch((error) => {
          console.warn("Background payment cloud sync failed:", error);
        });
      }
    });
  });

  // Update the invoice's paidAmount and status
  const totalPaid = getInvoicePaidTotalDB(invoiceId);
  const { calculateQuoteTotals } = await import("@/lib/calculations");
  const totals = calculateQuoteTotals(invoice);
  const invoiceTotal = totals.total;

  let newStatus = invoice.status;
  let paidDate: string | undefined;

  if (totalPaid >= invoiceTotal) {
    newStatus = "paid";
    paidDate = payment.paymentDate;
  } else if (totalPaid > 0) {
    newStatus = "partial";
  }

  await updateInvoice(invoiceId, {
    paidAmount: totalPaid,
    paidMethod: paymentMethod,
    paidDate,
    status: newStatus,
  });

  return payment;
}

/**
 * Delete a payment and update invoice totals
 */
export async function deletePayment(paymentId: string, invoiceId: string): Promise<void> {
  deleteInvoicePaymentDB(paymentId);

  // Recalculate invoice totals
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return;

  const totalPaid = getInvoicePaidTotalDB(invoiceId);
  const { calculateQuoteTotals } = await import("@/lib/calculations");
  const totals = calculateQuoteTotals(invoice);
  const invoiceTotal = totals.total;

  let newStatus: "unpaid" | "partial" | "paid" | "overdue" = "unpaid";
  if (totalPaid >= invoiceTotal) {
    newStatus = "paid";
  } else if (totalPaid > 0) {
    newStatus = "partial";
  }

  await updateInvoice(invoiceId, {
    paidAmount: totalPaid,
    paidDate: newStatus === "paid" ? invoice.paidDate : undefined,
    status: newStatus,
  });
}

/**
 * Get total paid amount for an invoice
 */
export function getInvoicePaidTotal(invoiceId: string): number {
  return getInvoicePaidTotalDB(invoiceId);
}
