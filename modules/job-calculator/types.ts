// modules/job-calculator/types.ts
// Types and configurations for the Job Calculator feature

// =============================================================================
// JOB TYPES
// =============================================================================

export type JobType = 'deck' | 'flooring' | 'framing';

// =============================================================================
// INPUT TYPES PER JOB
// =============================================================================

export interface DeckInputs {
  totalSqFt: number;
  totalPerimeter: number;
  heightFt: number;
  hasStairs: boolean;
  hasRailing: boolean;
  joistSpacing: 12 | 16;
  boardType: 'treated' | 'composite';
}

export interface FlooringInputs {
  totalSqFt: number;
  totalPerimeter: number;
  roomCount: number;
  floorType: 'lvp' | 'hardwood' | 'tile' | 'carpet';
}

export interface FramingInputs {
  totalLinearFt: number;
  heightFt: number;
  openingCount: number;
  isExterior: boolean;
}

export type JobInputs = {
  deck: DeckInputs;
  flooring: FlooringInputs;
  framing: FramingInputs;
};

// =============================================================================
// MATERIAL REQUIREMENTS (OUTPUT FROM FORMULAS)
// =============================================================================

export interface MaterialRequirement {
  category: string;
  name: string;
  searchTerms: string[];
  qty: number;
  unit: string;
  notes?: string;
}

// =============================================================================
// MATCHED PRODUCTS (AFTER CATALOG SEARCH)
// =============================================================================

export interface MatchedProduct {
  id: string;
  name: string;
  unitPrice: number;
  unit: string;
  supplierId?: string;
}

export interface MaterialWithProducts {
  requirement: MaterialRequirement;
  products: MatchedProduct[];
  selectedProductId: string | null;
  selectedQty: number;
}

// =============================================================================
// JOB CALCULATION RESULT
// =============================================================================

export interface JobCalculation {
  jobType: JobType;
  inputs: JobInputs[JobType];
  materials: MaterialWithProducts[];
  totalCost: number;
  createdAt: string;
}

// =============================================================================
// UI CONFIGURATION
// =============================================================================

export type InputFieldType = 'number' | 'boolean' | 'select';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface InputFieldConfig {
  key: string;
  label: string;
  type: InputFieldType;
  unit?: string;
  placeholder?: string;
  options?: SelectOption[];
  defaultValue?: number | boolean | string;
  min?: number;
  max?: number;
}

export interface JobTypeConfig {
  id: JobType;
  title: string;
  description: string;
  icon: string;
  inputs: InputFieldConfig[];
  defaultValues: Record<string, number | boolean | string>;
}

// =============================================================================
// JOB TYPE CONFIGURATIONS
// =============================================================================

export const JOB_TYPE_CONFIGS: JobTypeConfig[] = [
  {
    id: 'deck',
    title: 'Deck',
    description: 'Calculate materials for a new deck or rebuild',
    icon: 'home-outline',
    inputs: [
      {
        key: 'totalSqFt',
        label: 'Total Square Footage',
        type: 'number',
        unit: 'sq ft',
        placeholder: '320',
        min: 10,
        max: 5000,
      },
      {
        key: 'totalPerimeter',
        label: 'Total Perimeter',
        type: 'number',
        unit: 'linear ft',
        placeholder: '80',
        min: 10,
        max: 1000,
      },
      {
        key: 'heightFt',
        label: 'Deck Height',
        type: 'number',
        unit: 'ft',
        placeholder: '3',
        min: 1,
        max: 20,
      },
      {
        key: 'joistSpacing',
        label: 'Joist Spacing',
        type: 'select',
        options: [
          { value: 16, label: '16" on center (standard)' },
          { value: 12, label: '12" on center (heavy duty)' },
        ],
      },
      {
        key: 'boardType',
        label: 'Deck Board Type',
        type: 'select',
        options: [
          { value: 'treated', label: 'Pressure Treated' },
          { value: 'composite', label: 'Composite' },
        ],
      },
      {
        key: 'hasRailing',
        label: 'Include Railing',
        type: 'boolean',
      },
      {
        key: 'hasStairs',
        label: 'Include Stairs',
        type: 'boolean',
      },
    ],
    defaultValues: {
      totalSqFt: 0,
      totalPerimeter: 0,
      heightFt: 3,
      joistSpacing: 16,
      boardType: 'treated',
      hasRailing: true,
      hasStairs: false,
    },
  },
  {
    id: 'flooring',
    title: 'Flooring',
    description: 'Calculate flooring materials for one or more rooms',
    icon: 'grid-outline',
    inputs: [
      {
        key: 'totalSqFt',
        label: 'Total Square Footage',
        type: 'number',
        unit: 'sq ft',
        placeholder: '500',
        min: 10,
        max: 10000,
      },
      {
        key: 'totalPerimeter',
        label: 'Total Perimeter',
        type: 'number',
        unit: 'linear ft',
        placeholder: '100',
        min: 10,
        max: 2000,
      },
      {
        key: 'roomCount',
        label: 'Number of Rooms',
        type: 'number',
        placeholder: '1',
        min: 1,
        max: 20,
      },
      {
        key: 'floorType',
        label: 'Flooring Type',
        type: 'select',
        options: [
          { value: 'lvp', label: 'Luxury Vinyl Plank' },
          { value: 'hardwood', label: 'Hardwood' },
          { value: 'tile', label: 'Tile' },
          { value: 'carpet', label: 'Carpet' },
        ],
      },
    ],
    defaultValues: {
      totalSqFt: 0,
      totalPerimeter: 0,
      roomCount: 1,
      floorType: 'lvp',
    },
  },
  {
    id: 'framing',
    title: 'Framing',
    description: 'Calculate framing materials for walls',
    icon: 'construct-outline',
    inputs: [
      {
        key: 'totalLinearFt',
        label: 'Total Wall Length',
        type: 'number',
        unit: 'linear ft',
        placeholder: '50',
        min: 4,
        max: 1000,
      },
      {
        key: 'heightFt',
        label: 'Wall Height',
        type: 'number',
        unit: 'ft',
        placeholder: '8',
        min: 7,
        max: 20,
      },
      {
        key: 'openingCount',
        label: 'Door/Window Openings',
        type: 'number',
        placeholder: '2',
        min: 0,
        max: 50,
      },
      {
        key: 'isExterior',
        label: 'Exterior Wall (needs sheathing)',
        type: 'boolean',
      },
    ],
    defaultValues: {
      totalLinearFt: 0,
      heightFt: 8,
      openingCount: 0,
      isExterior: false,
    },
  },
];

// =============================================================================
// HELPERS
// =============================================================================

export function getJobTypeConfig(jobType: JobType): JobTypeConfig | undefined {
  return JOB_TYPE_CONFIGS.find((config) => config.id === jobType);
}

export function getDefaultInputs<T extends JobType>(jobType: T): JobInputs[T] {
  const config = getJobTypeConfig(jobType);
  if (!config) {
    throw new Error(`Unknown job type: ${jobType}`);
  }
  return config.defaultValues as unknown as JobInputs[T];
}
