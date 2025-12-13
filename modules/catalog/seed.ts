// modules/catalog/seed.ts
// Type definitions for products and categories
// Data is loaded from Supabase, not hardcoded

export type Category = { id: string; name: string };

export type Product = {
  id: string;
  categoryId: string;
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
