// modules/job-calculator/formulas/index.ts
// Formula dispatcher for job calculations

import type { JobType, JobInputs, MaterialRequirement, DeckInputs, FlooringInputs, FramingInputs } from '../types';
import { calculateDeckMaterials } from './deck';
import { calculateFlooringMaterials } from './flooring';
import { calculateFramingMaterials } from './framing';

/**
 * Calculate materials for any job type.
 * Dispatches to the appropriate formula based on job type.
 */
export function calculateMaterials<T extends JobType>(
  jobType: T,
  inputs: JobInputs[T]
): MaterialRequirement[] {
  switch (jobType) {
    case 'deck':
      return calculateDeckMaterials(inputs as DeckInputs);
    case 'flooring':
      return calculateFlooringMaterials(inputs as FlooringInputs);
    case 'framing':
      return calculateFramingMaterials(inputs as FramingInputs);
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

// Re-export individual calculators for direct use
export { calculateDeckMaterials } from './deck';
export { calculateFlooringMaterials } from './flooring';
export { calculateFramingMaterials } from './framing';
