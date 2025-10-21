// lib/types.ts
// Canonical type definitions for QuoteCat
// This is the single source of truth for all core domain types

/**
 * Supported currency codes across the app
 * Add more currencies as needed
 */
export type CurrencyCode = "USD" | "CRC" | "CAD" | "EUR";

/**
 * ID type for all entities
 */
export type ID = string;

/**
 * Quote status for workflow tracking
 */
export type QuoteStatus =
  | "draft" // Building the quote
  | "sent" // Sent to client, awaiting response
  | "approved" // Client accepted, work authorized
  | "completed" // Work finished, ready to invoice
  | "archived"; // Closed/inactive

/**
 * Status metadata for UI display
 */
export const QuoteStatusMeta: Record<
  QuoteStatus,
  { label: string; color: string; description: string }
> = {
  draft: {
    label: "Draft",
    color: "#8E8E93",
    description: "Building the quote",
  },
  sent: {
    label: "Sent",
    color: "#FF9500",
    description: "Sent to client, awaiting response",
  },
  approved: {
    label: "Approved",
    color: "#34C759",
    description: "Client accepted, work authorized",
  },
  completed: {
    label: "Completed",
    color: "#5856D6",
    description: "Work finished, ready to invoice",
  },
  archived: {
    label: "Archived",
    color: "#C7C7CC",
    description: "Closed/inactive",
  },
};

/**
 * Product from catalog
 */
export type Product = {
  id: ID;
  name: string;
  sku?: string;
  categoryId: string;
  unit: "ea" | "ft" | "m" | "sheet" | "box" | string;
  unitPrice: number;
  currency?: CurrencyCode;
};

/**
 * Item within a quote
 * productId is optional to allow manual line items
 */
export type QuoteItem = {
  id?: ID; // Optional ID for the line item itself
  productId?: ID; // Reference to catalog product
  name: string;
  unitPrice: number;
  qty: number;
  currency?: CurrencyCode;
  // Forward-compatible: allow extra fields
  [key: string]: any;
};

/**
 * Quote stored in AsyncStorage
 * All fields required except where marked optional
 */
export type Quote = {
  id: ID;
  name: string;
  clientName?: string;
  items: QuoteItem[];
  labor: number;
  materialEstimate?: number; // Quick estimate for materials without line items
  overhead?: number; // Flat overhead/additional costs
  markupPercent?: number; // Markup percentage applied to subtotal
  currency: CurrencyCode;
  status: QuoteStatus;
  pinned?: boolean; // For favoriting/starring quotes
  tier?: string; // Optional tier/variant name (e.g., "Good", "Better", "Best", "Base + Generator")
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  // Computed fields (not persisted, recalculated on load)
  materialSubtotal?: number;
  total?: number;
  // Forward-compatible: allow extra fields
  [key: string]: any;
};

/**
 * Partial quote for updates
 */
export type QuoteUpdate = Partial<Quote> & { id: ID };

/**
 * Assembly line item (computed from assembly calculator)
 */
export type AssemblyLine = {
  id: ID;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
};

/**
 * Assembly definition
 */
export type Assembly = {
  id: ID;
  name: string;
  description?: string;
  items: Array<{
    productId: ID;
    qty?: number; // Fixed quantity
    qtyFn?: (vars: Record<string, number>) => number; // Computed quantity
  }>;
  defaults?: Record<string, number>; // Default variable values
};
