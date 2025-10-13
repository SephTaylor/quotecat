// lib/quotes.ts
import { getJSON, setJSON } from './storage';

export type QuoteItem = {
  id: string;
  name: string;
  unitPrice: number;
  qty: number;
};

export type Quote = {
  id: string;
  name: string;
  items: QuoteItem[];
  labor: number;
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
  const quotes: Quote[] = [];
  for (const id of ids) {
    const q = await getJSON<Quote>(`quote:${id}`);
    if (q) quotes.push(q);
  }
  return quotes.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getQuoteById(id: string): Promise<Quote | null> {
  return (await getJSON<Quote>(`quote:${id}`)) ?? null;
}

export async function saveQuote(q: Partial<Quote> & { id: string }): Promise<Quote> {
  const existing = (await getJSON<Quote>(`quote:${q.id}`)) ?? null;

  const base: Quote = existing ?? {
    id: q.id,
    name: '',
    items: [],
    labor: 0,
    currency: 'USD',
    materialSubtotal: 0,
    total: 0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  const items = q.items ?? base.items;
  const labor = q.labor ?? base.labor;

  const materialSubtotal = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const total = materialSubtotal + labor;

  const merged: Quote = {
    ...base,
    ...q,
    items,
    labor,
    materialSubtotal,
    total,
    updatedAt: nowISO(),
  };

  await setJSON(`quote:${merged.id}`, merged);

  const ids = (await getJSON<string[]>(INDEX_KEY)) ?? [];
  if (!ids.includes(merged.id)) {
    ids.unshift(merged.id);
    await setJSON(INDEX_KEY, ids);
  }

  return merged;
}

export async function createNewQuote(name = ''): Promise<Quote> {
  const id = Math.random().toString(36).slice(2, 10);
  const q: Quote = {
    id,
    name,
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
