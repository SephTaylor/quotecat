// lib/database.ts
// SQLite database layer - replaces AsyncStorage for quotes/invoices/clients
// This solves the OOM crashes by loading data row-by-row instead of all at once

import * as SQLite from "expo-sqlite";
import type { Quote, Invoice, Client, QuoteItem, PricebookItem, InvoicePayment } from "./types";
import type { Product, Category } from "@/modules/catalog/seed";

// Database instance (lazy initialized)
let db: SQLite.SQLiteDatabase | null = null;

// Schema version for migrations
const SCHEMA_VERSION = 9;

/**
 * Get or create the database instance
 * Uses synchronous opening for reliability
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("quotecat.db");
    initializeSchema(db);
  }
  return db;
}

/**
 * Initialize database schema
 * Creates tables if they don't exist
 */
function initializeSchema(database: SQLite.SQLiteDatabase): void {
  // Enable foreign keys and WAL mode for better performance
  database.execSync("PRAGMA foreign_keys = ON;");
  database.execSync("PRAGMA journal_mode = WAL;");

  // Create schema version table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  // Check current version
  const versionResult = database.getFirstSync<{ version: number }>(
    "SELECT version FROM schema_version LIMIT 1"
  );
  const currentVersion = versionResult?.version || 0;

  if (currentVersion < SCHEMA_VERSION) {
    // Run migrations
    runMigrations(database, currentVersion);
  }
}

/**
 * Run database migrations
 */
function runMigrations(database: SQLite.SQLiteDatabase, fromVersion: number): void {
  console.log(`📊 Running database migrations from v${fromVersion} to v${SCHEMA_VERSION}`);

  if (fromVersion < 1) {
    // Initial schema
    database.execSync(`
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        quote_number TEXT,
        name TEXT NOT NULL,
        client_name TEXT,
        client_email TEXT,
        client_phone TEXT,
        client_address TEXT,
        items TEXT NOT NULL DEFAULT '[]',
        labor REAL NOT NULL DEFAULT 0,
        material_estimate REAL,
        overhead REAL,
        markup_percent REAL,
        tax_percent REAL,
        notes TEXT,
        follow_up_date TEXT,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'draft',
        pinned INTEGER NOT NULL DEFAULT 0,
        tier TEXT,
        linked_quote_ids TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_quotes_updated_at ON quotes(updated_at);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON quotes(deleted_at);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
    `);

    database.execSync(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        quote_id TEXT,
        contract_id TEXT,
        invoice_number TEXT NOT NULL,
        name TEXT NOT NULL,
        client_name TEXT,
        client_email TEXT,
        client_phone TEXT,
        client_address TEXT,
        items TEXT NOT NULL DEFAULT '[]',
        labor REAL NOT NULL DEFAULT 0,
        material_estimate REAL,
        overhead REAL,
        markup_percent REAL,
        tax_percent REAL,
        notes TEXT,
        invoice_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unpaid',
        paid_date TEXT,
        paid_amount REAL,
        percentage REAL,
        is_partial_invoice INTEGER,
        currency TEXT NOT NULL DEFAULT 'USD',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_invoices_updated_at ON invoices(updated_at);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at);
    `);

    database.execSync(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_clients_updated_at ON clients(updated_at);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
    `);

    // Track migration status from AsyncStorage
    database.execSync(`
      CREATE TABLE IF NOT EXISTS migration_status (
        key TEXT PRIMARY KEY,
        value TEXT,
        migrated_at TEXT
      );
    `);
  }

  if (fromVersion < 2) {
    // Add pricebook_items table for Premium users
    database.execSync(`
      CREATE TABLE IF NOT EXISTS pricebook_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        unit_price REAL NOT NULL DEFAULT 0,
        unit_type TEXT,
        sku TEXT,
        is_active INTEGER DEFAULT 1,
        source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_pricebook_items_updated_at ON pricebook_items(updated_at);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_pricebook_items_name ON pricebook_items(name);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_pricebook_items_category ON pricebook_items(category);
    `);
  }

  if (fromVersion < 3) {
    // Add change_history and approved_snapshot columns to quotes table
    // These support the simplified change order flow
    // Check if columns exist first to handle partial migrations safely
    const columns = database.getAllSync<{ name: string }>(
      "PRAGMA table_info(quotes)"
    );
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has("change_history")) {
      database.execSync(`ALTER TABLE quotes ADD COLUMN change_history TEXT;`);
    }
    if (!columnNames.has("approved_snapshot")) {
      database.execSync(`ALTER TABLE quotes ADD COLUMN approved_snapshot TEXT;`);
    }
  }

  if (fromVersion < 4) {
    // Add invoice_payments table for payment history tracking
    database.execSync(`
      CREATE TABLE IF NOT EXISTS invoice_payments (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        user_id TEXT,
        amount REAL NOT NULL,
        payment_method TEXT,
        payment_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_invoice_payments_payment_date ON invoice_payments(payment_date);
    `);
  }

  if (fromVersion < 5) {
    // Add custom_line_items table for Quick Custom Items feature
    // Stores user-typed custom items for autocomplete and reuse
    database.execSync(`
      CREATE TABLE IF NOT EXISTS custom_line_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        default_price REAL NOT NULL DEFAULT 0,
        times_used INTEGER NOT NULL DEFAULT 1,
        first_added TEXT NOT NULL,
        last_used TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_custom_line_items_name ON custom_line_items(name);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_custom_line_items_times_used ON custom_line_items(times_used DESC);
    `);
  }

  if (fromVersion < 6) {
    // Add products table for catalog with paginated sync from Supabase
    database.execSync(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category_id TEXT,
        unit TEXT DEFAULT 'each',
        unit_price REAL DEFAULT 0,
        supplier_id TEXT,
        description TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    `);

    // Add categories table
    database.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    // Add sync metadata table for tracking last sync time
    database.execSync(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      );
    `);
  }

  if (fromVersion < 7) {
    // Add FTS5 full-text search for products
    // product_id is UNINDEXED (stored but not searchable)
    // name is tokenized with porter stemmer for better matching
    database.execSync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
        product_id UNINDEXED,
        name,
        tokenize='porter unicode61'
      );
    `);

    // Search synonyms table for construction term aliases
    // Maps common terms to canonical forms (e.g., "2x4" → "2 in x 4 in")
    database.execSync(`
      CREATE TABLE IF NOT EXISTS search_synonyms (
        term TEXT PRIMARY KEY COLLATE NOCASE,
        canonical TEXT NOT NULL
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_search_synonyms_canonical
      ON search_synonyms(canonical COLLATE NOCASE);
    `);

    // Rebuild FTS index if products already exist (migration scenario)
    const productCount = database.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM products"
    );
    if (productCount && productCount.count > 0) {
      console.log(`📚 Rebuilding FTS index for ${productCount.count} existing products...`);
      database.execSync(`
        INSERT INTO products_fts (product_id, name)
        SELECT id, name FROM products;
      `);
      console.log(`✅ FTS index rebuilt`);
    }
  }

  if (fromVersion < 8) {
    // Add hierarchical category support (parent/child relationships)
    // Check if columns exist first to handle partial migrations safely
    const columns = database.getAllSync<{ name: string }>(
      "PRAGMA table_info(categories)"
    );
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has("parent_id")) {
      database.execSync(`ALTER TABLE categories ADD COLUMN parent_id TEXT;`);
    }
    if (!columnNames.has("level")) {
      database.execSync(`ALTER TABLE categories ADD COLUMN level INTEGER DEFAULT 0;`);
    }
    if (!columnNames.has("sort_order")) {
      database.execSync(`ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 999;`);
    }

    // Index for efficient parent lookups
    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);
    `);

    console.log(`📁 Category hierarchy columns added`);
  }

  if (fromVersion < 9) {
    // Add canonical_category column to products for keyword-based category mapping
    const columns = database.getAllSync<{ name: string }>(
      "PRAGMA table_info(products)"
    );
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has("canonical_category")) {
      database.execSync(`ALTER TABLE products ADD COLUMN canonical_category TEXT DEFAULT 'Other';`);
    }

    // Index for efficient canonical category lookups
    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_products_canonical ON products(canonical_category);
    `);

    console.log(`📦 Canonical category column added to products`);
  }

  // Update version
  database.runSync(
    "INSERT OR REPLACE INTO schema_version (version) VALUES (?)",
    SCHEMA_VERSION
  );

  console.log(`✅ Database migrated to v${SCHEMA_VERSION}`);
}

// ============================================
// QUOTES
// ============================================

/**
 * Convert database row to Quote object
 */
function rowToQuote(row: any): Quote {
  return {
    id: row.id,
    quoteNumber: row.quote_number || undefined,
    name: row.name || "",
    clientName: row.client_name || undefined,
    clientEmail: row.client_email || undefined,
    clientPhone: row.client_phone || undefined,
    clientAddress: row.client_address || undefined,
    items: JSON.parse(row.items || "[]") as QuoteItem[],
    labor: row.labor || 0,
    materialEstimate: row.material_estimate || undefined,
    overhead: row.overhead || undefined,
    markupPercent: row.markup_percent || undefined,
    taxPercent: row.tax_percent || undefined,
    notes: row.notes || undefined,
    changeHistory: row.change_history || undefined,
    approvedSnapshot: row.approved_snapshot || undefined,
    followUpDate: row.follow_up_date || undefined,
    currency: row.currency || "USD",
    status: row.status || "draft",
    pinned: row.pinned === 1,
    tier: row.tier || undefined,
    linkedQuoteIds: row.linked_quote_ids ? JSON.parse(row.linked_quote_ids) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || undefined,
  };
}

/**
 * List quotes with pagination
 * Returns active quotes (not deleted) sorted by most recent
 */
export function listQuotesDB(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  includeDeleted?: boolean;
}): Quote[] {
  try {
    const database = getDatabase();
    const { limit = 50, offset = 0, status, includeDeleted = false } = options || {};

    let sql = "SELECT * FROM quotes WHERE 1=1";
    const params: any[] = [];

    if (!includeDeleted) {
      sql += " AND deleted_at IS NULL";
    }

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = database.getAllSync(sql, params);
    return rows.map(rowToQuote);
  } catch (error) {
    console.error("Failed to list quotes from SQLite:", error);
    return [];
  }
}

/**
 * Get total count of quotes (for pagination)
 */
export function getQuoteCountDB(includeDeleted = false): number {
  try {
    const database = getDatabase();
    let sql = "SELECT COUNT(*) as count FROM quotes";
    if (!includeDeleted) {
      sql += " WHERE deleted_at IS NULL";
    }
    const result = database.getFirstSync<{ count: number }>(sql);
    return result?.count || 0;
  } catch (error) {
    console.error("Failed to get quote count from SQLite:", error);
    return 0;
  }
}

/**
 * Get a single quote by ID
 */
export function getQuoteByIdDB(id: string): Quote | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync(
      "SELECT * FROM quotes WHERE id = ?",
      [id]
    );
    return row ? rowToQuote(row) : null;
  } catch (error) {
    console.error(`Failed to get quote ${id} from SQLite:`, error);
    return null;
  }
}

/**
 * Save a quote (insert or update)
 */
export function saveQuoteDB(quote: Quote): void {
  try {
    const database = getDatabase();

    // Debug logging for tier/linkedQuoteIds
    if (quote.tier || quote.linkedQuoteIds) {
      console.log(`[DB] saveQuoteDB ${quote.id}:`, {
        tier: quote.tier,
        linkedQuoteIds: quote.linkedQuoteIds,
      });
    }

    database.runSync(
      `INSERT OR REPLACE INTO quotes (
        id, quote_number, name, client_name, client_email, client_phone, client_address,
        items, labor, material_estimate, overhead, markup_percent, tax_percent,
        notes, change_history, approved_snapshot, follow_up_date, currency, status, pinned, tier, linked_quote_ids,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quote.id,
        quote.quoteNumber || null,
        quote.name,
        quote.clientName || null,
        quote.clientEmail || null,
        quote.clientPhone || null,
        quote.clientAddress || null,
        JSON.stringify(quote.items || []),
        quote.labor || 0,
        quote.materialEstimate || null,
        quote.overhead || null,
        quote.markupPercent || null,
        quote.taxPercent || null,
        quote.notes || null,
        quote.changeHistory || null,
        quote.approvedSnapshot || null,
        quote.followUpDate || null,
        quote.currency || "USD",
        quote.status || "draft",
        quote.pinned ? 1 : 0,
        quote.tier || null,
        quote.linkedQuoteIds ? JSON.stringify(quote.linkedQuoteIds) : null,
        quote.createdAt,
        quote.updatedAt,
        quote.deletedAt || null,
      ]
    );
  } catch (error) {
    console.error(`Failed to save quote ${quote.id} to SQLite:`, error);
    throw error; // Re-throw so caller knows save failed
  }
}

/**
 * Save multiple quotes in a transaction (efficient batch operation)
 */
export function saveQuotesBatchDB(quotes: Quote[]): void {
  if (quotes.length === 0) return;

  try {
    const database = getDatabase();

    database.withTransactionSync(() => {
      for (const quote of quotes) {
        saveQuoteDB(quote);
      }
    });
  } catch (error) {
    console.error(`Failed to batch save ${quotes.length} quotes to SQLite:`, error);
    throw error;
  }
}

/**
 * Soft delete a quote
 */
export function deleteQuoteDB(id: string): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();
    database.runSync(
      "UPDATE quotes SET deleted_at = ?, updated_at = ? WHERE id = ?",
      [now, now, id]
    );
  } catch (error) {
    console.error(`Failed to delete quote ${id} from SQLite:`, error);
    throw error;
  }
}

/**
 * Get IDs of locally deleted quotes (for sync to skip re-downloading)
 */
export function getLocallyDeletedQuoteIdsDB(): string[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT id FROM quotes WHERE deleted_at IS NOT NULL"
    );
    return rows.map((row: any) => row.id);
  } catch (error) {
    console.error("Failed to get deleted quote IDs from SQLite:", error);
    return [];
  }
}

/**
 * Get quotes modified since a timestamp (for sync)
 */
export function getQuotesModifiedSinceDB(since: string): Quote[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM quotes WHERE updated_at > ? ORDER BY updated_at ASC",
      [since]
    );
    return rows.map(rowToQuote);
  } catch (error) {
    console.error("Failed to get modified quotes from SQLite:", error);
    return [];
  }
}

// ============================================
// INVOICES
// ============================================

/**
 * Convert database row to Invoice object
 */
function rowToInvoice(row: any): Invoice {
  return {
    id: row.id,
    quoteId: row.quote_id || undefined,
    contractId: row.contract_id || undefined,
    invoiceNumber: row.invoice_number,
    name: row.name || "",
    clientName: row.client_name || undefined,
    clientEmail: row.client_email || undefined,
    clientPhone: row.client_phone || undefined,
    clientAddress: row.client_address || undefined,
    items: JSON.parse(row.items || "[]") as QuoteItem[],
    labor: row.labor || 0,
    materialEstimate: row.material_estimate || undefined,
    overhead: row.overhead || undefined,
    markupPercent: row.markup_percent || undefined,
    taxPercent: row.tax_percent || undefined,
    notes: row.notes || undefined,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    status: row.status || "unpaid",
    paidDate: row.paid_date || undefined,
    paidAmount: row.paid_amount || undefined,
    percentage: row.percentage || undefined,
    isPartialInvoice: row.is_partial_invoice === 1,
    currency: row.currency || "USD",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || undefined,
  };
}

/**
 * List invoices with pagination
 */
export function listInvoicesDB(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  includeDeleted?: boolean;
}): Invoice[] {
  try {
    const database = getDatabase();
    const { limit = 50, offset = 0, status, includeDeleted = false } = options || {};

    let sql = "SELECT * FROM invoices WHERE 1=1";
    const params: any[] = [];

    if (!includeDeleted) {
      sql += " AND deleted_at IS NULL";
    }

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = database.getAllSync(sql, params);
    return rows.map(rowToInvoice);
  } catch (error) {
    console.error("Failed to list invoices from SQLite:", error);
    return [];
  }
}

/**
 * Get total count of invoices
 */
export function getInvoiceCountDB(includeDeleted = false): number {
  try {
    const database = getDatabase();
    let sql = "SELECT COUNT(*) as count FROM invoices";
    if (!includeDeleted) {
      sql += " WHERE deleted_at IS NULL";
    }
    const result = database.getFirstSync<{ count: number }>(sql);
    return result?.count || 0;
  } catch (error) {
    console.error("Failed to get invoice count from SQLite:", error);
    return 0;
  }
}

/**
 * Get a single invoice by ID
 */
export function getInvoiceByIdDB(id: string): Invoice | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync(
      "SELECT * FROM invoices WHERE id = ?",
      [id]
    );
    return row ? rowToInvoice(row) : null;
  } catch (error) {
    console.error(`Failed to get invoice ${id} from SQLite:`, error);
    return null;
  }
}

/**
 * Save an invoice (insert or update)
 */
export function saveInvoiceDB(invoice: Invoice): void {
  try {
    const database = getDatabase();

    database.runSync(
      `INSERT OR REPLACE INTO invoices (
        id, quote_id, contract_id, invoice_number, name, client_name,
        client_email, client_phone, client_address, items, labor,
        material_estimate, overhead, markup_percent, tax_percent, notes,
        invoice_date, due_date, status, paid_date, paid_amount,
        percentage, is_partial_invoice, currency, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice.id,
        invoice.quoteId || null,
        invoice.contractId || null,
        invoice.invoiceNumber,
        invoice.name,
        invoice.clientName || null,
        invoice.clientEmail || null,
        invoice.clientPhone || null,
        invoice.clientAddress || null,
        JSON.stringify(invoice.items || []),
        invoice.labor || 0,
        invoice.materialEstimate || null,
        invoice.overhead || null,
        invoice.markupPercent || null,
        invoice.taxPercent || null,
        invoice.notes || null,
        invoice.invoiceDate,
        invoice.dueDate,
        invoice.status || "unpaid",
        invoice.paidDate || null,
        invoice.paidAmount || null,
        invoice.percentage || null,
        invoice.isPartialInvoice ? 1 : null,
        invoice.currency || "USD",
        invoice.createdAt,
        invoice.updatedAt,
        invoice.deletedAt || null,
      ]
    );
  } catch (error) {
    console.error(`Failed to save invoice ${invoice.id} to SQLite:`, error);
    throw error;
  }
}

/**
 * Save multiple invoices in a transaction
 */
export function saveInvoicesBatchDB(invoices: Invoice[]): void {
  if (invoices.length === 0) return;

  try {
    const database = getDatabase();

    database.withTransactionSync(() => {
      for (const invoice of invoices) {
        saveInvoiceDB(invoice);
      }
    });
  } catch (error) {
    console.error(`Failed to batch save ${invoices.length} invoices to SQLite:`, error);
    throw error;
  }
}

/**
 * Soft delete an invoice
 */
export function deleteInvoiceDB(id: string): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();
    database.runSync(
      "UPDATE invoices SET deleted_at = ?, updated_at = ? WHERE id = ?",
      [now, now, id]
    );
  } catch (error) {
    console.error(`Failed to delete invoice ${id} from SQLite:`, error);
    throw error;
  }
}

/**
 * Get IDs of locally deleted invoices (for sync to skip re-downloading)
 */
export function getLocallyDeletedInvoiceIdsDB(): string[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT id FROM invoices WHERE deleted_at IS NOT NULL"
    );
    return rows.map((row: any) => row.id);
  } catch (error) {
    console.error("Failed to get deleted invoice IDs from SQLite:", error);
    return [];
  }
}

/**
 * Get invoices modified since a timestamp (for sync)
 */
export function getInvoicesModifiedSinceDB(since: string): Invoice[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM invoices WHERE updated_at > ? ORDER BY updated_at ASC",
      [since]
    );
    return rows.map(rowToInvoice);
  } catch (error) {
    console.error("Failed to get modified invoices from SQLite:", error);
    return [];
  }
}

// ============================================
// CLIENTS
// ============================================

/**
 * Convert database row to Client object
 */
function rowToClient(row: any): Client {
  return {
    id: row.id,
    name: row.name || "",
    email: row.email || undefined,
    phone: row.phone || undefined,
    address: row.address || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List clients with pagination
 */
export function listClientsDB(options?: {
  limit?: number;
  offset?: number;
  search?: string;
  includeDeleted?: boolean;
}): Client[] {
  try {
    const database = getDatabase();
    const { limit = 50, offset = 0, search, includeDeleted = false } = options || {};

    let sql = "SELECT * FROM clients WHERE 1=1";
    const params: any[] = [];

    if (!includeDeleted) {
      sql += " AND deleted_at IS NULL";
    }

    if (search) {
      sql += " AND (name LIKE ? OR email LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += " ORDER BY name ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = database.getAllSync(sql, params);
    return rows.map(rowToClient);
  } catch (error) {
    console.error("Failed to list clients from SQLite:", error);
    return [];
  }
}

/**
 * Get total count of clients
 */
export function getClientCountDB(includeDeleted = false): number {
  try {
    const database = getDatabase();
    let sql = "SELECT COUNT(*) as count FROM clients";
    if (!includeDeleted) {
      sql += " WHERE deleted_at IS NULL";
    }
    const result = database.getFirstSync<{ count: number }>(sql);
    return result?.count || 0;
  } catch (error) {
    console.error("Failed to get client count from SQLite:", error);
    return 0;
  }
}

/**
 * Get a single client by ID
 */
export function getClientByIdDB(id: string): Client | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync(
      "SELECT * FROM clients WHERE id = ?",
      [id]
    );
    return row ? rowToClient(row) : null;
  } catch (error) {
    console.error(`Failed to get client ${id} from SQLite:`, error);
    return null;
  }
}

/**
 * Save a client (insert or update)
 */
export function saveClientDB(client: Client): void {
  try {
    const database = getDatabase();

    database.runSync(
      `INSERT OR REPLACE INTO clients (
        id, name, email, phone, address, notes, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client.id,
        client.name,
        client.email || null,
        client.phone || null,
        client.address || null,
        client.notes || null,
        client.createdAt,
        client.updatedAt,
        null, // deleted_at
      ]
    );
  } catch (error) {
    console.error(`Failed to save client ${client.id} to SQLite:`, error);
    throw error;
  }
}

/**
 * Save multiple clients in a transaction
 */
export function saveClientsBatchDB(clients: Client[]): void {
  if (clients.length === 0) return;

  try {
    const database = getDatabase();

    database.withTransactionSync(() => {
      for (const client of clients) {
        saveClientDB(client);
      }
    });
  } catch (error) {
    console.error(`Failed to batch save ${clients.length} clients to SQLite:`, error);
    throw error;
  }
}

/**
 * Soft delete a client
 */
export function deleteClientDB(id: string): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();
    database.runSync(
      "UPDATE clients SET deleted_at = ?, updated_at = ? WHERE id = ?",
      [now, now, id]
    );
  } catch (error) {
    console.error(`Failed to delete client ${id} from SQLite:`, error);
    throw error;
  }
}

/**
 * Get IDs of locally deleted clients (for sync to skip re-downloading)
 */
export function getLocallyDeletedClientIdsDB(): string[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT id FROM clients WHERE deleted_at IS NOT NULL"
    );
    return rows.map((row: any) => row.id);
  } catch (error) {
    console.error("Failed to get deleted client IDs from SQLite:", error);
    return [];
  }
}

/**
 * Get clients modified since a timestamp (for sync)
 */
export function getClientsModifiedSinceDB(since: string): Client[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM clients WHERE updated_at > ? ORDER BY updated_at ASC",
      [since]
    );
    return rows.map(rowToClient);
  } catch (error) {
    console.error("Failed to get modified clients from SQLite:", error);
    return [];
  }
}

// ============================================
// PRICEBOOK ITEMS
// ============================================

/**
 * Convert database row to PricebookItem object
 */
function rowToPricebookItem(row: any): PricebookItem {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || undefined,
    category: row.category || undefined,
    unitPrice: row.unit_price || 0,
    unitType: row.unit_type || undefined,
    sku: row.sku || undefined,
    isActive: row.is_active === 1,
    source: row.source || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List pricebook items with pagination
 */
export function listPricebookItemsDB(options?: {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
  includeDeleted?: boolean;
  activeOnly?: boolean;
}): PricebookItem[] {
  try {
    const database = getDatabase();
    const { limit = 100, offset = 0, category, search, includeDeleted = false, activeOnly = true } = options || {};

    let sql = "SELECT * FROM pricebook_items WHERE 1=1";
    const params: any[] = [];

    if (!includeDeleted) {
      sql += " AND deleted_at IS NULL";
    }

    if (activeOnly) {
      sql += " AND (is_active = 1 OR is_active IS NULL)";
    }

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    if (search) {
      sql += " AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += " ORDER BY name ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = database.getAllSync(sql, params);
    return rows.map(rowToPricebookItem);
  } catch (error) {
    console.error("Failed to list pricebook items from SQLite:", error);
    return [];
  }
}

/**
 * Get total count of pricebook items
 */
export function getPricebookItemCountDB(includeDeleted = false): number {
  try {
    const database = getDatabase();
    let sql = "SELECT COUNT(*) as count FROM pricebook_items";
    if (!includeDeleted) {
      sql += " WHERE deleted_at IS NULL";
    }
    const result = database.getFirstSync<{ count: number }>(sql);
    return result?.count || 0;
  } catch (error) {
    console.error("Failed to get pricebook item count from SQLite:", error);
    return 0;
  }
}

/**
 * Get a single pricebook item by ID
 */
export function getPricebookItemByIdDB(id: string): PricebookItem | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync(
      "SELECT * FROM pricebook_items WHERE id = ?",
      [id]
    );
    return row ? rowToPricebookItem(row) : null;
  } catch (error) {
    console.error(`Failed to get pricebook item ${id} from SQLite:`, error);
    return null;
  }
}

/**
 * Save a pricebook item (insert or update)
 */
export function savePricebookItemDB(item: PricebookItem): void {
  try {
    const database = getDatabase();

    database.runSync(
      `INSERT OR REPLACE INTO pricebook_items (
        id, name, description, category, unit_price, unit_type, sku,
        is_active, source, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.name,
        item.description || null,
        item.category || null,
        item.unitPrice || 0,
        item.unitType || null,
        item.sku || null,
        item.isActive === false ? 0 : 1,
        item.source || null,
        item.createdAt,
        item.updatedAt,
        null, // deleted_at
      ]
    );
  } catch (error) {
    console.error(`Failed to save pricebook item ${item.id} to SQLite:`, error);
    throw error;
  }
}

/**
 * Save multiple pricebook items in a transaction
 */
export function savePricebookItemsBatchDB(items: PricebookItem[]): void {
  if (items.length === 0) return;

  try {
    const database = getDatabase();

    database.withTransactionSync(() => {
      for (const item of items) {
        savePricebookItemDB(item);
      }
    });
  } catch (error) {
    console.error(`Failed to batch save ${items.length} pricebook items to SQLite:`, error);
    throw error;
  }
}

/**
 * Soft delete a pricebook item
 */
export function deletePricebookItemDB(id: string): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();
    database.runSync(
      "UPDATE pricebook_items SET deleted_at = ?, updated_at = ? WHERE id = ?",
      [now, now, id]
    );
  } catch (error) {
    console.error(`Failed to delete pricebook item ${id} from SQLite:`, error);
    throw error;
  }
}

/**
 * Get pricebook items modified since a timestamp (for sync)
 */
export function getPricebookItemsModifiedSinceDB(since: string): PricebookItem[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM pricebook_items WHERE updated_at > ? ORDER BY updated_at ASC",
      [since]
    );
    return rows.map(rowToPricebookItem);
  } catch (error) {
    console.error("Failed to get modified pricebook items from SQLite:", error);
    return [];
  }
}

/**
 * Get unique categories from pricebook items
 */
export function getPricebookCategoriesDB(): string[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync<{ category: string }>(
      "SELECT DISTINCT category FROM pricebook_items WHERE category IS NOT NULL AND deleted_at IS NULL ORDER BY category ASC"
    );
    return rows.map(row => row.category);
  } catch (error) {
    console.error("Failed to get pricebook categories from SQLite:", error);
    return [];
  }
}

// ============================================
// MIGRATION STATUS
// ============================================

/**
 * Check if data has been migrated from AsyncStorage
 */
export function hasMigratedFromAsyncStorage(): boolean {
  try {
    const database = getDatabase();
    const result = database.getFirstSync<{ value: string }>(
      "SELECT value FROM migration_status WHERE key = 'asyncstorage_migrated'"
    );
    return result?.value === "true";
  } catch (error) {
    console.error("Failed to check migration status from SQLite:", error);
    return false;
  }
}

/**
 * Mark migration from AsyncStorage as complete
 */
export function setMigratedFromAsyncStorage(): void {
  try {
    const database = getDatabase();
    database.runSync(
      "INSERT OR REPLACE INTO migration_status (key, value, migrated_at) VALUES (?, ?, ?)",
      ["asyncstorage_migrated", "true", new Date().toISOString()]
    );
  } catch (error) {
    console.error("Failed to set migration status in SQLite:", error);
    throw error;
  }
}

// ============================================
// INVOICE PAYMENTS
// ============================================

/**
 * Convert database row to InvoicePayment object
 */
function rowToInvoicePayment(row: any): InvoicePayment {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    userId: row.user_id || undefined,
    amount: row.amount || 0,
    paymentMethod: row.payment_method || undefined,
    paymentDate: row.payment_date,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List all payments for an invoice
 */
export function listInvoicePaymentsDB(invoiceId: string): InvoicePayment[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC",
      [invoiceId]
    );
    return rows.map(rowToInvoicePayment);
  } catch (error) {
    console.error(`Failed to list payments for invoice ${invoiceId}:`, error);
    return [];
  }
}

/**
 * Get a single payment by ID
 */
export function getInvoicePaymentByIdDB(id: string): InvoicePayment | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync(
      "SELECT * FROM invoice_payments WHERE id = ?",
      [id]
    );
    return row ? rowToInvoicePayment(row) : null;
  } catch (error) {
    console.error(`Failed to get payment ${id}:`, error);
    return null;
  }
}

/**
 * Save a payment (insert or update)
 */
export function saveInvoicePaymentDB(payment: InvoicePayment): void {
  try {
    const database = getDatabase();
    database.runSync(
      `INSERT OR REPLACE INTO invoice_payments (
        id, invoice_id, user_id, amount, payment_method, payment_date,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.id,
        payment.invoiceId,
        payment.userId || null,
        payment.amount,
        payment.paymentMethod || null,
        payment.paymentDate,
        payment.notes || null,
        payment.createdAt,
        payment.updatedAt,
      ]
    );
  } catch (error) {
    console.error(`Failed to save payment ${payment.id}:`, error);
    throw error;
  }
}

/**
 * Delete a payment by ID
 */
export function deleteInvoicePaymentDB(id: string): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM invoice_payments WHERE id = ?", [id]);
  } catch (error) {
    console.error(`Failed to delete payment ${id}:`, error);
    throw error;
  }
}

/**
 * Get total paid amount for an invoice
 */
export function getInvoicePaidTotalDB(invoiceId: string): number {
  try {
    const database = getDatabase();
    const result = database.getFirstSync<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM invoice_payments WHERE invoice_id = ?",
      [invoiceId]
    );
    return result?.total || 0;
  } catch (error) {
    console.error(`Failed to get paid total for invoice ${invoiceId}:`, error);
    return 0;
  }
}

// ============================================
// UTILITY
// ============================================

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.closeSync();
    db = null;
  }
}

// ==========================================
// PRODUCTS
// ==========================================

/**
 * Convert database row to Product type
 */
function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id || "Other",
    canonicalCategory: row.canonical_category || "Other",
    unit: row.unit || "each",
    unitPrice: row.unit_price || 0,
    supplierId: row.supplier_id || undefined,
  };
}

/**
 * List products with optional pagination and filtering
 */
export function listProductsDB(options?: {
  limit?: number;
  offset?: number;
  categoryId?: string;
  supplierId?: string;
}): Product[] {
  try {
    const database = getDatabase();
    const { limit, offset, categoryId, supplierId } = options || {};

    let sql = "SELECT * FROM products WHERE 1=1";
    const params: any[] = [];

    if (categoryId) {
      sql += " AND category_id = ?";
      params.push(categoryId);
    }

    if (supplierId) {
      sql += " AND supplier_id = ?";
      params.push(supplierId);
    }

    sql += " ORDER BY name ASC";

    if (limit !== undefined) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    if (offset !== undefined) {
      sql += " OFFSET ?";
      params.push(offset);
    }

    const rows = database.getAllSync(sql, params);
    return rows.map(rowToProduct);
  } catch (error) {
    console.error("Failed to list products from SQLite:", error);
    return [];
  }
}

/**
 * Get total product count
 */
export function getProductCountDB(): number {
  try {
    const database = getDatabase();
    const result = database.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM products"
    );
    return result?.count || 0;
  } catch (error) {
    console.error("Failed to get product count from SQLite:", error);
    return 0;
  }
}

/**
 * Get product by ID
 */
export function getProductByIdDB(id: string): Product | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync(
      "SELECT * FROM products WHERE id = ?",
      [id]
    );
    return row ? rowToProduct(row) : null;
  } catch (error) {
    console.error(`Failed to get product ${id} from SQLite:`, error);
    return null;
  }
}

/**
 * Save a single product
 */
export function saveProductDB(product: Product): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();

    database.runSync(
      `INSERT OR REPLACE INTO products (
        id, name, category_id, unit, unit_price, supplier_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product.id,
        product.name,
        product.categoryId,
        product.unit,
        product.unitPrice,
        product.supplierId || null,
        now,
      ]
    );
  } catch (error) {
    console.error(`Failed to save product ${product.id} to SQLite:`, error);
    throw error;
  }
}

/**
 * Save multiple products in a transaction (efficient batch operation)
 * FTS index is rebuilt separately via rebuildProductsFTS()
 */
export function saveProductsBatchDB(products: Product[]): void {
  if (products.length === 0) return;

  try {
    const database = getDatabase();
    const now = new Date().toISOString();

    database.withTransactionSync(() => {
      for (const product of products) {
        // Insert/update product
        database.runSync(
          `INSERT OR REPLACE INTO products (
            id, name, category_id, canonical_category, unit, unit_price, supplier_id, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.id,
            product.name,
            product.categoryId,
            product.canonicalCategory || "Other",
            product.unit,
            product.unitPrice,
            product.supplierId || null,
            now,
          ]
        );
      }
    });
  } catch (error) {
    console.error(`Failed to batch save ${products.length} products to SQLite:`, error);
    throw error;
  }
}

/**
 * Clear all products (for full resync)
 * Also clears the FTS5 search index
 */
export function clearProductsDB(): void {
  try {
    const database = getDatabase();
    database.withTransactionSync(() => {
      database.runSync("DELETE FROM products");
      database.runSync("DELETE FROM products_fts");
    });
  } catch (error) {
    console.error("Failed to clear products from SQLite:", error);
    throw error;
  }
}

/**
 * Rebuild FTS index from existing products
 * Call this if FTS search returns no results but products exist
 */
export function rebuildProductsFTS(): void {
  try {
    const database = getDatabase();
    const productCount = getProductCountDB();

    if (productCount === 0) {
      console.log("No products to index");
      return;
    }

    console.log(`🔄 Rebuilding FTS index for ${productCount} products...`);

    database.withTransactionSync(() => {
      // Clear existing FTS data
      database.runSync("DELETE FROM products_fts");

      // Rebuild from products table
      database.runSync(`
        INSERT INTO products_fts (product_id, name)
        SELECT id, name FROM products
      `);
    });

    console.log(`✅ FTS index rebuilt`);
  } catch (error) {
    console.error("Failed to rebuild FTS index:", error);
    throw error;
  }
}

/**
 * Check if FTS index needs rebuilding (products exist but FTS is empty)
 */
export function needsFTSRebuild(): boolean {
  try {
    const database = getDatabase();
    const productCount = getProductCountDB();
    const ftsCount = database.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM products_fts"
    );

    return productCount > 0 && (ftsCount?.count || 0) === 0;
  } catch (error) {
    console.error("Failed to check FTS status:", error);
    return false;
  }
}

/**
 * Get synonym expansion for a search term
 */
export function getSynonymDB(term: string): string | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync<{ canonical: string }>(
      "SELECT canonical FROM search_synonyms WHERE term = ? COLLATE NOCASE",
      [term]
    );
    return row?.canonical || null;
  } catch (error) {
    console.error("Failed to get synonym:", error);
    return null;
  }
}

/**
 * Add or update a search synonym
 */
export function setSynonymDB(term: string, canonical: string): void {
  try {
    const database = getDatabase();
    database.runSync(
      "INSERT OR REPLACE INTO search_synonyms (term, canonical) VALUES (?, ?)",
      [term.toLowerCase(), canonical.toLowerCase()]
    );
  } catch (error) {
    console.error("Failed to set synonym:", error);
    throw error;
  }
}

/**
 * Batch insert synonyms
 */
export function setSynonymsBatchDB(synonyms: Array<{ term: string; canonical: string }>): void {
  if (synonyms.length === 0) return;

  try {
    const database = getDatabase();
    database.withTransactionSync(() => {
      for (const { term, canonical } of synonyms) {
        database.runSync(
          "INSERT OR REPLACE INTO search_synonyms (term, canonical) VALUES (?, ?)",
          [term.toLowerCase(), canonical.toLowerCase()]
        );
      }
    });
  } catch (error) {
    console.error("Failed to batch insert synonyms:", error);
    throw error;
  }
}

/**
 * Search products using FTS5 full-text search
 * Supports:
 * - Word stemming (running → run)
 * - Prefix matching (dry* → drywall)
 * - Synonym expansion (2x4 → 2 in x 4 in)
 * - Relevance ranking
 */
export function searchProductsFTS(query: string, limit = 100): Product[] {
  if (!query.trim()) return [];

  try {
    const database = getDatabase();
    const originalQuery = query.trim().toLowerCase();

    // Check for synonym expansion first (e.g., "2x4" → "2 in x 4 in")
    const synonym = getSynonymDB(originalQuery);

    // Use synonym if available, otherwise use original
    const searchText = synonym || originalQuery;

    // Clean and tokenize for FTS
    const terms = searchText
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .split(/\s+/)
      .filter(t => t.length > 0);

    if (terms.length === 0) return [];

    // Build FTS query: all terms with prefix matching, joined by AND
    // This ensures all terms must be present
    const ftsQuery = terms.map(t => `${t}*`).join(' AND ');

    // Search FTS5 and join with products for full data
    const rows = database.getAllSync(
      `SELECT p.*, fts.rank
       FROM products_fts fts
       JOIN products p ON p.id = fts.product_id
       WHERE products_fts MATCH ?
       ORDER BY fts.rank
       LIMIT ?`,
      [ftsQuery, limit]
    );

    return rows.map(rowToProduct);
  } catch (error) {
    console.error("[FTS] Search failed, falling back to LIKE:", error);
    // Fallback to simple LIKE search if FTS fails
    return searchProductsLike(query, limit);
  }
}

/**
 * Fallback LIKE-based search (used if FTS5 fails)
 */
function searchProductsLike(query: string, limit = 100): Product[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      `SELECT * FROM products
       WHERE LOWER(name) LIKE ?
       ORDER BY name ASC
       LIMIT ?`,
      [`%${query.toLowerCase()}%`, limit]
    );
    return rows.map(rowToProduct);
  } catch (error) {
    console.error("Failed to search products:", error);
    return [];
  }
}

/**
 * Legacy function name for compatibility
 * @deprecated Use searchProductsFTS instead
 */
export function searchProductsDB(query: string, limit = 100): Product[] {
  return searchProductsFTS(query, limit);
}

// ==========================================
// CATEGORIES
// ==========================================

/**
 * Convert database row to Category type
 */
function rowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id || undefined,
    level: row.level ?? 0,
    sortOrder: row.sort_order ?? 999,
  };
}

/**
 * List all categories ordered by level then name
 */
export function listCategoriesDB(): Category[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM categories ORDER BY level ASC, sort_order ASC, name ASC"
    );
    return rows.map(rowToCategory);
  } catch (error) {
    console.error("Failed to list categories from SQLite:", error);
    return [];
  }
}

/**
 * List only parent categories (level 0)
 */
export function listParentCategoriesDB(): Category[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM categories WHERE level = 0 OR parent_id IS NULL ORDER BY sort_order ASC, name ASC"
    );
    return rows.map(rowToCategory);
  } catch (error) {
    console.error("Failed to list parent categories from SQLite:", error);
    return [];
  }
}

/**
 * List child categories for a given parent
 */
export function listChildCategoriesDB(parentId: string): Category[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order ASC, name ASC",
      [parentId]
    );
    return rows.map(rowToCategory);
  } catch (error) {
    console.error(`Failed to list child categories for ${parentId}:`, error);
    return [];
  }
}

/**
 * Save multiple categories in a transaction (with hierarchy support)
 */
export function saveCategoriesBatchDB(categories: Category[]): void {
  if (categories.length === 0) return;

  try {
    const database = getDatabase();
    const now = new Date().toISOString();

    database.withTransactionSync(() => {
      for (const category of categories) {
        database.runSync(
          `INSERT OR REPLACE INTO categories (id, name, parent_id, level, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            category.id,
            category.name,
            category.parentId || null,
            category.level ?? 0,
            category.sortOrder ?? 999,
            now
          ]
        );
      }
    });
  } catch (error) {
    console.error(`Failed to batch save ${categories.length} categories to SQLite:`, error);
    throw error;
  }
}

/**
 * Clear all categories (for full resync)
 */
export function clearCategoriesDB(): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM categories");
  } catch (error) {
    console.error("Failed to clear categories from SQLite:", error);
    throw error;
  }
}

// ==========================================
// SYNC METADATA
// ==========================================

/**
 * Get sync metadata value
 */
export function getSyncMetadataDB(key: string): string | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync<{ value: string }>(
      "SELECT value FROM sync_metadata WHERE key = ?",
      [key]
    );
    return row?.value || null;
  } catch (error) {
    console.error(`Failed to get sync metadata ${key} from SQLite:`, error);
    return null;
  }
}

/**
 * Set sync metadata value
 */
export function setSyncMetadataDB(key: string, value: string): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();
    database.runSync(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
      [key, value, now]
    );
  } catch (error) {
    console.error(`Failed to set sync metadata ${key} in SQLite:`, error);
    throw error;
  }
}

/**
 * Clear all data (for testing/reset)
 */
export function clearAllDataDB(): void {
  try {
    const database = getDatabase();
    database.withTransactionSync(() => {
      database.runSync("DELETE FROM invoice_payments");
      database.runSync("DELETE FROM quotes");
      database.runSync("DELETE FROM invoices");
      database.runSync("DELETE FROM clients");
      database.runSync("DELETE FROM pricebook_items");
      database.runSync("DELETE FROM products");
      database.runSync("DELETE FROM categories");
      database.runSync("DELETE FROM sync_metadata");
      database.runSync("DELETE FROM migration_status");
    });
  } catch (error) {
    console.error("Failed to clear all data from SQLite:", error);
    throw error;
  }
}
