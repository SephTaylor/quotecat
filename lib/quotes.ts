// lib/quotes.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Quote = {
  id: string;
  clientName: string;
  projectName: string;
  labor: number;
  material: number;
  total: number;
  createdAt: number; // ms since epoch
};

const KEY = 'quotecat:quotes';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Get all quotes (newest first)
export async function getAllQuotes(): Promise<Quote[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Quote[];
    return arr.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// Create a new quote
export async function saveQuote(partial: Omit<Quote, 'id' | 'createdAt' | 'total'>) {
  const existing = await getAllQuotes();
  const total = partial.labor + partial.material;
  const q: Quote = { id: uid(), createdAt: Date.now(), total, ...partial };
  const updated = [q, ...existing];
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return q;
}

// Get one by ID
export async function getQuoteById(id: string) {
  const all = await getAllQuotes();
  return all.find(q => q.id === id) || null;
}

// Delete a quote
export async function deleteQuote(id: string) {
  const all = await getAllQuotes();
  const updated = all.filter(q => q.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}

// Update by id (supports passing total directly)
export async function updateQuote(
  id: string,
  updates: {
    clientName: string;
    projectName: string;
    labor?: number;
    material?: number;
    total?: number;
  }
) {
  const all = await getAllQuotes();
  const idx = all.findIndex(q => q.id === id);
  if (idx === -1) throw new Error('Quote not found');

  const current = all[idx];
  const labor = updates.labor ?? current.labor;
  const material = updates.material ?? current.material;
  const total = updates.total ?? labor + material;

  const merged: Quote = {
    ...current,
    clientName: updates.clientName,
    projectName: updates.projectName,
    labor,
    material,
    total,
  };

  const newAll = [...all];
  newAll[idx] = merged;
  await AsyncStorage.setItem(KEY, JSON.stringify(newAll));
  return merged;
}

// Optional helper if needed elsewhere
export async function upsertQuote(q: Quote) {
  const all = await getAllQuotes();
  const idx = all.findIndex(x => x.id === q.id);
  const newAll = idx === -1 ? [q, ...all] : Object.assign([...all], { [idx]: q });
  await AsyncStorage.setItem(KEY, JSON.stringify(newAll));
}
// ---- Materials helpers ----

export type QuoteItem = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  unit?: "ea" | "ft" | "sheet" | "roll" | "box" | "bag" | "bucket" | "gal";
  vendor?: string;
  currency?: string;
};

/** Insert-or-merge an item by productId (adds qty if it already exists). */
export function upsertItem(
  items: QuoteItem[],
  incoming: QuoteItem
) {
  const idx = items.findIndex(i => i.productId === incoming.productId);
  if (idx >= 0) {
    const merged = { ...items[idx], qty: items[idx].qty + incoming.qty };
    const next = items.slice();
    next[idx] = merged;
    return next;
  }
  return [...items, incoming];
}

/** Set an exact quantity for an item; removes it if qty <= 0. */
export function setItemQty(
  items: QuoteItem[],
  productId: string,
  qty: number
) {
  const q = Math.max(0, Math.round(qty || 0));
  return items
    .map(i => (i.productId === productId ? { ...i, qty: q } : i))
    .filter(i => i.qty > 0);
}

/** Remove an item entirely by productId. */
export function removeItem(items: QuoteItem[], productId: string) {
  return items.filter(i => i.productId !== productId);
}

/** Recalculate materialSubtotal and total (labor + materials). */
export function recalc<T extends { items: QuoteItem[]; labor?: number }>(quote: T) {
  const materialSubtotal = quote.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const labor = quote.labor ?? 0;
  const total = materialSubtotal + labor;
  return { ...quote, materialSubtotal, total } as T & { materialSubtotal: number; total: number };
}
