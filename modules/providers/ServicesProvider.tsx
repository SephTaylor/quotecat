// app/_providers/ServicesProvider.tsx
import React, { createContext, PropsWithChildren, useContext } from 'react';
import type {
    CatalogRepo,
    Optimizer,
    PDFService,
    PriceFeed,
    Quote,
    QuotesRepo,
    Services,
    SettingsStore
} from '../../lib/services';

const NotImplemented = (name: string) => () => {
  throw new Error(`${name} not implemented`);
};

// --- Mocks so the app always compiles ---
const mockSettings: SettingsStore = {
  async getCurrency() { return 'USD'; },
  async setCurrency() {},
};

const mockCatalog: CatalogRepo = {
  async listCategories() { return ['Framing', 'Drywall']; },
  async listProductsByCategory() { return []; },
  async getProductById() { return null; },
  async search() { return []; },
};

const mockQuotes: QuotesRepo = {
  async list() { return []; },
  async get() { return null; },
  async create(input) {
    const q: Quote = {
      ...input,
      id: 'draft',
      materialSubtotal: 0,
      total: input.labor || 0,
    };
    return q;
  },
  async update() {},
  async remove() {},
};

const mockPriceFeed: PriceFeed = {
  async batchLookup(skus) {
    const now = new Date().toISOString();
    return skus.map(sku => ({ sku, price: 9.99, currency: 'USD' as const, vendor: 'MockVendor', timestamp: now }));
  },
};

const mockOptimizer: Optimizer = {
  async optimize({ currency, lines }) {
    const items = lines.map(l => ({
      skuOrId: l.productId ?? l.category ?? 'unknown',
      unitPrice: 9.99,
      qty: l.qty,
      lineTotal: 9.99 * l.qty,
    }));
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    return { total: subtotal, currency, vendors: [{ name: 'MockVendor', items, subtotal }] };
  },
};

const mockPDF: PDFService = { shareQuote: async () => {} };

const defaultServices: Services = {
  settings: mockSettings,
  catalog: mockCatalog,
  quotes: mockQuotes,   // <— NEW
  priceFeed: mockPriceFeed,
  optimizer: mockOptimizer,
  pdf: mockPDF,
  assemblies: [],
};

const Ctx = createContext<Services>(defaultServices);

export function ServicesProvider({ children, services }: PropsWithChildren<{ services?: Partial<Services> }>) {
  const merged = { ...defaultServices, ...services } as Services;
  return <Ctx.Provider value={merged}>{children}</Ctx.Provider>;
}

export function useServices() {
  return useContext(Ctx);
}
