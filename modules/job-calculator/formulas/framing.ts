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
  const { totalLinearFt, heightFt, openingCount, isExterior } = inputs;

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

  // Headers: 2x10 or 2x12 depending on opening width, 2 per opening
  const headerCount = openingCount * 2;

  // Plywood/OSB sheathing for exterior walls
  const sheathingSheets = isExterior ? Math.ceil((totalLinearFt * heightFt) / 32) : 0; // 4x8 = 32 sqft

  const materials: MaterialRequirement[] = [
    // Studs
    {
      category: 'studs',
      name: `2x4x${studLength} Studs`,
      searchTerms: [`2x4x${studLength}`, '2x4 stud', '2x4 framing lumber'],
      qty: totalStuds,
      unit: 'ea',
      notes: `${heightFt}ft walls, 16" OC spacing`,
    },

    // Top and bottom plates
    {
      category: 'plates',
      name: '2x4x8 Plates',
      searchTerms: ['2x4x8', '2x4 lumber', '2x4 framing'],
      qty: plateCount,
      unit: 'ea',
      notes: '3 plates per wall (top + bottom)',
    },
  ];

  // Headers for openings
  if (openingCount > 0) {
    materials.push(
      {
        category: 'headers',
        name: '2x10 Headers',
        searchTerms: ['2x10', '2x10 lumber', 'header lumber'],
        qty: headerCount,
        unit: 'ea',
        notes: `${openingCount} openings × 2 boards each`,
      },
      {
        category: 'hardware',
        name: 'Header Hangers',
        searchTerms: ['header hanger', 'simpson hanger', 'HUS26'],
        qty: openingCount * 2,
        unit: 'ea',
        notes: '2 hangers per opening',
      }
    );
  }

  // Common hardware
  materials.push(
    {
      category: 'fasteners',
      name: 'Framing Nails 3"',
      searchTerms: ['framing nail', '16d nail', '3 inch nail'],
      qty: Math.ceil((totalStuds * 6) / 1000), // ~6 nails per stud, boxes of 1000
      unit: 'box',
      notes: '~6 nails per stud connection',
    },
    {
      category: 'hardware',
      name: 'Nail Plates',
      searchTerms: ['nail plate', 'mending plate', 'tie plate'],
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
        searchTerms: ['osb sheathing', '7/16 osb', 'wall sheathing'],
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
        name: 'Sheathing Nails 2"',
        searchTerms: ['sheathing nail', '8d nail', 'osb nail'],
        qty: Math.ceil(sheathingSheets * 50 / 1000), // ~50 nails per sheet
        unit: 'box',
        notes: '~50 nails per 4x8 sheet',
      },
      {
        category: 'tape',
        name: 'Seam Tape',
        searchTerms: ['house wrap tape', 'sheathing tape', 'tyvek tape'],
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
      searchTerms: ['2x4', '2x4 lumber', 'fire blocking'],
      qty: blockingCount,
      unit: 'ea',
      notes: 'Mid-height blocking for tall walls',
    });
  }

  return materials;
}
