// lib/quotes.ts
import { getJSON, remove, setJSON } from './storage';

export type QuoteItem = {
  id: string;
  name: string;
  unitPrice: number;
  qty: number;
};

export type Quote = {
  id: string;
  name: string;
  clientName: string;       // NEW
  items: QuoteItem[];
  labor: number;            // already existed
  currency: string;
  materialSubtotal: number;
  total: number;
  createdAt: string;
  updatedAt: string;
};

const INDEX_KEY = 'quotes:index';
const nowISO = () => new Date().toISOString();

export async function listQuotes(): Promise<Quote[]> {
  const ids = (await getJSON<string[]>(INDEX_KEY)) ?? [];
  const out: Quote[] = [];
  for (const id of ids) {
    const q = await getJSON<Quote>(`quote:${id}`);
    if (q) out.push(q);
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getQuoteById(id: string): Promise<Quote | null> {
  return (await getJSON<Quote>(`quote:${id}`)) ?? null;
}

export async function createNewQuote(name = '', clientName = ''): Promise<Quote> {
  const id = Math.random().toString(36).slice(2, 10);
  const q: Quote = {
    id,
    name,
    clientName,
    items: [],
    labor: 0,
    currency: 'USD',
    materialSubtotal: 0,
    total: 0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  await setJSON(`quote:${id}`, q);
  const ids = (await getJSON<string[]>(INDEX_KEY)) ?? [];
  ids.unshift(id);
  await setJSON(INDEX_KEY, ids);
  return q;
}

// Merge + recalc. Accepts partial fields.
export async function saveQuote(patch: Partial<Quote> & { id: string }): Promise<Quote> {
  const existing = (await getJSON<Quote>(`quote:${patch.id}`)) ?? {
    id: patch.id,
    name: '',
    clientName: '',
    items: [] as QuoteItem[],
    labor: 0,
    currency: 'USD',
    materialSubtotal: 0,
    total: 0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  } satisfies Quote;

  const next: Quote = {
    ...existing,
    ...patch,
  };

  // Recalculate derived fields
  const materialSubtotal = (next.items ?? []).reduce(
    (sum, it) => sum + it.unitPrice * it.qty,
    0
  );
  next.materialSubtotal = materialSubtotal;
  next.total = materialSubtotal + (next.labor || 0);
  next.updatedAt = nowISO();

  await setJSON(`quote:${next.id}`, next);

  // Ensure index contains this id
  const ids = (await getJSON<string[]>(INDEX_KEY)) ?? [];
  if (!ids.includes(next.id)) {
    ids.unshift(next.id);
    await setJSON(INDEX_KEY, ids);
  }

  return next;
}

export async function deleteQuote(id: string): Promise<void> {
  // remove the quote blob
  await remove(`quote:${id}`);
  // remove from index
  const ids = (await getJSON<string[]>(INDEX_KEY)) ?? [];
  const next = ids.filter((x) => x !== id);
  await setJSON(INDEX_KEY, next);
}
