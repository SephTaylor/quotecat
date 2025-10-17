// modules/quotes/index.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StoredQuote } from "./types";
import { normalizeQuote } from "./types";

// Read legacy keys but always write to PRIMARY_KEY
const STORAGE_KEYS = ["@quotecat/quotes", "quotes", "qc:quotes:v1"] as const;
const PRIMARY_KEY = STORAGE_KEYS[0];

type QuotesMap = Record<string, StoredQuote>;

// Safe timestamp extractor: return a numeric epoch (0 if missing/invalid)
const ts = (s?: string) => {
  if (typeof s !== "string") return 0;
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : 0;
};

async function safeParse(json: string | null): Promise<StoredQuote[]> {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(normalizeQuote) : [];
  } catch {
    return [];
  }
}

async function readAllRaw(): Promise<StoredQuote[]> {
  const [a, b, c] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS[0]),
    AsyncStorage.getItem(STORAGE_KEYS[1]),
    AsyncStorage.getItem(STORAGE_KEYS[2]),
  ]);

  const merged = [
    ...(await safeParse(a)),
    ...(await safeParse(b)),
    ...(await safeParse(c)),
  ];

  // De-dupe by id; prefer latest updatedAt/createdAt
  const map: QuotesMap = {};
  for (const q of merged) {
    const existing = map[q.id];
    if (!existing) {
      map[q.id] = q;
    } else {
      const ei = Math.max(ts(existing.updatedAt), ts(existing.createdAt));
      const qi = Math.max(ts(q.updatedAt), ts(q.createdAt));
      map[q.id] = qi >= ei ? q : existing;
    }
  }
  return Object.values(map);
}

async function writeAll(quotes: StoredQuote[]): Promise<void> {
  const normalized = quotes.map(normalizeQuote);
  await AsyncStorage.setItem(PRIMARY_KEY, JSON.stringify(normalized));
}

export async function listQuotes(): Promise<StoredQuote[]> {
  const all = await readAllRaw();
  return all.sort(
    (a, b) =>
      Math.max(ts(b.updatedAt), ts(b.createdAt)) -
      Math.max(ts(a.updatedAt), ts(a.createdAt)),
  );
}

export async function getQuoteById(id: string): Promise<StoredQuote | null> {
  const all = await readAllRaw();
  const found = all.find((q) => q.id === id);
  return found ? normalizeQuote(found) : null;
}

export async function saveQuote(q: StoredQuote): Promise<StoredQuote> {
  const all = await readAllRaw();
  const idx = all.findIndex((x) => x.id === q.id);
  const nowIso = new Date().toISOString();
  const next = normalizeQuote({ ...q, updatedAt: nowIso });

  if (idx === -1) {
    all.push(next);
  } else {
    // Merge while preserving normalized fields
    const merged = { ...all[idx], ...next, updatedAt: nowIso };
    all[idx] = normalizeQuote(merged);
  }

  await writeAll(all);
  return next;
}

export async function updateQuote(
  id: string,
  patch: Partial<StoredQuote>,
): Promise<StoredQuote | null> {
  const current = await getQuoteById(id);
  if (!current) return null;
  return saveQuote({ ...current, ...patch });
}

export async function deleteQuote(id: string): Promise<void> {
  const all = await readAllRaw();
  const next = all.filter((q) => q.id !== id);
  await writeAll(next);
}

export * from "./calc";
export * from "./exportCsv";
export * from "./types";
export * from "./useExportQuote";
export * from "./useQuoteData";
