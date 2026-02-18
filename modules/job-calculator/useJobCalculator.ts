// modules/job-calculator/useJobCalculator.ts
// React hook for managing job calculator state and flow

import { useState, useCallback } from 'react';
import type {
  JobType,
  JobInputs,
  MaterialWithProducts,
  JobCalculation,
} from './types';
import { getDefaultInputs, getJobTypeConfig } from './types';
import { calculateMaterials } from './formulas';
import {
  matchProductsToMaterials,
  calculateTotalCost,
  selectProduct as selectProductHelper,
  updateQuantity as updateQuantityHelper,
} from './searchProducts';

export type CalculatorStep = 'select-type' | 'input' | 'calculating' | 'results';

// Simplified input type for state management
type InputValues = Record<string, number | boolean | string>;

interface UseJobCalculatorState {
  step: CalculatorStep;
  jobType: JobType | null;
  inputs: InputValues;
  materials: MaterialWithProducts[];
  totalCost: number;
  isCalculating: boolean;
  error: string | null;
}

interface UseJobCalculatorReturn extends UseJobCalculatorState {
  // Actions
  selectJobType: (type: JobType) => void;
  updateInput: (key: string, value: number | boolean | string) => void;
  calculate: () => Promise<void>;
  selectProduct: (category: string, name: string, productId: string) => void;
  updateMaterialQty: (category: string, name: string, qty: number) => void;
  reset: () => void;
  goBack: () => void;
}

const initialState: UseJobCalculatorState = {
  step: 'select-type',
  jobType: null,
  inputs: {},
  materials: [],
  totalCost: 0,
  isCalculating: false,
  error: null,
};

export function useJobCalculator(): UseJobCalculatorReturn {
  const [state, setState] = useState<UseJobCalculatorState>(initialState);

  /**
   * Select a job type and move to input step.
   */
  const selectJobType = useCallback((type: JobType) => {
    const defaults = getDefaultInputs(type);
    setState((prev) => ({
      ...prev,
      step: 'input' as CalculatorStep,
      jobType: type,
      inputs: defaults as unknown as InputValues,
      materials: [],
      totalCost: 0,
      error: null,
    }));
  }, []);

  /**
   * Update an input field value.
   */
  const updateInput = useCallback(
    (key: string, value: number | boolean | string) => {
      setState((prev) => ({
        ...prev,
        inputs: { ...prev.inputs, [key]: value },
      }));
    },
    []
  );

  /**
   * Calculate materials and match to products.
   */
  const calculate = useCallback(async () => {
    if (!state.jobType) return;

    setState((prev) => ({
      ...prev,
      step: 'calculating',
      isCalculating: true,
      error: null,
    }));

    try {
      // Validate required inputs
      const config = getJobTypeConfig(state.jobType);
      if (!config) {
        throw new Error('Invalid job type');
      }

      // Check that required numeric fields are > 0
      const inputs = state.inputs;
      for (const field of config.inputs) {
        if (field.type === 'number' && field.min !== undefined) {
          const value = inputs[field.key] as number;
          if (value < field.min) {
            throw new Error(`${field.label} must be at least ${field.min}`);
          }
        }
      }

      // Calculate material requirements
      const requirements = calculateMaterials(
        state.jobType,
        inputs as unknown as JobInputs[typeof state.jobType]
      );

      // Match requirements to products
      const materialsWithProducts = await matchProductsToMaterials(requirements);

      // Calculate total cost
      const total = calculateTotalCost(materialsWithProducts);

      setState((prev) => ({
        ...prev,
        step: 'results',
        materials: materialsWithProducts,
        totalCost: total,
        isCalculating: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        step: 'input',
        isCalculating: false,
        error: err instanceof Error ? err.message : 'Calculation failed',
      }));
    }
  }, [state.jobType, state.inputs]);

  /**
   * Select a different product for a material.
   */
  const selectProduct = useCallback(
    (category: string, name: string, productId: string) => {
      setState((prev) => {
        const updatedMaterials = selectProductHelper(
          prev.materials,
          category,
          name,
          productId
        );
        return {
          ...prev,
          materials: updatedMaterials,
          totalCost: calculateTotalCost(updatedMaterials),
        };
      });
    },
    []
  );

  /**
   * Update quantity for a material.
   */
  const updateMaterialQty = useCallback(
    (category: string, name: string, qty: number) => {
      setState((prev) => {
        const updatedMaterials = updateQuantityHelper(
          prev.materials,
          category,
          name,
          qty
        );
        return {
          ...prev,
          materials: updatedMaterials,
          totalCost: calculateTotalCost(updatedMaterials),
        };
      });
    },
    []
  );

  /**
   * Reset to initial state.
   */
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Go back one step.
   */
  const goBack = useCallback(() => {
    setState((prev) => {
      switch (prev.step) {
        case 'input':
          return initialState;
        case 'results':
          return { ...prev, step: 'input', materials: [], totalCost: 0 };
        default:
          return prev;
      }
    });
  }, []);

  return {
    ...state,
    selectJobType,
    updateInput,
    calculate,
    selectProduct,
    updateMaterialQty,
    reset,
    goBack,
  };
}

/**
 * Create a JobCalculation record from current state.
 * Useful for saving or creating a quote.
 */
export function createJobCalculation(
  jobType: JobType,
  inputs: JobInputs[JobType],
  materials: MaterialWithProducts[],
  totalCost: number
): JobCalculation {
  return {
    jobType,
    inputs,
    materials,
    totalCost,
    createdAt: new Date().toISOString(),
  };
}
