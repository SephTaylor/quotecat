# Tradecraft Development Guide

> How to efficiently build out Drew's domain knowledge

## Overview

Tradecraft docs are the structured knowledge that makes Drew smart. Each doc contains:
- **Scoping questions** - What to ask before quoting
- **Materials checklist** - What products are typically needed
- **Labor estimates** - How long jobs typically take
- **Gotchas** - Common issues pros know to watch for

---

## Current Status

### Completed Tradecraft Docs

| Job Type | Trade | Scoping Questions | Materials Checklist | Notes |
|----------|-------|-------------------|---------------------|-------|
| `panel_upgrade` | Electrical | 4 questions | 5 categories | Full state machine support |
| `ev_charger` | Electrical | - | 4 categories | Needs scoping questions |
| `recessed_lighting` | Electrical | - | - | Needs scoping questions |
| `outlet_circuit` | Electrical | - | - | Needs scoping questions |

### Priority Job Types by Trade

**The goal:** Cover the 80% of jobs that solo contractors quote most often.

| Trade | Common Jobs | Priority |
|-------|-------------|----------|
| **Electrical** | Panel upgrade, EV charger, recessed lighting, outlets, ceiling fans, fixtures | Have 4, need ~6 more |
| **Plumbing** | Water heater, faucets, toilets, garbage disposal, shut-offs, drain clearing | Need ~8 |
| **HVAC** | Thermostat, mini-split, furnace, AC unit, duct work | Need ~6 |
| **Carpentry** | Door install, trim work, shelving, deck repair, fence repair | Need ~8 |
| **Drywall** | Patch repair, full room, ceiling repair, texture matching | Need ~5 |
| **Painting** | Interior room, exterior, cabinet refinish, deck stain | Need ~5 |
| **Flooring** | LVP install, tile, carpet, hardwood refinish | Need ~5 |
| **Roofing** | Shingle repair, flat roof patch, gutter install, flashing | Need ~5 |
| **Concrete** | Sidewalk, patio, driveway repair, foundation crack | Need ~4 |
| **Landscaping** | Irrigation, sod install, retaining wall, drainage | Need ~5 |

**Total estimated: ~60 job types to cover most residential work**

---

## Development Strategy

### The 3-Step Process

```
1. EXTRACT structure from industry templates
2. DRAFT content with Claude
3. VALIDATE with expert (Wyatt)
```

### Step 1: Extract Structure

Use free industry templates to identify:
- Common job categories per trade
- Typical task breakdowns
- Standard material lists

### Step 2: Draft with Claude

Prompt template:
```
You're an experienced {trade} contractor. For a {job_type} job:

1. What are the 4-5 key scoping questions you'd ask before quoting?
   - Include question text and 3-4 common answers as quick replies

2. What material categories are typically needed?
   - Include search terms that would find products at Lowe's/HD
   - Include default quantities and units

3. What's the typical labor hour range?
   - Provide low/mid/high estimates
   - Note factors that affect time

Output as JSON matching our tradecraft schema.
```

### Step 3: Validate with Expert

Send draft to Wyatt (or other contractor):
- "Does this match how you'd scope this job?"
- "What's missing?"
- "What's wrong?"

Update based on feedback.

---

## Research: Available Resources

### Tier 1: High-Value APIs

| Resource | What It Offers | Access | Link |
|----------|---------------|--------|------|
| **1Build API** | 68M+ live material/labor costs, county-level pricing | Already using via XByte | [1build.com](https://www.1build.com/) |
| **NECA Manual of Labor Units** | Industry-standard labor hours per electrical task | Purchase (~$200) | [necanet.org](https://www.necanet.org) |

**1Build is key** - we're already paying for it. Their API has:
- Material categorization we can use
- Labor cost data by task type
- County-level pricing

**Idea:** Query 1Build for their category taxonomy. Structure tradecraft docs so searchTerms always match their data.

### Tier 2: Structured Templates (Free)

| Resource | What It Offers | Link |
|----------|---------------|------|
| **Smartsheet Construction Templates** | Residential scope checklists by trade | [smartsheet.com](https://www.smartsheet.com/content/construction-scope-of-work-templates) |
| **Building Advisor Checklist** | 350+ line items for residential projects | [buildingadvisor.com](https://buildingadvisor.com/estimating-for-owner-builders/) |
| **BuildBook SOW Template** | Scope of work for remodelers | [buildbook.co](https://buildbook.co/scope-of-work-template) |
| **CSI MasterFormat** | Standard organization of construction trades | [csiresources.org](https://www.csiresources.org/standards/masterformat) |

**Smartsheet residential checklist** has task breakdowns for:
- Project planning
- Site prep
- Framing
- MEP (Mechanical, Electrical, Plumbing)
- HVAC
- Insulation & drywall
- Windows & doors
- Flooring
- Interior/exterior finishes

### Tier 3: Knowledge Sources

| Resource | What It Offers | Link |
|----------|---------------|------|
| **Mike Holt Electrical Training** | Video courses on electrical estimating | [mikeholt.com](https://www.mikeholt.com/) |
| **Countfire Academy** | Estimator best practices, YouTube channel | [countfire.com](https://www.countfire.com/academy/learn-electrical-estimating) |
| **Procore Library** | Guides on estimating by trade | [procore.com/library](https://www.procore.com/library) |
| **Jobber Academy** | Trade-specific estimating guides | [getjobber.com/academy](https://www.getjobber.com/academy/) |

### Not Useful (Closed/Expensive)

| Resource | Why Not |
|----------|---------|
| RSMeans API | No public API, enterprise licensing only ($500+/yr) |
| HomeAdvisor/Angi | No cost data API, just lead gen |
| XactRemodel | Closed ecosystem, no API |

---

## Tradecraft Doc Schema

### Database Table: `tradecraft_docs`

```sql
CREATE TABLE tradecraft_docs (
  id UUID PRIMARY KEY,
  trade TEXT,                    -- "electrical", "plumbing", etc.
  job_type TEXT UNIQUE,          -- "panel_upgrade", "ev_charger"
  title TEXT,                    -- "200 Amp Panel Upgrade"
  content TEXT,                  -- Markdown guidance for Claude
  embedding VECTOR(1536),        -- For semantic search
  scoping_questions JSONB,       -- Structured questions for state machine
  materials_checklist JSONB,     -- Structured material categories
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Scoping Questions Format

```json
{
  "scoping_questions": [
    {
      "id": "unique_id",
      "question": "What is the current panel amperage?",
      "quickReplies": ["100A", "150A", "60A or fuse box", "Not sure"],
      "storeAs": "currentAmperage"
    }
  ]
}
```

### Materials Checklist Format

```json
{
  "materials_checklist": {
    "items": [
      {
        "category": "main_panel",
        "name": "200A Main breaker panel",
        "searchTerms": ["200A panel", "200 amp load center"],
        "defaultQty": 1,
        "unit": "ea",
        "required": true,
        "notes": "Match amperage to service upgrade"
      }
    ]
  }
}
```

---

## Time Estimates

| Task | Time |
|------|------|
| Draft scoping questions for 1 job type (Claude) | 5 min |
| Add to database | 2 min |
| Expert review (async) | Wyatt's time |
| Incorporate feedback | 5 min |

**Total per job type: ~12 min of our time**

To add 20 job types: ~4 hours

---

## Implementation Plan

### The Problem
- ~60 job types needed across 10+ trades
- At 12 min each = 12 hours of manual work
- We need to parallelize and automate

### The Solution: Batch Generation

**Step 1: Define all job types upfront (1 hour)**

Create a master list of job types with:
- `job_type` slug
- `trade` category
- `title` display name
- Brief description

**Step 2: Batch generate with Claude (2-3 hours)**

```
For each job type in the master list:
1. Generate 4-5 scoping questions with quick replies
2. Generate materials checklist with search terms
3. Output as JSON ready for database insert
```

One Claude session can generate 5-10 job types at once.

**Step 3: Bulk insert to database (30 min)**

Single SQL script to insert all tradecraft docs.

**Step 4: Expert review by trade (async)**

Send to trade experts:
- Wyatt: Electrical
- [Need]: Plumbing contact
- [Need]: General contractor contact

They review their trade, we batch update.

### Estimated Timeline

| Phase | Time | Output |
|-------|------|--------|
| Define master list | 1 hr | 60 job types defined |
| Batch generate | 3 hrs | 60 tradecraft docs drafted |
| Database insert | 30 min | All docs in Supabase |
| Expert review | Async | Validated tradecraft |
| Incorporate feedback | 2 hrs | Production-ready |

**Total: ~7 hours to go from 4 to 60 job types**

### Rollout Strategy

Don't need all 60 at once. Prioritize by:
1. **What users ask for** - Track "Something else" selections
2. **Most common residential jobs** - Faucets, water heaters, painting
3. **Highest margin jobs** - Panel upgrades, remodels

**MVP coverage by trade:**
- 2-3 jobs per trade = ~25 total
- Covers most common requests
- Add more based on user demand

---

## Expert Reviewers

| Name | Trade | Contact | Notes |
|------|-------|---------|-------|
| Wyatt | Electrical | wyattstephan@stephanelectric.com | VIP tester, lifetime premium |

---

## Core Design Principles

### Tradecraft Must Be Generalized

**Bad:** "200 Amp Panel Upgrade" (hardcoded to one size)
**Good:** "Panel Upgrade" (scoping questions determine size)

Each tradecraft doc should be **one generalized job type**, with scoping questions that branch into specifics. The materials checklist and labor estimates should be **deterministic based on scoping answers**.

Example flow:
```
Job Type: Panel Upgrade (generalized)
    ↓
Scoping Q: "What amperage are you upgrading to?"
    → 200A / 320A / 400A
    ↓
Materials: Determined by answer (200A panel vs 400A panel)
Labor: Determined by answer (200A = 8hrs, 400A = 12hrs)
```

**NOT:**
```
Job Type: 200 Amp Panel Upgrade (specific)
Job Type: 320 Amp Panel Upgrade (another specific doc)
Job Type: 400 Amp Panel Upgrade (yet another doc)
```

This keeps the number of tradecraft docs manageable and lets the scoping questions do the work of customization.

---

## Known Issues

| Job Type | Issue | Status |
|----------|-------|--------|
| `panel_upgrade` | Title hardcoded to "200 Amp", missing target amperage question | Open |
| `panel_upgrade` | Materials checklist assumes 200A, needs to be dynamic based on scoping | Open |

---

## Notes

### What Makes Good Scoping Questions

1. **Ask about scope, not details**
   - Good: "Is this a full gut or cosmetic refresh?"
   - Bad: "What color tile do you want?"

2. **Quick replies should cover 90% of answers**
   - 3-4 options that are mutually exclusive
   - Always include "Not sure" or "Other"

3. **Order matters**
   - Ask big-picture questions first
   - Narrow down to specifics

4. **Each answer should affect the quote**
   - If an answer doesn't change materials or labor, don't ask it

### What Makes Good Material Checklists

1. **Use search terms that match 1Build/Lowe's/HD**
   - Test terms in the product search
   - Be specific: "200A panel" not "electrical panel"

2. **Include realistic default quantities**
   - Panel: 1 ea
   - Wire: 25 ft (measure at job)
   - Breakers: based on job scope

3. **Mark required vs optional**
   - Required = pre-checked in UI
   - Optional = user must check

---

*Document created: January 12, 2026*
