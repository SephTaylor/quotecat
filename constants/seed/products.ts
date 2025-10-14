// constants/seed/products.ts
export type Category = { id: string; name: string };
export type Product = {
  id: string;
  categoryId: string;
  name: string;
  unit: string;        // e.g., "ea", "sheet", "10ft", "box"
  unitPrice: number;   // seed-only baseline
};

export const CATEGORIES: Category[] = [
  { id: 'framing', name: 'Framing' },
  { id: 'drywall', name: 'Drywall' },
  { id: 'electrical', name: 'Electrical' },
  { id: 'plumbing', name: 'Plumbing' },
];

export const PRODUCTS_SEED: Record<string, Product[]> = {
  framing: [
    { id: 'stud-2x4x8', categoryId: 'framing', name: '2×4×8 KD Stud', unit: 'ea', unitPrice: 3.45 },
    { id: 'plate-2x4',  categoryId: 'framing', name: '2×4 Plate (10 ft)', unit: '10ft', unitPrice: 6.90 },
  ],
  drywall: [
    { id: 'sheet-1-2-4x8', categoryId: 'drywall', name: 'Drywall 1/2" 4×8', unit: 'sheet', unitPrice: 11.75 },
    { id: 'screws-1-1-4',  categoryId: 'drywall', name: 'Drywall Screws 1-1/4" (1 lb)', unit: 'box', unitPrice: 6.50 },
  ],
  electrical: [
    { id: 'nmb-12-2-250', categoryId: 'electrical', name: 'NM-B 12/2 (250 ft)', unit: 'roll', unitPrice: 112.00 },
    { id: 'box-single',   categoryId: 'electrical', name: 'Single-Gang Box (old work)', unit: 'ea', unitPrice: 1.25 },
  ],
  plumbing: [
    { id: 'pex-a-1-2-100', categoryId: 'plumbing', name: 'PEX-A 1/2" (100 ft)', unit: 'coil', unitPrice: 42.00 },
    { id: 'angle-stop-1-2', categoryId: 'plumbing', name: 'Angle Stop 1/2" × 3/8"', unit: 'ea', unitPrice: 6.20 },
  ],
};
