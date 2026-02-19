// modules/job-calculator/formulas/framing.ts
// Material calculation formulas for wall framing

import type { FramingInputs, MaterialRequirement } from '../types';

/**
 * Calculate all materials needed for wall framing based on user inputs.
 *
 * Standard framing assumptions:
 * - Studs: 16" on center (1.5 studs per linear foot + extras for corners/intersections)
 * - Plates: 3 plates per wall (2 bottom plates, 1 top plate OR 1 bottom, 2 top)
 * - Headers: For door/window openings, sized by opening width
 * - Exterior walls need sheathing and house wrap
 */
export function calculateFramingMaterials(inputs: FramingInputs): MaterialRequirement[] {
  const { totalLinearFt, heightFt, openingCount, avgOpeningWidthFt, isExterior } = inputs;

  // Studs: 16" OC = 0.75 studs per foot, plus corners and extras
  // Standard formula: (linear feet × 0.75) + (corners × 2) + openings × 2
  const baseStudCount = Math.ceil(totalLinearFt * 0.75);
  const cornerStuds = 4; // Assume 4 corners typical
  const openingStuds = openingCount * 2; // King + trimmer studs per opening
  const totalStuds = baseStudCount + cornerStuds + openingStuds;

  // Determine stud length based on wall height
  const studLength = heightFt <= 8 ? 8 : heightFt <= 9 ? 9 : 10;

  // Plates: 3 plates per wall length (bottom + double top OR double bottom + top)
  const plateCount = Math.ceil((totalLinearFt * 3) / 8); // 8ft boards

  // Headers: sized by opening span - 2 boards per opening (sandwiched with plywood for exterior)
  const headerCount = openingCount * 2;

  // Determine header lumber size based on wall type and opening width
  // Exterior (load-bearing): ≤4ft → 2x8, 5-6ft → 2x10, 7ft+ → 2x12
  // Interior (partition): doubled 2x4 flat is sufficient
  const openingWidth = avgOpeningWidthFt || 3;
  let headerSize: string;
  let headerDimension: string;
  let headerSearchTerms: string[];

  if (isExterior) {
    // Load-bearing exterior walls need properly sized headers
    headerSize = openingWidth <= 4 ? '2x8' : openingWidth <= 6 ? '2x10' : '2x12';
    headerDimension = openingWidth <= 4 ? '8' : openingWidth <= 6 ? '10' : '12';
    headerSearchTerms = [
      `2 in. x ${headerDimension} in. x 8 ft. Premium Grade Fir`,
      `2 in. x ${headerDimension} in. x 10 ft. Premium Grade`,
    ];
  } else {
    // Interior partition walls just need doubled 2x4
    headerSize = '2x4';
    headerDimension = '4';
    headerSearchTerms = ['2 in. x 4 in. x 8 ft. lumber', '2 in. x 4 in. SPF Dimensional'];
  }

  // Plywood/OSB sheathing for exterior walls
  const sheathingSheets = isExterior ? Math.ceil((totalLinearFt * heightFt) / 32) : 0; // 4x8 = 32 sqft

  const materials: MaterialRequirement[] = [
    // Studs
    {
      category: 'studs',
      name: `2x4x${studLength} Studs`,
      searchTerms: [`2 in. x 4 in. x ${studLength} ft. lumber`, '2 in. x 4 in. SPF Dimensional'],
      qty: totalStuds,
      unit: 'ea',
      notes: `${heightFt}ft walls, 16" OC spacing`,
    },

    // Top and bottom plates
    {
      category: 'plates',
      name: '2x4x8 Plates',
      searchTerms: ['2 in. x 4 in. x 8 ft. lumber', '2 in. x 4 in. SPF Dimensional'],
      qty: plateCount,
      unit: 'ea',
      notes: '3 plates per wall (top + bottom)',
    },
  ];

  // Headers for openings
  if (openingCount > 0) {
    materials.push({
      category: 'headers',
      name: `${headerSize} Lumber (for headers)`,
      searchTerms: headerSearchTerms,
      qty: headerCount,
      unit: 'ea',
      notes: isExterior
        ? `${openingCount} openings @ ~${openingWidth}ft wide × 2 boards each`
        : `${openingCount} openings × doubled 2x4 (partition wall)`,
    });

    // Plywood spacer only needed for built-up headers on exterior/load-bearing walls
    if (isExterior) {
      materials.push({
        category: 'headers',
        name: '1/2" Plywood (header spacer)',
        searchTerms: ['1/2 in. x 2 ft. x 4 ft. BCX Sanded Plywood', '1/2 in. x 2 ft. x 4 ft. Sande Plywood'],
        qty: Math.ceil(openingCount / 4), // 1 sheet makes ~4 header spacers
        unit: 'sheet',
        notes: 'Cut strips to sandwich between 2x lumber',
      });
    }
  }

  // Common hardware
  materials.push(
    {
      category: 'fasteners',
      name: 'Framing Nails 3"',
      searchTerms: ['3 in. Common Nails lb', '16d Common Nail lb'],
      qty: Math.ceil((totalStuds * 6) / 1000), // ~6 nails per stud, boxes of 1000
      unit: 'box',
      notes: '~6 nails per stud connection',
    },
    {
      category: 'hardware',
      name: 'Nail Plates',
      searchTerms: ['Steel Nail Plate', 'Tie Plate G90'],
      qty: Math.ceil(totalLinearFt / 4), // Every 4ft for code compliance
      unit: 'ea',
      notes: 'For protecting wiring/plumbing',
    }
  );

  // Exterior wall materials
  if (isExterior) {
    materials.push(
      {
        category: 'sheathing',
        name: '7/16" OSB Sheathing',
        searchTerms: ['7/16-in x 4-ft x 8-ft OSB Sheathing', '7/16 in. x 4 ft. x 8 ft. OSB'],
        qty: sheathingSheets,
        unit: 'sheet',
        notes: `${Math.ceil(totalLinearFt * heightFt)} sqft of wall area`,
      },
      {
        category: 'wrap',
        name: 'House Wrap',
        searchTerms: ['house wrap', 'tyvek', 'weather barrier'],
        qty: Math.ceil((totalLinearFt * heightFt) / 150), // Rolls cover ~150 sqft
        unit: 'roll',
        notes: 'Weather resistant barrier',
      },
      {
        category: 'fasteners',
        name: 'Sheathing Nails 2-1/2"',
        searchTerms: ['8D Hot-Dipped Galvanized Siding Nail', '8D Ring Shank Siding Nail'],
        qty: Math.ceil(sheathingSheets * 50 / 1000), // ~50 nails per sheet
        unit: 'box',
        notes: '~50 nails per 4x8 sheet',
      },
      {
        category: 'tape',
        name: 'Seam Tape',
        searchTerms: ['Housewrap Tape', 'Super Stick Building Tape'],
        qty: Math.ceil(totalLinearFt / 50), // 1 roll per ~50 linear ft
        unit: 'roll',
        notes: 'For sealing sheathing joints',
      }
    );
  }

  // Blocking for mid-height support (walls > 8ft)
  if (heightFt > 8) {
    const blockingCount = Math.ceil(totalLinearFt / 4); // Every 4ft
    materials.push({
      category: 'blocking',
      name: '2x4 Blocking',
      searchTerms: ['2 in. x 4 in. x 8 ft. lumber', '2 in. x 4 in. SPF'],
      qty: blockingCount,
      unit: 'ea',
      notes: 'Mid-height blocking for tall walls',
    });
  }

  return materials;
}
