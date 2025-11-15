/**
 * Category Mapping Tool for Xbyte Product Data
 *
 * Maps retailer categories (Home Depot, Lowe's, Menards) to QuoteCat categories
 */

export type QuoteCatCategory =
  | 'framing'
  | 'fasteners'
  | 'drywall'
  | 'electrical'
  | 'plumbing'
  | 'roofing'
  | 'masonry'
  | 'insulation'
  | 'painting'
  | 'sealants'
  | 'flooring';

interface CategoryMapping {
  category: QuoteCatCategory;
  keywords: string[];
  priority: number; // Higher priority = check first (for overlapping keywords)
}

/**
 * Category mapping configuration
 * Keywords are checked in order of priority (highest first)
 */
const CATEGORY_MAPPINGS: CategoryMapping[] = [
  // Priority 1: Very specific categories (check first to avoid misclassification)
  {
    category: 'drywall',
    keywords: ['drywall', 'gypsum', 'joint compound', 'sheetrock', 'corner bead'],
    priority: 10
  },
  {
    category: 'roofing',
    keywords: ['roofing', 'shingles', 'underlayment', 'flashing', 'roof panel', 'roof coating', 'low-slope roofing'],
    priority: 10
  },
  {
    category: 'masonry',
    keywords: ['masonry', 'concrete', 'brick', 'block', 'cinder block', 'cement', 'mortar', 'bagged concrete'],
    priority: 10
  },

  // Priority 2: Medium specificity
  {
    category: 'electrical',
    keywords: ['electrical', 'wire', 'cable', 'conduit', 'outlets', 'switches', 'thhn', 'primary wire', 'conduit fitting'],
    priority: 8
  },
  {
    category: 'plumbing',
    keywords: ['plumbing', 'pipe', 'pex', 'copper', 'fittings', 'valves', 'ballcock', 'supply line', 'toilet'],
    priority: 8
  },
  {
    category: 'insulation',
    keywords: ['insulation', 'foam board', 'batt insulation', 'spray foam insulation', 'fiberglass insulation', 'radiant barrier'],
    priority: 8
  },
  {
    category: 'painting',
    keywords: ['paint', 'stain', 'primer', 'polyurethane', 'polycrylic', 'sandpaper', 'sanding'],
    priority: 7
  },
  {
    category: 'sealants',
    keywords: ['sealant', 'caulk', 'adhesive', 'glue', 'tape', 'duct tape', 'flex seal', 'spray foam & rubberized sealant'],
    priority: 7
  },
  {
    category: 'flooring',
    keywords: ['carpet', 'flooring', 'hardwood flooring', 'tile', 'accent & trim tile'],
    priority: 7
  },

  // Priority 3: Broad categories (check last)
  {
    category: 'framing',
    keywords: ['lumber', 'framing', 'studs', 'dimensional lumber', 'structural', 'timber', 'boards', 'plywood', 'osb', 'sheathing', 'appearance boards'],
    priority: 5
  },
  {
    category: 'fasteners',
    keywords: ['nails', 'screws', 'bolts', 'anchors', 'fasteners', 'connectors', 'brads', 'staples', 'sheet metal screws', 'deck screws', 'hollow wall anchors'],
    priority: 5
  }
];

/**
 * Maps a retailer category string to a QuoteCat category
 *
 * @param retailerCategory - Full category path from retailer (e.g., "Building Materials | Drywall | Joint Compound")
 * @returns QuoteCat category or null if no match
 *
 * @example
 * ```ts
 * mapCategory("Building Materials | Drywall | Joint Compound") // Returns: "drywall"
 * mapCategory("Electrical | Wire | THHN Wires") // Returns: "electrical"
 * mapCategory("Kitchen | Appliances") // Returns: null (not construction)
 * ```
 */
export function mapCategory(retailerCategory: string): QuoteCatCategory | null {
  if (!retailerCategory) return null;

  const lowerCategory = retailerCategory.toLowerCase();

  // Sort by priority (highest first)
  const sortedMappings = [...CATEGORY_MAPPINGS].sort((a, b) => b.priority - a.priority);

  // Find first matching category
  for (const mapping of sortedMappings) {
    for (const keyword of mapping.keywords) {
      if (lowerCategory.includes(keyword.toLowerCase())) {
        return mapping.category;
      }
    }
  }

  return null; // No match found
}

/**
 * Batch map multiple products
 * Returns products with added quotecatCategory field
 */
export function mapProducts<T extends { Category?: string }>(
  products: T[]
): Array<T & { quotecatCategory: QuoteCatCategory | null }> {
  return products.map(product => ({
    ...product,
    quotecatCategory: mapCategory(product.Category || '')
  }));
}

/**
 * Get mapping statistics for a set of products
 */
export function getMappingStats(products: Array<{ Category?: string }>) {
  const mapped = new Map<QuoteCatCategory, number>();
  let unmapped = 0;

  products.forEach(product => {
    const category = mapCategory(product.Category || '');
    if (category) {
      mapped.set(category, (mapped.get(category) || 0) + 1);
    } else {
      unmapped++;
    }
  });

  const total = products.length;
  const mappedCount = total - unmapped;
  const mappedPercentage = ((mappedCount / total) * 100).toFixed(1);

  return {
    total,
    mapped: mappedCount,
    unmapped,
    mappedPercentage: parseFloat(mappedPercentage),
    byCategory: Object.fromEntries(mapped)
  };
}

/**
 * Get unmapped products for review
 */
export function getUnmappedProducts<T extends { Category?: string; 'Product Name'?: string }>(
  products: T[]
): T[] {
  return products.filter(product => !mapCategory(product.Category || ''));
}

/**
 * Display name for QuoteCat categories
 */
export const CATEGORY_DISPLAY_NAMES: Record<QuoteCatCategory, string> = {
  framing: 'Framing',
  fasteners: 'Fasteners',
  drywall: 'Drywall',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  roofing: 'Roofing',
  masonry: 'Masonry',
  insulation: 'Insulation',
  painting: 'Painting',
  sealants: 'Sealants',
  flooring: 'Flooring'
};

/**
 * Get all available QuoteCat categories
 */
export function getAllCategories(): QuoteCatCategory[] {
  return Object.keys(CATEGORY_DISPLAY_NAMES) as QuoteCatCategory[];
}
