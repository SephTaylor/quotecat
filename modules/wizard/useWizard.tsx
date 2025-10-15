import { useCallback, useMemo, useState } from 'react';
import type { WizardStep } from './types';

export function useWizard<TState>({
  steps,
  initial,
  onFinish,
}: {
  steps: WizardStep<TState>[];
  initial: TState;
  onFinish: (state: TState) => void | Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [state, setStateFull] = useState<TState>(initial);
  const step = steps[index];

  const setState = useCallback((patch: Partial<TState>) => {
    setStateFull(prev => ({ ...prev, ...patch }));
  }, []);

  const canNext = useMemo(() => {
    if (!step?.validate) return true;
    return step.validate(state) == null;
  }, [step, state]);

  const goNext = useCallback(async () => {
    if (!canNext) return;
    if (index + 1 < steps.length) setIndex(i => i + 1);
    else await onFinish(state);
  }, [canNext, index, steps.length, state, onFinish]);

  const goBack = useCallback(() => {
    setIndex(i => Math.max(0, i - 1));
  }, []);

  return { step, index, steps, state, setState, goNext, goBack, canNext };
}
