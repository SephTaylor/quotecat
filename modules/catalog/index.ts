// modules/catalog/index.ts
import type { CatalogRepo, Product } from '../../lib/services';

// Be flexible with whatever your seed exports.
import * as seedData from './seed';

type RawSeed = any[] | { products?: any[] } | { default?: any[] };

function normalizeSeed(raw: RawSeed): Product[] {
  const arr =
    (raw as any).products ??
    (raw as any).default ??
    (Array.isArray(raw) ? raw : []);

  if (!Array.isArray(arr)) return [];
  return arr
    .map((p: any) => {
      const id = String(p?.id ?? p?.sku ?? p?.name ?? '');
      const name = String(p?.name ?? p?.title ?? 'Unnamed');
      const category = String(p?.category ?? 'Uncategorized');
      const unit = String(p?.unit ?? 'ea');
      const price = typeof p?.price === 'number' ? p.price : undefined;
      const currency = (p?.currency ?? 'USD') as 'USD' | 'CRC';
      const sku = p?.sku ? String(p.sku) : undefined;
      if (!id || !name) return null;
      return { id, name, category, unit, price, currency, sku } as Product;
    })
    .filter(Boolean) as Product[];
}

export function createCatalogFromSeed(raw: RawSeed): CatalogRepo {
  const products = normalizeSeed(raw);
  const byId = new Map(products.map((p) => [p.id, p]));
  const byCat = new Map<string, Product[]>();
  for (const p of products) {
    const list = byCat.get(p.category) ?? [];
    list.push(p);
    byCat.set(p.category, list);
  }
  const categories = Array.from(byCat.keys()).sort();

  return {
    async listCategories() {
      return categories;
    },
    async listProductsByCategory(category: string) {
      return (byCat.get(category) ?? []).slice();
    },
    async getProductById(id: string) {
      return byId.get(id) ?? null;
    },
    async search(term: string) {
      const q = term.trim().toLowerCase();
      if (!q) return products.slice(0, 50);
      return products
        .filter((p) => {
          const hay = `${p.name} ${p.sku ?? ''} ${p.category}`.toLowerCase();
          return hay.includes(q);
        })
        .slice(0, 100);
    },
  };
}

// Build the default repo from whatever the seed exports.
// If your seed exports `products`, `default`, or a raw array, this will work.
const catalogRepo = createCatalogFromSeed(seedData as unknown as RawSeed);
export default catalogRepo;

