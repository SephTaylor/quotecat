// modules/quotes/index.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ID, Quote, QuotesRepo } from '../../lib/services';

const STORE_KEY = 'qc:quotes:v1';

async function loadAll(): Promise<Quote[]> {
  const raw = await AsyncStorage.getItem(STORE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveAll(list: Quote[]) {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function calcTotals(q: Quote): Quote {
  const material = q.items.reduce((s, it) => s + (it.unitPrice || 0) * (it.qty || 0), 0);
  return {
    ...q,
    materialSubtotal: material,
    total: material + (q.labor || 0),
  };
}

function genId(): ID {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const quotesRepo: QuotesRepo = {
  async list() {
    return loadAll();
  },
  async get(id) {
    const all = await loadAll();
    return all.find(q => q.id === id) ?? null;
  },
  async create(input) {
    const all = await loadAll();
    const id = input.id ?? genId();
    const next = calcTotals({ ...input, id });
    await saveAll([next, ...all]);
    return next;
  },
  async update(q) {
    const all = await loadAll();
    const next = calcTotals(q);
    const idx = all.findIndex(x => x.id === q.id);
    if (idx >= 0) all[idx] = next;
    else all.unshift(next);
    await saveAll(all);
  },
  async remove(id) {
    const all = await loadAll();
    await saveAll(all.filter(q => q.id !== id));
  },
};

export default quotesRepo;

