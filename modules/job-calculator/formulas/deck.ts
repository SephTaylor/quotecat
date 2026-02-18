// modules/job-calculator/formulas/deck.ts
// Material calculation formulas for deck construction

import type { DeckInputs, MaterialRequirement } from '../types';

/**
 * Calculate all materials needed for a deck based on user inputs.
 *
 * Formulas are based on standard deck construction practices:
 * - Posts: 1 per 6ft of perimeter + interior supports (1 per 64 sqft)
 * - Joists: Based on sqft and spacing (16" OC = ~10 sqft per joist, 12" OC = ~8 sqft)
 * - Deck boards: sqft / board coverage + 10% waste
 * - Fasteners: ~4 screws per sqft
 * - Joist hangers: 2 per joist (each end)
 */
export function calculateDeckMaterials(inputs: DeckInputs): MaterialRequirement[] {
  const {
    totalSqFt,
    totalPerimeter,
    heightFt,
    hasStairs,
    hasRailing,
    joistSpacing,
    boardType,
  } = inputs;

  // Calculate derived quantities
  const postCount = Math.ceil(totalPerimeter / 6) + Math.ceil(totalSqFt / 64);
  const joistCount = Math.ceil(totalSqFt / (joistSpacing === 16 ? 10 : 8));

  // Board coverage: 5.5" wide x 12ft long = ~5.5 sqft per board
  const deckBoardCount = Math.ceil((totalSqFt / 5.5) * 1.1); // 10% waste factor

  // Screws: ~4 per sqft, sold in boxes of 1000
  const screwBoxes = Math.ceil((totalSqFt * 4) / 1000);

  // Joist hangers: 2 per joist
  const joistHangerCount = joistCount * 2;

  // Concrete: 0.5 bags per post (for footings)
  const concreteBags = Math.ceil(postCount * 0.5);

  const materials: MaterialRequirement[] = [
    // Structural posts
    {
      category: 'posts',
      name: '4x4 Treated Posts',
      searchTerms: ['4x4x10 pressure treated', '4 in x 4 in x 10 ft treated', '4x4 post lumber'],
      qty: postCount,
      unit: 'ea',
      notes: `${heightFt}ft deck height - order ${heightFt + 2}ft posts for burial`,
    },

    // Joists
    {
      category: 'joists',
      name: '2x8 Treated Joists',
      searchTerms: ['2-in x 8-in pressure treated', '2 in x 8 in treated lumber', 'pressure treated lumber 2x8'],
      qty: joistCount,
      unit: 'ea',
      notes: `${joistSpacing}" on center spacing`,
    },

    // Ledger board (attaches to house)
    {
      category: 'ledger',
      name: '2x10 Treated Ledger',
      searchTerms: ['2-in x 10-in pressure treated', '2 in x 10 in treated lumber', 'pressure treated lumber 2x10'],
      qty: Math.ceil(totalPerimeter / 4 / 12), // Approximate ledger length in 12ft boards
      unit: 'ea',
      notes: 'Ledger board against house',
    },

    // Rim joists / band boards
    {
      category: 'rim_joists',
      name: '2x8 Rim Joists',
      searchTerms: ['2-in x 8-in pressure treated', '2 in x 8 in treated lumber', 'pressure treated lumber 2x8'],
      qty: Math.ceil(totalPerimeter / 12), // Perimeter in 12ft boards
      unit: 'ea',
      notes: 'Perimeter framing',
    },

    // Deck boards (depends on material choice)
    {
      category: 'deck_boards',
      name: boardType === 'composite' ? 'Composite Deck Boards' : '2x6 Treated Deck Boards',
      searchTerms: boardType === 'composite'
        ? ['composite deck board', 'trex deck', 'composite decking']
        : ['2x6 treated deck', '2x6 pressure treated', 'deck board treated'],
      qty: deckBoardCount,
      unit: 'ea',
      notes: `${boardType === 'composite' ? 'Composite' : 'Pressure treated'} - includes 10% waste`,
    },

    // Screws
    {
      category: 'fasteners',
      name: boardType === 'composite' ? 'Composite Deck Screws' : 'Deck Screws',
      searchTerms: boardType === 'composite'
        ? ['composite deck screw', 'hidden deck fastener', 'trex screw']
        : ['deck screws', 'exterior deck screw', '#8 deck screw'],
      qty: screwBoxes,
      unit: 'box',
      notes: '~4 screws per sqft',
    },

    // Joist hangers
    {
      category: 'hardware',
      name: '2x8 Joist Hangers',
      searchTerms: ['joist hanger 2 x 8', 'joist hanger steel', '2x8 joist hanger'],
      qty: joistHangerCount,
      unit: 'ea',
      notes: '2 hangers per joist',
    },

    // Joist hanger nails
    {
      category: 'hardware',
      name: 'Joist Hanger Nails',
      searchTerms: ['joist hanger nail galvanized', '10D joist hanger', '1-1/2 joist hanger nail'],
      qty: Math.ceil(joistHangerCount * 10 / 50), // ~10 nails per hanger, boxes of 50
      unit: 'box',
      notes: '~10 nails per hanger',
    },

    // Lag bolts for ledger
    {
      category: 'hardware',
      name: '1/2" x 4" Lag Bolts',
      searchTerms: ['1/2 x 4 lag screw', 'lag bolt 1/2', 'ledger lag bolt'],
      qty: Math.ceil(totalPerimeter / 4 / 16) * 2, // Every 16" along ledger
      unit: 'ea',
      notes: 'For ledger attachment',
    },

    // Concrete for post footings
    {
      category: 'concrete',
      name: 'Concrete Mix 60lb',
      searchTerms: ['quikrete 60 lb', 'sakrete 60 lb', 'concrete mix 60'],
      qty: concreteBags,
      unit: 'bag',
      notes: '~0.5 bags per post footing',
    },
  ];

  // Conditional: Stairs
  if (hasStairs) {
    const stepsNeeded = Math.ceil((heightFt * 12) / 7.5); // 7.5" rise per step

    materials.push(
      {
        category: 'stringers',
        name: 'Stair Stringers',
        searchTerms: ['stair stringer', 'deck stair stringer', 'pre-cut stringer'],
        qty: 3, // Standard 3 stringers for residential stairs
        unit: 'ea',
        notes: `${stepsNeeded} steps needed`,
      },
      {
        category: 'treads',
        name: '2x10 Stair Treads',
        searchTerms: ['2x10 pressure treated', '2 in x 10 in treated', '2x10 lumber treated'],
        qty: stepsNeeded * 2, // 2 boards per tread (typical 36" wide stairs)
        unit: 'ea',
        notes: `${stepsNeeded} steps × 2 boards each`,
      },
      {
        category: 'hardware',
        name: 'Stair Stringer Brackets',
        searchTerms: ['stringer bracket', 'stair bracket', 'simpson stair'],
        qty: 3,
        unit: 'ea',
        notes: 'For attaching stringers to deck frame',
      }
    );
  }

  // Conditional: Railing
  if (hasRailing) {
    const railingPostCount = Math.ceil(totalPerimeter / 6); // Post every 6ft
    const railLength = totalPerimeter; // Total linear feet of rail
    // Balusters: 4" max gap per code, but baluster + gap ≈ 5-6" on center
    const balusterCount = Math.ceil(totalPerimeter * 2); // ~2 balusters per linear foot

    materials.push(
      {
        category: 'railing_posts',
        name: '4x4 Railing Posts',
        searchTerms: ['4x4x8 pressure treated', '4 in x 4 in x 8 ft treated', '4x4 post treated'],
        qty: railingPostCount,
        unit: 'ea',
        notes: 'Posts every 6ft around perimeter',
      },
      {
        category: 'rails',
        name: '2x4 Top Rail',
        searchTerms: ['2x4x8 pressure treated', '2 in x 4 in x 8 ft treated', '2x4 lumber treated'],
        qty: Math.ceil(railLength / 8), // 8ft boards
        unit: 'ea',
        notes: 'Top rail - 8ft boards',
      },
      {
        category: 'rails',
        name: '2x4 Bottom Rail',
        searchTerms: ['2x4x8 pressure treated', '2 in x 4 in x 8 ft treated', '2x4 lumber treated'],
        qty: Math.ceil(railLength / 8),
        unit: 'ea',
        notes: 'Bottom rail - 8ft boards',
      },
      {
        category: 'balusters',
        name: 'Deck Balusters',
        searchTerms: ['pressure-treated baluster', 'wood square end baluster', 'pine baluster'],
        qty: balusterCount,
        unit: 'ea',
        notes: '~4" spacing per code',
      },
      {
        category: 'hardware',
        name: 'Post Anchors',
        searchTerms: ['4 x 4 post anchor', '4 x 4 post base', 'post anchor steel'],
        qty: railingPostCount,
        unit: 'ea',
        notes: 'For securing railing posts',
      }
    );
  }

  return materials;
}
