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
  | "declined" // Client declined the quote
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
  declined: {
    label: "Declined",
    color: "#FF3B30",
    description: "Client declined the quote",
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
  quoteNumber?: string; // Sequential number like "Q-001" - assigned on creation
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
  notes?: string; // Internal notes or special instructions
  changeHistory?: string; // Auto-generated log of changes to approved quotes
  approvedSnapshot?: string; // JSON snapshot of items when quote was approved (for change tracking)
  followUpDate?: string; // ISO 8601 date for follow-up reminder
  currency: CurrencyCode;
  status: QuoteStatus;
  pinned?: boolean; // For favoriting/starring quotes
  tier?: string; // Optional tier/variant name (e.g., "Good", "Better", "Best", "Base + Generator")
  linkedQuoteIds?: string[]; // IDs of quotes linked as options/tiers (Good/Better/Best)
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
  quoteId?: ID; // Reference to original quote (optional if from contract)
  contractId?: ID; // Reference to contract (Premium feature)
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

/**
 * Individual payment record for an invoice
 * Supports multiple payments per invoice with full history
 */
export type InvoicePayment = {
  id: ID;
  invoiceId: ID;
  userId?: string; // For cloud sync
  amount: number;
  paymentMethod?: string; // cash, check, card, bank_transfer, zelle, venmo, cashapp, other
  paymentDate: string; // ISO 8601 date
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Change Order status for tracking approval
 */
export type ChangeOrderStatus = "pending" | "approved" | "cancelled";

/**
 * Status metadata for Change Order UI display
 */
export const ChangeOrderStatusMeta: Record<
  ChangeOrderStatus,
  { label: string; color: string; description: string }
> = {
  pending: {
    label: "Pending",
    color: "#FF9500",
    description: "Awaiting client approval",
  },
  approved: {
    label: "Approved",
    color: "#34C759",
    description: "Client approved this change",
  },
  cancelled: {
    label: "Cancelled",
    color: "#8E8E93",
    description: "Change was cancelled",
  },
};

/**
 * Individual item change within a Change Order
 */
export type ChangeOrderItem = {
  productId?: ID;
  name: string;
  unit: string;
  unitPrice: number;
  qtyBefore: number; // 0 if newly added
  qtyAfter: number; // 0 if removed
  qtyDelta: number; // positive = added, negative = removed
  lineDelta: number; // dollar impact of this line
};

/**
 * Change Order - tracks modifications to a quote
 */
export type ChangeOrder = {
  id: ID;
  quoteId: ID;
  quoteNumber?: string; // Quote's number for display (e.g., "Q-001")
  number: number; // CO #1, #2, #3 within this quote

  // The diff
  items: ChangeOrderItem[];
  laborBefore: number;
  laborAfter: number;
  laborDelta: number;

  // Totals
  netChange: number; // total dollar impact
  quoteTotalBefore: number; // snapshot
  quoteTotalAfter: number; // snapshot

  // Metadata
  note?: string; // "Client requested deck railing"
  status: ChangeOrderStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

/**
 * Partial change order for updates
 */
export type ChangeOrderUpdate = Partial<ChangeOrder> & { id: ID };

/**
 * Contract status for workflow tracking
 */
export type ContractStatus =
  | "draft" // Building the contract
  | "sent" // Sent to client for signature
  | "viewed" // Client has viewed it
  | "signed" // Both parties signed, work authorized
  | "completed" // Work finished, ready to invoice
  | "declined" // Client declined
  | "expired"; // Contract expired without signature

/**
 * Status metadata for Contract UI display
 */
export const ContractStatusMeta: Record<
  ContractStatus,
  { label: string; color: string; description: string }
> = {
  draft: {
    label: "Draft",
    color: "#8E8E93",
    description: "Building the contract",
  },
  sent: {
    label: "Sent",
    color: "#FF9500",
    description: "Awaiting client signature",
  },
  viewed: {
    label: "Viewed",
    color: "#5856D6",
    description: "Client has viewed the contract",
  },
  signed: {
    label: "Signed",
    color: "#34C759",
    description: "Contract signed, work authorized",
  },
  completed: {
    label: "Completed",
    color: "#5856D6",
    description: "Work finished, ready to invoice",
  },
  declined: {
    label: "Declined",
    color: "#FF3B30",
    description: "Client declined to sign",
  },
  expired: {
    label: "Expired",
    color: "#8E8E93",
    description: "Contract expired",
  },
};

/**
 * Signature record for audit trail
 */
export type Signature = {
  id: ID;
  contractId: ID;

  // Who signed
  signerType: "contractor" | "client";
  signerName: string;
  signerEmail?: string;

  // Signature data
  signatureImage: string; // Base64 PNG

  // Audit trail
  ipAddress?: string;
  userAgent?: string;
  signedAt: string; // ISO 8601
};

/**
 * Contract - legally binding agreement generated from quote
 */
export type Contract = {
  id: ID;
  userId: ID;
  quoteId?: ID; // Optional reference to source quote

  // Contract identification
  contractNumber: string; // "CTR-001"

  // Client info
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;

  // Contract content
  projectName: string;
  scopeOfWork?: string;
  materials: QuoteItem[];
  labor: number;
  materialEstimate?: number;
  markupPercent?: number;
  taxPercent?: number;
  total: number;

  // Terms
  paymentTerms?: string; // "50% deposit, 50% on completion"
  termsAndConditions?: string;
  startDate?: string; // ISO 8601
  completionDate?: string; // ISO 8601

  // Status tracking
  status: ContractStatus;
  sentAt?: string; // ISO 8601
  viewedAt?: string; // ISO 8601
  signedAt?: string; // ISO 8601
  expiresAt?: string; // ISO 8601

  // Signatures (loaded separately or embedded)
  signatures?: Signature[];

  // Metadata
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  currency: CurrencyCode;
};

/**
 * Partial contract for updates
 */
export type ContractUpdate = Partial<Contract> & { id: ID };

/**
 * Saved client for Pro users
 */
export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Price book item for Premium users
 * Custom products with user-defined pricing
 * Syncs with webapp's pricebook_items table
 */
export type PricebookItem = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  unitType?: string; // "each", "linear ft", "sq ft", etc.
  sku?: string;
  isActive?: boolean;
  source?: string; // "custom" for user-created
  createdAt: string;
  updatedAt: string;
};

/**
 * Custom line item for Quick Custom Items feature
 * Stores user-typed items locally for autocomplete and reuse
 * Free tier feature - helps contractors add items without catalog
 */
export type CustomLineItem = {
  id: string;
  name: string;
  defaultPrice: number; // Last-used price for autocomplete
  timesUsed: number; // For sorting by frequency
  firstAdded: string; // ISO 8601 - when first created
  lastUsed: string; // ISO 8601 - when last added to a quote
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // Soft delete
};

// =============================================================================
// SHARED ASSEMBLY LIBRARY TYPES
// =============================================================================

/**
 * Trade categories for shared assemblies
 */
export const ASSEMBLY_TRADES = [
  { id: "electrical", label: "Electrical" },
  { id: "plumbing", label: "Plumbing" },
  { id: "hvac", label: "HVAC" },
  { id: "drywall", label: "Drywall" },
  { id: "framing", label: "Framing" },
  { id: "roofing", label: "Roofing" },
  { id: "flooring", label: "Flooring" },
  { id: "painting", label: "Painting" },
  { id: "general", label: "General" },
] as const;

export type AssemblyTrade = (typeof ASSEMBLY_TRADES)[number]["id"];

/**
 * Item in a shared assembly (stored without prices for privacy)
 */
export type SharedAssemblyItem = {
  name: string;
  sku?: string;
  qty: number;
  unit?: string; // "ea", "ft", "sheet", etc.
};

/**
 * Shared assembly from the community library
 * Prices are NOT included - users map to their own pricebook when copying
 */
export type SharedAssembly = {
  id: string;
  creatorId?: string;
  creatorDisplayName?: string; // null = anonymous
  name: string;
  description?: string;
  trade: AssemblyTrade;
  category?: string;
  tags: string[];
  items: SharedAssemblyItem[];
  copyCount: number;
  upvoteCount: number;
  commentCount: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * User's like on a shared assembly (downvotes removed)
 */
export type AssemblyVote = {
  id: string;
  sharedAssemblyId: string;
  userId: string;
  voteType: "up";
  createdAt: string;
};

/**
 * Comment on a shared assembly
 */
export type AssemblyComment = {
  id: string;
  sharedAssemblyId: string;
  userId: string;
  userDisplayName?: string;
  content: string;
  createdAt: string;
};

/**
 * Result of matching a shared assembly item to user's pricebook
 */
export type ItemMatchResult = {
  sharedItem: SharedAssemblyItem;
  matchType: "exact" | "fuzzy" | "none";
  confidence: number; // 0-100
  matchedPricebookItem?: PricebookItem;
  suggestedMatches?: PricebookItem[]; // Top alternatives for fuzzy/none
};

/**
 * Sort options for browsing shared assemblies
 */
export type SharedAssemblySortOption = "popular" | "newest" | "top_rated";
