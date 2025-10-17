// modules/quotes/types.ts
export type CurrencyCode = "CRC" | "USD";

export type QuoteItem = {
  productId?: string;
  name: string;
  unitPrice: number;
  qty: number;
  currency?: CurrencyCode;
  [key: string]: any; // forward-compatible extras
};

export type StoredQuote = {
  id: string;
  name: string;
  clientName?: string;
  items: QuoteItem[];
  labor: number;
  createdAt?: string; // ISO
  updatedAt?: string; // ISO
  total?: number; // computed; ignored on load
  [key: string]: any;
};

const KNOWN_ITEM_KEYS = new Set([
  "productId",
  "name",
  "unitPrice",
  "qty",
  "currency",
]);
const KNOWN_QUOTE_KEYS = new Set([
  "id",
  "name",
  "clientName",
  "items",
  "labor",
  "createdAt",
  "updatedAt",
  "total",
]);

function extras(obj: any, known: Set<string>) {
  const out: Record<string, any> = {};
  if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj))
      if (!known.has(k)) out[k] = (obj as any)[k];
  }
  return out;
}

export function normalizeItem(raw: any): QuoteItem {
  const base: QuoteItem = {
    productId: typeof raw?.productId === "string" ? raw.productId : undefined,
    name: typeof raw?.name === "string" ? raw.name : "",
    unitPrice: Number.isFinite(raw?.unitPrice) ? Number(raw.unitPrice) : 0,
    qty: Number.isFinite(raw?.qty) ? Number(raw.qty) : 0,
    currency:
      raw?.currency === "USD" || raw?.currency === "CRC"
        ? raw.currency
        : undefined,
  };
  return { ...base, ...extras(raw, KNOWN_ITEM_KEYS) };
}

export function normalizeQuote(raw: any): StoredQuote {
  const nowIso = new Date().toISOString();
  const itemsArr: any[] = Array.isArray(raw?.items) ? raw.items : [];

  const base: StoredQuote = {
    id:
      typeof raw?.id === "string" && raw.id
        ? raw.id
        : String(Math.random()).slice(2),
    name: typeof raw?.name === "string" ? raw.name : "",
    clientName: typeof raw?.clientName === "string" ? raw.clientName : "",
    items: itemsArr.map(normalizeItem),
    labor: Number.isFinite(raw?.labor) ? Number(raw.labor) : 0,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : nowIso,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : nowIso,
  };

  const out: StoredQuote = { ...base, ...extras(raw, KNOWN_QUOTE_KEYS) };
  if ("total" in out) delete (out as any).total; // never trust stored totals
  return out;
}
