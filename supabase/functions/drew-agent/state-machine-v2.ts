// =============================================================================
// DREW STATE MACHINE v2 - Fully Declarative
// =============================================================================
// Following XState patterns without the library:
// 1. States are objects with entry actions - no switch statements
// 2. Transitions are declared, not coded
// 3. Guards are named functions
// 4. Actions are named and separate from state logic
// 5. "always" transitions for automatic state skipping
// =============================================================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callTradeAgent, quickMatchJobType, applyChecklistAdjustments } from './trade-agents.ts';
import type { ChecklistAdjustment } from './trade-agents.ts';

// =============================================================================
// TYPES
// =============================================================================

export type DrewState =
  | 'greeting'
  | 'job_selection'
  | 'scoping'
  | 'checklist'
  | 'products'
  | 'labor'
  | 'markup'
  | 'review'
  | 'done'
  | 'clarify';

export type DrewEventType =
  | 'START'
  | 'SELECT_JOB'
  | 'ANSWER_SCOPING'
  | 'CONFIRM_CHECKLIST'
  | 'SKIP_CHECKLIST'
  | 'ADD_PRODUCTS'
  | 'SKIP_PRODUCTS'
  | 'SET_LABOR'
  | 'SET_MARKUP'
  | 'FINALIZE'
  | 'START_NEW'
  | 'UNCLEAR';

export interface DrewEvent {
  type: DrewEventType;
  [key: string]: any;
}

export interface DrewContext {
  quoteItems: QuoteItem[];
  quoteName?: string;
  clientName?: string;
  laborHours?: number;
  laborRate?: number;
  markupPercent?: number;
  tradecraft?: TradecraftDoc;
  scopingQuestions?: ScopingQuestion[];
  currentQuestionIndex: number;
  scopingAnswers: Record<string, string>;
  pendingChecklist?: ChecklistItem[];
  confirmedCategories?: string[];
  pendingProducts?: Product[];
  previousState?: DrewState;
  clarifyAttempts: number;
  messages: Message[];
}

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

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface DisplayData {
  type: 'checklist' | 'products' | 'added' | 'summary';
  checklist?: ChecklistItem[];
  products?: Product[];
}

export interface UserSettings {
  defaultLaborRate?: number;
  defaultMarkupPercent?: number;
}

// =============================================================================
// GUARDS - Named boolean functions
// =============================================================================

const guards = {
  hasMoreScopingQuestions: (ctx: DrewContext): boolean => {
    if (!ctx.scopingQuestions) return false;
    return ctx.currentQuestionIndex < ctx.scopingQuestions.length - 1;
  },

  noMoreScopingQuestions: (ctx: DrewContext): boolean => {
    if (!ctx.scopingQuestions) return true;
    return ctx.currentQuestionIndex >= ctx.scopingQuestions.length - 1;
  },

  hasChecklist: (ctx: DrewContext): boolean => {
    return !!ctx.pendingChecklist && ctx.pendingChecklist.length > 0;
  },

  noChecklist: (ctx: DrewContext): boolean => {
    return !ctx.pendingChecklist || ctx.pendingChecklist.length === 0;
  },

  hasProducts: (ctx: DrewContext): boolean => {
    return !!ctx.pendingProducts && ctx.pendingProducts.length > 0;
  },

  noProducts: (ctx: DrewContext): boolean => {
    return !ctx.pendingProducts || ctx.pendingProducts.length === 0;
  },

  canRetryPreviousState: (ctx: DrewContext): boolean => {
    return !!ctx.previousState && ctx.previousState !== 'clarify';
  },
};

// =============================================================================
// ACTIONS - Named context transformers
// =============================================================================

const actions = {
  loadTradecraft: (ctx: DrewContext, event: DrewEvent): DrewContext => {
    const { tradecraft } = event;
    return {
      ...ctx,
      tradecraft,
      scopingQuestions: tradecraft?.scoping_questions,
      currentQuestionIndex: 0,
      scopingAnswers: {},
      pendingChecklist: tradecraft?.materials_checklist?.items,
    };
  },

  recordScopingAnswer: (ctx: DrewContext, event: DrewEvent): DrewContext => {
    return {
      ...ctx,
      scopingAnswers: {
        ...ctx.scopingAnswers,
        [event.questionId]: event.answer,
      },
      currentQuestionIndex: ctx.currentQuestionIndex + 1,
    };
  },

  confirmChecklist: (ctx: DrewContext, event: DrewEvent): DrewContext => {
    return {
      ...ctx,
      confirmedCategories: event.categories,
    };
  },

  setProducts: (ctx: DrewContext, event: DrewEvent): DrewContext => {
    return {
      ...ctx,
      pendingProducts: event.products,
      pendingChecklist: undefined,
    };
  },

  addProducts: (ctx: DrewContext, event: DrewEvent): DrewContext => {
    const newItems = event.products.map((p: any) => ({
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
  },

  setLabor: (ctx: DrewContext, event: DrewEvent): DrewContext => {
    return {
      ...ctx,
      laborHours: event.hours,
      laborRate: event.rate,
    };
  },

  setMarkup: (ctx: DrewContext, event: DrewEvent): DrewContext => {
    return {
      ...ctx,
      markupPercent: event.percent,
    };
  },

  enterClarify: (ctx: DrewContext, _event: DrewEvent, fromState: DrewState): DrewContext => {
    return {
      ...ctx,
      previousState: fromState,
      clarifyAttempts: ctx.clarifyAttempts + 1,
    };
  },

  reset: (_ctx: DrewContext, _event: DrewEvent): DrewContext => {
    return createInitialContext();
  },
};

// =============================================================================
// ENTRY HANDLERS - What to show when entering a state
// =============================================================================

interface EntryResult {
  message: string;
  quickReplies: string[];
  display?: DisplayData;
  isComplete?: boolean;
}

type EntryHandler = (ctx: DrewContext, event: DrewEvent, settings: UserSettings) => EntryResult;

const entryHandlers: Record<DrewState, EntryHandler> = {
  greeting: () => ({
    message: "Hey! I'm Drew, your quoting assistant. What kind of job are we working on?",
    quickReplies: ['Panel upgrade', 'EV charger', 'Recessed lighting', 'Ceiling fan', 'Something else'],
  }),

  job_selection: () => ({
    message: "What kind of job are we quoting today?",
    quickReplies: ['Panel upgrade', 'EV charger', 'Recessed lighting', 'Ceiling fan', 'Something else'],
  }),

  scoping: (ctx, event) => {
    const question = ctx.scopingQuestions?.[ctx.currentQuestionIndex];
    if (!question) {
      return {
        message: "Let's move on.",
        quickReplies: [],
      };
    }

    const isFirst = ctx.currentQuestionIndex === 0;
    const prefix = isFirst
      ? `${ctx.tradecraft?.title || 'Got it'}! `
      : `${event.answer || ''}, got it. `;

    return {
      message: `${prefix}${question.question}`,
      quickReplies: question.quickReplies,
    };
  },

  checklist: (ctx) => ({
    message: "Here's what you'll typically need. Uncheck anything you already have:",
    quickReplies: [],
    display: {
      type: 'checklist',
      checklist: ctx.pendingChecklist,
    },
  }),

  products: (ctx) => ({
    message: `Found ${ctx.pendingProducts?.length || 0} products. Select what you need:`,
    quickReplies: ['Skip products'],
    display: {
      type: 'products',
      products: ctx.pendingProducts,
    },
  }),

  labor: (_ctx, _event, settings) => ({
    message: `How many labor hours for this job? (at $${settings.defaultLaborRate || 50}/hr)`,
    quickReplies: ['4 hours', '8 hours', '16 hours', 'Custom'],
  }),

  markup: () => ({
    message: "What markup percentage?",
    quickReplies: ['10%', '15%', '20%', '25%', 'No markup'],
  }),

  review: (ctx) => {
    const total = calculateTotal(ctx);
    return {
      message: `Quote ready! Total: $${total.toFixed(2)}. Ready to finalize?`,
      quickReplies: ['Yes, finalize', 'Make changes'],
      display: { type: 'summary' },
    };
  },

  done: () => ({
    message: "Quote saved! You can edit it anytime from the quotes list.",
    quickReplies: ['Start new quote'],
    isComplete: true,
  }),

  clarify: (ctx) => {
    const messages: Record<DrewState, string> = {
      job_selection: "I didn't catch that job type. Could you pick from the options?",
      scoping: "I didn't recognize that answer. Could you pick from the options above?",
      labor: "I need a number of hours. How many hours for this job?",
      markup: "I need a percentage. What markup would you like?",
      review: "Would you like to finalize this quote, or make changes?",
      greeting: "Would you like to start a new quote?",
      checklist: "Would you like to confirm the materials, or skip?",
      products: "Would you like to add these products, or skip?",
      done: "Would you like to start a new quote?",
      clarify: "I'm not sure what you mean. Could you try again?",
    };

    return {
      message: messages[ctx.previousState || 'job_selection'],
      quickReplies: getQuickRepliesForState(ctx.previousState || 'job_selection', ctx),
    };
  },
};

// =============================================================================
// STATE MACHINE DEFINITION - Fully Declarative
// =============================================================================

interface Transition {
  target: DrewState;
  guard?: keyof typeof guards;
  actions?: (keyof typeof actions)[];
}

interface StateDefinition {
  on: Partial<Record<DrewEventType, Transition | Transition[]>>;
  always?: Transition[];  // Automatic transitions checked on entry
}

const machine: Record<DrewState, StateDefinition> = {
  greeting: {
    on: {
      START: { target: 'job_selection' },
      START_NEW: { target: 'job_selection', actions: ['reset'] },
    },
  },

  job_selection: {
    on: {
      SELECT_JOB: { target: 'scoping', actions: ['loadTradecraft'] },
      UNCLEAR: { target: 'clarify', actions: ['enterClarify'] },
      START_NEW: { target: 'greeting', actions: ['reset'] },
    },
  },

  scoping: {
    on: {
      ANSWER_SCOPING: [
        { target: 'scoping', guard: 'hasMoreScopingQuestions', actions: ['recordScopingAnswer'] },
        { target: 'checklist', guard: 'noMoreScopingQuestions', actions: ['recordScopingAnswer'] },
      ],
      UNCLEAR: { target: 'clarify', actions: ['enterClarify'] },
      START_NEW: { target: 'greeting', actions: ['reset'] },
    },
    always: [
      { target: 'checklist', guard: 'noChecklist' },  // Skip if no scoping questions
    ],
  },

  checklist: {
    on: {
      CONFIRM_CHECKLIST: { target: 'products', actions: ['confirmChecklist'] },
      SKIP_CHECKLIST: { target: 'labor' },
      START_NEW: { target: 'greeting', actions: ['reset'] },
    },
    always: [
      { target: 'labor', guard: 'noChecklist' },  // Skip if no checklist
    ],
  },

  products: {
    on: {
      ADD_PRODUCTS: { target: 'labor', actions: ['addProducts'] },
      SKIP_PRODUCTS: { target: 'labor' },
      START_NEW: { target: 'greeting', actions: ['reset'] },
    },
    always: [
      { target: 'labor', guard: 'noProducts' },  // Skip if no products found
    ],
  },

  labor: {
    on: {
      SET_LABOR: { target: 'markup', actions: ['setLabor'] },
      UNCLEAR: { target: 'clarify', actions: ['enterClarify'] },
      START_NEW: { target: 'greeting', actions: ['reset'] },
    },
  },

  markup: {
    on: {
      SET_MARKUP: { target: 'review', actions: ['setMarkup'] },
      UNCLEAR: { target: 'clarify', actions: ['enterClarify'] },
      START_NEW: { target: 'greeting', actions: ['reset'] },
    },
  },

  review: {
    on: {
      FINALIZE: { target: 'done' },
      UNCLEAR: { target: 'clarify', actions: ['enterClarify'] },
      START_NEW: { target: 'greeting', actions: ['reset'] },
    },
  },

  done: {
    on: {
      START_NEW: { target: 'greeting', actions: ['reset'] },
    },
  },

  clarify: {
    on: {
      // Any valid event for the previous state should work here
      // This is handled specially in dispatch
      START_NEW: { target: 'greeting', actions: ['reset'] },
    },
  },
};

// =============================================================================
// EVENT PARSER
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
  'ceiling fan': 'ceiling_fan',
  'fan': 'ceiling_fan',
  'smoke detector': 'smoke_detectors',
  'smoke detectors': 'smoke_detectors',
  'smoke alarm': 'smoke_detectors',
  'co detector': 'smoke_detectors',
  'range': 'range_dryer_circuit',
  'dryer': 'range_dryer_circuit',
  'dryer outlet': 'range_dryer_circuit',
  'range outlet': 'range_dryer_circuit',
  '240v': 'range_dryer_circuit',
};

export async function parseEvent(
  state: DrewState,
  input: string,
  context: DrewContext,
  supabase: SupabaseClient,
): Promise<DrewEvent> {
  const normalized = input.trim().toLowerCase();

  // Global commands
  if (normalized.match(/^(start new|new quote|start over|start fresh)$/)) {
    return { type: 'START_NEW' };
  }

  // State-specific parsing
  switch (state) {
    case 'greeting':
      return { type: 'START' };

    case 'job_selection': {
      // 1. Try exact pattern matching first (fastest, no AI)
      const jobType = JOB_TYPE_PATTERNS[normalized];
      if (jobType) {
        const tradecraft = await loadTradecraftDoc(supabase, jobType);
        if (tradecraft) {
          return { type: 'SELECT_JOB', jobType, tradecraft };
        }
      }

      // 2. Try keyword matching (still fast, no AI)
      const quickMatch = quickMatchJobType(input);
      if (quickMatch) {
        console.log(`[FSM] Quick match found: ${quickMatch.jobType} (${quickMatch.confidence})`);
        const tradecraft = await loadTradecraftDoc(supabase, quickMatch.jobType);
        if (tradecraft) {
          return { type: 'SELECT_JOB', jobType: quickMatch.jobType, tradecraft };
        }
      }

      // 3. Call trade agent for interpretation (uses Claude Haiku)
      console.log('[FSM] Calling trade agent to interpret job type');
      const agentResponse = await callTradeAgent({
        trade: 'electrical', // TODO: Detect trade from input
        task: 'interpret_job',
        userInput: input,
        context: {
          availableJobTypes: Object.values(JOB_TYPE_PATTERNS),
        },
      });

      if (agentResponse.success && agentResponse.jobType) {
        const tradecraft = await loadTradecraftDoc(supabase, agentResponse.jobType);
        if (tradecraft) {
          return {
            type: 'SELECT_JOB',
            jobType: agentResponse.jobType,
            tradecraft,
            agentMessage: agentResponse.message,
          };
        }
      }

      // 4. If agent couldn't determine, return unclear with agent's message
      return {
        type: 'UNCLEAR',
        originalInput: input,
        agentMessage: agentResponse.message,
        quickReplies: agentResponse.quickReplies,
      };
    }

    case 'scoping': {
      const question = context.scopingQuestions?.[context.currentQuestionIndex];
      if (!question) return { type: 'UNCLEAR', originalInput: input };

      const matched = matchQuickReply(input, question.quickReplies);
      if (matched) {
        return { type: 'ANSWER_SCOPING', answer: matched, questionId: question.id };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'checklist': {
      if (normalized.match(/^(skip|no materials|none)$/)) {
        return { type: 'SKIP_CHECKLIST' };
      }
      if (input.startsWith('CONFIRM_CHECKLIST:')) {
        const categories = JSON.parse(input.replace('CONFIRM_CHECKLIST:', ''));
        return { type: 'CONFIRM_CHECKLIST', categories };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'products': {
      // Match: "skip", "skip products", "skip these", "no products", "none", "done"
      if (normalized.match(/^(skip(\s+(products|these|materials))?|no products|none|done)$/)) {
        return { type: 'SKIP_PRODUCTS' };
      }
      if (input.startsWith('ADD_SELECTED:')) {
        const products = JSON.parse(input.replace('ADD_SELECTED:', ''));
        return { type: 'ADD_PRODUCTS', products };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'labor': {
      const hours = parseHours(input);
      if (hours !== null) {
        return { type: 'SET_LABOR', hours, rate: 50 };
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
      // Match: "yes", "finalize", "yes, finalize", "yes finalize", "confirm", etc.
      if (normalized.match(/^(yes[,\s]*)?(finalize|confirm|done|looks good|save|ready)$/)) {
        return { type: 'FINALIZE' };
      }
      if (normalized === 'yes') {
        return { type: 'FINALIZE' };
      }
      return { type: 'UNCLEAR', originalInput: input };
    }

    case 'done':
      return { type: 'START_NEW' };

    case 'clarify': {
      // First, try to re-parse for the previous state
      if (context.previousState && context.previousState !== 'clarify') {
        const retryEvent = await parseEvent(context.previousState, input, context, supabase);
        // If we got a valid event (not UNCLEAR), use it
        if (retryEvent.type !== 'UNCLEAR') {
          return retryEvent;
        }
      }

      // If still unclear after 2 attempts, call trade agent for clarification
      if (context.clarifyAttempts >= 2) {
        console.log('[FSM] Calling trade agent to clarify input');
        const agentResponse = await callTradeAgent({
          trade: 'electrical',
          task: 'clarify_input',
          userInput: input,
          context: {
            currentState: context.previousState,
            previousQuestion: context.scopingQuestions?.[context.currentQuestionIndex]?.question,
            scopingAnswers: context.scopingAnswers,
          },
        });

        if (agentResponse.success && agentResponse.suggestedAction === 'continue') {
          // Agent understood, try to continue with clarified intent
          return {
            type: 'UNCLEAR',
            originalInput: input,
            agentMessage: agentResponse.message,
            quickReplies: agentResponse.quickReplies,
            clarifiedIntent: agentResponse.clarifiedIntent,
          };
        }
      }

      return { type: 'UNCLEAR', originalInput: input };
    }

    default:
      return { type: 'UNCLEAR', originalInput: input };
  }
}

// =============================================================================
// DISPATCH - The Interpreter
// =============================================================================

export async function dispatch(
  currentState: DrewState,
  input: string,
  context: DrewContext,
  settings: UserSettings,
  supabase: SupabaseClient,
): Promise<DrewResponse> {
  console.log(`[FSM] State: ${currentState}, Input: "${input.substring(0, 50)}"`);

  // 1. Parse input to event
  const event = await parseEvent(currentState, input, context, supabase);
  console.log(`[FSM] Event: ${event.type}`);

  // 2. Find transition
  const stateConfig = machine[currentState];
  let transition: Transition | undefined;

  // Check event-based transitions
  const transitions = stateConfig.on[event.type];
  if (transitions) {
    if (Array.isArray(transitions)) {
      // Multiple possible transitions - find first matching guard
      transition = transitions.find(t => !t.guard || guards[t.guard](context));
    } else {
      transition = (!transitions.guard || guards[transitions.guard](context)) ? transitions : undefined;
    }
  }

  // 3. Execute transition
  let nextState: DrewState;
  let nextContext: DrewContext = context;

  if (transition) {
    console.log(`[FSM] Transition: ${currentState} -> ${transition.target}`);
    nextState = transition.target;

    // Execute actions
    if (transition.actions) {
      for (const actionName of transition.actions) {
        if (actionName === 'enterClarify') {
          nextContext = actions.enterClarify(nextContext, event, currentState);
        } else {
          nextContext = actions[actionName](nextContext, event);
        }
      }
    }
  } else {
    // No transition found - go to clarify
    console.log(`[FSM] No transition for ${event.type} in ${currentState}`);
    nextState = 'clarify';
    // IMPORTANT: If already in clarify, keep the original previousState
    // to avoid losing context about which state to retry
    if (currentState === 'clarify' && context.previousState) {
      nextContext = {
        ...context,
        clarifyAttempts: context.clarifyAttempts + 1,
      };
    } else {
      nextContext = actions.enterClarify(context, event, currentState);
    }
  }

  // 4. Async side effects BEFORE checking "always" transitions

  // 4a. Dynamic checklist adjustment when entering checklist state
  if (nextState === 'checklist' && nextContext.pendingChecklist && Object.keys(nextContext.scopingAnswers).length > 0) {
    console.log(`[FSM] Adjusting checklist based on scoping answers...`);
    try {
      const agentResponse = await callTradeAgent({
        trade: 'electrical',
        task: 'adjust_checklist',
        userInput: '', // Not needed for this task
        context: {
          scopingAnswers: nextContext.scopingAnswers,
          baseChecklist: nextContext.pendingChecklist,
          jobType: nextContext.tradecraft?.job_type,
        },
      });

      if (agentResponse.success && agentResponse.adjustments && agentResponse.adjustments.length > 0) {
        console.log(`[FSM] Applying ${agentResponse.adjustments.length} checklist adjustments`);
        const adjustedChecklist = applyChecklistAdjustments(
          nextContext.pendingChecklist,
          agentResponse.adjustments as ChecklistAdjustment[]
        );
        nextContext = { ...nextContext, pendingChecklist: adjustedChecklist };
      } else {
        console.log(`[FSM] No checklist adjustments needed`);
      }
    } catch (error) {
      console.error(`[FSM] Checklist adjustment failed, using base checklist:`, error);
      // Continue with base checklist if adjustment fails
    }
  }

  // 4b. Product loading must happen before noProducts guard can evaluate correctly
  if (nextState === 'products' && nextContext.confirmedCategories && nextContext.pendingChecklist) {
    console.log(`[FSM] Loading products...`);
    const products = await searchProductsForCategories(
      supabase,
      nextContext.pendingChecklist,
      nextContext.confirmedCategories,
      nextContext.tradecraft?.job_type,
    );
    nextContext = { ...nextContext, pendingProducts: products, pendingChecklist: undefined };
  }

  // 5. Check "always" transitions (automatic state skipping)
  // Now guards like noProducts can evaluate correctly since products are loaded
  const nextStateConfig = machine[nextState];
  if (nextStateConfig.always) {
    for (const autoTransition of nextStateConfig.always) {
      if (!autoTransition.guard || guards[autoTransition.guard](nextContext)) {
        console.log(`[FSM] Auto-transition: ${nextState} -> ${autoTransition.target}`);
        nextState = autoTransition.target;
        break;
      }
    }
  }

  // 6. Generate response from entry handler
  const entryResult = entryHandlers[nextState](nextContext, event, settings);

  // 7. Build final response
  const response: DrewResponse = {
    message: entryResult.message,
    quickReplies: entryResult.quickReplies,
    display: entryResult.display,
    context: {
      ...nextContext,
      messages: [
        ...context.messages,
        { role: 'user', content: input },
        { role: 'assistant', content: entryResult.message },
      ],
    },
    state: nextState,
    isComplete: entryResult.isComplete,
  };

  return response;
}

// =============================================================================
// HELPERS
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

async function loadTradecraftDoc(supabase: SupabaseClient, jobType: string): Promise<TradecraftDoc | null> {
  const { data, error } = await supabase
    .from('tradecraft_docs')
    .select('title, content, job_type, scoping_questions, materials_checklist')
    .eq('job_type', jobType)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  return {
    title: data.title,
    content: data.content,
    job_type: data.job_type,
    scoping_questions: data.scoping_questions,
    materials_checklist: data.materials_checklist,
  };
}

async function searchProductsForCategories(
  supabase: SupabaseClient,
  checklist: ChecklistItem[],
  confirmedCategories: string[],
  tradecraftJobType?: string,
): Promise<Product[]> {
  const categoryFilter = getCategoryFilterForTrade(tradecraftJobType);
  const products: Product[] = [];

  const confirmedItems = checklist.filter(item => confirmedCategories.includes(item.category));

  for (const item of confirmedItems) {
    for (const term of item.searchTerms.slice(0, 2)) {
      const { data, error } = await supabase.rpc('search_products', {
        search_query: term,
        result_limit: 2,
        category_filter: categoryFilter,
      });

      if (!error && data) {
        for (const product of data) {
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

  return products;
}

function getCategoryFilterForTrade(jobType?: string): string | null {
  const tradeCategories: Record<string, string> = {
    'panel_upgrade': 'electrical',
    'ev_charger': 'electrical',
    'recessed_lighting': 'electrical',
    'outlet_circuit': 'electrical',
    'ceiling_fan': 'electrical',
    'smoke_detectors': 'electrical',
    'range_dryer_circuit': 'electrical',
    'water_heater': 'plumbing',
  };
  return jobType ? tradeCategories[jobType] || null : null;
}

function matchQuickReply(input: string, quickReplies: string[]): string | null {
  const normalized = input.trim().toLowerCase();

  for (const reply of quickReplies) {
    if (reply.toLowerCase() === normalized) return reply;
  }

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
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?$/);
  if (match) return parseFloat(match[1]);
  if (normalized.includes('half day')) return 4;
  if (normalized.includes('full day')) return 8;
  return null;
}

function parsePercent(input: string): number | null {
  const normalized = input.trim().toLowerCase();
  if (normalized.match(/^(no markup|none|skip|0%?)$/)) return 0;
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*%?(?:\s*percent)?$/);
  if (match) return parseFloat(match[1]);
  return null;
}

function calculateTotal(ctx: DrewContext): number {
  const itemsTotal = ctx.quoteItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const labor = (ctx.laborHours || 0) * (ctx.laborRate || 0);
  // Apply markup to materials only (not labor)
  const markup = itemsTotal * ((ctx.markupPercent || 0) / 100);
  const materialsWithMarkup = itemsTotal + markup;
  return materialsWithMarkup + labor;
}

function getQuickRepliesForState(state: DrewState, ctx: DrewContext): string[] {
  switch (state) {
    case 'job_selection': return ['Panel upgrade', 'EV charger', 'Recessed lighting', 'Ceiling fan', 'Something else'];
    case 'scoping': return ctx.scopingQuestions?.[ctx.currentQuestionIndex]?.quickReplies || [];
    case 'labor': return ['4 hours', '8 hours', '16 hours', 'Custom'];
    case 'markup': return ['10%', '15%', '20%', '25%', 'No markup'];
    case 'review': return ['Yes, finalize', 'Make changes'];
    case 'done': return ['Start new quote'];
    default: return [];
  }
}
