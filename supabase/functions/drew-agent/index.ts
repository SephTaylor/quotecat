/**
 * Drew Agent - Agentic Quote Wizard
 *
 * An AI agent that uses tools to help contractors build quotes.
 * Uses RAG with tradecraft knowledge base for domain expertise.
 *
 * ARCHITECTURE (Drew 2.0):
 * - USE_STATE_MACHINE=true: State machine controls flow, Claude only for intelligence
 * - USE_STATE_MACHINE=false: Full Claude agent loop (legacy, expensive)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// State machine imports
import {
  dispatch as stateMachineDispatch,
  createInitialContext,
  type DrewState,
  type DrewContext,
  type DrewResponse as StateMachineResponse,
  type UserSettings as StateMachineSettings,
} from './state-machine-v2.ts';

// =============================================================================
// FEATURE FLAG - Toggle between state machine and full Claude agent
// =============================================================================

// Set to true to use the new state machine (Phase 1 of Drew 2.0)
// Set to false to use the legacy full Claude agent
const USE_STATE_MACHINE = true;

// =============================================================================
// ENVIRONMENT
// =============================================================================

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// =============================================================================
// TYPES
// =============================================================================

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface QuoteItem {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  unit?: string;
}

// UI Response Types - for rich product selection
interface WizardProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
  retailer?: string;
  source?: 'pricebook' | 'catalog';
  suggestedQty: number;
}

// Checklist item for material category selection
interface ChecklistItem {
  category: string;      // e.g., "main_panel", "wire", "grounding"
  name: string;          // Human-readable: "Main breaker panel"
  searchTerms: string[]; // Keywords for product search
  defaultQty: number;    // Suggested quantity
  unit: string;          // ea, ft, etc.
  required: boolean;     // Pre-checked if true
  notes?: string;        // Helper text
}

// Product group for grouped display
interface ProductGroup {
  category: string;
  categoryName: string;
  products: WizardProduct[];
}

interface WizardDisplay {
  type: 'products' | 'added' | 'summary' | 'checklist';
  products?: WizardProduct[];
  productGroups?: ProductGroup[];  // For grouped product display
  checklist?: ChecklistItem[];     // For checklist display
  addedItems?: Array<{ name: string; qty: number }>;
}

interface WizardTool {
  type: 'addItem' | 'setLabor' | 'applyMarkup' | 'setQuoteName' | 'setClientName';
  productId?: string;
  productName?: string;
  qty?: number;
  unitPrice?: number;
  hours?: number;
  rate?: number;
  percent?: number;
  name?: string;
}

interface ConversationState {
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
  // For material checklist UI
  pendingChecklist?: ChecklistItem[];
  // For product selection UI
  pendingProducts?: WizardProduct[];
  // Track if quote is complete
  isComplete?: boolean;

  // State machine fields (Drew 2.0)
  machineState?: DrewState;
  machineContext?: DrewContext;
}

interface UserSettings {
  defaultLaborRate?: number;
  defaultMarkupPercent?: number;
}

// Full response to client
interface AgentResponse {
  message: string;
  state: ConversationState;
  display?: WizardDisplay;
  quickReplies?: string[];
  toolCalls?: WizardTool[];
}

interface RequestBody {
  userMessage: string;
  state?: ConversationState;
  userSettings?: UserSettings;
}

// =============================================================================
// DREW'S SYSTEM PROMPT
// =============================================================================

const DREW_SYSTEM_PROMPT = `You are Drew, an expert construction estimating assistant built into the QuoteCat app. You help contractors build accurate, professional quotes.

## Your Personality
- You're a fellow tradesperson, not a computer
- Keep responses brief and practical (1-3 sentences max unless explaining materials)
- Use casual language: "Got it", "Nice", "Let's do this"
- Never say "Great question!" or "I'd be happy to help!"
- Be confident but not cocky

## Your Capabilities
You have access to tools that let you:
1. Search tradecraft knowledge for job-specific guidance
2. Look up real material prices from Lowe's/Home Depot
3. Build the quote by adding items
4. Get and confirm labor hours, rates, and markup
5. Finalize the quote when the user is done

## How You Work
1. When a user describes a job, FIRST search the tradecraft knowledge base to get expert guidance
2. Use the tradecraft doc to ask the RIGHT scoping questions in the RIGHT order
3. When you understand the scope, call propose_checklist to show the user what material CATEGORIES they need
4. Wait for the user to confirm the checklist (they can uncheck items they already have)
5. After checklist is confirmed, look up specific products for the confirmed categories
6. Confirm labor hours with the user (propose based on tradecraft, let them adjust)
7. Confirm markup percentage
8. When user says "review quote" or similar, call get_quote_summary to show totals
9. When the user confirms the summary looks good, call finalize_quote with a descriptive quote name
10. After finalizing, let them know they can add custom items when they edit the quote

## Removing Items
If the user says items don't belong, are wrong, or need to be cleaned up:
- Call remove_quote_items with the item names to remove
- Be aggressive about removing clearly wrong items (e.g., "faucet" in an electrical job)
- After removing, show what's left with get_quote_summary

## Important Rules
- ALWAYS search tradecraft first for any job type - this is your expertise
- ONE THING PER MESSAGE:
  - If showing products: ONLY say "Here are the products" - do NOT ask about labor or anything else
  - If asking about labor: ONLY ask about labor - do NOT mention materials
  - If showing summary: ONLY show summary - do NOT ask "want to finalize?" in same message
  - Never bundle multiple questions or actions together
- Ask scoping questions ONE AT A TIME, not all at once
- ALWAYS use propose_checklist BEFORE lookup_materials - let user confirm categories first
- When you don't know something, ask - don't assume
- Propose labor hours based on tradecraft, but always confirm with user
- Keep the conversation moving - don't over-explain
- For specialty items not in the catalog, tell user they can add them on the quote edit screen
- After completing an action (adding items, setting labor, etc), WAIT for user response before asking the next question

## Quick Replies
When you ask a question, ALWAYS include 2-4 likely answers as quick reply buttons. Put them at the END of your message in this exact format:

[QUICK_REPLIES: "Option 1", "Option 2", "Option 3"]

Examples:
- Asking about amperage: [QUICK_REPLIES: "100A", "150A", "60A or fuse box"]
- Asking about reason for upgrade: [QUICK_REPLIES: "EV charger", "General capacity", "Selling home", "New HVAC"]
- Asking about panel location: [QUICK_REPLIES: "Garage", "Basement", "Exterior", "Interior"]
- Asking about labor hours: [QUICK_REPLIES: "Sounds right", "Add more time", "Less time needed"]
- Asking about markup: [QUICK_REPLIES: "20%", "25%", "30%"]

The quick replies should be SHORT (1-4 words each) and directly answer your question. This helps users respond quickly on mobile.

## Your Current Context
{tradecraft_context}`;

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
  {
    name: 'search_tradecraft',
    description: 'Search the tradecraft knowledge base for job-specific guidance. Use this FIRST when a user mentions any job type to get expert scoping questions, material lists, and labor estimates.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for (e.g., "panel upgrade", "EV charger installation", "recessed lighting")',
        },
        trade: {
          type: 'string',
          description: 'Optional: filter by trade (e.g., "electrical", "plumbing", "drywall")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'propose_checklist',
    description: 'Propose a materials checklist based on tradecraft. Call this AFTER scoping questions are answered, BEFORE looking up specific products. This shows the user what material categories they need so they can confirm.',
    input_schema: {
      type: 'object',
      properties: {
        job_type: {
          type: 'string',
          description: 'The job type from tradecraft (e.g., "panel_upgrade", "ev_charger", "recessed_lighting")',
        },
      },
      required: ['job_type'],
    },
  },
  {
    name: 'lookup_materials',
    description: 'Search the product catalog for materials with real prices. ONLY use this after the user confirms the checklist - search only for confirmed categories.',
    input_schema: {
      type: 'object',
      properties: {
        searchTerms: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of materials to search for (e.g., ["200A panel", "6/3 wire", "50A breaker"])',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Category names for grouping results (e.g., ["Main breaker panel", "Service entrance cable"])',
        },
      },
      required: ['searchTerms'],
    },
  },
  {
    name: 'add_quote_items',
    description: 'Add materials to the quote. Use after looking up materials and confirming quantities with the user.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              name: { type: 'string' },
              unitPrice: { type: 'number' },
              qty: { type: 'number' },
              unit: { type: 'string' },
            },
            required: ['productId', 'name', 'unitPrice', 'qty'],
          },
          description: 'Items to add to the quote',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'remove_quote_items',
    description: 'Remove items from the quote by product ID or name. Use when the user says to remove, delete, or clean up items that don\'t belong.',
    input_schema: {
      type: 'object',
      properties: {
        productIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product IDs to remove (if known)',
        },
        productNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product names or partial names to match and remove',
        },
      },
    },
  },
  {
    name: 'set_labor',
    description: 'Set labor hours and hourly rate for the quote. Always confirm hours with the user first.',
    input_schema: {
      type: 'object',
      properties: {
        hours: {
          type: 'number',
          description: 'Number of labor hours',
        },
        rate: {
          type: 'number',
          description: 'Hourly rate in dollars (use user default if available)',
        },
      },
      required: ['hours', 'rate'],
    },
  },
  {
    name: 'set_markup',
    description: 'Set markup percentage for materials.',
    input_schema: {
      type: 'object',
      properties: {
        percent: {
          type: 'number',
          description: 'Markup percentage (e.g., 20 for 20%)',
        },
      },
      required: ['percent'],
    },
  },
  {
    name: 'set_quote_info',
    description: 'Set quote name and/or client information.',
    input_schema: {
      type: 'object',
      properties: {
        quoteName: { type: 'string', description: 'Name for the quote' },
        clientName: { type: 'string', description: 'Client name' },
        clientEmail: { type: 'string', description: 'Client email' },
        clientPhone: { type: 'string', description: 'Client phone' },
      },
    },
  },
  {
    name: 'get_quote_summary',
    description: 'Get a summary of the current quote (items, totals, etc). Use to review before finalizing.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'finalize_quote',
    description: 'Mark the quote as complete and ready to save. Use this when the user confirms they are done building the quote.',
    input_schema: {
      type: 'object',
      properties: {
        quoteName: { type: 'string', description: 'Optional name for the quote' },
      },
    },
  },
];

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

async function searchTradecraft(
  supabase: ReturnType<typeof createClient>,
  query: string,
  trade?: string
): Promise<{ title: string; content: string; job_type: string } | null> {
  console.log(`[drew-agent] Searching tradecraft: "${query}" (trade: ${trade || 'any'})`);

  // Generate embedding for the query
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
    }),
  });

  if (!embeddingResponse.ok) {
    console.error('[drew-agent] Failed to generate embedding');
    return null;
  }

  const embeddingData = await embeddingResponse.json();
  const queryEmbedding = embeddingData.data[0].embedding;

  // Search using the vector similarity function
  const { data, error } = await supabase.rpc('search_tradecraft', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 1,
    filter_trade: trade || null,
  });

  if (error) {
    console.error('[drew-agent] Tradecraft search error:', error);
    return null;
  }

  if (data && data.length > 0) {
    console.log(`[drew-agent] Found tradecraft: ${data[0].title} (job_type: ${data[0].job_type}, similarity: ${data[0].similarity})`);
    return {
      title: data[0].title,
      content: data[0].content,
      job_type: data[0].job_type,
    };
  }

  console.log('[drew-agent] No tradecraft found');
  return null;
}

async function getChecklistForJobType(
  supabase: ReturnType<typeof createClient>,
  jobType: string
): Promise<ChecklistItem[] | null> {
  console.log(`[drew-agent] Getting checklist for job type: ${jobType}`);

  const { data, error } = await supabase
    .from('tradecraft_docs')
    .select('materials_checklist')
    .eq('job_type', jobType)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('[drew-agent] Failed to get checklist:', error);
    return null;
  }

  if (data?.materials_checklist?.items) {
    console.log(`[drew-agent] Found checklist with ${data.materials_checklist.items.length} items`);
    return data.materials_checklist.items as ChecklistItem[];
  }

  console.log('[drew-agent] No checklist found for job type:', jobType);
  return null;
}

// Get category filter based on tradecraft job type
function getCategoryFilterForTrade(jobType?: string): string | null {
  if (!jobType) return null;

  const tradeCategories: Record<string, string> = {
    'panel_upgrade': 'electrical',
    'ev_charger': 'electrical',
    'recessed_lighting': 'electrical',
    'outlet_circuit': 'electrical',
    // Add more mappings as tradecraft docs are added
  };

  return tradeCategories[jobType] || null;
}

async function lookupMaterials(
  supabase: ReturnType<typeof createClient>,
  searchTerms: string[],
  userId?: string,
  categoryFilter?: string | null
): Promise<Array<{ id: string; name: string; price: number; unit: string; retailer?: string; source: 'pricebook' | 'catalog' }>> {
  console.log(`[drew-agent] Looking up materials:`, searchTerms, userId ? '(with pricebook)' : '(catalog only)', categoryFilter ? `(category: ${categoryFilter})` : '');

  const results: Array<{ id: string; name: string; price: number; unit: string; retailer?: string; source: 'pricebook' | 'catalog' }> = [];

  for (const term of searchTerms) {
    // 1. Search user's pricebook first (if logged in)
    if (userId) {
      const { data: pricebookItems, error: pbError } = await supabase
        .from('pricebook_items')
        .select('id, name, unit_price, unit_type')
        .eq('user_id', userId)
        .eq('is_active', true)
        .ilike('name', `%${term}%`)
        .limit(3);

      if (!pbError && pricebookItems) {
        for (const item of pricebookItems) {
          // Avoid duplicates
          if (!results.find(r => r.id === item.id)) {
            results.push({
              id: item.id,
              name: item.name,
              price: item.unit_price,
              unit: item.unit_type || 'ea',
              source: 'pricebook',
            });
          }
        }
      }
    }

    // 2. Search catalog (with optional category filter to avoid cross-trade results)
    const { data, error } = await supabase.rpc('search_products', {
      search_query: term,
      result_limit: 3,
      category_filter: categoryFilter || null,
    });

    if (!error && data) {
      for (const product of data) {
        // Avoid duplicates (check both pricebook and catalog results)
        if (!results.find(r => r.id === product.id)) {
          results.push({
            id: product.id,
            name: product.name,
            price: product.unit_price,
            unit: product.unit || 'ea',
            retailer: product.retailer || undefined,
            source: 'catalog',
          });
        }
      }
    }
  }

  console.log(`[drew-agent] Found ${results.length} materials (${results.filter(r => r.source === 'pricebook').length} from pricebook)`);
  return results;
}

function addQuoteItems(
  state: ConversationState,
  items: QuoteItem[]
): ConversationState {
  console.log(`[drew-agent] Adding ${items.length} items to quote`);

  // Create a map to deduplicate by productId (update qty if already exists)
  const itemMap = new Map<string, QuoteItem>();

  // Add existing items
  for (const item of state.quoteItems) {
    itemMap.set(item.productId, item);
  }

  // Add/update with new items
  for (const item of items) {
    const existing = itemMap.get(item.productId);
    if (existing) {
      // Update quantity if same product
      itemMap.set(item.productId, { ...existing, qty: item.qty });
    } else {
      itemMap.set(item.productId, item);
    }
  }

  return {
    ...state,
    quoteItems: Array.from(itemMap.values()),
  };
}

function setLabor(
  state: ConversationState,
  hours: number,
  rate: number
): ConversationState {
  console.log(`[drew-agent] Setting labor: ${hours} hrs @ $${rate}/hr`);
  return {
    ...state,
    laborHours: hours,
    laborRate: rate,
  };
}

function setMarkup(
  state: ConversationState,
  percent: number
): ConversationState {
  console.log(`[drew-agent] Setting markup: ${percent}%`);
  return {
    ...state,
    markupPercent: percent,
  };
}

function setQuoteInfo(
  state: ConversationState,
  info: { quoteName?: string; clientName?: string; clientEmail?: string; clientPhone?: string }
): ConversationState {
  console.log(`[drew-agent] Setting quote info:`, info);
  return {
    ...state,
    ...info,
  };
}

function getQuoteSummary(state: ConversationState): string {
  const materialTotal = state.quoteItems.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  );
  const markupAmount = materialTotal * (state.markupPercent || 0) / 100;
  const laborTotal = (state.laborHours || 0) * (state.laborRate || 0);
  const grandTotal = materialTotal + markupAmount + laborTotal;

  let summary = `## Quote Summary\n\n`;

  if (state.quoteName) summary += `**Quote Name:** ${state.quoteName}\n`;
  if (state.clientName) summary += `**Client:** ${state.clientName}\n`;

  summary += `\n### Materials (${state.quoteItems.length} items)\n`;
  for (const item of state.quoteItems) {
    summary += `- ${item.qty}x ${item.name} @ $${item.unitPrice.toFixed(2)} = $${(item.qty * item.unitPrice).toFixed(2)}\n`;
  }
  summary += `\n**Materials Subtotal:** $${materialTotal.toFixed(2)}\n`;

  if (state.markupPercent) {
    summary += `**Markup (${state.markupPercent}%):** $${markupAmount.toFixed(2)}\n`;
  }

  if (state.laborHours && state.laborRate) {
    summary += `\n### Labor\n`;
    summary += `${state.laborHours} hours @ $${state.laborRate}/hr = $${laborTotal.toFixed(2)}\n`;
  }

  summary += `\n### Total: $${grandTotal.toFixed(2)}`;

  return summary;
}

// =============================================================================
// EXECUTE TOOL
// =============================================================================

async function executeTool(
  supabase: ReturnType<typeof createClient>,
  state: ConversationState,
  toolName: string,
  toolInput: Record<string, unknown>,
  userId?: string
): Promise<{ result: string; newState: ConversationState }> {
  let result = '';
  let newState = state;

  switch (toolName) {
    case 'search_tradecraft': {
      const doc = await searchTradecraft(
        supabase,
        toolInput.query as string,
        toolInput.trade as string | undefined
      );
      if (doc) {
        newState = {
          ...state,
          tradecraftContext: doc.content,
          tradecraftJobType: doc.job_type,
        };
        result = `Found tradecraft document: "${doc.title}"\n\n${doc.content}`;
      } else {
        result = 'No specific tradecraft found for this job type. Proceed with general knowledge.';
      }
      break;
    }

    case 'propose_checklist': {
      // Prevent re-proposing if checklist already pending - user should confirm or skip
      if (state.pendingChecklist && state.pendingChecklist.length > 0) {
        result = `Checklist already shown. Ask user to confirm the materials checklist, modify it, or skip. Don't re-propose.`;
        break;
      }
      const jobType = toolInput.job_type as string;
      const checklist = await getChecklistForJobType(supabase, jobType);
      if (checklist && checklist.length > 0) {
        newState = { ...state, pendingChecklist: checklist };
        result = `Materials checklist for ${jobType}:\n` +
          checklist.map(item =>
            `- ${item.name} (${item.defaultQty} ${item.unit})${item.required ? ' [required]' : ''}${item.notes ? ` - ${item.notes}` : ''}`
          ).join('\n');
      } else {
        result = `No materials checklist found for job type: ${jobType}. Use lookup_materials directly.`;
      }
      break;
    }

    case 'lookup_materials': {
      // Get category filter from tradecraft job type to avoid cross-trade results
      const categoryFilter = getCategoryFilterForTrade(state.tradecraftJobType);
      const materials = await lookupMaterials(
        supabase,
        toolInput.searchTerms as string[],
        userId,
        categoryFilter
      );
      if (materials.length > 0) {
        // Store as pendingProducts for UI display with checkboxes
        newState = {
          ...state,
          pendingProducts: materials.map(m => ({
            id: m.id,
            name: m.name,
            price: m.price,
            unit: m.unit,
            retailer: m.retailer,
            source: m.source,
            suggestedQty: 1, // Default qty, Drew can adjust in his message
          })),
        };
        result = 'Found materials:\n' + materials
          .map(m => `- ${m.name}: $${m.price.toFixed(2)}/${m.unit}${m.source === 'pricebook' ? ' (Your Pricebook)' : m.retailer ? ` (${m.retailer})` : ''} (ID: ${m.id})`)
          .join('\n');
      } else {
        result = 'No materials found for those search terms.';
      }
      break;
    }

    case 'add_quote_items': {
      const items = toolInput.items as QuoteItem[];
      newState = addQuoteItems(state, items);
      result = `Added ${items.length} item(s) to quote. Current total: ${newState.quoteItems.length} items.`;
      break;
    }

    case 'remove_quote_items': {
      const productIds = (toolInput.productIds as string[]) || [];
      const productNames = (toolInput.productNames as string[]) || [];

      const originalCount = state.quoteItems.length;
      const remainingItems = state.quoteItems.filter(item => {
        // Remove if productId matches
        if (productIds.includes(item.productId)) return false;
        // Remove if name contains any of the search terms (case-insensitive)
        for (const namePattern of productNames) {
          if (item.name.toLowerCase().includes(namePattern.toLowerCase())) return false;
        }
        return true;
      });

      const removedCount = originalCount - remainingItems.length;
      newState = { ...state, quoteItems: remainingItems };
      result = removedCount > 0
        ? `Removed ${removedCount} item(s) from quote. ${remainingItems.length} items remaining.`
        : 'No matching items found to remove.';
      break;
    }

    case 'set_labor': {
      newState = setLabor(
        state,
        toolInput.hours as number,
        toolInput.rate as number
      );
      result = `Labor set: ${toolInput.hours} hours @ $${toolInput.rate}/hr = $${((toolInput.hours as number) * (toolInput.rate as number)).toFixed(2)}`;
      break;
    }

    case 'set_markup': {
      newState = setMarkup(state, toolInput.percent as number);
      result = `Markup set to ${toolInput.percent}%`;
      break;
    }

    case 'set_quote_info': {
      newState = setQuoteInfo(state, toolInput as any);
      result = 'Quote information updated.';
      break;
    }

    case 'get_quote_summary': {
      result = getQuoteSummary(state);
      break;
    }

    case 'finalize_quote': {
      const quoteName = toolInput.quoteName as string | undefined;
      newState = {
        ...state,
        isComplete: true,
        quoteName: quoteName || state.quoteName,
      };
      result = `Quote finalized${quoteName ? ` as "${quoteName}"` : ''}. Ready to save.`;
      break;
    }

    default:
      result = `Unknown tool: ${toolName}`;
  }

  return { result, newState };
}

// =============================================================================
// QUICK REPLIES PARSING & GENERATION
// =============================================================================

/**
 * Parse quick replies from Drew's response text.
 * Format: [QUICK_REPLIES: "Option 1", "Option 2", "Option 3"]
 * Returns { cleanText, quickReplies } where cleanText has the tag removed.
 */
function parseQuickReplies(text: string): { cleanText: string; quickReplies: string[] | null } {
  const match = text.match(/\[QUICK_REPLIES:\s*(.+?)\]/);

  if (!match) {
    return { cleanText: text, quickReplies: null };
  }

  // Extract the options string and parse it
  const optionsStr = match[1];
  const options: string[] = [];

  // Match quoted strings (handles both "option" and 'option')
  const quotedMatches = optionsStr.matchAll(/["']([^"']+)["']/g);
  for (const m of quotedMatches) {
    options.push(m[1].trim());
  }

  // Remove the [QUICK_REPLIES: ...] tag from the text
  const cleanText = text.replace(/\s*\[QUICK_REPLIES:\s*.+?\]/, '').trim();

  return {
    cleanText,
    quickReplies: options.length > 0 ? options : null,
  };
}

/**
 * Fallback quick replies based on quote state (used when Drew doesn't provide any)
 */
function generateQuickReplies(state: ConversationState, userSettings: UserSettings): string[] {
  const replies: string[] = [];
  const hasItems = state.quoteItems.length > 0;
  const hasLabor = state.laborHours && state.laborRate;
  const hasMarkup = state.markupPercent !== undefined;

  // If quote is finalized, show save option
  if (state.isComplete) {
    replies.push('Save Quote');
    replies.push('Add more materials');
    return replies;
  }

  // If we have items but no labor, suggest setting labor
  if (hasItems && !hasLabor) {
    if (userSettings.defaultLaborRate) {
      replies.push('Use my default rate');
    }
    replies.push('Set labor hours');
  }

  // If we have items and labor but no markup, suggest markup
  if (hasItems && hasLabor && !hasMarkup) {
    if (userSettings.defaultMarkupPercent) {
      replies.push(`Use ${userSettings.defaultMarkupPercent}% markup`);
    }
    replies.push('Set markup percentage');
  }

  // If quote looks complete, suggest finalize (not review again)
  if (hasItems && hasLabor && hasMarkup) {
    replies.push('Yes, finalize');
    replies.push('Add more materials');
  }

  // Always offer to look up materials if we don't have many items
  if (state.quoteItems.length < 3) {
    replies.push('Look up materials');
  }

  // Limit to 3 quick replies
  return replies.slice(0, 3);
}

// =============================================================================
// AGENT LOOP
// =============================================================================

async function runAgent(
  supabase: ReturnType<typeof createClient>,
  userMessage: string,
  state: ConversationState,
  userSettings: UserSettings,
  userId?: string
): Promise<AgentResponse> {
  // Handle empty message (initial greeting)
  if (!userMessage || userMessage.trim() === '') {
    const greetingMessage = "Hey! I'm Drew, your estimating assistant. What kind of job are we quoting today?";
    return {
      message: greetingMessage,
      state: {
        ...state,
        messages: [
          { role: 'assistant', content: greetingMessage },
        ],
      },
      quickReplies: ['Panel upgrade', 'EV charger install', 'Recessed lighting', 'Something else'],
    };
  }

  // Handle special product selection message (from UI checkboxes)
  if (userMessage.startsWith('ADD_SELECTED:')) {
    const selectedData = JSON.parse(userMessage.replace('ADD_SELECTED:', ''));
    const items: QuoteItem[] = selectedData.map((s: { id: string; name: string; price: number; unit: string; qty: number }) => ({
      productId: s.id,
      name: s.name,
      unitPrice: s.price,
      qty: s.qty,
      unit: s.unit,
    }));

    const newState = addQuoteItems(state, items);
    // Clear pending products after selection
    newState.pendingProducts = undefined;

    // Add to conversation history
    const addedMsg = items.map(i => `${i.qty}x ${i.name}`).join(', ');
    newState.messages = [
      ...state.messages,
      { role: 'user', content: `[Selected: ${addedMsg}]` },
      { role: 'assistant', content: `Added ${items.length} item(s) to the quote.` },
    ];

    return {
      message: `Added ${items.length} item(s) to the quote. What's next?`,
      state: newState,
      display: {
        type: 'added',
        addedItems: items.map(i => ({ name: i.name, qty: i.qty })),
      },
      quickReplies: ['Look up more materials', 'Set labor hours', 'Review quote'],
    };
  }

  // Handle "Add all to quote" quick reply - adds all pending products
  const addAllMatch = userMessage.toLowerCase().match(/^add all( to quote)?$/);
  if (addAllMatch && state.pendingProducts && state.pendingProducts.length > 0) {
    const items: QuoteItem[] = state.pendingProducts.map((p) => ({
      productId: p.id,
      name: p.name,
      unitPrice: p.price,
      qty: p.suggestedQty,
      unit: p.unit,
    }));

    const newState = addQuoteItems(state, items);
    // Clear pending products after selection
    newState.pendingProducts = undefined;

    // Add to conversation history
    const addedMsg = items.map(i => `${i.qty}x ${i.name}`).join(', ');
    newState.messages = [
      ...state.messages,
      { role: 'user', content: `[Added all: ${addedMsg}]` },
      { role: 'assistant', content: `Added ${items.length} item(s) to the quote.` },
    ];

    return {
      message: `Added all ${items.length} item(s) to the quote. Ready to set labor hours?`,
      state: newState,
      display: {
        type: 'added',
        addedItems: items.map(i => ({ name: i.name, qty: i.qty })),
      },
      quickReplies: ['Set labor hours', 'Look up more materials', 'Review quote'],
    };
  }

  // Handle "Skip these materials" quick reply
  if (userMessage.toLowerCase().match(/^skip( these materials)?$/)) {
    const newState = { ...state };
    newState.pendingProducts = undefined;

    newState.messages = [
      ...state.messages,
      { role: 'user', content: '[Skipped materials]' },
      { role: 'assistant', content: 'No problem, skipped those materials.' },
    ];

    return {
      message: 'No problem. What would you like to do next?',
      state: newState,
      quickReplies: ['Look up more materials', 'Set labor hours', 'Review quote'],
    };
  }

  // Handle natural language checklist confirmation (e.g., "Looks good", "Yes", "Confirm")
  // This catches affirmative responses when there's a pending checklist
  const affirmativePatterns = /^(looks? good|yes|yeah|yep|confirm|ok|okay|good|perfect|that'?s? (good|right|it)|sounds? good|all good|go ahead)$/i;

  // Handle partial selection phrases like "Just the panel", "Only the wire"
  const partialSelectionMatch = userMessage.trim().match(/^(just|only)\s+(the\s+)?(.+)$/i);
  let partialSelectionCategories: string[] | null = null;

  if (state.pendingChecklist && state.pendingChecklist.length > 0 && partialSelectionMatch) {
    const requestedItem = partialSelectionMatch[3].toLowerCase();
    console.log('[drew-agent] Partial selection detected:', requestedItem);

    // Find matching categories from the checklist
    partialSelectionCategories = state.pendingChecklist
      .filter(item =>
        item.name.toLowerCase().includes(requestedItem) ||
        item.category.toLowerCase().includes(requestedItem)
      )
      .map(item => item.category);

    if (partialSelectionCategories.length > 0) {
      console.log('[drew-agent] Matched categories for partial selection:', partialSelectionCategories);
    } else {
      console.log('[drew-agent] No matching categories found for:', requestedItem);
      partialSelectionCategories = null;
    }
  }

  if (state.pendingChecklist && state.pendingChecklist.length > 0 && affirmativePatterns.test(userMessage.trim())) {
    console.log('[drew-agent] Natural language checklist confirmation detected:', userMessage);
    // Confirm all required items by default
    const confirmedCategories = state.pendingChecklist
      .filter(item => item.required)
      .map(item => item.category);

    // Fall through to the CONFIRM_CHECKLIST handler logic below
    // by constructing the same format
    const syntheticMessage = `CONFIRM_CHECKLIST:${JSON.stringify(confirmedCategories)}`;
    console.log('[drew-agent] Converting to:', syntheticMessage);
    // Don't return - let it fall through to the handler below
    // We'll handle this by checking for pendingChecklist + affirmative in the CONFIRM_CHECKLIST section
  }

  // Handle checklist confirmation (from UI checkboxes OR natural language OR partial selection)
  const isChecklistConfirm = userMessage.startsWith('CONFIRM_CHECKLIST:') ||
    (state.pendingChecklist && state.pendingChecklist.length > 0 && affirmativePatterns.test(userMessage.trim())) ||
    (partialSelectionCategories && partialSelectionCategories.length > 0);

  if (isChecklistConfirm) {
    let confirmedCategories: string[];

    if (userMessage.startsWith('CONFIRM_CHECKLIST:')) {
      confirmedCategories = JSON.parse(userMessage.replace('CONFIRM_CHECKLIST:', '')) as string[];
    } else if (partialSelectionCategories && partialSelectionCategories.length > 0) {
      // Partial selection like "Just the panel" - use only matching categories
      confirmedCategories = partialSelectionCategories;
      console.log('[drew-agent] Using partial selection categories');
    } else {
      // Natural language confirmation - confirm all required items
      confirmedCategories = state.pendingChecklist!
        .filter(item => item.required)
        .map(item => item.category);
    }
    console.log('[drew-agent] Checklist confirmed, categories:', confirmedCategories);

    if (!state.pendingChecklist || confirmedCategories.length === 0) {
      return {
        message: 'No materials selected. Would you like to look up materials manually or move on?',
        state: { ...state, pendingChecklist: undefined },
        quickReplies: ['Look up materials', 'Set labor hours', 'Skip materials'],
      };
    }

    // Get checklist items for confirmed categories
    const confirmedItems = state.pendingChecklist.filter(item =>
      confirmedCategories.includes(item.category)
    );

    // Track seen product IDs to avoid duplicates across categories
    const seenProductIds = new Set<string>();

    // Look up products for each confirmed category (with trade filter)
    const categoryFilter = getCategoryFilterForTrade(state.tradecraftJobType);
    const productGroups: ProductGroup[] = [];
    for (const item of confirmedItems) {
      const materials = await lookupMaterials(supabase, item.searchTerms, userId, categoryFilter);
      if (materials.length > 0) {
        // Filter out duplicates within this category and across categories
        const uniqueProducts = materials
          .filter(m => !seenProductIds.has(m.id))
          .map(m => {
            seenProductIds.add(m.id);
            return {
              id: m.id,
              name: m.name,
              price: m.price,
              unit: m.unit,
              retailer: m.retailer,
              source: m.source,
              suggestedQty: item.defaultQty,
            };
          });

        if (uniqueProducts.length > 0) {
          // Limit to 2 products per category to avoid overwhelming the user
          productGroups.push({
            category: item.category,
            categoryName: item.name,
            products: uniqueProducts.slice(0, 2),
          });
        }
      }
    }

    // Flatten products for pendingProducts (already deduplicated)
    const allProducts = productGroups.flatMap(g => g.products);

    const newState: ConversationState = {
      ...state,
      pendingChecklist: undefined,
      pendingProducts: allProducts,
      messages: [
        ...state.messages,
        { role: 'user', content: `[Confirmed ${confirmedCategories.length} material categories]` },
        { role: 'assistant', content: `Found ${allProducts.length} products across ${productGroups.length} categories.` },
      ],
    };

    return {
      message: `Found ${allProducts.length} products. Select what you need:`,
      state: newState,
      display: {
        type: 'products',
        productGroups,
        products: allProducts,
      },
      quickReplies: ['Add all to quote', 'Skip these materials'],
    };
  }

  // Handle "Skip checklist" quick reply
  if (userMessage.toLowerCase().match(/^skip( checklist)?$/) && state.pendingChecklist) {
    const newState = { ...state };
    newState.pendingChecklist = undefined;

    newState.messages = [
      ...state.messages,
      { role: 'user', content: '[Skipped checklist]' },
      { role: 'assistant', content: 'Skipped the materials checklist.' },
    ];

    return {
      message: 'No problem. Would you like to look up specific materials or set labor?',
      state: newState,
      quickReplies: ['Look up materials', 'Set labor hours'],
    };
  }

  // Add user message to conversation
  const messages: Message[] = [
    ...state.messages,
    { role: 'user', content: userMessage },
  ];

  // Build system prompt with tradecraft context
  const systemPrompt = DREW_SYSTEM_PROMPT.replace(
    '{tradecraft_context}',
    state.tradecraftContext
      ? `You have loaded the following tradecraft guidance:\n\n${state.tradecraftContext}`
      : 'No tradecraft loaded yet. Search the knowledge base when the user describes a job.'
  );

  // Add user settings context
  const settingsContext = userSettings.defaultLaborRate || userSettings.defaultMarkupPercent
    ? `\n\nUser defaults: Labor rate: $${userSettings.defaultLaborRate || 'not set'}/hr, Markup: ${userSettings.defaultMarkupPercent || 'not set'}%`
    : '';

  let currentState = state;
  let iterations = 0;
  const MAX_ITERATIONS = 10; // Safety limit

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`[drew-agent] Iteration ${iterations}`);

    // Call Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: systemPrompt + settingsContext,
            cache_control: { type: 'ephemeral' }
          }
        ],
        tools: TOOLS,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[drew-agent] Claude API error status:', response.status);
      console.error('[drew-agent] Claude API error body:', errorText);
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[drew-agent] Stop reason: ${data.stop_reason}`);

    // Check if Claude wants to use a tool
    if (data.stop_reason === 'tool_use') {
      // Find the tool use block
      const toolUseBlock = data.content.find((c: ContentBlock) => c.type === 'tool_use');

      if (toolUseBlock) {
        console.log(`[drew-agent] Tool use: ${toolUseBlock.name}`);

        // Execute the tool
        const { result, newState } = await executeTool(
          supabase,
          currentState,
          toolUseBlock.name!,
          toolUseBlock.input as Record<string, unknown>,
          userId
        );
        currentState = newState;

        // Add assistant's response (with tool use) to messages
        messages.push({
          role: 'assistant',
          content: data.content,
        });

        // Add tool result to messages
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: result,
            },
          ],
        });

        // Continue the loop
        continue;
      }
    }

    // Claude wants to respond to the user (end_turn or no tool use)
    const textBlock = data.content.find((c: ContentBlock) => c.type === 'text');
    const rawResponseText = textBlock?.text || '';

    // Parse quick replies from Drew's response (format: [QUICK_REPLIES: "A", "B", "C"])
    const { cleanText, quickReplies: drewQuickReplies } = parseQuickReplies(rawResponseText);

    // Add final assistant message to conversation (use clean text without the tag)
    messages.push({
      role: 'assistant',
      content: cleanText,
    });

    // Build the final state
    const finalState: ConversationState = {
      ...currentState,
      messages,
    };

    // Build response with optional display and quickReplies
    const agentResponse: AgentResponse = {
      message: cleanText,
      state: finalState,
    };

    // If we have a pending checklist, show it for user confirmation
    if (finalState.pendingChecklist && finalState.pendingChecklist.length > 0) {
      agentResponse.display = {
        type: 'checklist',
        checklist: finalState.pendingChecklist,
      };
      // No quick replies - user interacts with checkboxes
    }
    // If we have pending products, include them in display for checkbox UI
    else if (finalState.pendingProducts && finalState.pendingProducts.length > 0) {
      agentResponse.display = {
        type: 'products',
        products: finalState.pendingProducts,
      };
      agentResponse.quickReplies = ['Add all to quote', 'Skip these materials'];
    }

    // Use Drew's quick replies if he provided them, otherwise fall back to state-based
    if (!agentResponse.quickReplies) {
      if (drewQuickReplies && drewQuickReplies.length > 0) {
        agentResponse.quickReplies = drewQuickReplies;
      } else {
        agentResponse.quickReplies = generateQuickReplies(finalState, userSettings);
      }
    }

    return agentResponse;
  }

  // Safety: hit max iterations
  console.error('[drew-agent] Hit max iterations');
  return {
    message: "I got a bit stuck there. Let's try again - what were we working on?",
    state: {
      ...currentState,
      messages,
    },
    quickReplies: ['Start over', 'Continue where we left off'],
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: RequestBody = await req.json();

    // Extract user ID from auth header (for pricebook lookup)
    let userId: string | undefined;
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      // Use Supabase to verify and get user from token
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
        console.log('[drew-agent] Authenticated user:', userId);
      }
    }

    const userMessage = body.userMessage || '';
    const state: ConversationState = body.state || {
      messages: [],
      quoteItems: [],
    };
    const userSettings: UserSettings = body.userSettings || {};

    console.log('[drew-agent] User message:', userMessage.substring(0, 100));

    // ==========================================================================
    // STATE MACHINE PATH (Drew 2.0)
    // ==========================================================================
    if (USE_STATE_MACHINE) {
      // Extract or initialize machine state
      const machineState: DrewState = state.machineState || 'greeting';
      const machineContext: DrewContext = state.machineContext || createInitialContext();
      const machineSettings: StateMachineSettings = {
        defaultLaborRate: userSettings.defaultLaborRate,
        defaultMarkupPercent: userSettings.defaultMarkupPercent,
      };

      console.log(`[drew-agent] State machine mode - State: ${machineState}`);

      // Dispatch through state machine
      const smResponse: StateMachineResponse = await stateMachineDispatch(
        machineState,
        userMessage,
        machineContext,
        machineSettings,
        supabase
      );

      console.log(`[drew-agent] State machine response - New state: ${smResponse.state}`);

      // Map state machine response to agent response format
      const agentResponse: AgentResponse = {
        message: smResponse.message,
        state: {
          // Preserve existing state fields
          ...state,
          // Map from machine context
          messages: smResponse.context.messages,
          quoteItems: smResponse.context.quoteItems,
          quoteName: smResponse.context.quoteName,
          clientName: smResponse.context.clientName,
          laborHours: smResponse.context.laborHours,
          laborRate: smResponse.context.laborRate,
          markupPercent: smResponse.context.markupPercent,
          tradecraftContext: smResponse.context.tradecraft?.content,
          tradecraftJobType: smResponse.context.tradecraft?.job_type,
          pendingChecklist: smResponse.context.pendingChecklist,
          pendingProducts: smResponse.context.pendingProducts?.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            unit: p.unit,
            suggestedQty: p.suggestedQty,
          })),
          isComplete: smResponse.isComplete,
          // Persist machine state for next request
          machineState: smResponse.state,
          machineContext: smResponse.context,
        },
        display: smResponse.display ? {
          type: smResponse.display.type,
          checklist: smResponse.display.checklist,
          products: smResponse.display.products?.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            unit: p.unit,
            suggestedQty: p.suggestedQty,
          })),
        } : undefined,
        quickReplies: smResponse.quickReplies,
      };

      console.log('[drew-agent] Response:', agentResponse.message.substring(0, 100));
      if (agentResponse.display) {
        console.log('[drew-agent] Display type:', agentResponse.display.type);
      }

      return new Response(
        JSON.stringify(agentResponse),
        { headers }
      );
    }

    // ==========================================================================
    // LEGACY CLAUDE AGENT PATH
    // ==========================================================================
    const agentResponse = await runAgent(
      supabase,
      userMessage,
      state,
      userSettings,
      userId
    );

    console.log('[drew-agent] Response:', agentResponse.message.substring(0, 100));
    if (agentResponse.display) {
      console.log('[drew-agent] Display type:', agentResponse.display.type);
    }
    if (agentResponse.quickReplies) {
      console.log('[drew-agent] Quick replies:', agentResponse.quickReplies.length);
    }

    return new Response(
      JSON.stringify(agentResponse),
      { headers }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[drew-agent] Error:', err.message);
    console.error('[drew-agent] Stack:', err.stack);
    return new Response(
      JSON.stringify({
        error: err.message,
      }),
      { status: 500, headers }
    );
  }
});
