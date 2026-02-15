// modules/catalog/seed.ts
// Type definitions for products and categories
// Data is loaded from Supabase, not hardcoded

export type Category = {
  id: string;
  name: string;
  parentId?: string;    // Reference to parent category (null for root categories)
  level?: number;       // 0 = parent/root, 1 = leaf/child
  sortOrder?: number;   // For display ordering
};

export type Product = {
  id: string;
  categoryId: string;
  canonicalCategory?: string; // Amazon-style top-level category (Lumber, Electrical, etc.)
  name: string;
  unit: string; // "ea", "sheet", "10ft", "box"
  unitPrice: number;
  supplierId?: string; // references suppliers table in Supabase
};

// Supplier display names lookup
export const SUPPLIER_NAMES: Record<string, string> = {
  lowes: "Lowe's",
  homedepot: "Home Depot",
  menards: "Menards",
};
