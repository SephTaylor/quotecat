// modules/assemblies/useAssemblyCalculator.ts
import { useCallback, useMemo, useState } from "react";
import { expandAssembly } from "./expand";
import type {
  Assembly,
  AssemblyVarBag,
  PricedLine,
  ProductIndex,
} from "./types";

type UseAssemblyCalculatorProps = {
  assembly: Assembly;
  products: ProductIndex;
};

/**
 * Hook for calculating assembly line items based on variables.
 * Provides state management for variables and computed pricing.
 */
export function useAssemblyCalculator({
  assembly,
  products,
}: UseAssemblyCalculatorProps) {
  const [vars, setVars] = useState<AssemblyVarBag>(assembly.defaults || {});

  // Compute priced lines whenever vars change
  const lines: PricedLine[] = useMemo(
    () => expandAssembly(assembly, products, vars),
    [assembly, products, vars],
  );

  // Calculate totals
  const materialTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
    [lines],
  );

  // Update a single variable
  const updateVar = useCallback(
    (key: string, value: number | string | boolean) => {
      setVars((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Reset to defaults
  const resetVars = useCallback(() => {
    setVars(assembly.defaults || {});
  }, [assembly.defaults]);

  return {
    vars,
    setVars,
    updateVar,
    resetVars,
    lines,
    materialTotal,
  };
}
