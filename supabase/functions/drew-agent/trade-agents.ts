/**
 * Trade Agents - Expert AI agents for each trade
 *
 * These agents provide intelligence when the state machine needs help:
 * 1. Job interpretation - "I need a sub-panel in my garage" → panel_upgrade
 * 2. Clarification - Understanding unexpected user input
 * 3. Expert advice - Code questions, material recommendations
 *
 * Uses Claude Haiku for speed and cost efficiency (~$0.01-0.02 per call)
 */

// =============================================================================
// TYPES
// =============================================================================

export type Trade = 'electrical' | 'plumbing' | 'general' | 'hvac' | 'roofing';

export interface TradeAgentRequest {
  trade: Trade;
  task: 'interpret_job' | 'clarify_input' | 'expert_advice' | 'adjust_checklist';
  userInput: string;
  context?: {
    currentState?: string;
    previousQuestion?: string;
    scopingAnswers?: Record<string, string>;
    availableJobTypes?: string[];
    baseChecklist?: ChecklistItem[];
    jobType?: string;
  };
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

export interface ChecklistAdjustment {
  action: 'add' | 'remove' | 'modify';
  category: string;
  name?: string;
  reason: string;
  searchTerms?: string[];
  defaultQty?: number;
  unit?: string;
}

export interface TradeAgentResponse {
  success: boolean;
  // For job interpretation
  jobType?: string;
  confidence?: 'high' | 'medium' | 'low';
  // For clarification
  clarifiedIntent?: string;
  suggestedAction?: string;
  // For expert advice
  advice?: string;
  // For checklist adjustments
  adjustments?: ChecklistAdjustment[];
  // Always include a message for the user
  message?: string;
  quickReplies?: string[];
}

// =============================================================================
// TRADE AGENT SYSTEM PROMPTS
// =============================================================================

const MASTER_ELECTRICIAN_PROMPT = `You are a Master Electrician with 20+ years of residential and commercial experience.
You know the NEC code inside and out. You help contractors build accurate quotes.

Your expertise includes:
- Residential: Panel upgrades, EV chargers, lighting, outlets, ceiling fans
- Commercial: 3-phase, sub-panels, dedicated circuits
- Code: NEC requirements, permits, inspections
- Safety: Wire sizing, load calculations, grounding

Communication style:
- Brief and practical (1-2 sentences max)
- Speak like a fellow tradesperson
- Never say "Great question!" or be overly enthusiastic
- Be confident but not cocky

IMPORTANT: Respond with valid JSON only. No markdown, no explanation outside the JSON.`;

const MASTER_PLUMBER_PROMPT = `You are a Master Plumber with 20+ years of residential and commercial experience.
You know the IPC code inside and out. You help contractors build accurate quotes.

Your expertise includes:
- Residential: Water heaters, fixtures, re-pipes, drains
- Commercial: Backflow, grease traps, medical gas
- Code: IPC requirements, permits, inspections
- Safety: Venting, pressure testing, gas lines

Communication style:
- Brief and practical (1-2 sentences max)
- Speak like a fellow tradesperson
- Never say "Great question!" or be overly enthusiastic
- Be confident but not cocky

IMPORTANT: Respond with valid JSON only. No markdown, no explanation outside the JSON.`;

const MASTER_BUILDER_PROMPT = `You are a Master Builder/General Contractor with 20+ years of residential experience.
You handle framing, drywall, finishing, and general construction.

Your expertise includes:
- Framing: Walls, headers, structural repairs
- Drywall: Installation, finishing, repairs
- Finishing: Trim, doors, cabinets, flooring
- General: Decks, fences, siding, roofing basics

Communication style:
- Brief and practical (1-2 sentences max)
- Speak like a fellow tradesperson
- Never say "Great question!" or be overly enthusiastic
- Be confident but not cocky

IMPORTANT: Respond with valid JSON only. No markdown, no explanation outside the JSON.`;

export const TRADE_PROMPTS: Record<Trade, string> = {
  electrical: MASTER_ELECTRICIAN_PROMPT,
  plumbing: MASTER_PLUMBER_PROMPT,
  general: MASTER_BUILDER_PROMPT,
  hvac: MASTER_BUILDER_PROMPT, // TODO: Create HVAC-specific prompt
  roofing: MASTER_BUILDER_PROMPT, // TODO: Create roofing-specific prompt
};

// =============================================================================
// JOB TYPE MAPPINGS (for interpretation)
// =============================================================================

export const ELECTRICAL_JOB_TYPES = [
  { id: 'panel_upgrade', keywords: ['panel', 'sub-panel', 'subpanel', '200 amp', '200a', 'upgrade panel', 'service upgrade', 'main panel', 'breaker box', 'fuse box'] },
  { id: 'ev_charger', keywords: ['ev charger', 'electric vehicle', 'tesla charger', 'car charger', 'level 2 charger', 'nema 14-50'] },
  { id: 'recessed_lighting', keywords: ['recessed', 'can lights', 'pot lights', 'downlights', 'ceiling lights'] },
  { id: 'outlet_circuit', keywords: ['outlet', 'receptacle', 'plug', 'circuit', 'dedicated circuit'] },
  { id: 'ceiling_fan', keywords: ['ceiling fan', 'fan install', 'fan installation'] },
  { id: 'generator', keywords: ['generator', 'whole house generator', 'backup power', 'transfer switch'] },
  { id: 'hot_tub', keywords: ['hot tub', 'spa', 'jacuzzi', '240v outdoor'] },
  { id: 'smoke_detectors', keywords: ['smoke detector', 'smoke alarm', 'co detector', 'carbon monoxide'] },
  { id: 'range_dryer_circuit', keywords: ['range', 'dryer', 'stove', 'oven', '240v outlet', '240 volt', '50 amp outlet', '30 amp outlet', 'dryer outlet', 'range outlet'] },
];

// =============================================================================
// CALL TRADE AGENT
// =============================================================================

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

export async function callTradeAgent(request: TradeAgentRequest): Promise<TradeAgentResponse> {
  const systemPrompt = TRADE_PROMPTS[request.trade];

  if (!systemPrompt) {
    console.error(`[trade-agent] Unknown trade: ${request.trade}`);
    return { success: false, message: "I'm not sure about that trade." };
  }

  // Build the task-specific prompt
  let userPrompt: string;

  switch (request.task) {
    case 'interpret_job':
      userPrompt = buildInterpretJobPrompt(request);
      break;
    case 'clarify_input':
      userPrompt = buildClarifyInputPrompt(request);
      break;
    case 'expert_advice':
      userPrompt = buildExpertAdvicePrompt(request);
      break;
    case 'adjust_checklist':
      userPrompt = buildAdjustChecklistPrompt(request);
      break;
    default:
      return { success: false, message: "Unknown task type." };
  }

  console.log(`[trade-agent] Calling ${request.trade} agent for ${request.task}`);
  console.log(`[trade-agent] User input: "${request.userInput.substring(0, 50)}..."`);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[trade-agent] API error: ${response.status} - ${errorText}`);
      return { success: false, message: "I had trouble understanding that. Could you rephrase?" };
    }

    const data = await response.json();
    const textContent = data.content?.find((c: any) => c.type === 'text')?.text;

    if (!textContent) {
      console.error('[trade-agent] No text content in response');
      return { success: false, message: "I didn't get a response. Please try again." };
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(textContent);
      console.log(`[trade-agent] Response:`, parsed);
      return { success: true, ...parsed };
    } catch (parseError) {
      console.error('[trade-agent] Failed to parse JSON response:', textContent);
      // Try to extract useful info even if not valid JSON
      return {
        success: true,
        message: textContent.substring(0, 200),
        confidence: 'low'
      };
    }

  } catch (error) {
    console.error('[trade-agent] Error:', error);
    return { success: false, message: "Something went wrong. Let's try again." };
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildInterpretJobPrompt(request: TradeAgentRequest): string {
  const jobTypes = request.context?.availableJobTypes || ELECTRICAL_JOB_TYPES.map(j => j.id);

  return `The user said: "${request.userInput}"

Your task: Identify what type of electrical job they're describing.

Available job types:
${jobTypes.map(jt => `- ${jt}`).join('\n')}

Respond with JSON:
{
  "jobType": "the matching job type ID or null if unclear",
  "confidence": "high" | "medium" | "low",
  "message": "brief acknowledgment to the user (e.g., 'Panel upgrade, got it.')",
  "quickReplies": ["array of 2-4 follow-up options if confidence is low"]
}

If you can't determine the job type, set jobType to null and ask a clarifying question in the message.`;
}

function buildClarifyInputPrompt(request: TradeAgentRequest): string {
  return `The user said: "${request.userInput}"

Context:
- Current state: ${request.context?.currentState || 'unknown'}
- Previous question: "${request.context?.previousQuestion || 'none'}"
- Previous answers: ${JSON.stringify(request.context?.scopingAnswers || {})}

Your task: Understand what the user meant and suggest how to proceed.

Respond with JSON:
{
  "clarifiedIntent": "what you think they meant",
  "suggestedAction": "continue" | "rephrase_question" | "skip_question" | "go_back",
  "message": "brief response to the user",
  "quickReplies": ["2-4 helpful options"]
}`;
}

function buildExpertAdvicePrompt(request: TradeAgentRequest): string {
  return `The user asked: "${request.userInput}"

Context from the job:
${JSON.stringify(request.context?.scopingAnswers || {}, null, 2)}

Your task: Provide brief, practical expert advice.

Respond with JSON:
{
  "advice": "your expert recommendation (1-2 sentences)",
  "message": "friendly response to show the user",
  "quickReplies": ["continue options"]
}`;
}

function buildAdjustChecklistPrompt(request: TradeAgentRequest): string {
  const scopingAnswers = request.context?.scopingAnswers || {};
  const baseChecklist = request.context?.baseChecklist || [];
  const jobType = request.context?.jobType || 'unknown';

  return `Job type: ${jobType}

Scoping answers from the customer:
${Object.entries(scopingAnswers).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Current materials checklist:
${baseChecklist.map(item => `- ${item.name} (${item.category}): qty ${item.defaultQty} ${item.unit}`).join('\n')}

Your task: Based on the scoping answers, suggest adjustments to the checklist.

Common adjustments to consider:
- Long wire runs (50+ ft): Upsize wire gauge for voltage drop
- Panel full: Add sub-panel or tandem breakers
- Exterior/outdoor: Add weatherproof boxes, outdoor-rated materials
- Vaulted ceiling: Add angled mount adapters
- No attic access: More labor, may need surface conduit
- Multiple units: Increase quantities accordingly

Respond with JSON:
{
  "adjustments": [
    {
      "action": "add" | "remove" | "modify",
      "category": "category name for the item",
      "name": "item name (for add/modify)",
      "reason": "brief explanation",
      "searchTerms": ["search", "terms"],  // for add only
      "defaultQty": 1,  // for add/modify
      "unit": "ea"  // for add only
    }
  ],
  "message": "brief summary of changes (or 'No adjustments needed' if none)"
}

Only suggest adjustments that are clearly needed based on the answers. If the standard checklist is fine, return an empty adjustments array.`;
}

// =============================================================================
// HELPER: Apply checklist adjustments
// =============================================================================

export function applyChecklistAdjustments(
  baseChecklist: ChecklistItem[],
  adjustments: ChecklistAdjustment[]
): ChecklistItem[] {
  if (!adjustments || adjustments.length === 0) {
    return baseChecklist;
  }

  let result = [...baseChecklist];

  for (const adj of adjustments) {
    switch (adj.action) {
      case 'add':
        // Only add if not already present
        if (!result.find(item => item.category === adj.category)) {
          result.push({
            category: adj.category,
            name: adj.name || adj.category,
            searchTerms: adj.searchTerms || [adj.name || adj.category],
            defaultQty: adj.defaultQty || 1,
            unit: adj.unit || 'ea',
            required: false,
            notes: adj.reason,
          });
        }
        break;

      case 'remove':
        result = result.filter(item => item.category !== adj.category);
        break;

      case 'modify':
        result = result.map(item => {
          if (item.category === adj.category) {
            return {
              ...item,
              defaultQty: adj.defaultQty ?? item.defaultQty,
              name: adj.name || item.name,
              notes: adj.reason,
            };
          }
          return item;
        });
        break;
    }
  }

  return result;
}

// =============================================================================
// HELPER: Quick job type matching (before calling AI)
// =============================================================================

export function quickMatchJobType(input: string): { jobType: string; confidence: 'high' | 'medium' } | null {
  const normalized = input.toLowerCase().trim();

  for (const job of ELECTRICAL_JOB_TYPES) {
    for (const keyword of job.keywords) {
      if (normalized.includes(keyword)) {
        // Exact match = high confidence
        if (normalized === keyword || normalized.startsWith(keyword + ' ') || normalized.endsWith(' ' + keyword)) {
          return { jobType: job.id, confidence: 'high' };
        }
        // Partial match = medium confidence
        return { jobType: job.id, confidence: 'medium' };
      }
    }
  }

  return null;
}
