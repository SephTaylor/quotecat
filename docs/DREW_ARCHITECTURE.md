# Drew: Agentic Quote Wizard Architecture

> Summary of architectural discussion - January 2026

## Vision

Drew is not a chatbot. Drew is an **experienced contractor in your pocket** - an intelligent assistant that:

- **Drives the conversation** like a seasoned pro standing on the job site with you
- **Knows the tradecraft** - what questions to ask, in what order, what's often forgotten
- **Scopes jobs intelligently** based on deep domain knowledge
- **Builds accurate quotes** with real-time material pricing

The goal: When a user says "I need to quote a bathroom gut job," Drew already knows what to ask, probes for the details a pro would catch, and assembles a complete quote without the user having to lead.

## Why This Matters

Drew is the key differentiator for Premium tier. It's proprietary IP because:

1. **The tradecraft knowledge base is ours** - structured domain expertise, not generic AI
2. **The integration is tight** - Drew uses real-time Lowe's/HD pricing via XByte
3. **The workflow is unique** - scoping → materials → labor → quote in one conversation
4. **It compounds** - every tradecraft doc added makes Drew smarter

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DREW AGENT SYSTEM                           │
│                                                                     │
│   User: "I need to quote a panel upgrade"                          │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                    ORCHESTRATOR                              │  │
│   │            (The brain that runs the loop)                    │  │
│   │                                                              │  │
│   │   while (quote not complete) {                               │  │
│   │     1. Look at conversation so far                           │  │
│   │     2. Ask Claude: "What should I do next?"                  │  │
│   │     3. Claude picks a tool (or asks user a question)         │  │
│   │     4. Execute the tool, get result                          │  │
│   │     5. Add result to conversation context                    │  │
│   │   }                                                          │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                      TOOL BELT                               │  │
│   │                                                              │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│   │  │ searchDocs  │  │ askUser     │  │ lookupMaterials     │  │  │
│   │  │ (pgvector)  │  │             │  │ (XByte API)         │  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│   │                                                              │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│   │  │ calcLabor   │  │ buildQuote  │  │ saveQuote           │  │  │
│   │  │             │  │             │  │                     │  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│   │                                                              │  │
│   │  ┌─────────────────────┐  ┌─────────────────────────────┐   │  │
│   │  │ getUserSettings     │  │ confirmLabor                │   │  │
│   │  │ (hourly rate, etc)  │  │ (propose, let user adjust)  │   │  │
│   │  └─────────────────────┘  └─────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Orchestrator (TypeScript)

The agent loop that makes Drew an *agent* instead of a chatbot:

```
User says something
     │
     ▼
Build context (conversation history, quote state, available tools)
     │
     ▼
Call Claude: "What's your next action?"
     │
     ▼
Claude picks a tool OR responds to user
     │
     ▼
Execute tool, add result to context
     │
     ▼
Loop continues until quote complete
```

### 2. Tradecraft Knowledge Base (Supabase + pgvector)

```sql
TABLE: tradecraft_docs
├── id              uuid
├── trade           text ("electrical", "plumbing", "drywall", etc)
├── job_type        text ("panel_upgrade", "bathroom_remodel", etc)
├── title           text
├── content         text (markdown - the actual tradecraft)
├── embedding       vector(1536) (for semantic search)
├── created_at      timestamptz
└── updated_at      timestamptz
```

### 3. Tools

| Tool | Purpose | Data Source |
|------|---------|-------------|
| `searchDocs(query)` | Find relevant tradecraft | Supabase pgvector |
| `askUser(question)` | Get info from user | Returns to UI |
| `lookupMaterials(items)` | Real-time prices | XByte API (Lowe's/HD) |
| `calcLabor(params)` | Estimate labor hours | Tradecraft formulas |
| `buildQuote(items)` | Assemble line items | In-memory |
| `saveQuote(quote)` | Persist quote | SQLite + Supabase |
| `getUserSettings()` | Get hourly rate, markup, etc | User preferences |
| `confirmLabor(estimate)` | Propose hours, user adjusts | Interactive |

---

## Key Behaviors

### User Settings Awareness

Drew checks for user's default hourly rate, markup, tax rate before building quote. If not set:
> "What's your hourly labor rate for electrical work? Want me to save that as your default?"

### Labor Confirmation

Drew proposes hours based on tradecraft, but user confirms:
> "For a panel upgrade with an EV circuit, I'd estimate around 7 hours. Does that sound right, or would you adjust it?"

### Unknown Job Types (Fallback)

If tradecraft doc doesn't exist for a job type, Drew falls back to general mode:
> "I don't have specific guidance for septic systems yet, but let's walk through it together..."

### Corrections

Drew handles being wrong gracefully:
> USER: "No, kitchen not bathroom"
> DREW: "My bad - kitchen remodel. Let me grab the right questions."

### Conversation Persistence

Conversations are saved. User can close app and resume where they left off.

---

## Implementation Roadmap

### Phase 1: Foundation
**Goal:** Agent loop working with one job type

1. Set up `tradecraft_docs` table in Supabase with pgvector
2. Load initial electrical tradecraft docs
3. Build orchestrator (agent loop in TypeScript)
4. Define tools (searchDocs, askUser, lookupMaterials, buildQuote)
5. Wire up to existing Drew UI
6. Test end-to-end with panel upgrade job type

**Milestone:** Drew intelligently quotes ONE job type

### Phase 2: Core Experience
**Goal:** Drew feels like a real assistant

- User settings awareness (hourly rate, markup)
- Labor confirmation flow
- Conversation persistence
- Graceful fallback for unknown job types
- Natural correction handling

**Milestone:** Drew is usable for real quoting

### Phase 3: Knowledge Expansion
**Goal:** Drew covers common jobs across trades

- Use Claude to draft tradecraft docs
- Have real contractors (Wyatt) review and correct
- Build out 5-10 docs per major trade
- Iterate based on testing feedback

**Milestone:** Drew covers 80% of common residential jobs

### Phase 4: Polish (Future)
- Good-better-best quote variants
- Remember user patterns
- Client context from client manager
- Voice input (hands-free on job site)

---

## Costs

### API Stack

Drew uses two APIs:

| API | Purpose | Cost |
|-----|---------|------|
| **Anthropic Claude** | Conversations, tool use, responses | ~95% of Drew's cost |
| **OpenAI Embeddings** | Tradecraft vector search (`text-embedding-3-small`) | ~$0.0001/search (negligible) |

**Why both?** Anthropic doesn't offer an embeddings API. OpenAI's is industry standard and dirt cheap.

### Per-Session Cost Breakdown

A typical 10-turn Drew session (job scoping → materials → labor → quote):

| Configuration | Cost/Session | Notes |
|---------------|--------------|-------|
| Claude Sonnet (no caching) | ~$0.35 | Original baseline |
| Claude Sonnet + caching | ~$0.18 | ✅ Current (Jan 2026) |
| Claude Sonnet + hybrid state machine | ~$0.05 | Planned Phase 2 |
| Claude Haiku + hybrid | ~$0.02 | Future option |

### Cost Projections at Scale

| Premium Users | Sessions/Month | Current (w/ caching) | With Hybrid |
|---------------|----------------|----------------------|-------------|
| 100 | 500 | $90 | $25 |
| 500 | 2,500 | $450 | $125 |
| 1,000 | 5,000 | $900 | $250 |

*Assumes 5 Drew sessions per user per month*

### Main Investment
**Time** - specifically creating tradecraft docs. Infrastructure is cheap; knowledge is the work.

---

## Draft Tradecraft Docs (Electrical)

Four docs created to test the system:

1. **200 Amp Panel Upgrade** - scoping questions, materials, labor estimates, gotchas
2. **EV Charger Installation** - Level 2, NEMA 14-50 vs hardwired, distance considerations
3. **Recessed Lighting Installation** - wafer vs housing, attic access impact, per-light pricing
4. **Outlet/Circuit Addition** - dedicated circuits, GFCI/AFCI requirements, fishing difficulty

These are AI-drafted starting points. Validate system works first, THEN get expert review from Wyatt.

---

## Strategic Context

### QuoteCat Positioning
- Target: Solo contractors and small crews (1-5 people)
- Differentiator: Real-time Lowe's/HD pricing + intelligent quoting
- Growth path: Pro → Premium → Enterprise (future team features)

### Drew's Role
- Key Premium differentiator
- Proprietary IP (tradecraft knowledge base)
- Compounds over time (more docs = smarter Drew)
- Not competing with generic AI - competing on domain expertise

### Support Model
- Direct text/call support from founders
- Scales to ~200-500 users before needing help
- Fits target market (small businesses prefer real people)

---

## Next Steps

1. Set up `tradecraft_docs` table in Supabase with pgvector enabled
2. Create embedding generation function
3. Load the four electrical docs
4. Build orchestrator MVP
5. Test with panel upgrade flow
6. Iterate

---

## Known Issues / Future Optimizations

### Conversation State Size

**Issue:** When Drew retrieves tradecraft docs via RAG, the full document content gets added to the conversation messages. This content is passed back and forth on every subsequent message in the agent loop.

**Impact:** For longer conversations, this can:
- Increase Claude API token usage (cost)
- Add latency to each request
- Eventually hit context limits

**Current behavior:** Full tradecraft doc (~3-5KB per doc) embedded in tool results

**Future optimization options:**
1. Store tradecraft doc ID in conversation state, re-fetch content only when generating final response
2. Summarize tradecraft doc after retrieval (keep key points, drop examples)
3. Chunk tradecraft docs and only retrieve relevant sections
4. Use shorter tradecraft "reference cards" during conversation, full docs only for final quote assembly

**Priority:** Low (monitor token usage first, optimize if it becomes a cost issue)

### Drew Loses Context Mid-Conversation

**Issue:** Drew sometimes forgets what was discussed earlier, asks repeated questions, or loses track of where it is in the quoting flow. This happens because LLMs aren't reliable at state management.

**Root cause:** Claude manages conversation flow directly. LLMs are great at language but bad at tracking multi-step processes.

**Impact:** Confusing user experience, wasted API calls, user frustration.

**Solution:** Hybrid state machine approach (see Cost Optimization below).

---

## Cost Optimization Strategy

### Phase 1: Prompt Caching ✅ DONE (Jan 11, 2026)

Added `cache_control: { type: 'ephemeral' }` to system prompt in `drew-agent/index.ts`.

**How it works:**
- Caching happens on Anthropic's servers (not user devices or Supabase)
- First call creates cache, subsequent calls use cached content at 10% cost
- Cache refreshes automatically when used (5-minute TTL)

**Implementation:**
```typescript
system: [
  {
    type: 'text',
    text: systemPrompt + settingsContext,
    cache_control: { type: 'ephemeral' }
  }
],
```

**Result:** ~50% cost reduction on system prompt tokens.

### Phase 2: Hybrid State Machine (PLANNED)

**Concept:** Server-side state machine controls flow, Claude only adds personality for natural language parts.

**What doesn't need Claude (handle with state machine):**
- Job type selection → direct database lookup
- Checklist confirmation → UI interaction
- Product selection → database queries
- Labor/markup entry → form input

**What still needs Claude:**
- Understanding natural language job descriptions
- Asking clarifying questions
- Handling unexpected responses

**Benefits:**
1. ~85% total cost reduction (combined with caching)
2. Drew can't "forget" - state machine always knows where it is
3. Faster response times for structured parts (no API latency)
4. Predictable, consistent behavior

**Draft code:** `docs/state-machine-draft.ts`

**State machine phases:**
```
setup (scoping questions) → generating_checklist → building (materials) → wrapup (labor, markup) → done
```

### Phase 3: Model Optimization (FUTURE)

If more savings needed after hybrid implementation:

| Model | Cost/Session | Trade-off |
|-------|--------------|-----------|
| Claude Sonnet 4 (current) | ~$0.18 | Best quality |
| Claude Haiku 3.5 | ~$0.02 | May drift more in long conversations |
| GPT-4o-mini | ~$0.01 | Requires full API rewrite |

**Recommendation:** Don't switch models until hybrid state machine is implemented. Cheaper models have MORE context drift issues, not fewer. State machine fixes this.

**To switch to Haiku (one-line change):**
```typescript
model: 'claude-haiku-3-5-20241022'  // instead of claude-sonnet-4-20250514
```

---

## Testing Notes (January 11, 2026)

### What's Working

- ✅ Basic panel upgrade flow completes end-to-end
- ✅ Checklist confirmation with natural language ("Looks good", "Yes")
- ✅ Partial selection ("Just the panel") now works
- ✅ Products display with checkboxes and quantities
- ✅ Quote finalization and save to cloud
- ✅ Category filter prevents cross-trade results (electrical jobs get electrical products)
- ✅ Prompt caching enabled for ~50% cost savings

### Known Issues (LLM Behavior)

These issues stem from the LLM making its own decisions. The hybrid state machine will fix these by controlling the flow server-side.

| Issue | Description | Workaround Added |
|-------|-------------|------------------|
| **Bundled questions** | Drew asks about labor while showing products in same message | Added "ONE THING PER MESSAGE" rule to prompt |
| **Mismatched quick replies** | Drew asks "finalize?" but button says "Review quote" | Fixed `generateQuickReplies` to return "Yes, finalize" when quote is complete |
| **Wrong products from ad-hoc search** | When Drew calls `lookup_materials` outside checklist flow, it may search broad terms like "service entrance" which matches "Service Entrance Head Cap" | Tightened tradecraft search terms; full fix needs state machine |
| **Skips checklist sometimes** | Drew occasionally goes straight to products without showing checklist first | Added guard in `propose_checklist` handler; full fix needs state machine |
| **Re-proposes checklist** | Drew calls `propose_checklist` again when user says partial selection | Added guard: if checklist already pending, return error message |
| **Random scoping questions** | Drew sometimes asks questions not in tradecraft (e.g., "Any permits required?") with mismatched quick replies | Need to either add to tradecraft or constrain Drew to tradecraft questions only |
| **$0 draft quotes appearing** | After finalizing a quote through Drew, $0 draft quotes appear on dashboard - possible sync/merge issue or partial quotes being saved | Needs investigation - may be creating quotes during session that don't get cleaned up |

### Fixes Applied Today

1. **Limited products per category** - Max 2 products per checklist category (was unlimited)
2. **Added `remove_quote_items` tool** - Drew can now remove incorrect items
3. **Natural language checklist confirmation** - Recognizes "Looks good", "Yes", "Perfect", etc.
4. **Partial selection handling** - "Just the panel" selects only matching categories
5. **Updated tradecraft search terms** - More specific terms to avoid wrong matches
6. **Stricter prompt rules** - "One thing per message" with explicit examples
7. **Fixed quick replies** - Returns "Yes, finalize" instead of "Review quote" when appropriate

### Next Priority: Hybrid State Machine

The LLM behavior issues above all have the same root cause: Claude is making flow decisions that should be deterministic.

**Solution:** Implement the hybrid state machine (see Phase 2 above) where:
- Server controls flow progression
- UI interactions (checklist confirm, product select) don't go through LLM
- Claude only handles natural language understanding and personality

**Expected result:** Consistent behavior, faster responses, ~85% cost savings.

---

*Document created: January 2026*
*Last updated: January 11, 2026*
