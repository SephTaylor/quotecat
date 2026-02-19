// modules/job-calculator/formulas/flooring.ts
// Material calculation formulas for flooring installation

import type { FlooringInputs, MaterialRequirement } from '../types';

/**
 * Calculate all materials needed for flooring based on user inputs.
 *
 * Coverage and waste factors by flooring type:
 * - LVP: Sold in boxes covering ~20 sqft, 10% waste
 * - Hardwood: Sold in boxes covering ~20 sqft, 15% waste (more cuts)
 * - Tile: Sold by sqft or box, 15% waste (breakage + cuts)
 * - Carpet: Sold by sqyd, 10% waste
 */
export function calculateFlooringMaterials(inputs: FlooringInputs): MaterialRequirement[] {
  const { totalSqFt, totalPerimeter, roomCount, floorType } = inputs;

  const materials: MaterialRequirement[] = [];

  switch (floorType) {
    case 'lvp':
      materials.push(...calculateLVPMaterials(totalSqFt, totalPerimeter, roomCount));
      break;
    case 'hardwood':
      materials.push(...calculateHardwoodMaterials(totalSqFt, totalPerimeter, roomCount));
      break;
    case 'tile':
      materials.push(...calculateTileMaterials(totalSqFt, totalPerimeter, roomCount));
      break;
    case 'carpet':
      materials.push(...calculateCarpetMaterials(totalSqFt, totalPerimeter, roomCount));
      break;
  }

  return materials;
}

function calculateLVPMaterials(
  totalSqFt: number,
  totalPerimeter: number,
  roomCount: number
): MaterialRequirement[] {
  const wasteFactor = 1.1; // 10% waste
  const sqftNeeded = totalSqFt * wasteFactor;
  const boxCoverage = 20; // Typical box covers 20 sqft
  const boxesNeeded = Math.ceil(sqftNeeded / boxCoverage);

  return [
    {
      category: 'flooring',
      name: 'Luxury Vinyl Plank Flooring',
      searchTerms: ['Waterproof Click Lock Vinyl Plank', 'Luxury Vinyl Plank case'],
      qty: boxesNeeded,
      unit: 'case',
      notes: `${totalSqFt} sqft + 10% waste = ${Math.ceil(sqftNeeded)} sqft needed`,
    },
    {
      category: 'underlayment',
      name: 'LVP Underlayment',
      searchTerms: ['Floating Floor Underlayment', 'Moisture Barrier Underlayment roll'],
      qty: Math.ceil(totalSqFt / 100), // Rolls cover ~100 sqft
      unit: 'roll',
      notes: 'Check if flooring has attached pad',
    },
    {
      category: 'trim',
      name: 'Wall Base',
      searchTerms: ['VPI vinyl wall base', '4 x 48 vinyl wall base'],
      qty: Math.ceil(totalPerimeter / 4), // 4ft lengths
      unit: 'ea',
      notes: `${totalPerimeter} linear ft of wall base`,
    },
    {
      category: 'trim',
      name: 'Transition Strips',
      searchTerms: ['Vinyl 4-in-1 Molding', 'MultiFloor Transition'],
      qty: roomCount,
      unit: 'ea',
      notes: '1 transition per room/doorway',
    },
    {
      category: 'adhesive',
      name: 'Wall Base Adhesive',
      searchTerms: ['wall base adhesive', 'wall base mastic'],
      qty: Math.ceil(totalPerimeter / 100), // 1 tube per ~100 linear ft
      unit: 'tube',
      notes: 'For wall base',
    },
  ];
}

function calculateHardwoodMaterials(
  totalSqFt: number,
  totalPerimeter: number,
  roomCount: number
): MaterialRequirement[] {
  const wasteFactor = 1.15; // 15% waste for hardwood
  const sqftNeeded = totalSqFt * wasteFactor;
  const boxCoverage = 20;
  const boxesNeeded = Math.ceil(sqftNeeded / boxCoverage);

  return [
    {
      category: 'flooring',
      name: 'Hardwood Flooring',
      searchTerms: ['hardwood flooring', 'oak flooring', 'engineered hardwood'],
      qty: boxesNeeded,
      unit: 'box',
      notes: `${totalSqFt} sqft + 15% waste = ${Math.ceil(sqftNeeded)} sqft needed`,
    },
    {
      category: 'underlayment',
      name: 'Hardwood Underlayment',
      searchTerms: ['hardwood underlayment', 'floor underlayment', 'felt paper'],
      qty: Math.ceil(totalSqFt / 100),
      unit: 'roll',
      notes: 'Moisture barrier for hardwood',
    },
    {
      category: 'fasteners',
      name: 'Hardwood Flooring Cleats',
      searchTerms: ['flooring cleat', 'hardwood nail', 'flooring staple'],
      qty: Math.ceil((totalSqFt * 4) / 1000), // ~4 cleats per sqft, boxes of 1000
      unit: 'box',
      notes: '~4 cleats per sqft',
    },
    {
      category: 'trim',
      name: 'Hardwood Baseboards',
      searchTerms: ['hardwood baseboard', 'oak baseboard', 'base moulding'],
      qty: Math.ceil(totalPerimeter / 8),
      unit: 'ea',
      notes: `${totalPerimeter} linear ft`,
    },
    {
      category: 'trim',
      name: 'Transition Strips',
      searchTerms: ['hardwood transition', 't-molding hardwood', 'reducer strip'],
      qty: roomCount,
      unit: 'ea',
      notes: '1 per room/doorway',
    },
    {
      category: 'finish',
      name: 'Wood Floor Finish',
      searchTerms: ['polyurethane', 'floor finish', 'wood floor sealer'],
      qty: Math.ceil(totalSqFt / 350), // 1 gallon covers ~350 sqft
      unit: 'gal',
      notes: 'If unfinished hardwood',
    },
  ];
}

function calculateTileMaterials(
  totalSqFt: number,
  totalPerimeter: number,
  roomCount: number
): MaterialRequirement[] {
  const wasteFactor = 1.15; // 15% waste for tile (cuts + breakage)
  const sqftNeeded = totalSqFt * wasteFactor;

  // Thinset coverage: ~50 sqft per 50lb bag
  const thinsetBags = Math.ceil(sqftNeeded / 50);

  // Grout coverage: ~25 sqft per 10lb bag (varies by tile size)
  const groutBags = Math.ceil(sqftNeeded / 25);

  return [
    {
      category: 'flooring',
      name: 'Floor Tile',
      searchTerms: ['floor tile', 'ceramic tile', 'porcelain tile'],
      qty: Math.ceil(sqftNeeded),
      unit: 'sqft',
      notes: `${totalSqFt} sqft + 15% waste = ${Math.ceil(sqftNeeded)} sqft needed`,
    },
    {
      category: 'underlayment',
      name: 'Cement Backer Board',
      searchTerms: ['cement board', 'durock', 'hardiebacker'],
      qty: Math.ceil(totalSqFt / 15), // 3x5 sheets = 15 sqft
      unit: 'sheet',
      notes: 'Required substrate for tile',
    },
    {
      category: 'adhesive',
      name: 'Thinset Mortar',
      searchTerms: ['thinset', 'tile mortar', 'tile adhesive'],
      qty: thinsetBags,
      unit: 'bag',
      notes: '~50 sqft per 50lb bag',
    },
    {
      category: 'grout',
      name: 'Tile Grout',
      searchTerms: ['tile grout', 'sanded grout', 'unsanded grout'],
      qty: groutBags,
      unit: 'bag',
      notes: '~25 sqft per 10lb bag',
    },
    {
      category: 'supplies',
      name: 'Tile Spacers',
      searchTerms: ['tile spacer', 'grout spacer'],
      qty: Math.ceil(totalSqFt / 200), // Bags of ~200 spacers
      unit: 'bag',
      notes: '1/8" or 1/4" spacing',
    },
    {
      category: 'trim',
      name: 'Tile Baseboards',
      searchTerms: ['tile baseboard', 'cove base', 'ceramic base'],
      qty: Math.ceil(totalPerimeter / 6), // 6" tiles for baseboard
      unit: 'ea',
      notes: `${totalPerimeter} linear ft`,
    },
    {
      category: 'trim',
      name: 'Tile Transitions',
      searchTerms: ['tile transition', 'schluter', 'metal edge'],
      qty: roomCount,
      unit: 'ea',
      notes: '1 per doorway',
    },
    {
      category: 'sealant',
      name: 'Grout Sealer',
      searchTerms: ['grout sealer', 'tile sealer', 'grout waterproof'],
      qty: Math.ceil(totalSqFt / 200), // 1 bottle per ~200 sqft
      unit: 'bottle',
      notes: 'Protects grout from stains',
    },
  ];
}

function calculateCarpetMaterials(
  totalSqFt: number,
  totalPerimeter: number,
  roomCount: number
): MaterialRequirement[] {
  const wasteFactor = 1.1; // 10% waste
  const sqftNeeded = totalSqFt * wasteFactor;
  const sqydNeeded = Math.ceil(sqftNeeded / 9); // Convert to square yards

  return [
    {
      category: 'flooring',
      name: 'Carpet',
      searchTerms: ['carpet roll', 'carpet flooring', 'residential carpet'],
      qty: sqydNeeded,
      unit: 'sqyd',
      notes: `${totalSqFt} sqft = ${sqydNeeded} sqyd + 10% waste`,
    },
    {
      category: 'underlayment',
      name: 'Carpet Pad',
      searchTerms: ['carpet pad', 'carpet cushion', 'rebond pad'],
      qty: sqydNeeded,
      unit: 'sqyd',
      notes: 'Same coverage as carpet',
    },
    {
      category: 'hardware',
      name: 'Tack Strips',
      searchTerms: ['tack strip', 'carpet tack', 'gripper strip'],
      qty: Math.ceil(totalPerimeter / 4), // 4ft strips
      unit: 'ea',
      notes: `${totalPerimeter} linear ft around perimeter`,
    },
    {
      category: 'adhesive',
      name: 'Seam Tape',
      searchTerms: ['carpet seam tape', 'hot melt tape', 'seaming tape'],
      qty: Math.ceil(roomCount * 2), // ~2 seams per room average
      unit: 'roll',
      notes: 'For carpet seams',
    },
    {
      category: 'trim',
      name: 'Carpet Transitions',
      searchTerms: ['carpet transition', 'z-bar', 'carpet to tile'],
      qty: roomCount,
      unit: 'ea',
      notes: '1 per doorway',
    },
    {
      category: 'fasteners',
      name: 'Staples',
      searchTerms: ['staple', 'carpet staple', 'tacker staple'],
      qty: 1,
      unit: 'box',
      notes: 'For tack strips and pad',
    },
  ];
}
