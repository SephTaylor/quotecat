// modules/job-calculator/index.ts
// Job Calculator module exports

// Types
export type {
  JobType,
  DeckInputs,
  FlooringInputs,
  FramingInputs,
  JobInputs,
  MaterialRequirement,
  MatchedProduct,
  MaterialWithProducts,
  JobCalculation,
  InputFieldType,
  SelectOption,
  InputFieldConfig,
  JobTypeConfig,
} from './types';

export { JOB_TYPE_CONFIGS, getJobTypeConfig, getDefaultInputs } from './types';

// Formulas
export { calculateMaterials } from './formulas';
export { calculateDeckMaterials } from './formulas/deck';
export { calculateFlooringMaterials } from './formulas/flooring';
export { calculateFramingMaterials } from './formulas/framing';

// Product matching
export {
  matchProductsToMaterials,
  calculateTotalCost,
  selectProduct,
  updateQuantity,
  getUnmatchedMaterials,
  groupMaterialsByCategory,
} from './searchProducts';

// React hook
export { useJobCalculator, createJobCalculation } from './useJobCalculator';
export type { CalculatorStep } from './useJobCalculator';
