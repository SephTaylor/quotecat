// lib/asyncStorageMigration.ts
// One-time migration from AsyncStorage to SQLite
// This runs once per device to move data to the new efficient storage system

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getDatabase,
  hasMigratedFromAsyncStorage,
  setMigratedFromAsyncStorage,
  saveQuotesBatchDB,
  saveInvoicesBatchDB,
  saveClientsBatchDB,
} from "./database";
import type { Quote, Invoice, Client } from "./types";
import { QUOTE_KEYS } from "./storageKeys";

// AsyncStorage keys
const INVOICE_STORAGE_KEY = "@quotecat/invoices";
const CLIENTS_KEY = "@quotecat/clients";

/**
 * Migrate all data from AsyncStorage to SQLite
 * This is a one-time operation that happens on app startup
 * Returns true if migration was performed, false if already done
 */
export async function migrateAsyncStorageToSQLite(): Promise<{
  migrated: boolean;
  quotes: number;
  invoices: number;
  clients: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let quotesCount = 0;
  let invoicesCount = 0;
  let clientsCount = 0;

  // Check if already migrated
  if (hasMigratedFromAsyncStorage()) {
    console.log("📊 SQLite migration already complete");
    return { migrated: false, quotes: 0, invoices: 0, clients: 0, errors: [] };
  }

  console.log("📊 Starting AsyncStorage → SQLite migration...");

  // Ensure database is initialized
  getDatabase();

  // Migrate quotes
  try {
    const quotes = await readQuotesFromAsyncStorage();
    if (quotes.length > 0) {
      saveQuotesBatchDB(quotes);
      quotesCount = quotes.length;
      console.log(`✅ Migrated ${quotesCount} quotes to SQLite`);
    }
  } catch (error) {
    const msg = `Failed to migrate quotes: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error(msg);
    errors.push(msg);
  }

  // Allow GC between operations
  await new Promise(resolve => setTimeout(resolve, 100));

  // Migrate invoices
  try {
    const invoices = await readInvoicesFromAsyncStorage();
    if (invoices.length > 0) {
      saveInvoicesBatchDB(invoices);
      invoicesCount = invoices.length;
      console.log(`✅ Migrated ${invoicesCount} invoices to SQLite`);
    }
  } catch (error) {
    const msg = `Failed to migrate invoices: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error(msg);
    errors.push(msg);
  }

  // Allow GC between operations
  await new Promise(resolve => setTimeout(resolve, 100));

  // Migrate clients
  try {
    const clients = await readClientsFromAsyncStorage();
    if (clients.length > 0) {
      saveClientsBatchDB(clients);
      clientsCount = clients.length;
      console.log(`✅ Migrated ${clientsCount} clients to SQLite`);
    }
  } catch (error) {
    const msg = `Failed to migrate clients: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error(msg);
    errors.push(msg);
  }

  // Mark migration complete (even if there were errors, so we don't retry)
  setMigratedFromAsyncStorage();

  const totalMigrated = quotesCount + invoicesCount + clientsCount;
  console.log(`📊 Migration complete: ${totalMigrated} records moved to SQLite`);

  // Optionally clean up AsyncStorage (commented out for safety)
  // await cleanupAsyncStorage();

  return {
    migrated: true,
    quotes: quotesCount,
    invoices: invoicesCount,
    clients: clientsCount,
    errors,
  };
}

/**
 * Read quotes from all AsyncStorage keys (primary + legacy)
 * De-duplicates by ID, keeping most recently updated
 */
async function readQuotesFromAsyncStorage(): Promise<Quote[]> {
  const allKeys = [QUOTE_KEYS.PRIMARY, ...QUOTE_KEYS.LEGACY];
  const quotesMap = new Map<string, Quote>();

  for (const key of allKeys) {
    try {
      const json = await AsyncStorage.getItem(key);
      if (!json) continue;

      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) continue;

      for (const item of parsed) {
        if (!item || !item.id) continue;

        const existing = quotesMap.get(item.id);
        if (!existing) {
          quotesMap.set(item.id, normalizeQuote(item));
        } else {
          // Keep newer version
          const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
          if (itemTime > existingTime) {
            quotesMap.set(item.id, normalizeQuote(item));
          }
        }
      }
    } catch (error) {
      console.warn(`Error reading quotes from ${key}:`, error);
    }
  }

  return Array.from(quotesMap.values());
}

/**
 * Read invoices from AsyncStorage
 */
async function readInvoicesFromAsyncStorage(): Promise<Invoice[]> {
  try {
    const json = await AsyncStorage.getItem(INVOICE_STORAGE_KEY);
    if (!json) return [];

    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: any) => item && item.id)
      .map(normalizeInvoice);
  } catch (error) {
    console.warn("Error reading invoices from AsyncStorage:", error);
    return [];
  }
}

/**
 * Read clients from AsyncStorage
 */
async function readClientsFromAsyncStorage(): Promise<Client[]> {
  try {
    const json = await AsyncStorage.getItem(CLIENTS_KEY);
    if (!json) return [];

    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: any) => item && item.id)
      .map(normalizeClient);
  } catch (error) {
    console.warn("Error reading clients from AsyncStorage:", error);
    return [];
  }
}

/**
 * Normalize a quote to ensure required fields exist
 */
function normalizeQuote(raw: any): Quote {
  const now = new Date().toISOString();
  return {
    id: raw.id,
    quoteNumber: raw.quoteNumber || undefined,
    name: raw.name || "",
    clientName: raw.clientName || undefined,
    clientEmail: raw.clientEmail || undefined,
    clientPhone: raw.clientPhone || undefined,
    clientAddress: raw.clientAddress || undefined,
    items: Array.isArray(raw.items) ? raw.items : [],
    labor: typeof raw.labor === "number" ? raw.labor : 0,
    materialEstimate: raw.materialEstimate || undefined,
    overhead: raw.overhead || undefined,
    markupPercent: raw.markupPercent || undefined,
    taxPercent: raw.taxPercent || undefined,
    notes: raw.notes || undefined,
    followUpDate: raw.followUpDate || undefined,
    currency: raw.currency || "USD",
    status: raw.status || "draft",
    pinned: raw.pinned === true,
    tier: raw.tier || undefined,
    linkedQuoteIds: raw.linkedQuoteIds || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    deletedAt: raw.deletedAt || undefined,
  };
}

/**
 * Normalize an invoice to ensure required fields exist
 */
function normalizeInvoice(raw: any): Invoice {
  const now = new Date().toISOString();
  return {
    id: raw.id,
    quoteId: raw.quoteId || undefined,
    contractId: raw.contractId || undefined,
    invoiceNumber: raw.invoiceNumber || `INV-${Date.now()}`,
    name: raw.name || "",
    clientName: raw.clientName || undefined,
    clientEmail: raw.clientEmail || undefined,
    clientPhone: raw.clientPhone || undefined,
    clientAddress: raw.clientAddress || undefined,
    items: Array.isArray(raw.items) ? raw.items : [],
    labor: typeof raw.labor === "number" ? raw.labor : 0,
    materialEstimate: raw.materialEstimate || undefined,
    overhead: raw.overhead || undefined,
    markupPercent: raw.markupPercent || undefined,
    taxPercent: raw.taxPercent || undefined,
    notes: raw.notes || undefined,
    invoiceDate: raw.invoiceDate || now,
    dueDate: raw.dueDate || now,
    status: raw.status || "unpaid",
    paidDate: raw.paidDate || undefined,
    paidAmount: raw.paidAmount || undefined,
    percentage: raw.percentage || undefined,
    isPartialInvoice: raw.isPartialInvoice === true,
    currency: raw.currency || "USD",
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    deletedAt: raw.deletedAt || undefined,
  };
}

/**
 * Normalize a client to ensure required fields exist
 */
function normalizeClient(raw: any): Client {
  const now = new Date().toISOString();
  return {
    id: raw.id,
    name: raw.name || "",
    email: raw.email || undefined,
    phone: raw.phone || undefined,
    address: raw.address || undefined,
    notes: raw.notes || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

/**
 * Clean up AsyncStorage after successful migration (optional)
 * Call this only after confirming SQLite data is correct
 */
export async function cleanupAsyncStorage(): Promise<void> {
  console.log("🧹 Cleaning up AsyncStorage...");

  const keysToRemove = [
    QUOTE_KEYS.PRIMARY,
    ...QUOTE_KEYS.LEGACY,
    INVOICE_STORAGE_KEY,
    CLIENTS_KEY,
  ];

  for (const key of keysToRemove) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove ${key}:`, error);
    }
  }

  console.log("✅ AsyncStorage cleanup complete");
}
