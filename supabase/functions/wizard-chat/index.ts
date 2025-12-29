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

interface UserDefaults {
  defaultMarkupPercent?: number;
  defaultLaborRate?: number;
}

interface RequestBody {
  userMessage: string;
  state?: WizardState;
  userDefaults?: UserDefaults;
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
    prompt: 'Ask about the square footage. Mention they can type a number or pick a typical size. Keep it brief.',
    quickReplies: ['~50 sqft', '~100 sqft', '~150 sqft', '~200+ sqft'],
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
    // First try to find a matching category
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .ilike('name', `%${query}%`)
      .limit(1);

    if (categories && categories.length > 0) {
      // Found a category - return products in that category (excluding screws/fasteners unless that's the category)
      const categoryId = categories[0].id;
      const categoryName = categories[0].name.toLowerCase();

      let productsQuery = supabase
        .from('products')
        .select('id, name, unit, unit_price')
        .eq('category_id', categoryId)
        .limit(limit);

      // If this isn't the fasteners category, exclude items with "screw" or "nail" in the name
      // to avoid overlap with the dedicated Fasteners category
      if (!categoryName.includes('fastener') && !categoryName.includes('hardware')) {
        // Can't easily exclude with Supabase, so we'll filter after
      }

      const { data } = await productsQuery;

      // Filter out fasteners from non-fastener categories to avoid overlap
      let filtered = data || [];
      if (!categoryName.includes('fastener') && !categoryName.includes('hardware') && !categoryName.includes('screw')) {
        filtered = filtered.filter((p: any) => {
          const name = p.name.toLowerCase();
          return !name.includes('screw') && !name.includes('nail ') && !name.startsWith('nail');
        });
      }

      return filtered.slice(0, limit).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.unit_price,
        unit: p.unit,
      }));
    }

    // No category match - fall back to name search
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

// Parse size input to square footage
// Handles: "~100 sqft", "100 sqft", "100", "small", "medium", "large"
function getSqftFromSize(size: string, projectType: string): number {
  // First, try to extract a number from the input
  const numMatch = size.match(/(\d+)/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  // Fall back to label-based sizes for legacy compatibility
  const sizeMap: Record<string, Record<string, number>> = {
    bathroom: { small: 50, medium: 80, large: 120 },
    kitchen: { small: 100, medium: 150, large: 250 },
    deck: { small: 100, medium: 200, large: 400 },
    bedroom: { small: 100, medium: 150, large: 200 },
    basement: { small: 400, medium: 600, large: 1000 },
    default: { small: 100, medium: 200, large: 300 },
  };

  const sizeLower = size.toLowerCase();
  const typeLower = projectType.toLowerCase();

  // Find matching project type or use default
  const typeKey = Object.keys(sizeMap).find(k => typeLower.includes(k)) || 'default';
  const sizes = sizeMap[typeKey];

  // Find matching size label
  const sizeKey = Object.keys(sizes).find(k => sizeLower.includes(k)) || 'medium';
  return sizes[sizeKey];
}

// =============================================================================
// UNIT SIZE PARSING - Extract package/unit sizes from product names
// =============================================================================

interface ParsedUnitSize {
  weight?: number;      // lbs (for screws, nails, compound)
  sheetSqft?: number;   // sqft (for drywall, plywood - WxH)
  lengthFt?: number;    // feet (for lumber, pipe, wire, trim)
  volume?: number;      // gallons (for paint, primer)
  rollFt?: number;      // feet per roll (for wire, tape)
  bagCoverage?: number; // sqft per bag (for concrete, grout)
}

function parseUnitSize(item: string): ParsedUnitSize {
  const result: ParsedUnitSize = {};

  // Weight: "1lb", "5lb", "25lb", "50 lb"
  const weightMatch = item.match(/(\d+)\s*lb/i);
  if (weightMatch) {
    result.weight = parseInt(weightMatch[1], 10);
  }

  // Sheet dimensions: "4x8", "4x10", "4x12", "4'x8'"
  const sheetMatch = item.match(/(\d+)\s*[x']\s*(\d+)/);
  if (sheetMatch) {
    const w = parseInt(sheetMatch[1], 10);
    const h = parseInt(sheetMatch[2], 10);
    // Only use as sheet sqft if dimensions look like sheets (both > 2)
    if (w >= 3 && h >= 3) {
      result.sheetSqft = w * h;
    }
  }

  // Linear length: "8'", "10'", "12'", "8ft", "10 ft", "96in" (8ft)
  // Common lumber: 8', 10', 12', 16'
  const ftMatch = item.match(/(\d+)\s*(?:ft|'|foot|feet)\b/i);
  if (ftMatch) {
    result.lengthFt = parseInt(ftMatch[1], 10);
  }
  // Check for inches and convert (96" = 8')
  const inMatch = item.match(/(\d+)\s*(?:in|")\b/i);
  if (inMatch && !result.lengthFt) {
    const inches = parseInt(inMatch[1], 10);
    if (inches >= 48) { // Only convert if looks like lumber length
      result.lengthFt = inches / 12;
    }
  }

  // Volume: "1gal", "5gal", "1 gallon"
  const galMatch = item.match(/(\d+)\s*gal/i);
  if (galMatch) {
    result.volume = parseInt(galMatch[1], 10);
  }

  // Roll length: "50ft roll", "100' roll", "250ft"
  const rollMatch = item.match(/(\d+)\s*(?:ft|')\s*(?:roll)?/i);
  if (rollMatch && (item.includes('roll') || item.includes('wire') || item.includes('romex'))) {
    result.rollFt = parseInt(rollMatch[1], 10);
  }

  return result;
}

// Calculate suggested quantity based on item type and square footage
function suggestQty(itemType: string, sqft: number, projectType: string): number {
  const item = itemType.toLowerCase();
  const type = projectType.toLowerCase();
  const parsed = parseUnitSize(item);

  // Estimate linear feet needed (perimeter for a room)
  const perimeterFt = Math.sqrt(sqft) * 4;
  // Estimate wall sqft (assuming 8ft ceiling, all 4 walls)
  const wallSqft = perimeterFt * 8;

  // === FIXTURES (1 per room unless specified) ===
  if (['toilet', 'vanity', 'shower', 'tub', 'bathtub', 'sink', 'countertop', 'mirror', 'medicine cabinet'].some(i => item.includes(i))) {
    return 1;
  }
  if (item.includes('faucet')) {
    return type.includes('kitchen') ? 1 : (type.includes('bathroom') ? 2 : 1);
  }

  // === CONSUMABLES & SUPPLIES (small quantities) ===
  if (item.includes('compound') || item.includes('mud') || item.includes('spackle')) {
    const galPerUnit = parsed.volume || 1;
    const totalGalNeeded = sqft / 200; // ~1 gal per 200 sqft
    return Math.max(1, Math.ceil(totalGalNeeded / galPerUnit));
  }
  if (item.includes('tape') && (item.includes('drywall') || item.includes('joint'))) {
    const ftPerRoll = parsed.rollFt || 75; // default 75ft roll
    const totalFtNeeded = perimeterFt * 2; // seams
    return Math.max(1, Math.ceil(totalFtNeeded / ftPerRoll));
  }
  if (item.includes('caulk') || item.includes('sealant') || item.includes('adhesive')) {
    return Math.max(1, Math.ceil(sqft / 100)); // tubes
  }
  if (item.includes('primer')) {
    const galPerUnit = parsed.volume || 1;
    const totalGalNeeded = sqft / 300;
    return Math.max(1, Math.ceil(totalGalNeeded / galPerUnit));
  }
  if (item.includes('grout')) {
    return Math.max(1, Math.ceil(sqft / 50)); // bags
  }
  if (item.includes('thinset') || item.includes('mortar')) {
    return Math.max(1, Math.ceil(sqft / 40)); // bags
  }

  // === FASTENERS (weight-based) ===
  if (item.includes('screw') || item.includes('nail') || item.includes('fastener')) {
    const weightLbs = parsed.weight || 1;
    // Base: ~2lbs of fasteners per 100 sqft
    const totalLbsNeeded = (sqft / 100) * 2;
    return Math.max(1, Math.ceil(totalLbsNeeded / weightLbs));
  }

  // === SHEET GOODS (dimension-based) ===
  if (item.includes('drywall') || item.includes('sheetrock') || item.includes('gypsum')) {
    const sheetSqft = parsed.sheetSqft || 32; // default 4x8
    return Math.max(1, Math.ceil(wallSqft / sheetSqft));
  }
  if (item.includes('plywood') || item.includes('osb') || item.includes('subfloor')) {
    const sheetSqft = parsed.sheetSqft || 32;
    return Math.max(1, Math.ceil(sqft / sheetSqft));
  }
  if (item.includes('backer') || item.includes('cement board') || item.includes('hardie')) {
    const sheetSqft = parsed.sheetSqft || 15; // default 3x5
    return Math.max(1, Math.ceil(sqft / sheetSqft));
  }

  // === FLOORING & TILE (sqft based) ===
  if (item.includes('tile') && !item.includes('adhesive')) {
    return Math.ceil(sqft * 1.1); // 10% waste
  }
  if (item.includes('flooring') || item.includes('vinyl') || item.includes('laminate') || item.includes('hardwood')) {
    return Math.ceil(sqft * 1.1);
  }
  if (item.includes('carpet')) {
    return Math.ceil(sqft * 1.15); // more waste for carpet
  }

  // === PAINT (volume-based) ===
  if (item.includes('paint') || item.includes('stain')) {
    const galPerUnit = parsed.volume || 1;
    const totalGalNeeded = sqft / 350; // ~350 sqft per gallon
    return Math.max(1, Math.ceil(totalGalNeeded / galPerUnit));
  }

  // === INSULATION ===
  if (item.includes('insulation') || item.includes('batt')) {
    return Math.ceil(wallSqft / 40); // batts
  }

  // === LUMBER & FRAMING (length-based) ===
  if (item.includes('stud') || item.includes('2x4') || item.includes('2x6')) {
    const lengthFt = parsed.lengthFt || 8; // default 8ft studs
    // Studs every 16" = 0.75 studs per linear ft of wall
    const studsNeeded = perimeterFt * 0.75;
    // Longer studs can be cut, but 8ft is standard wall height
    // If they pick 10' or 12' studs, they need fewer (can cut to size)
    const adjustmentFactor = 8 / lengthFt;
    return Math.max(1, Math.ceil(studsNeeded * adjustmentFactor));
  }
  if (item.includes('lumber') || item.includes('board') || item.includes('plank')) {
    const lengthFt = parsed.lengthFt || 8;
    const totalFtNeeded = perimeterFt;
    return Math.max(1, Math.ceil(totalFtNeeded / lengthFt));
  }
  if (item.includes('joist') || item.includes('rafter')) {
    const lengthFt = parsed.lengthFt || 10;
    // Joists every 16" across the span
    const joistsNeeded = Math.sqrt(sqft) * 0.75;
    return Math.max(1, Math.ceil(joistsNeeded));
  }

  // === TRIM & MOLDING (length-based) ===
  if (item.includes('trim') || item.includes('molding') || item.includes('baseboard') || item.includes('casing')) {
    const lengthFt = parsed.lengthFt || 8; // default 8ft pieces
    const totalFtNeeded = perimeterFt;
    return Math.max(1, Math.ceil(totalFtNeeded / lengthFt));
  }
  if (item.includes('transition') || item.includes('threshold')) {
    return Math.max(1, Math.ceil(Math.sqrt(sqft) / 10)); // ~1 per doorway
  }

  // === ELECTRICAL ===
  if (item.includes('outlet') || item.includes('receptacle') || item.includes('switch')) {
    return Math.max(2, Math.ceil(sqft / 40)); // code: outlet every 12ft
  }
  if (item.includes('light') || item.includes('fixture') || item.includes('can')) {
    return Math.max(1, Math.ceil(sqft / 50));
  }
  if (item.includes('wire') || item.includes('romex')) {
    const rollFt = parsed.rollFt || parsed.lengthFt || 50; // default 50ft
    const totalFtNeeded = sqft * 1.5; // rough estimate: 1.5ft wire per sqft
    return Math.max(1, Math.ceil(totalFtNeeded / rollFt));
  }
  if (item.includes('box') && item.includes('electric')) {
    return Math.max(2, Math.ceil(sqft / 40));
  }

  // === PLUMBING (length-based) ===
  if (item.includes('pipe') || item.includes('pvc') || item.includes('copper')) {
    const lengthFt = parsed.lengthFt || 10; // default 10ft
    const totalFtNeeded = sqft / 5; // rough estimate
    return Math.max(1, Math.ceil(totalFtNeeded / lengthFt));
  }
  if (item.includes('fitting') || item.includes('elbow') || item.includes('coupling')) {
    return Math.max(4, Math.ceil(sqft / 15));
  }
  if (item.includes('valve') || item.includes('shutoff')) {
    return Math.max(2, Math.ceil(sqft / 50));
  }

  // === DECK & OUTDOOR ===
  if (item.includes('decking') || item.includes('deck board')) {
    const lengthFt = parsed.lengthFt || 8;
    // Deck boards ~5.5" wide, need enough to cover sqft
    const boardsNeeded = (sqft / (lengthFt * 0.46)) * 1.1; // 5.5"/12 = 0.46ft, +10% waste
    return Math.max(1, Math.ceil(boardsNeeded));
  }
  if (item.includes('post')) {
    return Math.max(4, Math.ceil(sqft / 50));
  }
  if (item.includes('railing') || item.includes('baluster')) {
    return Math.ceil(Math.sqrt(sqft) * 2);
  }
  if (item.includes('concrete') || item.includes('cement')) {
    return Math.ceil(sqft / 30); // bags for footings/pads
  }
  if (item.includes('joist hanger') || item.includes('bracket') || item.includes('hardware')) {
    return Math.max(4, Math.ceil(sqft / 20));
  }

  // === CABINET & STORAGE ===
  if (item.includes('cabinet')) {
    return Math.max(1, Math.ceil(sqft / 25));
  }
  if (item.includes('drawer') || item.includes('pull') || item.includes('knob') || item.includes('handle')) {
    return Math.max(4, Math.ceil(sqft / 15));
  }
  if (item.includes('shelf') || item.includes('shelving')) {
    return Math.max(2, Math.ceil(sqft / 30));
  }
  if (item.includes('hinge')) {
    return Math.max(4, Math.ceil(sqft / 10));
  }

  // === UNDERLAYMENT & BARRIERS ===
  if (item.includes('underlayment') || item.includes('membrane') || item.includes('barrier')) {
    const rollSqft = parsed.rollFt ? parsed.rollFt * 3 : 100; // assume 3ft wide rolls
    return Math.max(1, Math.ceil(sqft / rollSqft));
  }
  if (item.includes('felt') || item.includes('paper')) {
    return Math.ceil(sqft / 400); // rolls
  }

  // Default: 1 unit
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
// RESPONSE TYPES
// =============================================================================

interface WizardProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
  suggestedQty: number;  // Per-product qty based on sqft and product type
}

interface WizardDisplay {
  type: 'products' | 'added' | 'review';
  products?: WizardProduct[];          // Each product has its own suggestedQty
  addedItems?: Array<{ name: string; qty: number }>;
  reviewNotes?: string;
  relatedItems?: string[];
}

interface ProcessResult {
  message: string;
  display?: WizardDisplay;
  quickReplies?: string[];
  toolCalls?: any[];
  newState: WizardState;
}

// =============================================================================
// STATE MACHINE LOGIC
// =============================================================================

async function processMessage(
  supabase: any,
  userMessage: string,
  state: WizardState,
  userDefaults: UserDefaults = {}
): Promise<ProcessResult> {

  const newState = { ...state };
  let message = '';
  let display: WizardDisplay | undefined;
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
      const categoryMessage = await callClaude(`Say "First up: ${firstCategory}. Needed or skip?" Keep it super brief.`);
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
    const currentCategory = state.checklist[state.checklistIndex] || null;
    const isPostChecklist = state.checklistIndex >= state.checklist.length; // Adding items after checklist/review

    if (state.waitingForSelection) {
      // Handle skip even while waiting for selection
      if (userMessage.toLowerCase() === 'skip') {
        newState.waitingForSelection = false;
        newState.lastSearchResults = undefined;
        newState.checklistIndex++;

        if (newState.checklistIndex >= newState.checklist.length) {
          newState.phase = 'review';
          message = await callClaude('Say "Got it! That\'s the checklist done. Let me do a quick review to make sure we didn\'t miss anything..."');
        } else {
          const nextCategory = newState.checklist[newState.checklistIndex];
          message = await callClaude(`Say "Skipped." Then offer the next category: ${nextCategory}. Ask "Needed or skip?"`);
          quickReplies = ['Show options', 'Skip'];
        }
      }
      // Handle batch selections from UI: ADD_SELECTED:[{id,qty},{id,qty}]
      else if (userMessage.startsWith('ADD_SELECTED:')) {
        try {
          const selectionsJson = userMessage.substring('ADD_SELECTED:'.length);
          const selections: Array<{ id: string; qty: number }> = JSON.parse(selectionsJson);

          if (selections.length > 0 && state.lastSearchResults) {
            toolCalls = [];
            const addedItemsList: Array<{ name: string; qty: number }> = [];

            for (const sel of selections) {
              const product = state.lastSearchResults.find(p => p.id === sel.id);
              if (product) {
                newState.itemsAdded.push({ ...product, qty: sel.qty });
                toolCalls.push({
                  type: 'addItem',
                  productId: product.id,
                  productName: product.name,
                  qty: sel.qty,
                  unitPrice: product.price,
                });
                addedItemsList.push({ name: product.name, qty: sel.qty });
              }
            }

            newState.waitingForSelection = false;
            newState.lastSearchResults = undefined;
            newState.checklistIndex++;

            display = {
              type: 'added',
              addedItems: addedItemsList,
            };

            if (isPostChecklist) {
              newState.phase = 'wrapup';
              newState.wrapupStep = 1;
              message = await callClaude('Items added! Now ask how many labor hours for this job. Keep it brief.');
            } else if (newState.checklistIndex >= newState.checklist.length) {
              newState.phase = 'review';
              message = await callClaude('Items added! That\'s the checklist done. Say you\'re doing a quick review. Keep it brief.');
            } else {
              const nextCategory = newState.checklist[newState.checklistIndex];
              message = await callClaude(`Items added! Offer next category: ${nextCategory}. Ask "Needed or skip?" Keep it brief.`);
              quickReplies = ['Show options', 'Skip'];
            }
          } else {
            message = await callClaude('No items selected. Ask them to select items or skip.');
            quickReplies = ['Skip'];
          }
        } catch (e) {
          console.error('Failed to parse selections:', e);
          message = await callClaude('Something went wrong. Ask them to try again.');
          quickReplies = ['Skip'];
        }
      }
      // Legacy: Parse numbers from input (supports "1", "1,3", "1 3 5", "1, 2, 3")
      else {
        const numbers = userMessage.match(/\d+/g)?.map(n => parseInt(n)) || [];
        const validSelections = numbers.filter(n => state.lastSearchResults && state.lastSearchResults[n - 1]);

        if (validSelections.length > 0) {
        // Calculate sqft for quantity suggestions
        const sqft = getSqftFromSize(state.size || 'medium', state.projectType || 'room');

        // Add selected products with suggested quantities
        toolCalls = [];
        const addedItemsList: Array<{ name: string; qty: number }> = [];
        for (const selection of validSelections) {
          const product = state.lastSearchResults![selection - 1];
          // Use product name for qty suggestion if no current category
          const qtyCategory = currentCategory || product.name;
          const qty = suggestQty(qtyCategory, sqft, state.projectType || 'room');
          newState.itemsAdded.push({ ...product, qty });
          toolCalls.push({
            type: 'addItem',
            productId: product.id,
            productName: product.name,
            qty,
            unitPrice: product.price,
          });
          addedItemsList.push({ name: product.name, qty });
        }
        newState.waitingForSelection = false;
        newState.lastSearchResults = undefined;
        newState.checklistIndex++;

        // Return structured data showing what was added
        display = {
          type: 'added',
          addedItems: addedItemsList,
        };

        if (isPostChecklist) {
          // Adding items after checklist/review - go to wrapup
          newState.phase = 'wrapup';
          newState.wrapupStep = 1;
          message = await callClaude('Items added! Now ask how many labor hours for this job. Keep it brief.');
        } else if (newState.checklistIndex >= newState.checklist.length) {
          // Go to review phase to check for forgotten items
          newState.phase = 'review';
          message = await callClaude(`Items added! That's the checklist done. Say you're doing a quick review. Keep it brief.`);
        } else {
          const nextCategory = newState.checklist[newState.checklistIndex];
          message = await callClaude(`Items added! Offer next category: ${nextCategory}. Ask "Needed or skip?" Keep it brief.`);
          quickReplies = ['Show options', 'Skip'];
        }
      } else {
        // No valid numbers - treat as a search term
        const searchTerm = userMessage.trim();
        const products = await searchProducts(supabase, searchTerm);

        // Calculate sqft for quantity suggestions (use search term if no current category)
        const sqft = getSqftFromSize(state.size || 'medium', state.projectType || 'room');
        const qtyCategory = currentCategory || searchTerm;
        const suggestedQty = suggestQty(qtyCategory, sqft, state.projectType || 'room');

        if (products.length > 0) {
          newState.lastSearchResults = products;
          newState.waitingForSelection = true;

          // Return structured product data with per-product qty
          display = {
            type: 'products',
            products: products.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price,
              unit: p.unit,
              suggestedQty: suggestQty(p.name, sqft, state.projectType || 'room'),
            })),
          };

          message = await callClaude(`Found some "${searchTerm}" options. One brief sentence - nothing else.`);
          quickReplies = ['Add Selected', 'Skip'];
        } else {
          // No results found
          message = await callClaude(`Couldn't find "${searchTerm}" in the catalog. Ask them to try a different search term.`);
          quickReplies = isPostChecklist ? ['Done adding', 'Try another search'] : ['Skip'];
        }
      }
      } // close the else block for non-skip handling

    } else if (userMessage.toLowerCase() === 'skip') {
      newState.checklistIndex++;

      if (newState.checklistIndex >= newState.checklist.length) {
        // Go to review phase to check for forgotten items
        newState.phase = 'review';
        message = await callClaude('Say "Got it! That\'s the checklist done. Let me do a quick review to make sure we didn\'t miss anything..."');
      } else {
        const nextCategory = newState.checklist[newState.checklistIndex];
        message = await callClaude(`Say "Skipped." Then offer the next category: ${nextCategory}. Ask "Needed or skip?"`);
        quickReplies = ['Show options', 'Skip'];
      }

    } else if ((userMessage.toLowerCase() === 'show options' || userMessage.toLowerCase().includes('show')) && currentCategory) {
      // Show options for current checklist category
      const products = await searchProducts(supabase, currentCategory);

      if (products.length === 0) {
        message = await callClaude(`Say you don't have any ${currentCategory} in the catalog. Offer to skip or try a different search term.`);
        quickReplies = ['Skip', 'Try different term'];
      } else {
        newState.lastSearchResults = products;
        newState.waitingForSelection = true;

        // Calculate sqft for quantity suggestions
        const sqft = getSqftFromSize(state.size || 'medium', state.projectType || 'room');

        // Return structured product data with per-product qty suggestions
        display = {
          type: 'products',
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            unit: p.unit,
            suggestedQty: suggestQty(p.name, sqft, state.projectType || 'room'),
          })),
        };

        // Claude just provides brief personality message - products shown by UI
        message = await callClaude(`Here's what I've got for ${currentCategory}. One brief sentence like "Pick what you need:" - nothing else.`);
        quickReplies = ['Add Selected', 'Skip'];
      }

    } else if (userMessage.toLowerCase() === "that's it" || userMessage.toLowerCase() === 'done' || userMessage.toLowerCase() === 'done adding') {
      // Done adding - go to wrapup if post-checklist, otherwise review
      if (isPostChecklist) {
        newState.phase = 'wrapup';
        newState.wrapupStep = 1;
        message = await callClaude('Say "Sounds good!" Then ask how many labor hours for this job.');
        quickReplies = ['8 hrs', '16 hrs', '24 hrs', '40 hrs'];
      } else {
        newState.phase = 'review';
        message = await callClaude('Say "Sounds good! Let me do a quick review to make sure we didn\'t miss anything..."');
      }
    } else {
      // Treat any other input as a search term - be helpful, not picky
      const searchTerm = userMessage.trim();
      const products = await searchProducts(supabase, searchTerm);

      // Calculate sqft for quantity suggestions
      const sqft = getSqftFromSize(state.size || 'medium', state.projectType || 'room');
      const qtyCategory = currentCategory || searchTerm;
      const suggestedQty = suggestQty(qtyCategory, sqft, state.projectType || 'room');

      if (products.length === 0) {
        // No results - try the category instead if we have one
        if (currentCategory) {
          const categoryProducts = await searchProducts(supabase, currentCategory);
          if (categoryProducts.length > 0) {
            newState.lastSearchResults = categoryProducts;
            newState.waitingForSelection = true;

            // Return structured product data with per-product qty
            display = {
              type: 'products',
              products: categoryProducts.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                unit: p.unit,
                suggestedQty: suggestQty(p.name, sqft, state.projectType || 'room'),
              })),
            };

            message = await callClaude(`Couldn't find "${searchTerm}" but here's what I have for ${currentCategory}. Keep it brief.`);
            quickReplies = ['Add Selected', 'Skip'];
          } else {
            message = await callClaude(`Say you couldn't find "${searchTerm}" or any ${currentCategory}. Offer to skip or try something else.`);
            quickReplies = ['Skip'];
          }
        } else {
          // Post-checklist mode - just say not found
          message = await callClaude(`Couldn't find "${searchTerm}" in the catalog. Ask them to try a different search term.`);
          quickReplies = ['Done adding'];
        }
      } else {
        // Found products matching their search
        newState.lastSearchResults = products;
        newState.waitingForSelection = true;

        // Return structured product data with per-product qty
        display = {
          type: 'products',
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            unit: p.unit,
            suggestedQty: suggestQty(p.name, sqft, state.projectType || 'room'),
          })),
        };

        message = await callClaude(`Found some "${searchTerm}" options. One brief sentence - nothing else.`);
        quickReplies = ['Add Selected', 'Skip'];
      }
    }
  }

  // PHASE: REVIEW - Check for forgotten items AND quantity sanity before wrapup
  else if (state.phase === 'review') {
    if (userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase().includes('show')) {
      // User wants to add more items - go back to building mode
      newState.phase = 'building';
      newState.waitingForSelection = false;
      message = await callClaude('Ask what category or item they want to add. They can search or say "Done adding" when finished.');
      // Offer common forgotten items as quick replies
      quickReplies = ['Caulk', 'Primer', 'Tape', 'Done adding'];
    } else {
      // User says no (or anything else), move on to wrapup
      newState.phase = 'wrapup';
      newState.wrapupStep = 1;
      message = await callClaude('Say "No problem!" Then ask how many labor hours for this job.');
      quickReplies = ['8 hrs', '16 hrs', '24 hrs', '40 hrs'];
    }
  }

  // PHASE: WRAPUP
  else if (state.phase === 'wrapup') {
    let validInput = false;

    // Step 1: Labor hours
    if (state.wrapupStep === 1) {
      // Extract number from input like "8", "16 hrs", "Medium (16 hrs)"
      const hoursMatch = userMessage.match(/(\d+)/);
      if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        newState.laborHours = hours;
        validInput = true;
      }
    }
    // Step 2: Labor rate (hourly)
    else if (state.wrapupStep === 2) {
      // Extract number from input like "75", "$75", "75/hr"
      const rateMatch = userMessage.match(/(\d+)/);
      if (rateMatch) {
        const rate = parseInt(rateMatch[1], 10);
        newState.laborRate = rate;
        // Now we have both hours and rate, set the labor
        toolCalls = [{ type: 'setLabor', hours: newState.laborHours || state.laborHours || 8, rate }];
        validInput = true;
      }
    }
    // Step 3: Markup percentage
    else if (state.wrapupStep === 3) {
      // Extract number from input like "15", "15%", "20 percent"
      const markupMatch = userMessage.match(/(\d+)/);
      if (markupMatch) {
        const markup = parseInt(markupMatch[1], 10);
        newState.markup = markup;
        toolCalls = [{ type: 'applyMarkup', percent: markup }];
        validInput = true;
      }
    }
    // Step 4: Quote name - accept any reasonable text (not quick reply placeholders)
    else if (state.wrapupStep === 4) {
      const trimmed = userMessage.trim();
      const lower = trimmed.toLowerCase();
      // Reject placeholders and questions
      if (trimmed.length > 0 && trimmed.length < 100 &&
          !trimmed.includes('?') &&
          lower !== 'custom name' && lower !== 'enter name' &&
          !lower.includes("didn't") && !lower.includes('option')) {
        newState.quoteName = trimmed;
        toolCalls = [{ type: 'setQuoteName', name: trimmed }];
        validInput = true;
      }
    }
    // Step 5: Client name - accept any reasonable name (not placeholders)
    else if (state.wrapupStep === 5) {
      const trimmed = userMessage.trim();
      const lower = trimmed.toLowerCase();
      // Reject placeholders
      if (trimmed.length > 0 && trimmed.length < 100 &&
          !trimmed.includes('?') &&
          lower !== 'enter name' && lower !== 'custom name') {
        newState.clientName = trimmed;
        toolCalls = [{ type: 'setClientName', name: trimmed }];
        validInput = true;
      }
    }

    // Only advance if we got valid input, otherwise re-ask
    if (validInput) {
      newState.wrapupStep++;
    }

    // Auto-apply defaults if available
    // If we're at step 2 (labor rate) and user has default, auto-apply and skip
    if (newState.wrapupStep === 2 && userDefaults.defaultLaborRate && userDefaults.defaultLaborRate > 0) {
      newState.laborRate = userDefaults.defaultLaborRate;
      toolCalls = [{ type: 'setLabor', hours: newState.laborHours || state.laborHours || 8, rate: userDefaults.defaultLaborRate }];
      newState.wrapupStep = 3; // Skip to markup
    }
    // If we're at step 3 (markup) and user has default, auto-apply and skip
    if (newState.wrapupStep === 3 && userDefaults.defaultMarkupPercent && userDefaults.defaultMarkupPercent > 0) {
      newState.markup = userDefaults.defaultMarkupPercent;
      toolCalls = [...(toolCalls || []), { type: 'applyMarkup', percent: userDefaults.defaultMarkupPercent }];
      newState.wrapupStep = 4; // Skip to quote name
    }

    // Show appropriate question with quick replies
    if (newState.wrapupStep === 1) {
      message = await callClaude('Ask how many labor hours this job will take. Keep it casual.');
      quickReplies = ['8 hrs', '16 hrs', '24 hrs', '40 hrs'];
    } else if (newState.wrapupStep === 2) {
      message = await callClaude('Ask what their hourly labor rate is. Keep it brief.');
      quickReplies = ['$50/hr', '$75/hr', '$100/hr', '$125/hr'];
    } else if (newState.wrapupStep === 3) {
      message = await callClaude('Ask what markup percentage they want. Keep it brief.');
      quickReplies = ['10%', '15%', '20%', '25%'];
    } else if (newState.wrapupStep === 4) {
      // Suggest quote name based on project
      const suggestedName = `${state.projectType || 'Project'} Remodel`;
      message = await callClaude(`Ask what they want to name this quote. Suggest "${suggestedName}" or they can type their own.`);
      quickReplies = [suggestedName];
    } else if (newState.wrapupStep === 5) {
      message = await callClaude('Ask for the client name. They can type it in.');
      quickReplies = [];
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
    if (input.includes('hour') && !input.includes('rate')) {
      newState.phase = 'wrapup';
      newState.wrapupStep = 1;
      message = await callClaude('Ask what they want to change the labor hours to.');
      quickReplies = ['8 hrs', '16 hrs', '24 hrs', '40 hrs'];
    } else if (input.includes('rate') || (input.includes('labor') && !input.includes('hour'))) {
      newState.phase = 'wrapup';
      newState.wrapupStep = 2;
      message = await callClaude('Ask what hourly rate they want.');
      quickReplies = ['$50/hr', '$75/hr', '$100/hr', '$125/hr'];
    } else if (input.includes('markup') || input.includes('percent')) {
      newState.phase = 'wrapup';
      newState.wrapupStep = 3;
      message = await callClaude('Ask what markup percentage they want instead.');
      quickReplies = ['10%', '15%', '20%', '25%'];
    } else if (input.includes('name') || input.includes('quote name') || input.includes('title')) {
      newState.phase = 'wrapup';
      newState.wrapupStep = 4;
      message = await callClaude('Ask what they want to rename the quote to.');
    } else if (input.includes('client')) {
      newState.phase = 'wrapup';
      newState.wrapupStep = 5;
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

  // ==========================================================================
  // AUTO-RUN REVIEW: When transitioning to review phase, run review immediately
  // This is a post-processing step that runs after phase handling
  // ==========================================================================
  if (newState.phase === 'review' && !newState.reviewDone) {
    const sqft = getSqftFromSize(newState.size || 'medium', newState.projectType || 'room');
    const itemsList = newState.itemsAdded.map(i => `${i.qty}x ${i.name}`).join(', ');

    // Fetch categories for Claude to reference
    const { data: categories } = await supabase
      .from('categories')
      .select('name')
      .order('name');
    const availableCategories = (categories || []).map((c: any) => c.name).join(', ');

    const reviewPrompt = `You're a master contractor with 50 years experience reviewing a quote.

Project: ${newState.size} ${newState.projectType} (${newState.scope}) - approximately ${sqft} sq ft
Items on quote: ${itemsList || 'none yet'}
Available categories: ${availableCategories}

Review this quote with your expert eye:

1. QUANTITIES - Do any quantities look wrong for a ${sqft} sq ft ${newState.projectType}?
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

    // Check if Claude found suggestions
    const hasSuggestions = !reviewResult.toLowerCase().includes('looks complete') &&
                           !reviewResult.toLowerCase().includes('looks good') &&
                           !reviewResult.toLowerCase().includes('looks solid') &&
                           !reviewResult.toLowerCase().includes('covered');

    if (hasSuggestions) {
      display = {
        type: 'review',
        reviewNotes: reviewResult,
      };
      message = reviewResult + '\n\nWant me to search for any of these?';
      quickReplies = ['Yes, show me', 'No, move on'];
    } else {
      // Quote looks good, skip to wrapup
      message = await callClaude('Say the quote looks solid - nothing obvious missing. Then ask how many labor hours for this job.');
      newState.phase = 'wrapup';
      newState.wrapupStep = 1;
      quickReplies = ['8 hrs', '16 hrs', '24 hrs', '40 hrs'];
    }
  }

  return { message, display, quickReplies, toolCalls, newState };
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
    const userDefaults = body.userDefaults || {};

    console.log('[wizard-chat] Phase:', state.phase, 'Step:', state.setupStep, 'Message:', userMessage.substring(0, 50));

    const result = await processMessage(supabase, userMessage, state, userDefaults);

    console.log('[wizard-chat] Result - Phase:', result.newState.phase, 'Message:', result.message.substring(0, 50));

    return new Response(
      JSON.stringify({
        message: result.message,
        display: result.display,
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
