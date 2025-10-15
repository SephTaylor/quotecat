import type { LibraryEntry } from './types';

// MVP: in-memory. Later swap with Supabase without changing call sites.
const store = new Map<string, LibraryEntry>();

export async function saveEntry(entry: LibraryEntry) {
  store.set(entry.id, entry);
}

export async function getAll(): Promise<LibraryEntry[]> {
  return [...store.values()];
}

export async function getByKind(kind: LibraryEntry['kind']): Promise<LibraryEntry[]> {
  return [...store.values()].filter(e => e.kind === kind);
}

export async function removeEntry(id: string) {
  store.delete(id);
}
