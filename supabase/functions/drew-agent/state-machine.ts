// =============================================================================
// DREW STATE MACHINE - Clean FSM Implementation
// =============================================================================
// Based on patterns from:
// - typescript-fsm (minimal tabular approach)
// - fsm-chat (JSON conversation flow)
// - serverless-xstate (settled state persistence)
//
// Key principles:
// 1. Single transition table defines ALL state changes
// 2. Events are typed objects, not string matching
// 3. Every input maps to an event (no silent fallbacks)
// 4. Claude is used ONLY for interpretation, not flow control
// =============================================================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =============================================================================
// TYPES
// =============================================================================

/** All possible states Drew can be in */
export type DrewState =
  | 'greeting'        // Initial - show welcome message
  | 'job_selection'   // Waiting for job type
  | 'scoping'         // Asking tradecraft questions
  | 'checklist'       // Showing material categories
  | 'products'        // Showing specific products
  | 'labor'           // Asking for labor hours
  | 'markup'          // Asking for markup percentage
  | 'review'          // Showing quote summary
  | 'done'            // Quote finalized
  | 'clarify';        // EXPLICIT fallback - ask user to clarify

/** Events that can trigger state transitions */
export type DrewEvent =
  | { type: 'START' }
  | { type: 'SELECT_JOB'; jobType: string; tradecraft: TradecraftDoc }
  | { type: 'ANSWER_SCOPING'; answer: string; questionId: string }
  | { type: 'CONFIRM_CHECKLIST'; categories: string[] }
  | { type: 'SKIP_CHECKLIST' }
  | { type: 'ADD_PRODUCTS'; products: ProductSelection[] }
  | { type: 'SKIP_PRODUCTS' }
  | { type: 'SET_LABOR'; hours: number; rate: number }
  | { type: 'SET_MARKUP'; percent: number }
  | { type: 'FINALIZE' }
  | { type: 'START_NEW' }
  | { type: 'UNCLEAR'; originalInput: string };  // Explicit "I don't understand"

/** Context that persists across states */
export interface DrewContext {
  // Quote data
  quoteItems: QuoteItem[];
  quoteName?: string;
  clientName?: string;
  laborHours?: number;
  laborRate?: number;
  markupPercent?: number;

  // Tradecraft data
  tradecraft?: TradecraftDoc;
  scopingQuestions?: ScopingQuestion[];
  currentQuestionIndex: number;
  scopingAnswers: Record<string, string>;

  // Checklist data
  pendingChecklist?: ChecklistItem[];
  confirmedCategories?: string[];

  // Products data
  pendingProducts?: Product[];

  // For clarify state - remember where to return
  previousState?: DrewState;
  clarifyAttempts: number;

  // Conversation
  messages: Message[];
}

/** Response from state machine - what to send back to client */
export interface DrewResponse {
  message: string;
  quickReplies: string[];
  display?: DisplayData;
  context: DrewContext;
  state: DrewState;
  isComplete?: boolean;
}

// Supporting types
export interface TradecraftDoc {
  title: string;
  content: string;
  job_type: string;
  scoping_questions?: ScopingQuestion[];
  materials_checklist?: MaterialsChecklist;
}

export interface ScopingQuestion {
  id: string;
  question: string;
  quickReplies: string[];
  storeAs: string;
}

export interface MaterialsChecklist {
  items: ChecklistItem[];
}

export interface ChecklistItem {
  category: string;
  name: string;
  searchTerms: string[];
  defaultQty: number;
  unit: string;
  required: boolean;
  notes?: string;
}

export interface QuoteItem {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  unit?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  suggestedQty: number;
}

export interface ProductSelection {
  id: string;
  name: string;
  price: number;
  unit: string;
  qty: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface DisplayData {
  type: 'checklist' | 'products' | 'added' | 'summary';
  checklist?: ChecklistItem[];
  products?: Product[];
  addedItems?: { name: string; qty: number }[];
}

export interface UserSettings {
  defaultLaborRate?: number;
  defaultMarkupPercent?: number;
}

// =============================================================================
// TRANSITION TABLE
// =============================================================================
// This is the single source of truth for all state transitions.
// Format: { from, event, to, guard?, action? }
// =============================================================================

type TransitionGuard = (ctx: DrewContext, event: DrewEvent) => boolean;
type TransitionAction = (ctx: DrewContext, event: DrewEvent) => DrewContext;

interface Transition {
  from: DrewState | '*';  // '*' means any state
  event: DrewEvent['type'];
  to: DrewState;
  guard?: TransitionGuard;
  action?: TransitionAction;
}

// Guards
const hasMoreScopingQuestions: TransitionGuard = (ctx) => {
  if (!ctx.scopingQuestions) return false;
  return ctx.currentQuestionIndex < ctx.scopingQuestions.length - 1;
};

const noMoreScopingQuestions: TransitionGuard = (ctx) => {
  if (!ctx.scopingQuestions) return true;
  return ctx.currentQuestionIndex >= ctx.scopingQuestions.length - 1;
};

const hasChecklist: TransitionGuard = (ctx) => {
  return !!ctx.tradecraft?.materials_checklist?.items?.length;
};

const noChecklist: TransitionGuard = (ctx) => {
  return !ctx.tradecraft?.materials_checklist?.items?.length;
};

// Actions
const recordScopingAnswer: TransitionAction = (ctx, event) => {
  if (event.type !== 'ANSWER_SCOPING') return ctx;
  return {
    ...ctx,
    scopingAnswers: {
      ...ctx.scopingAnswers,
      [event.questionId]: event.answer,
    },
    currentQuestionIndex: ctx.currentQuestionIndex + 1,
  };
};

const loadTradecraft: TransitionAction = (ctx, event) => {
  if (event.type !== 'SELECT_JOB') return ctx;
  return {
    ...ctx,
    tradecraft: event.tradecraft,
    scopingQuestions: event.tradecraft.scoping_questions,
    currentQuestionIndex: 0,
    scopingAnswers: {},
    pendingChecklist: event.tradecraft.materials_checklist?.items,
  };
};

const loadChecklist: TransitionAction = (ctx) => {
  return {
    ...ctx,
    pendingChecklist: ctx.tradecraft?.materials_checklist?.items || [],
  };
};

const confirmChecklist: TransitionAction = (ctx, event) => {
  if (event.type !== 'CONFIRM_CHECKLIST') return ctx;
  return {
    ...ctx,
    confirmedCategories: event.categories,
    // Keep pendingChecklist so we can use searchTerms for product lookup
  };
};

const addProducts: TransitionAction = (ctx, event) => {
  if (event.type !== 'ADD_PRODUCTS') return ctx;
  const newItems = event.products.map(p => ({
    productId: p.id,
    name: p.name,
    unitPrice: p.price,
    qty: p.qty,
    unit: p.unit,
  }));
  return {
    ...ctx,
    quoteItems: [...ctx.quoteItems, ...newItems],
    pendingProducts: undefined,
  };
};

const setLabor: TransitionAction = (ctx, event) => {
  if (event.type !== 'SET_LABOR') return ctx;
  return {
    ...ctx,
    laborHours: event.hours,
    laborRate: event.rate,
  };
};

const setMarkup: TransitionAction = (ctx, event) => {
  if (event.type !== 'SET_MARKUP') return ctx;
  return {
    ...ctx,
    markupPercent: event.percent,
  };
};

const enterClarify: TransitionAction = (ctx, event) => {
  return {
    ...ctx,
    previousState: undefined, // Will be set by dispatch
    clarifyAttempts: ctx.clarifyAttempts + 1,
  };
};

const resetContext: TransitionAction = () => createInitialContext();

// The transition table
const TRANSITIONS: Transition[] = [
  // === GREETING ===
  { from: 'greeting', event: 'START', to: 'job_selection' },

  // === JOB SELECTION ===
  { from: 'job_selection', event: 'SELECT_JOB', to: 'scoping', action: loadTradecraft },
  { from: 'job_selection', event: 'UNCLEAR', to: 'clarify', action: enterClarify },

  // === SCOPING ===
  // If more questions, stay in scoping
  { from: 'scoping', event: 'ANSWER_SCOPING', to: 'scoping', guard: hasMoreScopingQuestions, action: recordScopingAnswer },
  // If no more questions and has checklist, go to checklist
  { from: 'scoping', event: 'ANSWER_SCOPING', to: 'checklist', guard: (ctx) => noMoreScopingQuestions(ctx) && hasChecklist(ctx), action: recordScopingAnswer },
  // If no more questions and no checklist, go to labor
  { from: 'scoping', event: 'ANSWER_SCOPING', to: 'labor', guard: (ctx) => noMoreScopingQuestions(ctx) && noChecklist(ctx), action: recordScopingAnswer },
  { from: 'scoping', event: 'UNCLEAR', to: 'clarify', action: enterClarify },

  // === CHECKLIST ===
  { from: 'checklist', event: 'CONFIRM_CHECKLIST', to: 'products', action: confirmChecklist },
  { from: 'checklist', event: 'SKIP_CHECKLIST', to: 'labor' },

  // === PRODUCTS ===
  { from: 'products', event: 'ADD_PRODUCTS', to: 'labor', action: addProducts },
  { from: 'products', event: 'SKIP_PRODUCTS', to: 'labor' },

  // === LABOR ===
  { from: 'labor', event: 'SET_LABOR', to: 'markup', action: setLabor },
  { from: 'labor', event: 'UNCLEAR', to: 'clarify', action: enterClarify },

  // === MARKUP ===
  { from: 'markup', event: 'SET_MARKUP', to: 'review', action: setMarkup },
  { from: 'markup', event: 'UNCLEAR', to: 'clarify', action: enterClarify },

  // === REVIEW ===
  { from: 'review', event: 'FINALIZE', to: 'done' },

  // === DONE ===
  { from: 'done', event: 'START_NEW', to: 'greeting', action: resetContext },

  // === CLARIFY (returns to previous state after clarification) ===
  // These are handled specially in dispatch since they need to return to previousState

  // === GLOBAL (from any state) ===
  { from: '*', event: 'START_NEW', to: 'greeting', action: resetContext },
];

// =============================================================================
// INITIAL CONTEXT
// =============================================================================

export function createInitialContext(): DrewContext {
  return {
    quoteItems: [],
    currentQuestionIndex: 0,
    scopingAnswers: {},
    clarifyAttempts: 0,
    messages: [],
  };
}

// =============================================================================
// EVENT PARSER
// =============================================================================
// Converts raw user input + current state into a typed event.
// This is where we decide what the user meant.
// =============================================================================

const JOB_TYPE_PATTERNS: Record<string, string> = {
  'panel upgrade': 'panel_upgrade',
  'panel': 'panel_upgrade',
  '200 amp': 'panel_upgrade',
  '200a': 'panel_upgrade',
  'ev charger': 'ev_charger',
  'ev charger install': 'ev_charger',
  'charger': 'ev_charger',
  'recessed lighting': 'recessed_lighting',
  'recessed lights': 'recessed_lighting',
  'can lights': 'recessed_lighting',
  'pot lights': 'recessed_lighting',
  'outlet': 'outlet_circuit',
  'new outlet': 'outlet_circuit',
  'add outlet': 'outlet_circuit',
  'circuit': 'outlet_circuit',
};

export async function parseEvent(
  state: DrewState,
  input: string,
  context: DrewContext,
  supabase: SupabaseClient,
): Promise<DrewEvent> {
  const normalized = input.trim().toLowerCase();

  // === GLOBAL COMMANDS ===
  if (normalized.match(/^(start new|new quote|start over|start fresh)$/)) {
    return { type: 'START_NEW' };
  }

  // === STATE-SPECIFIC PARSING ===
  switch (state) {
    case 'greeting':
      return { type: 'START' };

    case 'job_selection': {
      const jobType = JOB_TYPE_PATTERNS[normalized];
      if (jobType) {
        // Load tradecraft from database
        const tradecraft = await loadTradecraftDoc(supabase, jobType);
        if (tradecraft) {
          return { type: 'SELECT_JOB', jobType, tradecraft };
        }
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'scoping': {
      if (!context.scopingQuestions || context.currentQuestionIndex >= context.scopingQuestions.length) {
        return { type: 'UNCLEAR', originalInput: input };
      }

      const currentQuestion = context.scopingQuestions[context.currentQuestionIndex];
      const matched = matchQuickReply(input, currentQuestion.quickReplies);

      if (matched) {
        return {
          type: 'ANSWER_SCOPING',
          answer: matched,
          questionId: currentQuestion.id
        };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'checklist': {
      if (normalized.match(/^(skip|no materials|none)$/)) {
        return { type: 'SKIP_CHECKLIST' };
      }
      // Checklist confirmation comes from UI as structured data
      if (input.startsWith('CONFIRM_CHECKLIST:')) {
        const categories = JSON.parse(input.replace('CONFIRM_CHECKLIST:', ''));
        return { type: 'CONFIRM_CHECKLIST', categories };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'products': {
      if (normalized.match(/^(skip|no products|none|done)$/)) {
        return { type: 'SKIP_PRODUCTS' };
      }
      // Product selection comes from UI as structured data
      if (input.startsWith('ADD_SELECTED:')) {
        const products = JSON.parse(input.replace('ADD_SELECTED:', ''));
        return { type: 'ADD_PRODUCTS', products };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'labor': {
      const hours = parseHours(input);
      if (hours !== null) {
        return { type: 'SET_LABOR', hours, rate: 50 }; // Default rate, can be from settings
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'markup': {
      const percent = parsePercent(input);
      if (percent !== null) {
        return { type: 'SET_MARKUP', percent };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'review': {
      if (normalized.match(/^(yes|finalize|confirm|done|looks good|save)$/)) {
        return { type: 'FINALIZE' };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'done': {
      if (normalized.match(/^(new|start|another)$/)) {
        return { type: 'START_NEW' };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'clarify': {
      // In clarify state, try to parse for the previous state
      // IMPORTANT: Don't recurse if previousState is also clarify (prevents infinite loop)
      if (context.previousState && context.previousState !== 'clarify') {
        return parseEvent(context.previousState, input, context, supabase);
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    default:
      return { type: 'UNCLEAR', originalInput: input };
  }
}

// =============================================================================
// STATE HANDLERS
// =============================================================================
// Each state has an entry handler that generates the response to show the user.
// =============================================================================

export function generateResponse(
  state: DrewState,
  context: DrewContext,
  event: DrewEvent,
  settings: UserSettings,
): DrewResponse {
  switch (state) {
    case 'greeting':
      return {
        message: "Hey! I'm Drew, your quoting assistant. What kind of job are we working on?",
        quickReplies: ['Panel upgrade', 'EV charger', 'Recessed lighting', 'Something else'],
        context,
        state,
      };

    case 'job_selection':
      return {
        message: "What kind of job are we quoting today?",
        quickReplies: ['Panel upgrade', 'EV charger', 'Recessed lighting', 'Something else'],
        context,
        state,
      };

    case 'scoping': {
      if (!context.scopingQuestions || context.currentQuestionIndex >= context.scopingQuestions.length) {
        // No questions - this shouldn't happen, but handle gracefully
        // Don't recurse - just show a message and move forward
        return {
          message: "Let's move on to materials.",
          quickReplies: [],
          context,
          state: 'checklist',
        };
      }

      const question = context.scopingQuestions[context.currentQuestionIndex];
      const isFirst = context.currentQuestionIndex === 0;

      // Add acknowledgment for non-first questions
      const prefix = isFirst
        ? `${context.tradecraft?.title || 'Got it'}! `
        : `${event.type === 'ANSWER_SCOPING' ? (event as any).answer : ''}, got it. `;

      return {
        message: `${prefix}${question.question}`,
        quickReplies: question.quickReplies,
        context,
        state,
      };
    }

    case 'checklist': {
      if (!context.pendingChecklist || context.pendingChecklist.length === 0) {
        // No checklist - skip to labor without recursion
        return {
          message: "No materials checklist for this job. Let's set up labor.",
          quickReplies: ['4 hours', '8 hours', '16 hours'],
          context,
          state: 'labor',
        };
      }

      return {
        message: "Here's what you'll typically need. Uncheck anything you already have:",
        quickReplies: [], // UI handles checklist interaction
        display: {
          type: 'checklist',
          checklist: context.pendingChecklist,
        },
        context,
        state,
      };
    }

    case 'products': {
      // Products are loaded by dispatch when entering this state
      if (!context.pendingProducts || context.pendingProducts.length === 0) {
        // No products found, skip to labor
        return {
          message: "I couldn't find any matching products in the catalog. You can add custom items when you edit the quote. Let's move on to labor.",
          quickReplies: ['4 hours', '8 hours', '16 hours'],
          context,
          state: 'labor', // Skip to labor
        };
      }

      return {
        message: `Found ${context.pendingProducts.length} products. Select what you need:`,
        quickReplies: ['Skip products'],
        display: {
          type: 'products',
          products: context.pendingProducts,
        },
        context,
        state,
      };
    }

    case 'labor': {
      const rate = settings.defaultLaborRate || 50;
      return {
        message: `How many labor hours for this job? (at $${rate}/hr)`,
        quickReplies: ['4 hours', '8 hours', '16 hours', 'Custom'],
        context,
        state,
      };
    }

    case 'markup': {
      const defaultMarkup = settings.defaultMarkupPercent || 20;
      return {
        message: "What markup percentage?",
        quickReplies: ['10%', '15%', '20%', '25%', 'No markup'],
        context,
        state,
      };
    }

    case 'review': {
      const total = calculateTotal(context);
      return {
        message: `Quote ready! Total: $${total.toFixed(2)}. Ready to finalize?`,
        quickReplies: ['Yes, finalize', 'Make changes'],
        display: {
          type: 'summary',
        },
        context,
        state,
      };
    }

    case 'done': {
      return {
        message: "Quote saved! You can edit it anytime from the quotes list.",
        quickReplies: ['Start new quote'],
        context,
        state,
        isComplete: true,
      };
    }

    case 'clarify': {
      const attempts = context.clarifyAttempts;

      if (attempts >= 3) {
        // After 3 attempts, give up and offer options
        return {
          message: "I'm having trouble understanding. Let's try a different approach - what would you like to do?",
          quickReplies: ['Start over', 'Go back'],
          context,
          state,
        };
      }

      // Generate clarification based on previous state
      const clarifyMessages: Record<DrewState, string> = {
        job_selection: "I didn't catch that job type. Could you pick from the options or describe it differently?",
        scoping: "I didn't recognize that answer. Could you pick from the options above?",
        labor: "I need a number of hours. How many hours do you estimate for this job?",
        markup: "I need a percentage. What markup would you like to apply?",
        review: "Would you like to finalize this quote, or make changes?",
        greeting: "Would you like to start a new quote?",
        checklist: "Would you like to confirm the materials, or skip this step?",
        products: "Would you like to add these products, or skip?",
        done: "Would you like to start a new quote?",
        clarify: "I'm not sure what you mean. Could you try again?",
      };

      return {
        message: clarifyMessages[context.previousState || 'job_selection'],
        quickReplies: getQuickRepliesForState(context.previousState || 'job_selection', context, settings),
        context,
        state,
      };
    }

    default:
      return {
        message: "Something went wrong. Let's start over.",
        quickReplies: ['Start over'],
        context: createInitialContext(),
        state: 'greeting',
      };
  }
}

// =============================================================================
// DISPATCH - Main entry point
// =============================================================================

export async function dispatch(
  currentState: DrewState,
  input: string,
  context: DrewContext,
  settings: UserSettings,
  supabase: SupabaseClient,
): Promise<DrewResponse> {
  console.log(`[FSM] Current state: ${currentState}, Input: "${input.substring(0, 50)}"`);

  // Parse input into an event
  const event = await parseEvent(currentState, input, context, supabase);
  console.log(`[FSM] Parsed event: ${event.type}`);

  // Find matching transition
  const transition = TRANSITIONS.find(t => {
    // Match state (or wildcard)
    if (t.from !== '*' && t.from !== currentState) return false;
    // Match event type
    if (t.event !== event.type) return false;
    // Check guard if present
    if (t.guard && !t.guard(context, event)) return false;
    return true;
  });

  let nextState: DrewState;
  let nextContext: DrewContext;

  if (transition) {
    console.log(`[FSM] Transition: ${currentState} -> ${transition.to}`);
    nextState = transition.to;
    nextContext = transition.action ? transition.action(context, event) : context;

    // Special handling for clarify state - remember where we came from
    if (nextState === 'clarify') {
      nextContext = { ...nextContext, previousState: currentState };
    }
  } else {
    // No transition found - this shouldn't happen if our table is complete
    console.log(`[FSM] No transition found for ${currentState} + ${event.type}, going to clarify`);
    nextState = 'clarify';
    nextContext = { ...context, previousState: currentState, clarifyAttempts: context.clarifyAttempts + 1 };
  }

  // === ASYNC SIDE EFFECTS ON STATE ENTRY ===
  // Some states need to load data when entered

  // When entering products state, search for products based on confirmed categories
  if (nextState === 'products' && nextContext.confirmedCategories && nextContext.pendingChecklist) {
    console.log(`[FSM] Entering products state, searching for products...`);
    const products = await searchProductsForCategories(
      supabase,
      nextContext.pendingChecklist,
      nextContext.confirmedCategories,
      nextContext.tradecraft?.job_type,
    );
    nextContext = {
      ...nextContext,
      pendingProducts: products,
      pendingChecklist: undefined, // Clear checklist now that we've used it
    };
  }

  // Generate response for the new state
  const response = generateResponse(nextState, nextContext, event, settings);

  // Add messages to context
  response.context = {
    ...response.context,
    messages: [
      ...context.messages,
      { role: 'user' as const, content: input },
      { role: 'assistant' as const, content: response.message },
    ],
  };

  return response;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// =============================================================================
// PRODUCT SEARCH
// =============================================================================

async function searchProductsForCategories(
  supabase: SupabaseClient,
  checklist: ChecklistItem[],
  confirmedCategories: string[],
  tradecraftJobType?: string,
): Promise<Product[]> {
  console.log(`[FSM] Searching products for categories:`, confirmedCategories);

  // Get category filter based on trade to avoid cross-trade results
  const categoryFilter = getCategoryFilterForTrade(tradecraftJobType);

  const products: Product[] = [];

  // Get search terms from confirmed checklist items
  const confirmedItems = checklist.filter(item =>
    confirmedCategories.includes(item.category)
  );

  for (const item of confirmedItems) {
    // Search for each item's search terms
    for (const term of item.searchTerms.slice(0, 2)) { // Limit to first 2 terms per item
      const { data, error } = await supabase.rpc('search_products', {
        search_query: term,
        result_limit: 2, // Limit results per search
        category_filter: categoryFilter,
      });

      if (!error && data) {
        for (const product of data) {
          // Avoid duplicates
          if (!products.find(p => p.id === product.id)) {
            products.push({
              id: product.id,
              name: product.name,
              price: product.unit_price,
              unit: product.unit || 'ea',
              suggestedQty: item.defaultQty,
            });
          }
        }
      }
    }
  }

  console.log(`[FSM] Found ${products.length} products`);
  return products;
}

function getCategoryFilterForTrade(jobType?: string): string | null {
  if (!jobType) return null;

  // Map job types to catalog categories to filter results
  const tradeCategories: Record<string, string> = {
    'panel_upgrade': 'electrical',
    'ev_charger': 'electrical',
    'recessed_lighting': 'electrical',
    'outlet_circuit': 'electrical',
    'water_heater': 'plumbing',
    'faucet_install': 'plumbing',
  };

  return tradeCategories[jobType] || null;
}

async function loadTradecraftDoc(
  supabase: SupabaseClient,
  jobType: string,
): Promise<TradecraftDoc | null> {
  const { data, error } = await supabase
    .from('tradecraft_docs')
    .select('title, content, job_type, scoping_questions, materials_checklist')
    .eq('job_type', jobType)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.log(`[FSM] Failed to load tradecraft for ${jobType}: ${error?.message}`);
    return null;
  }

  return {
    title: data.title,
    content: data.content,
    job_type: data.job_type,
    scoping_questions: data.scoping_questions as ScopingQuestion[] | undefined,
    materials_checklist: data.materials_checklist as MaterialsChecklist | undefined,
  };
}

function matchQuickReply(input: string, quickReplies: string[]): string | null {
  const normalized = input.trim().toLowerCase();

  // Exact match
  for (const reply of quickReplies) {
    if (reply.toLowerCase() === normalized) return reply;
  }

  // Flexible match - input starts with reply or reply starts with input
  for (const reply of quickReplies) {
    const normalizedReply = reply.toLowerCase();
    if (normalized.startsWith(normalizedReply) ||
        normalizedReply.startsWith(normalized) ||
        normalized.includes(normalizedReply)) {
      return reply;
    }
  }

  return null;
}

function parseHours(input: string): number | null {
  const normalized = input.trim().toLowerCase();

  // Match patterns like "8", "8 hours", "8hrs"
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?$/);
  if (match) {
    return parseFloat(match[1]);
  }

  // Match "half day", "full day" etc
  if (normalized.includes('half day')) return 4;
  if (normalized.includes('full day')) return 8;

  return null;
}

function parsePercent(input: string): number | null {
  const normalized = input.trim().toLowerCase();

  // "no markup", "none", "0"
  if (normalized.match(/^(no markup|none|skip|0%?)$/)) {
    return 0;
  }

  // Match patterns like "20", "20%", "20 percent"
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*%?(?:\s*percent)?$/);
  if (match) {
    return parseFloat(match[1]);
  }

  return null;
}

function calculateTotal(context: DrewContext): number {
  const itemsTotal = context.quoteItems.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  );
  const labor = (context.laborHours || 0) * (context.laborRate || 0);
  // Apply markup to materials only (not labor)
  const markup = itemsTotal * ((context.markupPercent || 0) / 100);
  const materialsWithMarkup = itemsTotal + markup;
  return materialsWithMarkup + labor;
}

function getQuickRepliesForState(
  state: DrewState,
  context: DrewContext,
  settings: UserSettings,
): string[] {
  switch (state) {
    case 'job_selection':
      return ['Panel upgrade', 'EV charger', 'Recessed lighting', 'Something else'];
    case 'scoping':
      if (context.scopingQuestions && context.currentQuestionIndex < context.scopingQuestions.length) {
        return context.scopingQuestions[context.currentQuestionIndex].quickReplies;
      }
      return [];
    case 'labor':
      return ['4 hours', '8 hours', '16 hours', 'Custom'];
    case 'markup':
      return ['10%', '15%', '20%', '25%', 'No markup'];
    case 'review':
      return ['Yes, finalize', 'Make changes'];
    case 'done':
      return ['Start new quote'];
    default:
      return [];
  }
}
