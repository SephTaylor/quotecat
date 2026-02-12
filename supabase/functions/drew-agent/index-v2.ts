// =============================================================================
// DREW AGENT v2 - Clean State Machine Architecture
// =============================================================================
// This replaces the original index.ts with a proper FSM implementation.
// Key changes:
// 1. Single transition table defines all state changes
// 2. No silent fallback to Claude
// 3. Explicit clarify state for unrecognized input
// 4. Claude only used for interpretation (not flow control)
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  dispatch,
  createInitialContext,
  type DrewState,
  type DrewContext,
  type UserSettings,
} from './state-machine.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

interface RequestBody {
  userMessage: string;
  state?: {
    phase?: DrewState;
    context?: DrewContext;
    // Legacy fields for backwards compatibility
    messages?: any[];
    quoteItems?: any[];
    quoteName?: string;
    clientName?: string;
    laborHours?: number;
    laborRate?: number;
    markupPercent?: number;
    tradecraftContext?: string;
    tradecraftJobType?: string;
    pendingChecklist?: any[];
    pendingProducts?: any[];
    isComplete?: boolean;
    scopingQuestions?: any[];
    currentQuestionIndex?: number;
    scopingAnswers?: Record<string, string>;
  };
  userSettings?: UserSettings;
}

// =============================================================================
// STATE MIGRATION
// =============================================================================
// Converts legacy state format to new FSM format

function migrateState(legacyState: RequestBody['state']): { state: DrewState; context: DrewContext } {
  if (!legacyState) {
    return {
      state: 'greeting',
      context: createInitialContext(),
    };
  }

  // If already in new format
  if (legacyState.phase && legacyState.context) {
    return {
      state: legacyState.phase,
      context: legacyState.context,
    };
  }

  // Migrate from legacy format
  const context: DrewContext = {
    quoteItems: legacyState.quoteItems || [],
    quoteName: legacyState.quoteName,
    clientName: legacyState.clientName,
    laborHours: legacyState.laborHours,
    laborRate: legacyState.laborRate,
    markupPercent: legacyState.markupPercent,
    scopingQuestions: legacyState.scopingQuestions,
    currentQuestionIndex: legacyState.currentQuestionIndex || 0,
    scopingAnswers: legacyState.scopingAnswers || {},
    pendingChecklist: legacyState.pendingChecklist,
    clarifyAttempts: 0,
    messages: legacyState.messages || [],
  };

  // Determine state from legacy phase
  let state: DrewState = 'greeting';
  const legacyPhase = (legacyState as any).phase;

  if (legacyPhase) {
    // Map legacy phases to new states
    const phaseMap: Record<string, DrewState> = {
      'greeting': 'greeting',
      'job_selection': 'job_selection',
      'scoping': 'scoping',
      'checklist': 'checklist',
      'products': 'products',
      'labor': 'labor',
      'markup': 'markup',
      'review': 'review',
      'done': 'done',
    };
    state = phaseMap[legacyPhase] || 'greeting';
  } else if (legacyState.isComplete) {
    state = 'done';
  } else if (legacyState.quoteItems && legacyState.quoteItems.length > 0) {
    // Has items, probably in later stages
    if (legacyState.markupPercent !== undefined) {
      state = 'review';
    } else if (legacyState.laborHours !== undefined) {
      state = 'markup';
    } else {
      state = 'labor';
    }
  }

  return { state, context };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { userMessage, state: legacyState, userSettings = {} } = body;

    console.log(`[drew-agent-v2] Received message: "${userMessage?.substring(0, 50)}"`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Migrate legacy state to new format
    const { state: currentState, context } = migrateState(legacyState);
    console.log(`[drew-agent-v2] Current state: ${currentState}`);

    // Handle empty message (initial greeting)
    const message = userMessage?.trim() || '';
    const effectiveMessage = message || '__START__';

    // Dispatch to state machine
    const response = await dispatch(
      currentState,
      effectiveMessage === '__START__' ? '' : effectiveMessage,
      context,
      userSettings,
      supabase,
    );

    console.log(`[drew-agent-v2] Response state: ${response.state}, message: "${response.message.substring(0, 50)}"`);

    // Format response for client (backwards compatible)
    const clientResponse = {
      message: response.message,
      quickReplies: response.quickReplies,
      display: response.display,
      state: {
        // New format
        phase: response.state,
        context: response.context,
        // Legacy format (for backwards compatibility)
        messages: response.context.messages,
        quoteItems: response.context.quoteItems,
        quoteName: response.context.quoteName,
        clientName: response.context.clientName,
        laborHours: response.context.laborHours,
        laborRate: response.context.laborRate,
        markupPercent: response.context.markupPercent,
        pendingChecklist: response.context.pendingChecklist,
        pendingProducts: response.context.pendingProducts,
        scopingQuestions: response.context.scopingQuestions,
        currentQuestionIndex: response.context.currentQuestionIndex,
        scopingAnswers: response.context.scopingAnswers,
        isComplete: response.isComplete,
      },
    };

    return new Response(JSON.stringify(clientResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[drew-agent-v2] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        message: "Sorry, I hit a snag. Let's try that again.",
        quickReplies: ['Start over'],
        state: {
          phase: 'greeting',
          context: createInitialContext(),
        },
      }),
      {
        status: 200, // Return 200 so client can show error message
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
