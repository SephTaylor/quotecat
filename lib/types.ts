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
  clientEmail?: string; // Client email for sending quotes/invoices
  clientPhone?: string; // Client phone number
  clientAddress?: string; // Client address (can be multiline)
  items: QuoteItem[];
  labor: number;
  materialEstimate?: number; // Quick estimate for materials without line items
  overhead?: number; // Flat overhead/additional costs
  markupPercent?: number; // Markup percentage applied to subtotal
  taxPercent?: number; // Tax percentage (e.g., 8.25 for 8.25%)
  currency: CurrencyCode;
  status: QuoteStatus;
  pinned?: boolean; // For favoriting/starring quotes
  tier?: string; // Optional tier/variant name (e.g., "Good", "Better", "Best", "Base + Generator")
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt?: string; // ISO 8601 - soft delete timestamp
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

/**
 * Invoice status for payment tracking
 */
export type InvoiceStatus =
  | "unpaid" // Invoice sent, awaiting payment
  | "partial" // Partially paid
  | "paid" // Fully paid
  | "overdue"; // Past due date

/**
 * Status metadata for invoice UI display
 */
export const InvoiceStatusMeta: Record<
  InvoiceStatus,
  { label: string; color: string; description: string }
> = {
  unpaid: {
    label: "Unpaid",
    color: "#FF9500",
    description: "Invoice sent, awaiting payment",
  },
  partial: {
    label: "Partial",
    color: "#5856D6",
    description: "Partially paid",
  },
  paid: {
    label: "Paid",
    color: "#34C759",
    description: "Fully paid",
  },
  overdue: {
    label: "Overdue",
    color: "#FF3B30",
    description: "Past due date",
  },
};

/**
 * Invoice stored in AsyncStorage
 * Created from a quote, tracks payment status
 */
export type Invoice = {
  id: ID;
  quoteId: ID; // Reference to original quote
  invoiceNumber: string; // Auto-generated: INV-001, INV-002, etc.

  // Quote data (copied at time of invoice creation)
  name: string;
  clientName?: string;
  clientEmail?: string; // Client email for sending invoices
  clientPhone?: string; // Client phone number
  clientAddress?: string; // Client address (can be multiline)
  items: QuoteItem[];
  labor: number;
  materialEstimate?: number;
  overhead?: number;
  markupPercent?: number;
  taxPercent?: number; // Tax percentage (e.g., 8.25 for 8.25%)
  notes?: string;

  // Invoice-specific fields
  invoiceDate: string; // ISO 8601 date
  dueDate: string; // ISO 8601 date
  status: InvoiceStatus;
  paidDate?: string; // ISO 8601 date when fully paid
  paidAmount?: number; // For partial payments

  // Percentage/partial invoice support
  percentage?: number; // e.g., 50 for 50% deposit invoice
  isPartialInvoice?: boolean; // True if this is a deposit/partial invoice

  // Metadata
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt?: string; // ISO 8601 - soft delete timestamp
  currency: CurrencyCode;

  // Forward-compatible: allow extra fields
  [key: string]: any;
};

/**
 * Partial invoice for updates
 */
export type InvoiceUpdate = Partial<Invoice> & { id: ID };
