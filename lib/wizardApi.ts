// lib/wizardApi.ts
// API client for the Quote Wizard (Drew) - calls Supabase Edge Function
// Supports both drew-agent (intelligent RAG agent) and wizard-chat (state machine)

import { supabase } from './supabase';

// =============================================================================
// FEATURE FLAG - Toggle between drew-agent and wizard-chat
// =============================================================================

// Set to true to use the new intelligent agent with tradecraft
// Set to false to use the legacy state machine
export const USE_DREW_AGENT = true;

// =============================================================================
// DREW-AGENT TYPES (intelligent agent with tradecraft)
// =============================================================================

interface Message {
  role: 'user' | 'assistant';
  content: string | unknown[];
}

interface QuoteItem {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  unit?: string;
}

// Checklist item for material category selection
export interface ChecklistItem {
  category: string;      // e.g., "main_panel", "wire", "grounding"
  name: string;          // Human-readable: "Main breaker panel"
  searchTerms: string[]; // Keywords for product search
  defaultQty: number;    // Suggested quantity
  unit: string;          // ea, ft, etc.
  required: boolean;     // Pre-checked if true
  notes?: string;        // Helper text
}

// Product group for grouped display
export interface ProductGroup {
  category: string;
  categoryName: string;
  products: WizardProduct[];
}

export interface DrewAgentState {
  messages: Message[];
  quoteItems: QuoteItem[];
  quoteName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  laborHours?: number;
  laborRate?: number;
  markupPercent?: number;
  tradecraftContext?: string;
  tradecraftJobType?: string;  // For checklist lookup
  pendingChecklist?: ChecklistItem[];  // Material checklist awaiting confirmation
  pendingProducts?: WizardProduct[];
  isComplete?: boolean;
}

export function createDrewAgentInitialState(): DrewAgentState {
  return {
    messages: [],
    quoteItems: [],
  };
}

// =============================================================================
// WIZARD-CHAT TYPES (legacy state machine - kept for fallback)
// =============================================================================

export interface WizardChatState {
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

export function createWizardChatInitialState(): WizardChatState {
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
// UNIFIED STATE TYPE - works with both backends
// =============================================================================

export type WizardState = DrewAgentState | WizardChatState;

export function createInitialState(): WizardState {
  return USE_DREW_AGENT ? createDrewAgentInitialState() : createWizardChatInitialState();
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
  retailer?: string;     // Lowe's, Home Depot, Menards, etc.
  source?: 'pricebook' | 'catalog';  // Where this product came from
  suggestedQty: number;  // Per-product qty based on sqft and product type
}

// Structured display data from wizard - UI renders this consistently
export interface WizardDisplay {
  type: 'products' | 'added' | 'review' | 'summary' | 'checklist';
  products?: WizardProduct[];          // Products to show for selection (each with suggestedQty)
  productGroups?: ProductGroup[];      // Products grouped by category
  checklist?: ChecklistItem[];         // Material checklist for user confirmation
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
 * Uses either drew-agent (intelligent RAG) or wizard-chat (state machine) based on USE_DREW_AGENT flag.
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
  if (USE_DREW_AGENT) {
    return sendDrewAgentMessage(userMessage, state as DrewAgentState, userDefaults);
  } else {
    return sendWizardChatMessage(userMessage, state as WizardChatState, userDefaults);
  }
}

/**
 * Send message to drew-agent (intelligent RAG agent with tradecraft)
 */
async function sendDrewAgentMessage(
  userMessage: string,
  state: DrewAgentState,
  userDefaults?: UserDefaults,
): Promise<WizardResponse> {
  console.log('[wizardApi] drew-agent: Sending message:', userMessage.substring(0, 30));

  const { data, error } = await supabase.functions.invoke('drew-agent', {
    body: {
      userMessage,
      state,
      userSettings: {
        defaultLaborRate: userDefaults?.defaultLaborRate,
        defaultMarkupPercent: userDefaults?.defaultMarkupPercent,
      },
    },
  });

  if (error) {
    console.error('[wizardApi] drew-agent error:', error);
    throw new Error(error.message || 'Failed to get response from Drew');
  }

  if (data?.error) {
    console.error('[wizardApi] drew-agent function error:', data.error);
    throw new Error(data.error);
  }

  console.log('[wizardApi] drew-agent response - Message:', data.message?.substring(0, 30), 'Display:', data.display?.type);

  return {
    message: data.message || '',
    display: data.display,
    quickReplies: data.quickReplies,
    toolCalls: data.toolCalls,
    state: data.state,
  };
}

/**
 * Send message to wizard-chat (legacy state machine)
 */
async function sendWizardChatMessage(
  userMessage: string,
  state: WizardChatState,
  userDefaults?: UserDefaults,
): Promise<WizardResponse> {
  console.log('[wizardApi] wizard-chat: Sending message:', userMessage.substring(0, 30), 'Phase:', state.phase);

  const { data, error } = await supabase.functions.invoke('wizard-chat', {
    body: {
      userMessage,
      state,
      userDefaults,
    },
  });

  if (error) {
    console.error('[wizardApi] wizard-chat error:', error);
    throw new Error(error.message || 'Failed to get response from Drew');
  }

  if (data?.error) {
    console.error('[wizardApi] wizard-chat function error:', data.error);
    throw new Error(data.error);
  }

  console.log('[wizardApi] wizard-chat response - Phase:', data.state?.phase, 'Message:', data.message?.substring(0, 30));

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
