import type { QuoteItem } from "./index";

export type QuoteDraft = {
  id: string; // temp id while drafting
  customerId?: string;
  title?: string;
  items: QuoteItem[];
  createdAt: number;
  updatedAt: number;
};

// Pure helpers (no storage coupling)
export function createDraft(): QuoteDraft {
  const now = Date.now();
  return {
    id: "draft-" + now.toString(36),
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function touch(d: QuoteDraft): QuoteDraft {
  return { ...d, updatedAt: Date.now() };
}
