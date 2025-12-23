// lib/wizardApi.ts
// API client for the Quote Wizard (Drew) - calls Supabase Edge Function

import { supabase } from './supabase';

export type WizardMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type WizardTool =
  | { type: 'addItem'; productId: string; productName: string; qty: number; unitPrice: number }
  | { type: 'setLabor'; hours: number; rate: number }
  | { type: 'applyMarkup'; percent: number }
  | { type: 'setClientName'; name: string }
  | { type: 'setQuoteName'; name: string }
  | { type: 'suggestAssembly'; assemblyId: string; assemblyName: string };

export type WizardResponse = {
  message: string;
  toolCalls?: WizardTool[];
  done?: boolean; // True when wizard has finished building the quote
};

/**
 * Send a message to Drew (the Quote Wizard) and get a response.
 * This calls a Supabase Edge Function that wraps Claude API.
 */
export async function sendWizardMessage(
  messages: WizardMessage[],
  catalogContext?: string,
): Promise<WizardResponse> {
  const { data, error } = await supabase.functions.invoke('wizard-chat', {
    body: {
      messages,
      catalogContext,
    },
  });

  if (error) {
    console.error('[wizardApi] Error calling wizard-chat:', error);
    throw new Error(error.message || 'Failed to get response from Drew');
  }

  console.log('[wizardApi] Raw response:', JSON.stringify(data, null, 2));
  if (catalogContext) {
    console.log('[wizardApi] Full catalog context:\n', catalogContext);
  } else {
    console.log('[wizardApi] No catalog context sent');
  }

  // Handle different response formats from edge function
  const response: WizardResponse = {
    message: data?.message || '',
    toolCalls: data?.toolCalls?.map((tc: any) => ({
      type: tc.name || tc.type,
      ...(tc.input || tc.arguments || {}), // handle both input and arguments formats
    })),
    done: data?.done,
  };

  return response;
}

/**
 * Get a condensed catalog context string for the system prompt.
 * This gives Drew knowledge of available products.
 */
export function buildCatalogContext(
  categories: Array<{ id: string; name: string }>,
  products: Array<{ id: string; categoryId: string; name: string; unit: string; unitPrice: number }>,
): string {
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  const productsByCategory = products.reduce((acc, p) => {
    const catName = categoryMap.get(p.categoryId) || 'Other';
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(`${p.name} ($${p.unitPrice}/${p.unit})`);
    return acc;
  }, {} as Record<string, string[]>);

  return Object.entries(productsByCategory)
    .map(([cat, prods]) => `${cat}: ${prods.join(', ')}`)
    .join('\n');
}
