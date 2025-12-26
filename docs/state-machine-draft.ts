// docs/state-machine-draft.ts
// DRAFT: State machine approach for Quote Wizard (Drew)
// Save for implementation - DO NOT deploy directly
//
// The idea: Server controls flow, Claude adds personality
// This prevents Drew from repeating questions or losing track

// =============================================================================
// STATE TYPES
// =============================================================================

interface WizardState {
  phase: 'setup' | 'generating_checklist' | 'building' | 'wrapup' | 'done';
  // Setup phase tracking
  setupStep: number; // 0=project, 1=size, 2=scope, 3=finishes
  projectType?: string;
  size?: string;
  scope?: string;
  finishes?: string;
  // Building phase tracking
  checklist: string[]; // Categories to go through
  checklistIndex: number; // Current position
  waitingForSelection: boolean; // Are we showing products to pick from?
  lastSearchResults?: Array<{ id: string; name: string; price: number }>;
  // Items added
  itemsAdded: Array<{ id: string; name: string; price: number; qty: number }>;
  // Wrapup phase tracking
  wrapupStep: number; // 0=labor, 1=markup, 2=name, 3=client
  laborHours?: number;
  laborRate?: number;
  markup?: number;
  quoteName?: string;
  clientName?: string;
}

// =============================================================================
// SETUP QUESTIONS CONFIG
// =============================================================================

const SETUP_QUESTIONS = [
  {
    key: 'projectType',
    prompt: 'Ask what type of project (bathroom, kitchen, deck, etc). Be casual and friendly.',
    quickReplies: ['Bathroom', 'Kitchen', 'Deck', 'Other'],
  },
  {
    key: 'size',
    prompt: 'Ask about the size. Be brief.',
    quickReplies: ['Small', 'Medium', 'Large', 'Custom'],
  },
  {
    key: 'scope',
    prompt: 'Ask about scope of work - full remodel, cosmetic refresh, or partial update. Keep it short.',
    quickReplies: ['Full remodel', 'Cosmetic refresh', 'Partial update'],
  },
  {
    key: 'finishes',
    prompt: 'Ask about finish level - budget, standard, or premium. One sentence max.',
    quickReplies: ['Budget', 'Standard', 'Premium'],
  },
];

const WRAPUP_QUESTIONS = [
  { key: 'labor', prompt: 'Ask how many labor hours for this job. Keep it casual.' },
  { key: 'markup', prompt: 'Ask what markup percentage they want to apply.' },
  { key: 'quoteName', prompt: 'Ask what they want to name this quote.' },
  { key: 'clientName', prompt: 'Ask who the client is.' },
];

// =============================================================================
// DREW'S BASE PERSONALITY
// =============================================================================

const DREW_PERSONALITY = `You are Drew, a savvy construction quoting sidekick.
- Talk like a fellow contractor, not a computer
- Keep responses to 1-2 sentences MAX
- Use casual language: "Nice!", "Got it", "Let's do this"
- Never say "Great question!" or "I'd be happy to help!"
- Be confident but not cocky`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createInitialState(): WizardState {
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

async function searchProducts(supabase: any, query: string, limit = 5): Promise<Array<{ id: string; name: string; price: number; unit: string }>> {
  try {
    const { data, error } = await supabase.rpc('search_products', {
      search_query: query,
      result_limit: limit,
    });

    if (error || !data || data.length === 0) {
      // Fallback to ilike
      const { data: fallbackData } = await supabase
        .from('products')
        .select('id, name, unit, unit_price')
        .ilike('name', `%${query}%`)
        .limit(limit);

      return (fallbackData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.unit_price,
        unit: p.unit,
      }));
    }

    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.unit_price,
      unit: p.unit,
    }));
  } catch {
    return [];
  }
}

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: DREW_PERSONALITY,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

async function generateChecklist(projectType: string, size: string, scope: string, finishes: string, apiKey: string): Promise<string[]> {
  const prompt = `You're helping build a quote for: ${projectType}, ${size}, ${scope}, ${finishes} finishes.

List the product CATEGORIES needed for this job, in the order they should be selected.
Return ONLY a JSON array of category names, nothing else.
Example: ["toilet", "vanity", "sink", "faucet", "flooring"]

Keep it practical - only include categories that make sense for this specific job.`;

  const response = await callClaude(prompt, apiKey);

  try {
    // Extract JSON array from response
    const match = response.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch {
    // Fallback checklists
    if (projectType.toLowerCase().includes('bathroom')) {
      return ['toilet', 'vanity', 'sink', 'faucet', 'shower', 'flooring', 'lighting'];
    } else if (projectType.toLowerCase().includes('kitchen')) {
      return ['cabinets', 'countertop', 'sink', 'faucet', 'appliances', 'flooring'];
    } else if (projectType.toLowerCase().includes('deck')) {
      return ['decking', 'framing', 'posts', 'railings', 'fasteners'];
    }
  }

  return ['materials', 'fixtures', 'finishes'];
}

// =============================================================================
// STATE MACHINE LOGIC
// =============================================================================

async function processMessage(
  supabase: any,
  apiKey: string,
  userMessage: string,
  state: WizardState
): Promise<{ message: string; quickReplies?: string[]; toolCalls?: any[]; newState: WizardState }> {

  const newState = { ...state };
  let message = '';
  let quickReplies: string[] | undefined;
  let toolCalls: any[] | undefined;

  // =========================================================================
  // PHASE: SETUP
  // =========================================================================
  if (state.phase === 'setup') {
    const currentQuestion = SETUP_QUESTIONS[state.setupStep];

    // Save the user's answer (except on first message)
    if (userMessage && state.setupStep > 0) {
      const prevQuestion = SETUP_QUESTIONS[state.setupStep - 1];
      (newState as any)[prevQuestion.key] = userMessage;
    } else if (userMessage && state.setupStep === 0) {
      // First real answer
      newState.projectType = userMessage;
      newState.setupStep = 1;
    }

    // Check if setup is complete
    if (newState.setupStep >= SETUP_QUESTIONS.length) {
      // Move to generating checklist
      newState.phase = 'generating_checklist';
      message = await callClaude(`The user just told you they want ${newState.finishes} finishes. Acknowledge briefly and say you're putting together their checklist.`, apiKey);

      // Generate the checklist
      newState.checklist = await generateChecklist(
        newState.projectType!,
        newState.size!,
        newState.scope!,
        newState.finishes!,
        apiKey
      );
      newState.phase = 'building';
      newState.checklistIndex = 0;

      // Immediately offer first category
      const firstCategory = newState.checklist[0];
      const categoryMessage = await callClaude(`Say "First up: ${firstCategory}. Need one or skip?" Keep it super brief.`, apiKey);
      message = message + '\n\n' + categoryMessage;
      quickReplies = ['Show options', 'Skip'];

    } else {
      // Ask the current setup question
      if (state.setupStep === 0 && !userMessage) {
        // Very first message - greeting
        message = await callClaude('Greet the user and ask what kind of project they\'re quoting. One sentence.', apiKey);
      } else {
        // Ask next question
        const nextQuestion = SETUP_QUESTIONS[newState.setupStep];
        message = await callClaude(nextQuestion.prompt, apiKey);
        quickReplies = nextQuestion.quickReplies;
        newState.setupStep++;
      }
    }
  }

  // =========================================================================
  // PHASE: BUILDING
  // =========================================================================
  else if (state.phase === 'building') {
    const currentCategory = state.checklist[state.checklistIndex];

    if (state.waitingForSelection) {
      // User is picking from product options
      const selection = parseInt(userMessage);

      if (!isNaN(selection) && state.lastSearchResults && state.lastSearchResults[selection - 1]) {
        // Valid selection - add item
        const product = state.lastSearchResults[selection - 1];
        newState.itemsAdded.push({ ...product, qty: 1 });
        newState.waitingForSelection = false;
        newState.lastSearchResults = undefined;

        toolCalls = [{
          type: 'addItem',
          productId: product.id,
          productName: product.name,
          qty: 1,
          unitPrice: product.price,
        }];

        // Move to next category
        newState.checklistIndex++;

        if (newState.checklistIndex >= newState.checklist.length) {
          // Done with checklist
          newState.phase = 'wrapup';
          newState.wrapupStep = 0;
          message = await callClaude(`Say "Added! That covers the main items. Now let's wrap up." Then ask about labor hours.`, apiKey);
        } else {
          const nextCategory = newState.checklist[newState.checklistIndex];
          message = await callClaude(`Say "Added!" then offer the next category: ${nextCategory}. Ask "Need one or skip?" Keep it brief.`, apiKey);
          quickReplies = ['Show options', 'Skip'];
        }
      } else {
        // Invalid selection
        message = await callClaude('The user gave an invalid selection. Ask them to pick a number from the list.', apiKey);
        quickReplies = state.lastSearchResults?.map((_, i) => String(i + 1));
      }

    } else if (userMessage.toLowerCase() === 'skip') {
      // Skip this category
      newState.checklistIndex++;

      if (newState.checklistIndex >= newState.checklist.length) {
        // Done with checklist
        newState.phase = 'wrapup';
        newState.wrapupStep = 0;
        message = await callClaude('Say "Got it!" Then say we\'re done with materials and ask about labor hours.', apiKey);
      } else {
        const nextCategory = newState.checklist[newState.checklistIndex];
        message = await callClaude(`Say "Skipped." Then offer the next category: ${nextCategory}. Ask "Need one or skip?"`, apiKey);
        quickReplies = ['Show options', 'Skip'];
      }

    } else if (userMessage.toLowerCase() === 'show options' || userMessage.toLowerCase().includes('show')) {
      // Search for products in this category
      const products = await searchProducts(supabase, currentCategory);

      if (products.length === 0) {
        message = await callClaude(`Say you don't have any ${currentCategory} in the catalog. Offer to skip or try a different search term.`, apiKey);
        quickReplies = ['Skip', 'Try different term'];
      } else {
        newState.lastSearchResults = products;
        newState.waitingForSelection = true;

        // Format product list
        const productList = products.map((p, i) => `${i + 1}. ${p.name} - $${p.price}/${p.unit}`).join('\n');
        message = await callClaude(`Present these ${currentCategory} options briefly:\n${productList}\n\nJust say "Here's what I've got:" and list them with numbers. Ask which one.`, apiKey);
        quickReplies = products.map((_, i) => String(i + 1));
      }

    } else if (userMessage.toLowerCase() === "that's it" || userMessage.toLowerCase() === 'done') {
      // User wants to finish early
      newState.phase = 'wrapup';
      newState.wrapupStep = 0;
      message = await callClaude('Acknowledge they\'re done with materials. Ask about labor hours.', apiKey);
    } else {
      // Unclear input - re-offer current category
      message = await callClaude(`The user said "${userMessage}" but we're offering ${currentCategory}. Ask if they want to see options or skip.`, apiKey);
      quickReplies = ['Show options', 'Skip'];
    }
  }

  // =========================================================================
  // PHASE: WRAPUP
  // =========================================================================
  else if (state.phase === 'wrapup') {
    // Process previous answer
    if (state.wrapupStep === 1 && userMessage) {
      // They answered labor hours
      const hours = parseFloat(userMessage);
      if (!isNaN(hours)) {
        newState.laborHours = hours;
        newState.laborRate = 75; // Default rate
        toolCalls = [{ type: 'setLabor', hours, rate: 75 }];
      }
    } else if (state.wrapupStep === 2 && userMessage) {
      // They answered markup
      const markup = parseFloat(userMessage.replace('%', ''));
      if (!isNaN(markup)) {
        newState.markup = markup;
        toolCalls = [{ type: 'applyMarkup', percent: markup }];
      }
    } else if (state.wrapupStep === 3 && userMessage) {
      // They answered quote name
      newState.quoteName = userMessage;
      toolCalls = [{ type: 'setQuoteName', name: userMessage }];
    } else if (state.wrapupStep === 4 && userMessage) {
      // They answered client name
      newState.clientName = userMessage;
      toolCalls = [{ type: 'setClientName', name: userMessage }];
    }

    // Move to next wrapup step
    newState.wrapupStep++;

    if (newState.wrapupStep === 1) {
      message = await callClaude('Ask how many labor hours this job will take. Keep it casual.', apiKey);
    } else if (newState.wrapupStep === 2) {
      message = await callClaude('Ask what markup percentage they want. Keep it brief.', apiKey);
    } else if (newState.wrapupStep === 3) {
      message = await callClaude('Ask what they want to name this quote.', apiKey);
    } else if (newState.wrapupStep === 4) {
      message = await callClaude('Ask who the client is.', apiKey);
    } else {
      // Done!
      newState.phase = 'done';
      message = await callClaude('Say "All set! Your quote is ready." Be enthusiastic but brief.', apiKey);
    }
  }

  // =========================================================================
  // PHASE: DONE
  // =========================================================================
  else if (state.phase === 'done') {
    message = await callClaude('The quote is already complete. Ask if they want to start a new one or make changes.', apiKey);
    quickReplies = ['Start new quote', 'Make changes'];
  }

  return { message, quickReplies, toolCalls, newState };
}

// =============================================================================
// IMPLEMENTATION NOTES FOR TOMORROW
// =============================================================================
/*
To implement this properly:

1. EDGE FUNCTION (supabase/functions/wizard-chat/index.ts):
   - Use the processMessage function above
   - Accept { userMessage, state } in request body
   - Return { message, quickReplies, toolCalls, state }

2. CLIENT API (lib/wizardApi.ts):
   - Add WizardState type export
   - Update sendWizardMessage to accept and return state
   - Keep existing WizardTool types

3. CLIENT UI (app/(main)/wizard.tsx):
   - Add useState for wizardState
   - Pass state to sendWizardMessage
   - Update state from response
   - KEEP ALL EXISTING UI/STYLING - only change data flow

Key insight: The UI broke because I rewrote too much of wizard.tsx.
The fix is to make MINIMAL changes to the client - just add state passing.
Keep the intro screen, keep the styling, keep the quick reply rendering.
Only change how messages are sent/received.
*/

export { WizardState, createInitialState, processMessage };
