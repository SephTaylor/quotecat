// lib/wizardApi.ts
// API client for the Quote Wizard (Drew) - calls Supabase Edge Function

import { supabase } from './supabase';

export type WizardMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type WizardTool =
  | { type: 'searchCatalog'; query: string; category?: string; limit?: number }
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
  // Limit conversation history to last 20 messages to avoid timeout
  const recentMessages = messages.slice(-20);

  console.log('[wizardApi] Sending', recentMessages.length, 'messages');

  const { data, error } = await supabase.functions.invoke('wizard-chat', {
    body: {
      messages: recentMessages,
      catalogContext,
    },
  });

  if (error) {
    console.error('[wizardApi] Error:', error);
    throw new Error(error.message || 'Failed to get response from Drew');
  }

  if (data?.error) {
    console.error('[wizardApi] Edge function error:', data.error);
    throw new Error(data.error);
  }

  // Handle different response formats from edge function
  const response: WizardResponse = {
    message: data?.message || '',
    toolCalls: data?.toolCalls?.map((tc: any) => {
      // The edge function returns: { type: 'searchCatalog', query: '...', ... }
      // But it might also have nested input/arguments from Claude's format
      const params = tc.input || tc.arguments || tc;
      return {
        type: tc.name || tc.type || params.type,
        ...params,
      };
    }),
    done: data?.done,
  };

  return response;
}

/**
 * Search products in the catalog.
 * Used by the wizard to find products on-demand instead of loading everything upfront.
 * Supports 30k+ products by searching locally.
 */
export function searchCatalog(
  products: Array<{ id: string; categoryId: string; name: string; unit: string; unitPrice: number }>,
  categories: Array<{ id: string; name: string }>,
  query: string,
  categoryFilter?: string,
  limit: number = 10,
): string {
  // Guard against undefined/null inputs
  if (!query) {
    return 'Search query is required.';
  }
  if (!products || products.length === 0) {
    return 'No products in catalog.';
  }
  if (!categories || categories.length === 0) {
    return 'No categories in catalog.';
  }

  const categoryMap = new Map(categories.map(c => [c.id, c.name?.toLowerCase() || '']));
  const categoryIdMap = new Map(categories.map(c => [c.name?.toLowerCase() || '', c.id]));

  const queryLower = query.toLowerCase();
  const categoryFilterLower = categoryFilter?.toLowerCase();

  // Find matching category ID if filter provided
  let filterCategoryId: string | undefined;
  if (categoryFilterLower) {
    // Try exact match first, then partial match
    filterCategoryId = categoryIdMap.get(categoryFilterLower);
    if (!filterCategoryId) {
      // Partial match - find first category containing the filter term
      for (const [catName, catId] of categoryIdMap) {
        if (catName.includes(categoryFilterLower) || categoryFilterLower.includes(catName)) {
          filterCategoryId = catId;
          break;
        }
      }
    }
  }

  // Search products
  const matches = products
    .filter(p => {
      // Category filter
      if (filterCategoryId && p.categoryId !== filterCategoryId) {
        return false;
      }
      // Text search - match query against product name
      return p.name?.toLowerCase().includes(queryLower) || false;
    })
    .slice(0, limit)
    .map(p => {
      const catName = categoryMap.get(p.categoryId) || 'Other';
      return `[${p.id}] ${p.name} - $${p.unitPrice}/${p.unit} (${catName})`;
    });

  if (matches.length === 0) {
    return `No "${query}" found${categoryFilter ? ` in ${categoryFilter}` : ''}`;
  }

  // Return clean format - Drew will present these nicely to the user
  const displayMatches = products
    .filter(p => {
      if (filterCategoryId && p.categoryId !== filterCategoryId) return false;
      return p.name?.toLowerCase().includes(queryLower) || false;
    })
    .slice(0, limit)
    .map(p => `• ${p.name} - $${p.unitPrice.toFixed(2)}/${p.unit} (ID: ${p.id})`);

  const count = displayMatches.length;
  const header = count === 1 ? '1 match' : `${count} matches`;
  return `${header}:\n${displayMatches.join('\n')}`;
}

/**
 * Get a condensed catalog context string for the system prompt.
 * This gives Drew knowledge of available products with their IDs.
 * Limited to ~200 products to keep context size manageable.
 *
 * @deprecated Use searchCatalog instead for large catalogs (30k+ products)
 */
export function buildCatalogContext(
  categories: Array<{ id: string; name: string }>,
  products: Array<{ id: string; categoryId: string; name: string; unit: string; unitPrice: number }>,
): string {
  const MAX_PRODUCTS_PER_CATEGORY = 25;
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  const productsByCategory = products.reduce((acc, p) => {
    const catName = categoryMap.get(p.categoryId) || 'Other';
    if (!acc[catName]) acc[catName] = [];
    // Limit products per category to keep context manageable
    if (acc[catName].length < MAX_PRODUCTS_PER_CATEGORY) {
      // Include product ID so Drew can reference it in addItem calls
      acc[catName].push(`[${p.id}] ${p.name} - $${p.unitPrice}/${p.unit}`);
    }
    return acc;
  }, {} as Record<string, string[]>);

  const result = Object.entries(productsByCategory)
    .map(([cat, prods]) => `## ${cat}\n${prods.join('\n')}`)
    .join('\n\n');

  console.log(`[wizardApi] Catalog context: ${Object.keys(productsByCategory).length} categories, limited to ${MAX_PRODUCTS_PER_CATEGORY} products each`);
  return result;
}
