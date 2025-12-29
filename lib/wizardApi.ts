// lib/wizardApi.ts
// API client for the Quote Wizard (Drew) - calls Supabase Edge Function
// Now supports server-side state machine for reliable conversation flow

import { supabase } from './supabase';

// =============================================================================
// STATE MACHINE TYPES (must match edge function)
// =============================================================================

export interface WizardState {
  phase: 'setup' | 'generating_checklist' | 'building' | 'review' | 'wrapup' | 'done';
  setupStep: number;
  projectType?: string;
  size?: string;
  scope?: string;
  finishes?: string;
  checklist: string[];
  checklistIndex: number;
  waitingForSelection: boolean;
  lastSearchResults?: Array<{ id: string; name: string; price: number }>;
  itemsAdded: Array<{ id: string; name: string; price: number; qty: number }>;
  reviewDone?: boolean;
  wrapupStep: number;
  laborHours?: number;
  laborRate?: number;
  markup?: number;
  quoteName?: string;
  clientName?: string;
}

export function createInitialState(): WizardState {
  return {
    phase: 'setup',
    setupStep: 0,
    checklist: [],
    checklistIndex: 0,
    waitingForSelection: false,
    itemsAdded: [],
    wrapupStep: 0,
  };
}

// =============================================================================
// LEGACY TYPES (kept for backward compatibility)
// =============================================================================

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
  | { type: 'showRemoveItem' }
  | { type: 'showEditQuantity' };

// Product displayed in selection list - each has its own suggested qty
export interface WizardProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
  suggestedQty: number;  // Per-product qty based on sqft and product type
}

// Structured display data from wizard - UI renders this consistently
export interface WizardDisplay {
  type: 'products' | 'added' | 'review';
  products?: WizardProduct[];          // Products to show for selection (each with suggestedQty)
  addedItems?: Array<{ name: string; qty: number }>;  // Items just added
  reviewNotes?: string;                // Review phase findings
  relatedItems?: string[];             // Related items they might need
}

// Structured response from wizard - UI renders this consistently
export type WizardResponse = {
  // Drew's personality message (from Claude)
  message: string;

  // What the UI should display
  display?: WizardDisplay;

  // Quick reply buttons
  quickReplies?: string[];

  // Tool calls to apply to draft quote
  toolCalls?: WizardTool[];

  // Updated state
  state?: WizardState;
};

// User defaults that can be passed to the wizard
export interface UserDefaults {
  defaultMarkupPercent?: number;
  defaultLaborRate?: number;
}

/**
 * Send a message to Drew (the Quote Wizard) and get a response.
 * Uses server-side state machine for reliable conversation flow.
 *
 * @param userMessage - The user's message text
 * @param state - Current wizard state (use createInitialState() for first message)
 * @param userDefaults - Optional user defaults (markup %, labor rate)
 */
export async function sendWizardMessage(
  userMessage: string,
  state: WizardState,
  userDefaults?: UserDefaults,
): Promise<WizardResponse> {
  console.log('[wizardApi] Sending message:', userMessage.substring(0, 30), 'Phase:', state.phase);

  const { data, error } = await supabase.functions.invoke('wizard-chat', {
    body: {
      userMessage,
      state,
      userDefaults,
    },
  });

  if (error) {
    console.error('[wizardApi] Error:', error);
    console.error('[wizardApi] Error context:', JSON.stringify(error.context || {}));
    throw new Error(error.message || 'Failed to get response from Drew');
  }

  if (data?.error) {
    console.error('[wizardApi] Edge function error:', data.error);
    console.error('[wizardApi] Stack:', data.stack);
    throw new Error(data.error);
  }

  console.log('[wizardApi] Response - Phase:', data.state?.phase, 'Message:', data.message?.substring(0, 30), 'Display:', data.display?.type);

  return {
    message: data.message || '',
    display: data.display,
    quickReplies: data.quickReplies,
    toolCalls: data.toolCalls,
    state: data.state,
  };
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
