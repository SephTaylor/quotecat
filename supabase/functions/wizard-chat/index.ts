// supabase/functions/wizard-chat/index.ts
// Edge function for Quote Wizard (Drew) - wraps Claude API with tool use

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `You are Drew, a friendly construction quoting assistant. Help contractors build quotes quickly.

## Your Style
- Friendly and brief - 1-2 sentences max
- Ask ONE question at a time, then wait for the answer
- Never ask multiple questions in one message

## CONVERSATION FLOW

1. User describes project → Ask for dimensions (ONE question)
2. Get dimensions → Ask budget preference (ONE question)
3. Get budget → Say "Let me find you some options..." then search
4. Show 2-3 options with prices → Ask which they prefer
5. Get preference → Add items to quote

## CRITICAL: ONE QUESTION AT A TIME
BAD: "What are the dimensions? Also, what's your budget? And is this new construction?"
GOOD: "What size is the bathroom?"
(wait for answer)
GOOD: "Standard or premium finishes?"
(wait for answer)

## Available Tools

**searchCatalog** - Find products
- query: string (e.g., "toilet", "drywall")

**addItem** - Add to quote (only after user confirms)
- productId, productName, qty, unitPrice

**setLabor** - Set labor
- hours, rate

**applyMarkup** - Markup %
- percent

## When Presenting Options
Show cleanly:
"**Toilets:**
- Standard: $185
- Comfort height: $225

Which do you prefer?"

## Construction Math
- Tile: sq ft + 10% waste
- Drywall: wall sq ft ÷ 32
- Studs: perimeter in inches ÷ 16`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: Message[];
  catalogContext?: string;
}

serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    console.log('[wizard-chat] Function started');

    if (!ANTHROPIC_API_KEY) {
      console.error('[wizard-chat] ANTHROPIC_API_KEY is not set');
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    console.log('[wizard-chat] API key present, length:', ANTHROPIC_API_KEY.length);

    let body: RequestBody;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[wizard-chat] Failed to parse request body:', parseError);
      throw new Error('Invalid request body');
    }

    const { messages, catalogContext } = body;
    console.log('[wizard-chat] Received request with', messages?.length || 0, 'messages');

    // Build the full system prompt with catalog context
    let fullSystemPrompt = SYSTEM_PROMPT;
    if (catalogContext) {
      fullSystemPrompt += `\n\n## Available Products\n${catalogContext}`;
      console.log('[wizard-chat] System prompt size:', fullSystemPrompt.length, 'chars');
    }

    // Convert to Claude format
    const claudeMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Define tools for Claude
    const tools = [
      {
        name: 'searchCatalog',
        description: 'Search the user\'s product catalog to find materials. Use this BEFORE adding items to find available products and their IDs.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term (e.g., "2x4 lumber", "drywall sheet", "outlet")' },
            category: { type: 'string', description: 'Optional category filter (e.g., "framing", "electrical", "drywall")' },
            limit: { type: 'number', description: 'Max results to return (default 10)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'addItem',
        description: 'Add a product/material to the quote. ONLY use products found via searchCatalog.',
        input_schema: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Product ID from searchCatalog results' },
            productName: { type: 'string', description: 'Product name from searchCatalog results' },
            qty: { type: 'number', description: 'Quantity to add' },
            unitPrice: { type: 'number', description: 'Unit price from searchCatalog results' },
          },
          required: ['productId', 'productName', 'qty', 'unitPrice'],
        },
      },
      {
        name: 'setLabor',
        description: 'Set labor hours and hourly rate',
        input_schema: {
          type: 'object',
          properties: {
            hours: { type: 'number', description: 'Number of labor hours' },
            rate: { type: 'number', description: 'Hourly rate in dollars' },
          },
          required: ['hours', 'rate'],
        },
      },
      {
        name: 'applyMarkup',
        description: 'Apply a markup percentage to the quote',
        input_schema: {
          type: 'object',
          properties: {
            percent: { type: 'number', description: 'Markup percentage (e.g., 15 for 15%)' },
          },
          required: ['percent'],
        },
      },
      {
        name: 'setClientName',
        description: 'Set the client name on the quote',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Client name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'setQuoteName',
        description: 'Set the quote/project name',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Quote/project name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'suggestAssembly',
        description: 'Suggest a pre-built assembly template',
        input_schema: {
          type: 'object',
          properties: {
            assemblyId: { type: 'string', description: 'Assembly ID' },
            assemblyName: { type: 'string', description: 'Assembly name' },
          },
          required: ['assemblyId', 'assemblyName'],
        },
      },
    ];

    // Call Claude API
    console.log('[wizard-chat] Calling Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: fullSystemPrompt,
        messages: claudeMessages,
        tools,
      }),
    });

    console.log('[wizard-chat] Claude API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[wizard-chat] Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const claudeResponse = await response.json();
    console.log('[wizard-chat] Claude response stop_reason:', claudeResponse.stop_reason);

    // Extract text and tool calls from response
    let message = '';
    const toolCalls: Array<{ type: string; [key: string]: any }> = [];

    for (const block of claudeResponse.content) {
      if (block.type === 'text') {
        message = block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          type: block.name,
          ...block.input,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        done: claudeResponse.stop_reason === 'end_turn' && toolCalls.length === 0,
      }),
      { headers },
    );
  } catch (error) {
    console.error('Error in wizard-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers },
    );
  }
});
