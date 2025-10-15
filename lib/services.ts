// lib/services.ts

// ---------- Core types ----------
export type CurrencyCode = 'USD' | 'CRC';
export type ID = string;

export type Product = {
  id: ID;
  name: string;
  sku?: string;
  category: string;
  unit: 'ea' | 'ft' | 'm' | 'sheet' | 'box' | string;
  price?: number;
  currency?: CurrencyCode;
};

export type QuoteItem = {
  productId: ID;
  name: string;
  unitPrice: number;
  qty: number;
  currency: CurrencyCode;
};

export type Quote = {
  id: ID;
  name: string;
  items: QuoteItem[];
  labor: number;
  currency: CurrencyCode;
  materialSubtotal?: number;
  total?: number;
};

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

// ---------- Quotes (NEW) ----------
export interface QuotesRepo {
  list(): Promise<Quote[]>;
  get(id: ID): Promise<Quote | null>;
  create(input: Omit<Quote, 'id' | 'materialSubtotal' | 'total'> & { id?: ID }): Promise<Quote>;
  update(q: Quote): Promise<void>;
  remove(id: ID): Promise<void>;
}

// ---------- Price Feeds ----------
export interface PriceFeed {
  batchLookup(
    skus: string[],
    region?: string
  ): Promise<Array<{ sku: string; price: number; currency: CurrencyCode; vendor: string; timestamp: string }>>;
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
      items: Array<{ skuOrId: string; unitPrice: number; qty: number; lineTotal: number }>;
      deliveryFee?: number;
      subtotal: number;
    }>;
  }>;
}

// ---------- PDF ----------
export interface PDFService {
  shareQuote(quote: Quote): Promise<void>;
}

// ---------- Aggregate Services (DI) ----------
export type Services = {
  settings: SettingsStore;
  catalog: CatalogRepo;
  quotes: QuotesRepo;        // <— NEW
  priceFeed: PriceFeed;
  assemblies: AssemblyCalculator[];
  optimizer: Optimizer;
  pdf: PDFService;
};
