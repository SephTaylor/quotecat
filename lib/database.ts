// lib/database.ts
// SQLite database layer - replaces AsyncStorage for quotes/invoices/clients
// This solves the OOM crashes by loading data row-by-row instead of all at once

import * as SQLite from "expo-sqlite";
import type { Quote, Invoice, Client, QuoteItem, PricebookItem, InvoicePayment, LaborEntry, TeamMember } from "./types";
import type { Product, Category } from "@/modules/catalog/seed";

// Database instance (lazy initialized)
let db: SQLite.SQLiteDatabase | null = null;

// Schema version for migrations
const SCHEMA_VERSION = 16;

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

    // NOTE: FTS rebuild moved to migration v10 which uses search_name column
    // Do not rebuild here - v10 will handle it with the correct schema
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

  if (fromVersion < 10) {
    // Add search_name column for normalized FTS search
    // This column contains all search variations (e.g., "2x8 2-in x 8-in pressure treated lumber")
    const columns = database.getAllSync<{ name: string }>(
      "PRAGMA table_info(products)"
    );
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has("search_name")) {
      database.execSync(`ALTER TABLE products ADD COLUMN search_name TEXT;`);
    }

    // Update FTS to use search_name instead of name
    // First, drop and recreate the FTS table with the new column
    database.execSync(`DROP TABLE IF EXISTS products_fts;`);
    database.execSync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
        product_id UNINDEXED,
        search_name,
        tokenize='porter unicode61'
      );
    `);

    // Rebuild FTS index if products already exist
    const productCount = database.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM products"
    );
    if (productCount && productCount.count > 0) {
      console.log(`📚 Rebuilding FTS index for ${productCount.count} products with search_name...`);
      // Use search_name if available, fall back to name
      database.execSync(`
        INSERT INTO products_fts (product_id, search_name)
        SELECT id, COALESCE(search_name, name) FROM products;
      `);
      console.log(`✅ FTS index rebuilt with search_name`);
    }

    console.log(`🔍 Added search_name column and updated FTS index`);
  }

  if (fromVersion < 11) {
    // Add coverage_sqft column for flooring products (sq ft per carton/case/piece)
    const columns = database.getAllSync<{ name: string }>(
      "PRAGMA table_info(products)"
    );
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has("coverage_sqft")) {
      database.execSync(`ALTER TABLE products ADD COLUMN coverage_sqft REAL;`);
      console.log(`📐 Added coverage_sqft column for flooring products`);
    }
  }

  if (fromVersion < 12) {
    // Add product_url column for linking to retailer product pages
    const columns = database.getAllSync<{ name: string }>(
      "PRAGMA table_info(products)"
    );
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has("product_url")) {
      database.execSync(`ALTER TABLE products ADD COLUMN product_url TEXT;`);
      console.log(`🔗 Added product_url column for retailer links`);
    }
  }

  if (fromVersion < 13) {
    // Add team_members table for Premium users (mirrors Supabase team_members)
    // This allows tracking labor costs per worker on quotes
    database.execSync(`
      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        role TEXT,
        default_rate REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_team_members_name ON team_members(name);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON team_members(is_active);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
    `);

    // Add labor_entries column to quotes table (stored as JSON like items)
    const quoteColumns = database.getAllSync<{ name: string }>(
      "PRAGMA table_info(quotes)"
    );
    const quoteColumnNames = new Set(quoteColumns.map((c) => c.name));

    if (!quoteColumnNames.has("labor_entries")) {
      database.execSync(`ALTER TABLE quotes ADD COLUMN labor_entries TEXT;`);
    }

    // Add labor_entries column to invoices table as well
    const invoiceColumns = database.getAllSync<{ name: string }>(
      "PRAGMA table_info(invoices)"
    );
    const invoiceColumnNames = new Set(invoiceColumns.map((c) => c.name));

    if (!invoiceColumnNames.has("labor_entries")) {
      database.execSync(`ALTER TABLE invoices ADD COLUMN labor_entries TEXT;`);
    }

    console.log(`👷 Added team_members table and labor_entries columns`);
  }

  if (fromVersion < 14) {
    // Add assemblies table (migrated from AsyncStorage)
    // Assemblies are reusable templates for groups of products
    database.execSync(`
      CREATE TABLE IF NOT EXISTS assemblies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        items TEXT NOT NULL DEFAULT '[]',
        defaults TEXT,
        user_id TEXT,
        synced_at TEXT,
        deleted_at TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_assemblies_user_id ON assemblies(user_id);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_assemblies_updated_at ON assemblies(updated_at);
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_assemblies_deleted_at ON assemblies(deleted_at);
    `);

    // Add change_orders table (migrated from AsyncStorage)
    // Change orders track modifications to approved quotes
    database.execSync(`
      CREATE TABLE IF NOT EXISTS change_orders (
        id TEXT PRIMARY KEY,
        quote_id TEXT NOT NULL,
        quote_number TEXT,
        number INTEGER NOT NULL,
        items TEXT NOT NULL DEFAULT '[]',
        labor_before REAL DEFAULT 0,
        labor_after REAL DEFAULT 0,
        labor_delta REAL DEFAULT 0,
        net_change REAL DEFAULT 0,
        quote_total_before REAL DEFAULT 0,
        quote_total_after REAL DEFAULT 0,
        note TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_change_orders_quote_id ON change_orders(quote_id);
    `);

    console.log(`📦 Added assemblies and change_orders tables`);
  }

  if (fromVersion < 15) {
    // Add tombstones table for tracking deletions (hard delete + sync)
    // This replaces soft deletes (deleted_at) for quotes, invoices, clients, assemblies
    database.execSync(`
      CREATE TABLE IF NOT EXISTS tombstones (
        id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        deleted_at TEXT NOT NULL,
        PRIMARY KEY (id, entity_type)
      );
    `);

    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_tombstones_entity_type ON tombstones(entity_type);
    `);

    // Clean up old soft-deleted test data (no real users yet)
    // These records have deleted_at set but are still in the database
    database.execSync(`DELETE FROM quotes WHERE deleted_at IS NOT NULL;`);
    database.execSync(`DELETE FROM invoices WHERE deleted_at IS NOT NULL;`);
    database.execSync(`DELETE FROM clients WHERE deleted_at IS NOT NULL;`);
    database.execSync(`DELETE FROM assemblies WHERE deleted_at IS NOT NULL;`);

    console.log(`🪦 Added tombstones table and cleaned up soft-deleted test data`);
  }

  if (fromVersion < 16) {
    // Add tier_group_id column for tier groups
    // This is a simpler, more robust approach than linkedQuoteIds
    // All quotes in a tier group share the same UUID
    const columns = database.getAllSync<{ name: string }>(
      "PRAGMA table_info(quotes)"
    );
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has("tier_group_id")) {
      database.execSync(`ALTER TABLE quotes ADD COLUMN tier_group_id TEXT;`);
    }

    // Create index for fast tier group lookups
    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_quotes_tier_group_id ON quotes(tier_group_id);
    `);

    // Migrate existing tier groups from linkedQuoteIds to tierGroupId
    // Find all quotes that have linkedQuoteIds and assign them a shared tierGroupId
    const quotesWithLinks = database.getAllSync<{ id: string; linked_quote_ids: string; tier: string }>(
      "SELECT id, linked_quote_ids, tier FROM quotes WHERE linked_quote_ids IS NOT NULL AND linked_quote_ids != '[]'"
    );

    // Group quotes by their tier group (find connected components)
    const processed = new Set<string>();
    for (const quote of quotesWithLinks) {
      if (processed.has(quote.id)) continue;

      const linkedIds = JSON.parse(quote.linked_quote_ids || "[]") as string[];
      if (linkedIds.length === 0) continue;

      // Generate a new tierGroupId for this group
      const tierGroupId = `tg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Collect all quotes in this group (including this one and all linked)
      const groupIds = new Set<string>([quote.id, ...linkedIds]);

      // Also check the linked quotes' links to ensure we get everyone
      for (const linkedId of linkedIds) {
        const linked = database.getFirstSync<{ linked_quote_ids: string }>(
          "SELECT linked_quote_ids FROM quotes WHERE id = ?",
          [linkedId]
        );
        if (linked?.linked_quote_ids) {
          const moreIds = JSON.parse(linked.linked_quote_ids) as string[];
          moreIds.forEach((id) => groupIds.add(id));
        }
      }

      // Update all quotes in this group with the tierGroupId
      for (const groupQuoteId of groupIds) {
        database.runSync(
          "UPDATE quotes SET tier_group_id = ? WHERE id = ?",
          [tierGroupId, groupQuoteId]
        );
        processed.add(groupQuoteId);
      }
    }

    console.log(`🏷️ Added tier_group_id column and migrated ${processed.size} quotes to new tier group system`);
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
    laborEntries: row.labor_entries ? JSON.parse(row.labor_entries) as LaborEntry[] : undefined,
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
    tierGroupId: row.tier_group_id || undefined,
    linkedQuoteIds: row.linked_quote_ids ? JSON.parse(row.linked_quote_ids) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || undefined,
  };
}

/**
 * List quotes with pagination
 * Returns all quotes sorted by most recent (hard deletes mean no soft-deleted records exist)
 */
export function listQuotesDB(options?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Quote[] {
  try {
    const database = getDatabase();
    const { limit = 50, offset = 0, status } = options || {};

    let sql = "SELECT * FROM quotes WHERE 1=1";
    const params: any[] = [];

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
export function getQuoteCountDB(): number {
  try {
    const database = getDatabase();
    const result = database.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM quotes"
    );
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
 * Get all quotes in a tier group by tierGroupId
 * Returns quotes sorted by price (low to high) for consistent tier display
 */
export function getQuotesByTierGroupIdDB(tierGroupId: string): Quote[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM quotes WHERE tier_group_id = ? ORDER BY (labor + COALESCE(material_estimate, 0)) ASC",
      [tierGroupId]
    );
    return rows.map(rowToQuote);
  } catch (error) {
    console.error(`Failed to get quotes by tier group ${tierGroupId}:`, error);
    return [];
  }
}

/**
 * Save a quote (insert or update)
 */
export function saveQuoteDB(quote: Quote): void {
  try {
    const database = getDatabase();

    // Debug logging for tier groups
    if (quote.tier || quote.tierGroupId) {
      console.log(`[DB] saveQuoteDB ${quote.id}:`, {
        tier: quote.tier,
        tierGroupId: quote.tierGroupId,
      });
    }

    database.runSync(
      `INSERT OR REPLACE INTO quotes (
        id, quote_number, name, client_name, client_email, client_phone, client_address,
        items, labor, labor_entries, material_estimate, overhead, markup_percent, tax_percent,
        notes, change_history, approved_snapshot, follow_up_date, currency, status, pinned, tier, tier_group_id, linked_quote_ids,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        quote.laborEntries ? JSON.stringify(quote.laborEntries) : null,
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
        quote.tierGroupId || null,
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
    // Use transaction for atomicity: tombstone + hard delete
    database.withTransactionSync(() => {
      insertTombstoneSync(database, id, 'quote');
      database.runSync("DELETE FROM quotes WHERE id = ?", [id]);
    });
  } catch (error) {
    console.error(`Failed to delete quote ${id} from SQLite:`, error);
    throw error;
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
    laborEntries: row.labor_entries ? JSON.parse(row.labor_entries) as LaborEntry[] : undefined,
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
}): Invoice[] {
  try {
    const database = getDatabase();
    const { limit = 50, offset = 0, status } = options || {};

    let sql = "SELECT * FROM invoices WHERE 1=1";
    const params: any[] = [];

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
export function getInvoiceCountDB(): number {
  try {
    const database = getDatabase();
    const result = database.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM invoices"
    );
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
        client_email, client_phone, client_address, items, labor, labor_entries,
        material_estimate, overhead, markup_percent, tax_percent, notes,
        invoice_date, due_date, status, paid_date, paid_amount,
        percentage, is_partial_invoice, currency, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        invoice.laborEntries ? JSON.stringify(invoice.laborEntries) : null,
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
    // Use transaction for atomicity: tombstone + hard delete
    database.withTransactionSync(() => {
      insertTombstoneSync(database, id, 'invoice');
      database.runSync("DELETE FROM invoices WHERE id = ?", [id]);
    });
  } catch (error) {
    console.error(`Failed to delete invoice ${id} from SQLite:`, error);
    throw error;
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
}): Client[] {
  try {
    const database = getDatabase();
    const { limit = 50, offset = 0, search } = options || {};

    let sql = "SELECT * FROM clients WHERE 1=1";
    const params: any[] = [];

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
export function getClientCountDB(): number {
  try {
    const database = getDatabase();
    const result = database.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM clients"
    );
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
 * Hard delete a client with tombstone for sync
 */
export function deleteClientDB(id: string): void {
  try {
    const database = getDatabase();
    // Use transaction for atomicity: tombstone + hard delete
    database.withTransactionSync(() => {
      insertTombstoneSync(database, id, 'client');
      database.runSync("DELETE FROM clients WHERE id = ?", [id]);
    });
  } catch (error) {
    console.error(`Failed to delete client ${id} from SQLite:`, error);
    throw error;
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
      "SELECT * FROM pricebook_items WHERE id = ? AND deleted_at IS NULL",
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
    searchName: row.search_name || undefined,
    categoryId: row.category_id || "Other",
    canonicalCategory: row.canonical_category || "Other",
    unit: row.unit || "each",
    unitPrice: row.unit_price || 0,
    supplierId: row.supplier_id || undefined,
    coverageSqft: row.coverage_sqft || undefined,
    productUrl: row.product_url || undefined,
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
            id, name, search_name, category_id, canonical_category, unit, unit_price, supplier_id, coverage_sqft, product_url, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.id,
            product.name,
            product.searchName || null, // Normalized search name from Supabase
            product.categoryId,
            product.canonicalCategory || "Other",
            product.unit,
            product.unitPrice,
            product.supplierId || null,
            product.coverageSqft || null, // sq ft per carton/case for flooring
            product.productUrl || null, // URL to retailer product page
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
 * Uses search_name if available, falls back to name
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

      // Rebuild from products table - use search_name if available, fall back to name
      database.runSync(`
        INSERT INTO products_fts (product_id, search_name)
        SELECT id, COALESCE(search_name, name) FROM products
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
      database.runSync("DELETE FROM team_members");
      database.runSync("DELETE FROM sync_metadata");
      database.runSync("DELETE FROM migration_status");
    });
  } catch (error) {
    console.error("Failed to clear all data from SQLite:", error);
    throw error;
  }
}

// ============================================
// TEAM MEMBERS (Premium Feature - synced from Supabase)
// ============================================

/**
 * Convert database row to TeamMember object
 */
function rowToTeamMember(row: any): TeamMember {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    name: row.name || "",
    phone: row.phone || undefined,
    email: row.email || undefined,
    role: row.role || undefined,
    defaultRate: row.default_rate || 0,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List all team members (active only by default)
 */
export function listTeamMembersDB(options?: {
  activeOnly?: boolean;
  limit?: number;
}): TeamMember[] {
  try {
    const database = getDatabase();
    const { activeOnly = true, limit } = options || {};

    let sql = "SELECT * FROM team_members WHERE 1=1";
    const params: any[] = [];

    if (activeOnly) {
      sql += " AND is_active = 1";
    }

    sql += " ORDER BY name ASC";

    if (limit !== undefined) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    const rows = database.getAllSync(sql, params);
    return rows.map(rowToTeamMember);
  } catch (error) {
    console.error("Failed to list team members from SQLite:", error);
    return [];
  }
}

/**
 * Get a single team member by ID
 */
export function getTeamMemberByIdDB(id: string): TeamMember | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync(
      "SELECT * FROM team_members WHERE id = ?",
      [id]
    );
    return row ? rowToTeamMember(row) : null;
  } catch (error) {
    console.error(`Failed to get team member ${id} from SQLite:`, error);
    return null;
  }
}

/**
 * Save a team member (insert or update)
 */
export function saveTeamMemberDB(member: TeamMember): void {
  try {
    const database = getDatabase();

    database.runSync(
      `INSERT OR REPLACE INTO team_members (
        id, user_id, name, phone, email, role, default_rate,
        is_active, created_at, updated_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member.id,
        member.userId || null,
        member.name,
        member.phone || null,
        member.email || null,
        member.role || null,
        member.defaultRate || 0,
        member.isActive === false ? 0 : 1,
        member.createdAt,
        member.updatedAt,
        new Date().toISOString(),
      ]
    );
  } catch (error) {
    console.error(`Failed to save team member ${member.id} to SQLite:`, error);
    throw error;
  }
}

/**
 * Save multiple team members in a transaction (for sync)
 */
export function saveTeamMembersBatchDB(members: TeamMember[]): void {
  if (members.length === 0) return;

  try {
    const database = getDatabase();

    database.withTransactionSync(() => {
      for (const member of members) {
        saveTeamMemberDB(member);
      }
    });
  } catch (error) {
    console.error(`Failed to batch save ${members.length} team members:`, error);
    throw error;
  }
}

/**
 * Delete a team member (soft delete by setting inactive)
 */
export function deleteTeamMemberDB(id: string): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();
    database.runSync(
      "UPDATE team_members SET is_active = 0, updated_at = ? WHERE id = ?",
      [now, id]
    );
  } catch (error) {
    console.error(`Failed to delete team member ${id} from SQLite:`, error);
    throw error;
  }
}

/**
 * Search team members by name
 */
export function searchTeamMembersDB(query: string, limit = 10): TeamMember[] {
  if (!query.trim()) return listTeamMembersDB({ limit });

  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      `SELECT * FROM team_members
       WHERE is_active = 1 AND LOWER(name) LIKE ?
       ORDER BY name ASC
       LIMIT ?`,
      [`%${query.toLowerCase()}%`, limit]
    );
    return rows.map(rowToTeamMember);
  } catch (error) {
    console.error("Failed to search team members:", error);
    return [];
  }
}

/**
 * Clear all team members (for full resync)
 */
export function clearTeamMembersDB(): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM team_members");
  } catch (error) {
    console.error("Failed to clear team members:", error);
    throw error;
  }
}

// ============================================
// ASSEMBLIES (migrated from AsyncStorage)
// ============================================

/**
 * Assembly type for SQLite storage
 */
export type AssemblyDB = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  items: string; // JSON string of AssemblyItem[]
  defaults?: string; // JSON string of AssemblyVarBag
  userId?: string;
  syncedAt?: string;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Convert database row to Assembly-like object
 * Note: Returns raw JSON strings - caller should parse items/defaults
 */
function rowToAssembly(row: any): AssemblyDB {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || undefined,
    category: row.category || undefined,
    items: row.items || "[]",
    defaults: row.defaults || undefined,
    userId: row.user_id || undefined,
    syncedAt: row.synced_at || undefined,
    deletedAt: row.deleted_at || undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

/**
 * List all assemblies
 */
export function listAssembliesDB(options?: {
  limit?: number;
  userId?: string;
}): AssemblyDB[] {
  try {
    const database = getDatabase();
    const { limit = 1000, userId } = options || {};

    let sql = "SELECT * FROM assemblies";
    const params: any[] = [];
    const conditions: string[] = [];

    if (userId) {
      conditions.push("user_id = ?");
      params.push(userId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY updated_at DESC, created_at DESC LIMIT ?";
    params.push(limit);

    const rows = database.getAllSync(sql, params);
    return rows.map(rowToAssembly);
  } catch (error) {
    console.error("Failed to list assemblies:", error);
    return [];
  }
}

/**
 * Get assembly count
 */
export function getAssemblyCountDB(): number {
  try {
    const database = getDatabase();
    const result = database.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM assemblies"
    );
    return result?.count || 0;
  } catch (error) {
    console.error("Failed to get assembly count:", error);
    return 0;
  }
}

/**
 * Get assembly by ID
 */
export function getAssemblyByIdDB(id: string): AssemblyDB | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync(
      "SELECT * FROM assemblies WHERE id = ?",
      [id]
    );
    return row ? rowToAssembly(row) : null;
  } catch (error) {
    console.error(`Failed to get assembly ${id}:`, error);
    return null;
  }
}

/**
 * Save an assembly (insert or update)
 */
export function saveAssemblyDB(assembly: AssemblyDB): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();

    database.runSync(
      `INSERT OR REPLACE INTO assemblies (
        id, name, description, category, items, defaults,
        user_id, synced_at, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assembly.id,
        assembly.name,
        assembly.description || null,
        assembly.category || null,
        assembly.items,
        assembly.defaults || null,
        assembly.userId || null,
        assembly.syncedAt || null,
        assembly.deletedAt || null,
        assembly.createdAt || now,
        assembly.updatedAt || now,
      ]
    );
  } catch (error) {
    console.error(`Failed to save assembly ${assembly.id}:`, error);
    throw error;
  }
}

/**
 * Save multiple assemblies in a transaction
 */
export function saveAssembliesBatchDB(assemblies: AssemblyDB[]): void {
  if (assemblies.length === 0) return;

  try {
    const database = getDatabase();

    database.withTransactionSync(() => {
      for (const assembly of assemblies) {
        saveAssemblyDB(assembly);
      }
    });
  } catch (error) {
    console.error(`Failed to batch save ${assemblies.length} assemblies:`, error);
    throw error;
  }
}

/**
 * Hard delete an assembly with tombstone for sync
 */
export function deleteAssemblyDB(id: string): void {
  try {
    const database = getDatabase();
    // Use transaction for atomicity: tombstone + hard delete
    database.withTransactionSync(() => {
      insertTombstoneSync(database, id, 'assembly');
      database.runSync("DELETE FROM assemblies WHERE id = ?", [id]);
    });
  } catch (error) {
    console.error(`Failed to delete assembly ${id}:`, error);
    throw error;
  }
}

/**
 * Get assemblies modified since a given timestamp (for sync)
 */
export function getAssembliesModifiedSinceDB(since: string): AssemblyDB[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      `SELECT * FROM assemblies
       WHERE updated_at > ? OR synced_at IS NULL
       ORDER BY updated_at DESC`,
      [since]
    );
    return rows.map(rowToAssembly);
  } catch (error) {
    console.error("Failed to get modified assemblies:", error);
    return [];
  }
}

/**
 * Clear all assemblies (for full resync)
 */
export function clearAssembliesDB(): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM assemblies");
  } catch (error) {
    console.error("Failed to clear assemblies:", error);
    throw error;
  }
}

// ============================================
// CHANGE ORDERS (migrated from AsyncStorage)
// ============================================

/**
 * ChangeOrder type for SQLite storage
 */
export type ChangeOrderDB = {
  id: string;
  quoteId: string;
  quoteNumber?: string;
  number: number;
  items: string; // JSON string
  laborBefore: number;
  laborAfter: number;
  laborDelta: number;
  netChange: number;
  quoteTotalBefore: number;
  quoteTotalAfter: number;
  note?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Convert database row to ChangeOrder-like object
 */
function rowToChangeOrder(row: any): ChangeOrderDB {
  return {
    id: row.id,
    quoteId: row.quote_id,
    quoteNumber: row.quote_number || undefined,
    number: row.number || 1,
    items: row.items || "[]",
    laborBefore: row.labor_before || 0,
    laborAfter: row.labor_after || 0,
    laborDelta: row.labor_delta || 0,
    netChange: row.net_change || 0,
    quoteTotalBefore: row.quote_total_before || 0,
    quoteTotalAfter: row.quote_total_after || 0,
    note: row.note || undefined,
    status: row.status || "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List all change orders for a quote
 */
export function listChangeOrdersDB(quoteId: string): ChangeOrderDB[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM change_orders WHERE quote_id = ? ORDER BY number ASC",
      [quoteId]
    );
    return rows.map(rowToChangeOrder);
  } catch (error) {
    console.error(`Failed to list change orders for quote ${quoteId}:`, error);
    return [];
  }
}

/**
 * Get all change orders (for all quotes)
 */
export function listAllChangeOrdersDB(): ChangeOrderDB[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync(
      "SELECT * FROM change_orders ORDER BY created_at DESC"
    );
    return rows.map(rowToChangeOrder);
  } catch (error) {
    console.error("Failed to list all change orders:", error);
    return [];
  }
}

/**
 * Get change order by ID
 */
export function getChangeOrderByIdDB(id: string): ChangeOrderDB | null {
  try {
    const database = getDatabase();
    const row = database.getFirstSync(
      "SELECT * FROM change_orders WHERE id = ?",
      [id]
    );
    return row ? rowToChangeOrder(row) : null;
  } catch (error) {
    console.error(`Failed to get change order ${id}:`, error);
    return null;
  }
}

/**
 * Save a change order (insert or update)
 */
export function saveChangeOrderDB(changeOrder: ChangeOrderDB): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();

    database.runSync(
      `INSERT OR REPLACE INTO change_orders (
        id, quote_id, quote_number, number, items,
        labor_before, labor_after, labor_delta,
        net_change, quote_total_before, quote_total_after,
        note, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        changeOrder.id,
        changeOrder.quoteId,
        changeOrder.quoteNumber || null,
        changeOrder.number,
        changeOrder.items,
        changeOrder.laborBefore,
        changeOrder.laborAfter,
        changeOrder.laborDelta,
        changeOrder.netChange,
        changeOrder.quoteTotalBefore,
        changeOrder.quoteTotalAfter,
        changeOrder.note || null,
        changeOrder.status,
        changeOrder.createdAt || now,
        changeOrder.updatedAt || now,
      ]
    );
  } catch (error) {
    console.error(`Failed to save change order ${changeOrder.id}:`, error);
    throw error;
  }
}

/**
 * Delete a change order
 */
export function deleteChangeOrderDB(id: string): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM change_orders WHERE id = ?", [id]);
  } catch (error) {
    console.error(`Failed to delete change order ${id}:`, error);
    throw error;
  }
}

/**
 * Delete all change orders for a quote
 */
export function deleteChangeOrdersForQuoteDB(quoteId: string): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM change_orders WHERE quote_id = ?", [quoteId]);
  } catch (error) {
    console.error(`Failed to delete change orders for quote ${quoteId}:`, error);
    throw error;
  }
}

/**
 * Get next change order number for a quote
 */
export function getNextChangeOrderNumberDB(quoteId: string): number {
  try {
    const database = getDatabase();
    const result = database.getFirstSync<{ max_num: number | null }>(
      "SELECT MAX(number) as max_num FROM change_orders WHERE quote_id = ?",
      [quoteId]
    );
    return (result?.max_num || 0) + 1;
  } catch (error) {
    console.error(`Failed to get next CO number for quote ${quoteId}:`, error);
    return 1;
  }
}

// ============================================
// TOMBSTONES (for hard delete + cloud sync)
// ============================================

export type TombstoneEntityType = 'quote' | 'invoice' | 'client' | 'assembly';

/**
 * Insert a tombstone record for a deleted entity
 * This is used to track deletions that need to be synced to cloud
 */
export function insertTombstoneDB(id: string, entityType: TombstoneEntityType): void {
  try {
    const database = getDatabase();
    const now = new Date().toISOString();
    database.runSync(
      "INSERT OR REPLACE INTO tombstones (id, entity_type, deleted_at) VALUES (?, ?, ?)",
      [id, entityType, now]
    );
  } catch (error) {
    console.error(`Failed to insert tombstone for ${entityType} ${id}:`, error);
    throw error;
  }
}

/**
 * Sync version that can be called within a transaction
 */
function insertTombstoneSync(database: SQLite.SQLiteDatabase, id: string, entityType: TombstoneEntityType): void {
  const now = new Date().toISOString();
  database.runSync(
    "INSERT OR REPLACE INTO tombstones (id, entity_type, deleted_at) VALUES (?, ?, ?)",
    [id, entityType, now]
  );
}

/**
 * Get all tombstones for a given entity type
 * Returns array of IDs that were deleted locally and need to be synced
 */
export function getTombstonesDB(entityType: TombstoneEntityType): string[] {
  try {
    const database = getDatabase();
    const rows = database.getAllSync<{ id: string }>(
      "SELECT id FROM tombstones WHERE entity_type = ?",
      [entityType]
    );
    return rows.map((r) => r.id);
  } catch (error) {
    console.error(`Failed to get tombstones for ${entityType}:`, error);
    return [];
  }
}

/**
 * Delete a single tombstone after successful cloud sync
 */
export function deleteTombstoneDB(id: string, entityType: TombstoneEntityType): void {
  try {
    const database = getDatabase();
    database.runSync(
      "DELETE FROM tombstones WHERE id = ? AND entity_type = ?",
      [id, entityType]
    );
  } catch (error) {
    console.error(`Failed to delete tombstone for ${entityType} ${id}:`, error);
    throw error;
  }
}

/**
 * Delete multiple tombstones after successful cloud sync (batch)
 */
export function deleteTombstonesBatchDB(ids: string[], entityType: TombstoneEntityType): void {
  if (ids.length === 0) return;

  try {
    const database = getDatabase();
    database.withTransactionSync(() => {
      for (const id of ids) {
        database.runSync(
          "DELETE FROM tombstones WHERE id = ? AND entity_type = ?",
          [id, entityType]
        );
      }
    });
  } catch (error) {
    console.error(`Failed to batch delete tombstones for ${entityType}:`, error);
    throw error;
  }
}

// ============================================
// HARD DELETE FUNCTIONS (for server-side deletions)
// These delete without creating tombstones - used when server tells us to delete
// ============================================

/**
 * Hard delete a quote without creating a tombstone
 * Used when server indicates the quote was deleted (e.g., deleted from portal)
 */
export function hardDeleteQuoteDB(id: string): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM quotes WHERE id = ?", [id]);
  } catch (error) {
    console.error(`Failed to hard delete quote ${id}:`, error);
    throw error;
  }
}

/**
 * Hard delete an invoice without creating a tombstone
 * Used when server indicates the invoice was deleted
 */
export function hardDeleteInvoiceDB(id: string): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM invoices WHERE id = ?", [id]);
  } catch (error) {
    console.error(`Failed to hard delete invoice ${id}:`, error);
    throw error;
  }
}

/**
 * Hard delete a client without creating a tombstone
 * Used when server indicates the client was deleted
 */
export function hardDeleteClientDB(id: string): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM clients WHERE id = ?", [id]);
  } catch (error) {
    console.error(`Failed to hard delete client ${id}:`, error);
    throw error;
  }
}

/**
 * Hard delete an assembly without creating a tombstone
 * Used when server indicates the assembly was deleted
 */
export function hardDeleteAssemblyDB(id: string): void {
  try {
    const database = getDatabase();
    database.runSync("DELETE FROM assemblies WHERE id = ?", [id]);
  } catch (error) {
    console.error(`Failed to hard delete assembly ${id}:`, error);
    throw error;
  }
}
