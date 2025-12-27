// supabase/functions/wizard-chat/index.ts
// Edge function for Quote Wizard (Drew) - STATE MACHINE approach
// Server controls flow, Claude adds personality

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// =============================================================================
// STATE MACHINE TYPES
// =============================================================================

interface WizardState {
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

interface RequestBody {
  userMessage: string;
  state?: WizardState;
}

// =============================================================================
// CONFIG
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
    // Simple ilike search - no fuzzy matching, just exact substring match
    const { data } = await supabase
      .from('products')
      .select('id, name, unit, unit_price')
      .ilike('name', `%${query}%`)
      .limit(limit);

    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.unit_price,
      unit: p.unit,
    }));
  } catch {
    return [];
  }
}

async function callClaude(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
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

// =============================================================================
// SIZE & QUANTITY HELPERS
// =============================================================================

// Map size labels to approximate square footage by project type
function getSqftFromSize(size: string, projectType: string): number {
  const sizeMap: Record<string, Record<string, number>> = {
    bathroom: { small: 50, medium: 80, large: 120, custom: 80 },
    kitchen: { small: 100, medium: 150, large: 250, custom: 150 },
    deck: { small: 100, medium: 200, large: 400, custom: 200 },
    bedroom: { small: 100, medium: 150, large: 200, custom: 150 },
    basement: { small: 400, medium: 600, large: 1000, custom: 600 },
    default: { small: 100, medium: 200, large: 300, custom: 200 },
  };

  const sizeLower = size.toLowerCase();
  const typeLower = projectType.toLowerCase();

  // Find matching project type or use default
  const typeKey = Object.keys(sizeMap).find(k => typeLower.includes(k)) || 'default';
  const sizes = sizeMap[typeKey];

  // Find matching size
  const sizeKey = Object.keys(sizes).find(k => sizeLower.includes(k)) || 'medium';
  return sizes[sizeKey];
}

// Calculate suggested quantity based on item type and square footage
function suggestQty(itemType: string, sqft: number, projectType: string): number {
  const item = itemType.toLowerCase();
  const type = projectType.toLowerCase();

  // Fixed quantities (one per room/project)
  if (['toilet', 'vanity', 'shower', 'sink', 'countertop'].some(i => item.includes(i))) {
    return 1;
  }
  if (item.includes('faucet')) {
    return type.includes('kitchen') ? 1 : (type.includes('bathroom') ? 2 : 1); // bathroom might have sink + shower
  }

  // Area-based quantities
  if (item.includes('tile')) {
    return Math.ceil(sqft * 1.1); // 10% waste factor
  }
  if (item.includes('flooring') || item.includes('floor')) {
    return Math.ceil(sqft * 1.1);
  }
  if (item.includes('drywall')) {
    return Math.ceil(sqft / 32); // 4x8 sheets = 32 sqft each
  }
  if (item.includes('paint')) {
    return Math.ceil(sqft / 350); // ~350 sqft per gallon
  }
  if (item.includes('insulation')) {
    return Math.ceil(sqft / 40); // batts cover ~40 sqft
  }

  // Linear/count-based
  if (item.includes('lighting') || item.includes('light')) {
    return Math.max(1, Math.ceil(sqft / 50)); // roughly 1 per 50 sqft
  }
  if (item.includes('cabinet')) {
    return Math.ceil(sqft / 20); // rough cabinet count
  }
  if (item.includes('lumber') || item.includes('framing')) {
    return Math.ceil(sqft / 8); // 2x4 studs roughly
  }
  if (item.includes('post')) {
    return Math.ceil(sqft / 50); // deck posts
  }
  if (item.includes('railing')) {
    return Math.ceil(Math.sqrt(sqft) * 2); // perimeter estimate in linear ft
  }
  if (item.includes('decking')) {
    return Math.ceil(sqft * 1.1); // deck boards in sqft with waste
  }
  if (item.includes('screw') || item.includes('nail')) {
    return Math.ceil(sqft / 10); // boxes/pounds
  }
  if (item.includes('concrete')) {
    return Math.ceil(sqft / 30); // bags for footings
  }
  if (item.includes('trim')) {
    return Math.ceil(Math.sqrt(sqft) * 4); // perimeter in linear ft
  }

  // Default: 1
  return 1;
}

async function generateChecklist(
  supabase: any,
  projectType: string,
  scope: string,
  size: string
): Promise<string[]> {
  // Fetch available categories from the database
  const { data: categories } = await supabase
    .from('categories')
    .select('name')
    .order('name');

  const availableCategories = (categories || []).map((c: any) => c.name).join(', ');

  // Let Claude generate a smart checklist based on what's actually available
  const prompt = `You're a master contractor with 50 years in the trades - plumbing, electrical, framing, finishing, tile, roofing, concrete, HVAC, you name it. You've built and remodeled hundreds of ${projectType}s and know every material that goes into them.

Project: ${size} ${projectType} (${scope})

Our catalog has these categories: ${availableCategories}

What materials does this job need? You know the answer - you've done this a thousand times.

Your expertise:
- Materials come in systems: tile needs thinset and grout, drywall needs mud and tape, electrical needs boxes and wire. Include the supporting materials, not just the main ones.
- You've seen contractors lose money forgetting: disposal/demo supplies, primer before paint, transition strips, caulk and sealants, fasteners and adhesives. Don't let that happen here.
- For a full remodel, think demo to finish. For cosmetic work, only what's changing. Size the list to the actual scope.
- You know the order things go in: rough before finish, structure before surface. Your list reflects how the job actually gets built.

Rules:
- Only use categories from the list above
- Return a JSON array: ["category1", "category2", ...]
- Nothing else, just the array`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error('Claude API error');
    }

    const data = await response.json();
    const text = data.content[0]?.text || '[]';

    // Parse the JSON array
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error('[wizard-chat] Checklist generation failed:', e);
  }

  // Fallback: return category names directly if Claude fails
  return (categories || []).slice(0, 6).map((c: any) => c.name.toLowerCase());
}

// Material relationships - what goes with what
const RELATED_MATERIALS: Record<string, string[]> = {
  tile: ['thinset', 'grout', 'backer board', 'spacers', 'sealer'],
  drywall: ['joint compound', 'tape', 'screws', 'corner bead'],
  paint: ['primer', 'tape', 'drop cloth', 'caulk'],
  flooring: ['underlayment', 'transition strips', 'adhesive'],
  electrical: ['wire', 'boxes', 'connectors', 'covers'],
  plumbing: ['fittings', 'valves', 'supply lines', 'caulk'],
  cabinets: ['hardware', 'screws', 'shims'],
  countertop: ['caulk', 'adhesive', 'brackets'],
  framing: ['fasteners', 'hangers', 'shims'],
  insulation: ['vapor barrier', 'tape', 'staples'],
  roofing: ['underlayment', 'flashing', 'fasteners', 'sealant'],
  decking: ['fasteners', 'flashing', 'post caps', 'sealant'],
};

function getRelatedItems(category: string): string[] {
  const cat = category.toLowerCase();
  for (const [key, related] of Object.entries(RELATED_MATERIALS)) {
    if (cat.includes(key) || key.includes(cat)) {
      return related;
    }
  }
  return [];
}

// =============================================================================
// STATE MACHINE LOGIC
// =============================================================================

async function processMessage(
  supabase: any,
  userMessage: string,
  state: WizardState
): Promise<{ message: string; quickReplies?: string[]; toolCalls?: any[]; newState: WizardState }> {

  const newState = { ...state };
  let message = '';
  let quickReplies: string[] | undefined;
  let toolCalls: any[] | undefined;

  // PHASE: SETUP
  if (state.phase === 'setup') {
    // Save previous answer
    if (userMessage && state.setupStep > 0) {
      const prevQuestion = SETUP_QUESTIONS[state.setupStep - 1];
      (newState as any)[prevQuestion.key] = userMessage;
    } else if (userMessage && state.setupStep === 0) {
      newState.projectType = userMessage;
      newState.setupStep = 1;
    }

    // Check if setup complete
    if (newState.setupStep >= SETUP_QUESTIONS.length) {
      newState.phase = 'generating_checklist';
      message = await callClaude(`The user just told you they want ${newState.finishes} finishes. Acknowledge briefly and say you're putting together their checklist.`);

      // Let Claude generate a smart checklist based on available categories
      newState.checklist = await generateChecklist(
        supabase,
        newState.projectType!,
        newState.scope!,
        newState.size || 'medium'
      );
      newState.phase = 'building';
      newState.checklistIndex = 0;

      const firstCategory = newState.checklist[0];
      const categoryMessage = await callClaude(`Say "First up: ${firstCategory}. Need one or skip?" Keep it super brief.`);
      message = message + '\n\n' + categoryMessage;
      quickReplies = ['Show options', 'Skip'];

    } else {
      if (state.setupStep === 0 && !userMessage) {
        message = await callClaude('Greet the user and ask what kind of project they\'re quoting. One sentence.');
      } else {
        const nextQuestion = SETUP_QUESTIONS[newState.setupStep];
        message = await callClaude(nextQuestion.prompt);
        quickReplies = nextQuestion.quickReplies;
        newState.setupStep++;
      }
    }
  }

  // PHASE: BUILDING
  else if (state.phase === 'building') {
    const currentCategory = state.checklist[state.checklistIndex];

    if (state.waitingForSelection) {
      // Parse numbers from input (supports "1", "1,3", "1 3 5", "1, 2, 3")
      const numbers = userMessage.match(/\d+/g)?.map(n => parseInt(n)) || [];
      const validSelections = numbers.filter(n => state.lastSearchResults && state.lastSearchResults[n - 1]);

      if (validSelections.length > 0) {
        // Calculate sqft for quantity suggestions
        const sqft = getSqftFromSize(state.size || 'medium', state.projectType || 'room');

        // Add selected products with suggested quantities
        toolCalls = [];
        const addedItems: string[] = [];
        for (const selection of validSelections) {
          const product = state.lastSearchResults![selection - 1];
          const qty = suggestQty(currentCategory, sqft, state.projectType || 'room');
          newState.itemsAdded.push({ ...product, qty });
          toolCalls.push({
            type: 'addItem',
            productId: product.id,
            productName: product.name,
            qty,
            unitPrice: product.price,
          });
          addedItems.push(`${qty}x ${product.name}`);
        }
        newState.waitingForSelection = false;
        newState.lastSearchResults = undefined;
        newState.checklistIndex++;

        const count = toolCalls.length;
        const addedSummary = addedItems.join(', ');
        const addedText = count === 1 ? `Added ${addedSummary}!` : `Added: ${addedSummary}!`;

        // Check for related items they might need
        const relatedItems = getRelatedItems(currentCategory);
        const relatedNote = relatedItems.length > 0
          ? ` You might also mention they may need ${relatedItems.slice(0, 3).join(', ')} to go with that - ask if they want to add any.`
          : '';

        if (newState.checklistIndex >= newState.checklist.length) {
          // Go to review phase to check for forgotten items
          newState.phase = 'review';
          message = await callClaude(`Say "${addedText} That's the main checklist done."${relatedNote} Then say "Let me do a quick review to make sure we didn't miss anything..."`);
        } else {
          const nextCategory = newState.checklist[newState.checklistIndex];
          message = await callClaude(`Say "${addedText}"${relatedNote} Then offer the next category: ${nextCategory}. Ask "Need one or skip?" Keep it brief.`);
          quickReplies = ['Show options', 'Skip'];
        }
      } else {
        // No valid numbers - treat as a search term
        const searchTerm = userMessage.trim();
        const products = await searchProducts(supabase, searchTerm);

        // Calculate sqft for quantity suggestions
        const sqft = getSqftFromSize(state.size || 'medium', state.projectType || 'room');
        const suggestedQty = suggestQty(currentCategory, sqft, state.projectType || 'room');
        const qtyNote = suggestedQty > 1 ? ` (I'd suggest ${suggestedQty} for this size)` : '';

        if (products.length > 0) {
          newState.lastSearchResults = products;
          const productList = products.map((p, i) => `${i + 1}. ${p.name} - $${p.price}/${p.unit}`).join('\n');
          message = await callClaude(`Found these for "${searchTerm}":\n${productList}${qtyNote}\n\nBriefly show the options. If there's a qty suggestion, mention it. Ask which ones they want.`);
          quickReplies = products.map((_, i) => String(i + 1));
        } else {
          // Keep showing current results
          const productList = state.lastSearchResults?.map((p, i) => `${i + 1}. ${p.name} - $${p.price}`).join('\n') || '';
          message = await callClaude(`Couldn't find "${searchTerm}". Current options:\n${productList}\n\nBriefly say you didn't find that, show the options again.`);
          quickReplies = [...(state.lastSearchResults?.map((_, i) => String(i + 1)) || []), 'Skip'];
        }
      }

    } else if (userMessage.toLowerCase() === 'skip') {
      newState.checklistIndex++;

      if (newState.checklistIndex >= newState.checklist.length) {
        // Go to review phase to check for forgotten items
        newState.phase = 'review';
        message = await callClaude('Say "Got it! That\'s the checklist done. Let me do a quick review to make sure we didn\'t miss anything..."');
      } else {
        const nextCategory = newState.checklist[newState.checklistIndex];
        message = await callClaude(`Say "Skipped." Then offer the next category: ${nextCategory}. Ask "Need one or skip?"`);
        quickReplies = ['Show options', 'Skip'];
      }

    } else if (userMessage.toLowerCase() === 'show options' || userMessage.toLowerCase().includes('show')) {
      const products = await searchProducts(supabase, currentCategory);

      if (products.length === 0) {
        message = await callClaude(`Say you don't have any ${currentCategory} in the catalog. Offer to skip or try a different search term.`);
        quickReplies = ['Skip', 'Try different term'];
      } else {
        newState.lastSearchResults = products;
        newState.waitingForSelection = true;

        // Calculate sqft and show suggested qty in the list
        const sqft = getSqftFromSize(state.size || 'medium', state.projectType || 'room');
        const suggestedQty = suggestQty(currentCategory, sqft, state.projectType || 'room');
        const qtyNote = suggestedQty > 1 ? ` (I'd suggest ${suggestedQty} for this size)` : '';

        const productList = products.map((p, i) => `${i + 1}. ${p.name} - $${p.price}/${p.unit}`).join('\n');
        message = await callClaude(`Present these ${currentCategory} options briefly:\n${productList}${qtyNote}\n\nJust say "Here's what I've got:" and list them with numbers. If there's a qty suggestion, mention it naturally. Ask which ones they want.`);
        quickReplies = products.map((_, i) => String(i + 1));
      }

    } else if (userMessage.toLowerCase() === "that's it" || userMessage.toLowerCase() === 'done') {
      // Go to review phase to check for forgotten items
      newState.phase = 'review';
      message = await callClaude('Say "Sounds good! Let me do a quick review to make sure we didn\'t miss anything..."');
    } else {
      // Treat any other input as a search term - be helpful, not picky
      const searchTerm = userMessage.trim();
      const products = await searchProducts(supabase, searchTerm);

      // Calculate sqft for quantity suggestions
      const sqft = getSqftFromSize(state.size || 'medium', state.projectType || 'room');
      const suggestedQty = suggestQty(currentCategory, sqft, state.projectType || 'room');
      const qtyNote = suggestedQty > 1 ? ` (I'd suggest ${suggestedQty} for this size)` : '';

      if (products.length === 0) {
        // No results - try the category instead and mention it
        const categoryProducts = await searchProducts(supabase, currentCategory);
        if (categoryProducts.length > 0) {
          newState.lastSearchResults = categoryProducts;
          newState.waitingForSelection = true;
          const productList = categoryProducts.map((p, i) => `${i + 1}. ${p.name} - $${p.price}/${p.unit}`).join('\n');
          message = await callClaude(`Couldn't find "${searchTerm}" but here's what I have for ${currentCategory}:\n${productList}${qtyNote}\n\nBriefly say you didn't find that exact thing but here are the ${currentCategory} options. If there's a qty suggestion, mention it.`);
          quickReplies = [...categoryProducts.map((_, i) => String(i + 1)), 'Skip'];
        } else {
          message = await callClaude(`Say you couldn't find "${searchTerm}" or any ${currentCategory}. Offer to skip or try something else.`);
          quickReplies = ['Skip'];
        }
      } else {
        // Found products matching their search
        newState.lastSearchResults = products;
        newState.waitingForSelection = true;
        const productList = products.map((p, i) => `${i + 1}. ${p.name} - $${p.price}/${p.unit}`).join('\n');
        message = await callClaude(`Found these for "${searchTerm}":\n${productList}${qtyNote}\n\nBriefly present the options. If there's a qty suggestion, mention it. Ask which ones they want.`);
        quickReplies = products.map((_, i) => String(i + 1));
      }
    }
  }

  // PHASE: REVIEW - Check for forgotten items AND quantity sanity before wrapup
  else if (state.phase === 'review') {
    if (!state.reviewDone) {
      // First time in review - have Claude check for missing items AND quantity issues
      const sqft = getSqftFromSize(state.size || 'medium', state.projectType || 'room');
      const itemsList = state.itemsAdded.map(i => `${i.qty}x ${i.name}`).join(', ');

      // Fetch categories for Claude to reference
      const { data: categories } = await supabase
        .from('categories')
        .select('name')
        .order('name');
      const availableCategories = (categories || []).map((c: any) => c.name).join(', ');

      const reviewPrompt = `You're a master contractor with 50 years experience reviewing a quote.

Project: ${state.size} ${state.projectType} (${state.scope}) - approximately ${sqft} sq ft
Items on quote: ${itemsList || 'none yet'}
Available categories: ${availableCategories}

Review this quote with your expert eye:

1. QUANTITIES - Do any quantities look wrong for a ${sqft} sq ft ${state.projectType}?
   - Too little tile/flooring for the space?
   - Way too much paint or drywall?
   - Missing multiples (should have 2 faucets but only 1)?

2. FORGOTTEN ITEMS - Any commonly forgotten items?
   - Fasteners, adhesives, caulk, sealants
   - Prep materials (primer, backer board, underlayment)
   - Finishing touches (trim, transition strips, hardware)

If you spot issues, list them briefly (be specific about what's wrong).
If everything looks solid for this size project, say so.
Keep to 2-3 sentences max.`;

      const reviewResult = await callClaude(reviewPrompt);
      newState.reviewDone = true;

      // Check if Claude found missing items
      const hasSuggestions = !reviewResult.toLowerCase().includes('looks complete') &&
                             !reviewResult.toLowerCase().includes('looks good') &&
                             !reviewResult.toLowerCase().includes('covered');

      if (hasSuggestions) {
        message = reviewResult + '\n\nWant me to search for any of these?';
        quickReplies = ['Yes, show me', 'No, move on'];
      } else {
        message = await callClaude('Say the quote looks solid - nothing obvious missing. Then ask how many labor hours for this job.');
        newState.phase = 'wrapup';
        newState.wrapupStep = 1;
      }
    } else if (userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase().includes('show')) {
      // User wants to see forgotten items - go back to building mode
      newState.phase = 'building';
      newState.waitingForSelection = false;
      message = await callClaude('Ask what they want to search for and add.');
    } else {
      // User says no, move on to wrapup
      newState.phase = 'wrapup';
      newState.wrapupStep = 1;
      message = await callClaude('Say "No problem!" Then ask how many labor hours for this job.');
    }
  }

  // PHASE: WRAPUP
  else if (state.phase === 'wrapup') {
    if (state.wrapupStep === 1 && userMessage) {
      const hours = parseFloat(userMessage);
      if (!isNaN(hours)) {
        newState.laborHours = hours;
        newState.laborRate = 75;
        toolCalls = [{ type: 'setLabor', hours, rate: 75 }];
      }
    } else if (state.wrapupStep === 2 && userMessage) {
      const markup = parseFloat(userMessage.replace('%', ''));
      if (!isNaN(markup)) {
        newState.markup = markup;
        toolCalls = [{ type: 'applyMarkup', percent: markup }];
      }
    } else if (state.wrapupStep === 3 && userMessage) {
      newState.quoteName = userMessage;
      toolCalls = [{ type: 'setQuoteName', name: userMessage }];
    } else if (state.wrapupStep === 4 && userMessage) {
      newState.clientName = userMessage;
      toolCalls = [{ type: 'setClientName', name: userMessage }];
    }

    newState.wrapupStep++;

    if (newState.wrapupStep === 1) {
      message = await callClaude('Ask how many labor hours this job will take. Keep it casual.');
    } else if (newState.wrapupStep === 2) {
      message = await callClaude('Ask what markup percentage they want. Keep it brief.');
    } else if (newState.wrapupStep === 3) {
      message = await callClaude('Ask what they want to name this quote.');
    } else if (newState.wrapupStep === 4) {
      message = await callClaude('Ask who the client is.');
    } else {
      newState.phase = 'done';
      message = await callClaude('Say "All set! Your quote is ready to save." Be enthusiastic but brief.');
      quickReplies = ['Save Quote', 'Make Changes', 'Start Over'];
    }
  }

  // PHASE: DONE
  else if (state.phase === 'done') {
    const input = userMessage.toLowerCase();

    // Handle correction requests
    if (input.includes('labor') || input.includes('hour')) {
      newState.phase = 'wrapup';
      newState.wrapupStep = 1;
      message = await callClaude('Ask what they want to change the labor hours to.');
    } else if (input.includes('markup') || input.includes('percent')) {
      newState.phase = 'wrapup';
      newState.wrapupStep = 2;
      message = await callClaude('Ask what markup percentage they want instead.');
    } else if (input.includes('name') || input.includes('quote name') || input.includes('title')) {
      newState.phase = 'wrapup';
      newState.wrapupStep = 3;
      message = await callClaude('Ask what they want to rename the quote to.');
    } else if (input.includes('client')) {
      newState.phase = 'wrapup';
      newState.wrapupStep = 4;
      message = await callClaude('Ask who the client should be.');
    } else if (input === 'make changes' || input === 'edit' || input === 'change') {
      message = await callClaude('Ask what they want to change: items, labor, markup, or names?');
      quickReplies = ['Edit Items', 'Edit Labor', 'Edit Markup', 'Edit Names', 'Done'];
    } else if (input === 'edit items' || input.includes('add item') || input.includes('remove') || input.includes('quantity')) {
      message = await callClaude('Ask if they want to add an item, remove an item, or change a quantity?');
      quickReplies = ['Add Item', 'Remove Item', 'Change Qty', 'Done'];
    } else if (input === 'add item' || input === 'add') {
      newState.phase = 'building';
      newState.checklistIndex = newState.checklist.length; // Past the checklist so it treats input as search
      newState.waitingForSelection = false;
      message = await callClaude('Ask what product they want to search for and add.');
    } else if (input === 'remove item' || input === 'remove') {
      // Signal to client to show item removal UI
      toolCalls = [{ type: 'showRemoveItem' }];
      message = await callClaude('Say to tap the item they want to remove from the list below.');
    } else if (input === 'change qty' || input === 'change quantity' || input === 'quantity') {
      // Signal to client to show quantity edit UI
      toolCalls = [{ type: 'showEditQuantity' }];
      message = await callClaude('Say to tap the item they want to change the quantity for.');
    } else if (input === 'done' || input.includes('looks good') || input.includes('save')) {
      message = await callClaude('Say "Perfect!" and confirm they can tap Save Quote when ready.');
      quickReplies = ['Save Quote', 'Start Over'];
    } else {
      message = await callClaude('The quote is ready. Ask if they want to save it, make changes, or start over.');
      quickReplies = ['Save Quote', 'Make Changes', 'Start Over'];
    }
  }

  return { message, quickReplies, toolCalls, newState };
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase credentials not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: RequestBody = await req.json();

    const state = body.state || createInitialState();
    const userMessage = body.userMessage || '';

    console.log('[wizard-chat] Phase:', state.phase, 'Step:', state.setupStep, 'Message:', userMessage.substring(0, 50));

    const result = await processMessage(supabase, userMessage, state);

    console.log('[wizard-chat] Result - Phase:', result.newState.phase, 'Message:', result.message.substring(0, 50));

    return new Response(
      JSON.stringify({
        message: result.message,
        quickReplies: result.quickReplies,
        toolCalls: result.toolCalls,
        state: result.newState,
      }),
      { headers }
    );

  } catch (error: any) {
    console.error('[wizard-chat] Error:', error);
    console.error('[wizard-chat] Stack:', error.stack);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        name: error.name
      }),
      { status: 500, headers }
    );
  }
});
