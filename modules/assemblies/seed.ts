// modules/assemblies/seed.ts
import type { Assembly } from "./types";

/**
 * Seed assemblies for initial app setup.
 */
export const ASSEMBLIES_SEED: Assembly[] = [
  {
    id: "interior-wall-8ft",
    name: "Interior Wall (8 ft ceiling)",
    defaults: {
      lengthFt: 10, // default 10 ft wall
    },
    items: [
      // Studs: (length / 16") on center, plus 2 end studs
      {
        productId: "stud-2x4x8",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          const studsOC = Math.ceil((lengthFt * 12) / 16); // 16" on center
          return studsOC + 2; // plus 2 end studs
        },
      },
      // Top and bottom plates: 2x length (double top plate)
      {
        productId: "plate-2x4",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          return Math.ceil((lengthFt * 3) / 10); // 3 plates total (top double + bottom)
        },
      },
      // Drywall: 2 sheets per side (assumes 8ft ceiling)
      {
        productId: "sheet-1-2-4x8",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          return Math.ceil(lengthFt / 4) * 2; // both sides
        },
      },
      // Drywall screws: 1 box per 8 sheets (rough estimate)
      {
        productId: "screws-1-1-4",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          const sheets = Math.ceil(lengthFt / 4) * 2;
          return Math.ceil(sheets / 8);
        },
      },
    ],
  },
  {
    id: "deck-12x16",
    name: "12x16 Deck",
    defaults: {
      // No variables - fixed 12x16 size
    },
    items: [
      // Deck boards: 192 sq ft (12x16) @ 5.5" coverage per board
      // 16 ft length, need 12 ft coverage = ~27 boards
      {
        productId: "stud-2x4x8",
        qty: 27, // Using stud as placeholder for deck boards
      },
      // Joists: 16" on center for 12 ft span
      // (12 ft * 12") / 16" = 9 joists + 2 end = 11 joists
      {
        productId: "plate-2x4",
        qty: 11, // Using plate as placeholder for 2x6 joists
      },
      // Hardware & fasteners (estimate)
      {
        productId: "screws-1-1-4",
        qty: 3, // 3 boxes of screws
      },
    ],
  },
];
