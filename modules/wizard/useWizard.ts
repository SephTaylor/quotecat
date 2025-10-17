// modules/wizard/useWizard.ts
import { useCallback, useMemo, useState } from "react";
import type { WizardStep } from "./types";

type UseWizardResult<TState> = {
  /** Current step ID */
  step: string;
  /** Current step index (0-based) */
  stepIndex: number;
  /** Current step title for display */
  stepTitle: string;
  /** Whether the current step can proceed to next */
  canNext: boolean;
  /** Wizard state object */
  state: TState;
  /** Update wizard state */
  setState: (state: TState) => void;
  /** Go to previous step */
  back: () => void;
  /** Go to next step (or finish if on last step) */
  next: () => void;
  /** Check if on first step */
  isFirstStep: boolean;
  /** Check if on last step */
  isLastStep: boolean;
};

/**
 * Multi-step wizard state management hook.
 * Handles step navigation, validation, and state persistence.
 */
export function useWizard<TState>(
  steps: WizardStep<TState>[],
  initialState: TState,
  initialStep?: string,
): UseWizardResult<TState> {
  const [step, setStep] = useState<string>(initialStep ?? steps[0]?.id ?? "");
  const [state, setState] = useState<TState>(initialState);

  const stepIndex = useMemo(
    () => steps.findIndex((s) => s.id === step),
    [steps, step],
  );

  const currentStep = steps[stepIndex];
  const stepTitle = currentStep?.title ?? "";

  const canNext = useMemo(() => {
    if (!currentStep?.validate) return true;
    const error = currentStep.validate(state);
    return !error; // Can proceed if no error message
  }, [currentStep, state]);

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  const back = useCallback(() => {
    if (stepIndex > 0) {
      setStep(steps[stepIndex - 1].id);
    }
  }, [stepIndex, steps]);

  const next = useCallback(() => {
    if (!canNext) return;
    if (stepIndex < steps.length - 1) {
      setStep(steps[stepIndex + 1].id);
    }
    // If on last step, caller handles finish logic
  }, [canNext, stepIndex, steps]);

  return {
    step,
    stepIndex,
    stepTitle,
    canNext,
    state,
    setState,
    back,
    next,
    isFirstStep,
    isLastStep,
  };
}
