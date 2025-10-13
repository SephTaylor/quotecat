// lib/products.ts
export type Product = {
  id: string;            // a readable id
  name: string;
  category: string;
  unit: "ea" | "ft" | "sheet" | "roll" | "box" | "bag" | "bucket" | "gal";
  unitPrice: number;     // price per unit in your app currency
  vendor?: string;
};

export const PRODUCTS_SEED: Product[] = [
  { id: "stud_2x4_8", name: "Stud 2x4x8 SPF", category: "Framing", unit: "ea", unitPrice: 3.95 },
  { id: "drywall_1_2_4x8", name: "Drywall 1/2\" 4x8", category: "Drywall", unit: "sheet", unitPrice: 11.2 },
  { id: "screw_drywall_1_1_4_box", name: "Drywall Screws 1-1/4\" (1 lb)", category: "Fasteners", unit: "box", unitPrice: 6.5 },
  { id: "mud_all_purpose_5gal", name: "Joint Compound 5 gal", category: "Drywall", unit: "bucket", unitPrice: 19.9 },
  { id: "tape_drywall_250ft", name: "Drywall Tape 250 ft", category: "Drywall", unit: "roll", unitPrice: 3.7 },
  { id: "paint_int_eggshell_gal", name: "Interior Paint Eggshell (gal)", category: "Paint", unit: "gal", unitPrice: 24.0 },
  { id: "wire_nm_b_12_2_250ft", name: "NM-B 12/2 (250 ft)", category: "Electrical", unit: "roll", unitPrice: 124.0 },
  { id: "can_light_6in", name: "6\" Can Light (IC)", category: "Electrical", unit: "ea", unitPrice: 18.0 },
  { id: "switch_singlepole_decora", name: "Switch Single-Pole (Decora)", category: "Electrical", unit: "ea", unitPrice: 3.2 },
  { id: "pex_a_1_2_100ft", name: "PEX-A 1/2\" (100 ft)", category: "Plumbing", unit: "roll", unitPrice: 39.0 },
  { id: "toilet_standard", name: "Toilet (Standard)", category: "Plumbing", unit: "ea", unitPrice: 129.0 },
  { id: "thinset_50lb", name: "Thinset Mortar 50 lb", category: "Tile", unit: "bag", unitPrice: 13.5 },
];

// simple in-memory search
export function searchProducts(q: string): Product[] {
  const term = q.trim().toLowerCase();
  if (!term) return PRODUCTS_SEED.slice(0, 20);
  return PRODUCTS_SEED
    .filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    )
    .slice(0, 20);
}

// Convenience aliases used by other screens
export const PRODUCTS = PRODUCTS_SEED;
export const CATEGORIES = Array.from(new Set(PRODUCTS_SEED.map(p => p.category))).sort();
