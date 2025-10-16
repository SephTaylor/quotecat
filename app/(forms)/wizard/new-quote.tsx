// app/(forms)/wizard/new-quote.tsx
import { FormScreen } from '@/modules/core/ui';
import React from 'react';
import NewQuoteInner from './new-quote-inner';

/**
 * Wrapper route:
 * - Keeps the existing Wizard implementation intact (now in new-quote-inner.tsx)
 * - Provides consistent form chrome via <FormScreen>
 * - URL remains /wizard (index.tsx should re-export default from './new-quote')
 */
export default function WizardNewQuote() {
  return (
    <FormScreen
      // The wizard likely manages its own scrolling/layout,
      // so keep outer padding zero to avoid double spacing.
      scroll
      contentStyle={{ paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }}
    >
      <NewQuoteInner />
    </FormScreen>
  );
}
