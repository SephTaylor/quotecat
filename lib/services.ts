// lib/services.ts
// Service interfaces for dependency injection (if needed in future)
// Currently not actively used - kept for potential future DI implementation

import type { Quote, QuoteItem, Product, CurrencyCode, ID } from "./types";

// Re-export canonical types
export type { Quote, QuoteItem, Product, CurrencyCode, ID } from "./types";

// ---------- Settings ----------
export interface SettingsStore {
  getCurrency(): Promise<CurrencyCode>;
  setCurrency(c: CurrencyCode): Promise<void>;
}

// ---------- Catalog ----------
export interface CatalogRepo {
  listCategories(): Promise<string[]>;
  listProductsByCategory(category: string): Promise<Product[]>;
  getProductById(id: ID): Promise<Product | null>;
  search(term: string): Promise<Product[]>;
}

// ---------- Quotes ----------
export interface QuotesRepo {
  list(): Promise<Quote[]>;
  get(id: ID): Promise<Quote | null>;
  create(name?: string, clientName?: string): Promise<Quote>;
  update(id: ID, patch: Partial<Quote>): Promise<Quote | null>;
  save(quote: Quote): Promise<Quote>;
  remove(id: ID): Promise<void>;
}

// ---------- Price Feeds ----------
export interface PriceFeed {
  batchLookup(
    skus: string[],
    region?: string,
  ): Promise<
    Array<{
      sku: string;
      price: number;
      currency: CurrencyCode;
      vendor: string;
      timestamp: string;
    }>
  >;
}

// ---------- Assemblies ----------
export type AssemblyInput = Record<string, number | string | boolean>;
export type BOMLine = { productCategoryOrId: string; qty: number };

export interface AssemblyCalculator {
  id: string;
  name: string;
  inputsSchema: Record<string, unknown>;
  compute(inputs: AssemblyInput): Promise<BOMLine[]>;
}

// ---------- Optimizer ----------
export interface Optimizer {
  optimize(params: {
    region?: string;
    currency: CurrencyCode;
    lines: Array<{ productId?: ID; category?: string; qty: number }>;
  }): Promise<{
    total: number;
    currency: CurrencyCode;
    vendors: Array<{
      name: string;
      items: Array<{
        skuOrId: string;
        unitPrice: number;
        qty: number;
        lineTotal: number;
      }>;
      deliveryFee?: number;
      subtotal: number;
    }>;
  }>;
}

// ---------- PDF ----------
export interface PDFService {
  shareQuote(quote: Quote): Promise<void>;
}

// ---------- Aggregate Services (DI Container) ----------
export type Services = {
  settings: SettingsStore;
  catalog: CatalogRepo;
  quotes: QuotesRepo;
  priceFeed: PriceFeed;
  assemblies: AssemblyCalculator[];
  optimizer: Optimizer;
  pdf: PDFService;
};
