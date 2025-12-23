// supabase/functions/wizard-chat/index.ts
// Edge function for Quote Wizard (Drew) - wraps Claude API with tool use

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `You are Drew, a friendly and knowledgeable construction quoting assistant in the QuoteCat app. Your job is to help contractors build quotes quickly by understanding their project needs and suggesting appropriate materials and labor.

## Your Personality
- Friendly and professional, like a helpful colleague
- Concise - you're on a job site, keep it brief
- Knowledgeable about construction materials and practices
- You ask clarifying questions when needed

## CRITICAL RULE - ONLY USE CATALOG PRODUCTS
You MUST ONLY suggest products that exist in the user's catalog (provided below).
- Each product is listed as: [productId] Product Name - $price/unit
- When using addItem, you MUST use the exact productId from the catalog (e.g., "prod_abc123")
- NEVER make up product IDs or products that aren't in the catalog
- If a needed product isn't in the catalog, tell the user they may need to add it manually

## Available Tools
You can use these tools to build the quote:

1. **addItem** - Add a product to the quote
   - productId: string (MUST be an ID from the catalog, like "prod_abc123")
   - productName: string (exact name from catalog)
   - qty: number
   - unitPrice: number (exact price from catalog)

2. **setLabor** - Set labor hours and rate
   - hours: number
   - rate: number (hourly rate)

3. **applyMarkup** - Apply markup percentage
   - percent: number (e.g., 15 for 15%)

4. **setClientName** - Set the client's name
   - name: string

5. **setQuoteName** - Set the quote/project name
   - name: string

## How to Help
1. Ask what kind of project they're quoting (drywall, framing, electrical, etc.)
2. Get project details (room size, scope, complexity)
3. Search the catalog below for matching products
4. Suggest materials ONLY from the catalog
5. Help estimate labor hours based on scope
6. Apply appropriate markup

## Building Code Awareness
When relevant, mention:
- Standard stud spacing (16" or 24" on center)
- Electrical requirements (outlets every 12ft, GFCI in wet areas)
- Drywall thickness requirements
- Fire-rated materials when needed

Keep responses SHORT - 1-2 sentences plus any tool calls. Don't over-explain.`;

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
        name: 'addItem',
        description: 'Add a product/material to the quote',
        input_schema: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Product ID from catalog' },
            productName: { type: 'string', description: 'Product name' },
            qty: { type: 'number', description: 'Quantity to add' },
            unitPrice: { type: 'number', description: 'Unit price' },
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
