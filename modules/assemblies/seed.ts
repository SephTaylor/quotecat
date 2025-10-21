// modules/assemblies/seed.ts
import type { Assembly } from "./types";

/**
 * Seed assemblies for initial app setup.
 */
export const ASSEMBLIES_SEED: Assembly[] = [
  // ===== FRAMING ASSEMBLIES =====
  {
    id: "interior-wall-8ft",
    name: "Interior Wall - 8 ft Ceiling",
    defaults: {
      lengthFt: 10, // default 10 ft wall
    },
    items: [
      // Precut studs for 8 ft ceiling (92-5/8")
      {
        productId: "stud-2x4x92-5-8",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          const studsOC = Math.ceil((lengthFt * 12) / 16); // 16" on center
          return studsOC + 2; // plus 2 end studs
        },
      },
      // Plates: 3 per wall (double top + single bottom)
      {
        productId: "plate-2x4",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          return Math.ceil((lengthFt * 3) / 10); // 3 plates total
        },
      },
      // Drywall both sides
      {
        productId: "sheet-1-2-4x8",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          return Math.ceil(lengthFt / 4) * 2; // both sides
        },
      },
      // Drywall screws
      {
        productId: "screws-1-1-4",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          const sheets = Math.ceil(lengthFt / 4) * 2;
          return Math.max(1, Math.ceil(sheets / 8));
        },
      },
      // Joint compound
      {
        productId: "compound-all-purpose",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          const sheets = Math.ceil(lengthFt / 4) * 2;
          return Math.max(1, Math.ceil(sheets / 12)); // ~12 sheets per bucket
        },
      },
      // Drywall tape
      {
        productId: "tape-paper",
        qty: 1,
      },
      // Corner beads (2 per wall - top corners)
      {
        productId: "corner-bead-8ft",
        qty: 2,
      },
      // Framing nails
      {
        productId: "nails-16d-framing",
        qty: 1,
      },
    ],
  },
  {
    id: "room-framing-12x12",
    name: "Room Framing - 12x12 ft",
    defaults: {},
    items: [
      // 4 walls @ 12 ft each = 48 linear ft
      // Studs: ~36 studs for 48 ft @ 16" OC + corners
      {
        productId: "stud-2x4x92-5-8",
        qty: 40, // Extra for corners and openings
      },
      // Plates: 48 ft * 3 plates = 144 ft / 10 ft per plate
      {
        productId: "plate-2x4-12",
        qty: 12, // 12 ft plates more efficient
      },
      // Door header (3 ft opening)
      {
        productId: "header-lvl-2x10",
        qty: 1,
      },
      // Drywall: 48 linear ft * 8 ft tall / 32 sf per sheet * 2 sides
      {
        productId: "sheet-1-2-4x8",
        qty: 24,
      },
      // Ceiling drywall: 144 sf / 32 sf per sheet
      {
        productId: "sheet-1-2-4x12",
        qty: 5,
      },
      // Fasteners
      {
        productId: "nails-16d-framing",
        qty: 2,
      },
      {
        productId: "screws-1-1-4",
        qty: 3,
      },
      // Finishing
      {
        productId: "compound-all-purpose",
        qty: 3,
      },
      {
        productId: "tape-paper",
        qty: 2,
      },
      {
        productId: "corner-bead-8ft",
        qty: 8, // 4 corners * 2
      },
    ],
  },
  {
    id: "exterior-wall-2x6",
    name: "Exterior Wall - 2x6 Framing",
    defaults: {
      lengthFt: 10,
    },
    items: [
      // 2x6 studs for exterior walls
      {
        productId: "stud-2x6x8",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          const studsOC = Math.ceil((lengthFt * 12) / 16);
          return studsOC + 2;
        },
      },
      // 2x6 plates
      {
        productId: "plate-2x6-10",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          return Math.ceil((lengthFt * 3) / 10);
        },
      },
      // OSB sheathing exterior
      {
        productId: "osb-7-16-4x8",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          return Math.ceil(lengthFt / 4);
        },
      },
      // Drywall interior side
      {
        productId: "sheet-1-2-4x8",
        qtyFn: (vars) => {
          const lengthFt = Number(vars.lengthFt) || 10;
          return Math.ceil(lengthFt / 4);
        },
      },
      // Nails
      {
        productId: "nails-16d-framing",
        qty: 2,
      },
      {
        productId: "nails-8d-common",
        qty: 1,
      },
    ],
  },

  // ===== ELECTRICAL ASSEMBLIES =====
  {
    id: "bedroom-electrical",
    name: "Bedroom Electrical Rough-In",
    defaults: {},
    items: [
      // Typical bedroom: 6 outlets, 1 switch, 1 ceiling light
      // Wire: 14/2 for lighting, 12/2 for outlets (20A circuit)
      {
        productId: "nmb-12-2-250",
        qty: 1, // 20A outlet circuit
      },
      {
        productId: "nmb-14-2-250",
        qty: 1, // 15A lighting circuit
      },
      // Outlet boxes
      {
        productId: "box-single",
        qty: 7, // 6 outlets + 1 switch
      },
      // Ceiling box
      {
        productId: "box-ceiling",
        qty: 1,
      },
      // Outlets
      {
        productId: "outlet-20a",
        qty: 6,
      },
      // Switch
      {
        productId: "switch-single",
        qty: 1,
      },
      // Breakers
      {
        productId: "breaker-20a",
        qty: 1,
      },
      {
        productId: "breaker-15a",
        qty: 1,
      },
      // Consumables
      {
        productId: "wire-nuts-red",
        qty: 1,
      },
      {
        productId: "staples-cable",
        qty: 1,
      },
      // Cover plates
      {
        productId: "panel-cover-single",
        qty: 7,
      },
    ],
  },
  {
    id: "kitchen-electrical",
    name: "Kitchen Electrical Rough-In",
    defaults: {},
    items: [
      // Kitchen requires: countertop outlets (20A GFCI), appliance circuits, lighting
      // 2x 20A circuits for countertop (GFCI protected)
      {
        productId: "nmb-12-2-250",
        qty: 3, // 2 for countertop + 1 for appliances
      },
      // Lighting circuit
      {
        productId: "nmb-14-2-250",
        qty: 1,
      },
      // GFCI outlets for countertop (2 circuits, 4 outlets total)
      {
        productId: "gfci-15a",
        qty: 2, // First in each circuit
      },
      {
        productId: "outlet-20a",
        qty: 4, // Downstream outlets
      },
      // Boxes
      {
        productId: "box-single",
        qty: 8, // 6 outlets + 2 switches
      },
      {
        productId: "box-ceiling",
        qty: 2, // Main light + under-cabinet
      },
      // Switches
      {
        productId: "switch-single",
        qty: 2,
      },
      // Breakers
      {
        productId: "breaker-20a",
        qty: 3,
      },
      {
        productId: "breaker-15a",
        qty: 1,
      },
      // Consumables
      {
        productId: "wire-nuts-red",
        qty: 2,
      },
      {
        productId: "wire-nuts-yellow",
        qty: 1,
      },
      {
        productId: "staples-cable",
        qty: 2,
      },
      // Cover plates
      {
        productId: "panel-cover-single",
        qty: 8,
      },
    ],
  },
  {
    id: "bathroom-electrical",
    name: "Bathroom Electrical Rough-In",
    defaults: {},
    items: [
      // Bathroom: GFCI outlets, exhaust fan, vanity lighting, switch
      {
        productId: "nmb-12-2-250",
        qty: 1, // 20A GFCI circuit
      },
      {
        productId: "nmb-14-2-250",
        qty: 1, // Lighting/fan circuit
      },
      // GFCI outlet
      {
        productId: "gfci-15a",
        qty: 1,
      },
      // Regular outlet
      {
        productId: "outlet-20a",
        qty: 1,
      },
      // Boxes
      {
        productId: "box-single",
        qty: 3, // 2 outlets + 1 switch
      },
      {
        productId: "box-ceiling",
        qty: 2, // Vanity light + exhaust fan
      },
      // Switch (could be 3-way for fan/light combo)
      {
        productId: "switch-single",
        qty: 2,
      },
      // Breakers
      {
        productId: "breaker-20a",
        qty: 1,
      },
      {
        productId: "breaker-15a",
        qty: 1,
      },
      // Consumables
      {
        productId: "wire-nuts-red",
        qty: 1,
      },
      {
        productId: "staples-cable",
        qty: 1,
      },
      // Cover plates
      {
        productId: "panel-cover-single",
        qty: 3,
      },
    ],
  },
  {
    id: "3way-switch-circuit",
    name: "3-Way Switch Circuit (Hallway/Stairs)",
    defaults: {},
    items: [
      // 3-way switching for hallways or stairs
      {
        productId: "nmb-14-2-250",
        qty: 1, // Hot to first switch
      },
      {
        productId: "nmb-12-3-100",
        qty: 1, // 3-wire between switches
      },
      // 3-way switches
      {
        productId: "switch-3way",
        qty: 2,
      },
      // Boxes
      {
        productId: "box-single",
        qty: 2,
      },
      {
        productId: "box-ceiling",
        qty: 2, // Light fixtures
      },
      // Breaker
      {
        productId: "breaker-15a",
        qty: 1,
      },
      // Consumables
      {
        productId: "wire-nuts-red",
        qty: 1,
      },
      {
        productId: "staples-cable",
        qty: 1,
      },
      // Cover plates
      {
        productId: "panel-cover-single",
        qty: 2,
      },
    ],
  },
  {
    id: "outlet-circuit-8",
    name: "Outlet Circuit - 8 Receptacles",
    defaults: {},
    items: [
      // Standard 20A outlet circuit with 8 outlets
      {
        productId: "nmb-12-2-250",
        qty: 1,
      },
      // Outlets
      {
        productId: "outlet-20a",
        qty: 8,
      },
      // Boxes
      {
        productId: "box-single",
        qty: 8,
      },
      // Breaker
      {
        productId: "breaker-20a",
        qty: 1,
      },
      // Consumables
      {
        productId: "wire-nuts-red",
        qty: 1,
      },
      {
        productId: "staples-cable",
        qty: 1,
      },
      // Cover plates
      {
        productId: "panel-cover-single",
        qty: 8,
      },
    ],
  },
  // ===== TEST ASSEMBLY - AUTO-MERGE VERIFICATION =====
  {
    id: "test-automerge-assembly",
    name: "🧪 Test Auto-Merge Assembly",
    defaults: {},
    items: [
      {
        productId: "stud-2x4x92-5-8",
        qty: 10,
      },
      {
        productId: "sheet-1-2-4x8",
        qty: 5,
      },
    ],
  },
];
