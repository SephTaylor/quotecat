// modules/wizard/types.ts

// A single step in a wizard. Generic over your wizard's state.
export type WizardStep<TState = unknown> = {
  id: string;                                  // e.g. 'basics' | 'materials' | 'review'
  title: string;                                // UI label
  validate?: (state: TState) => string | null | undefined; // return a message to block "Next"
};
