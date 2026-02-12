# QuoteCat Strategy Session - February 2, 2026

## Overview

Extended strategy session covering data strategy, market validation, X-Byte negotiations, and co-founder alignment.

---

## Key Decisions Made

1. **Target Market:** Kalamazoo (warmest connection), with Battle Creek and Lansing as expansion options
2. **Business Model:** Lifestyle business (~$150K/year target), not venture scale
3. **Data Strategy:** Negotiate with X-Byte for weekly updates instead of daily to reduce costs while expanding geographic coverage
4. **Validation Approach:** Get 10 paying customers to prove product-market fit

---

## Financial Context

- **Total funds:** $33K (includes living expenses)
- **Monthly living expenses:** ~$2K
- **Runway without data costs:** ~15.5 months
- **Runway with X-Byte ($800/mo):** ~10.5 months
- **Retirement (TSP):** $338K - DO NOT TOUCH

---

## X-Byte Data Situation

### Current State
- Paying ~$800/month for Lansing only (all 3 suppliers, daily updates)
- X-Byte can easily swap cities
- Menards stock issue is now FIXED (showing real In Stock/Out of Stock data)

### Negotiation Strategy
Requested pricing on weekly updates (instead of daily) to reduce record volume:

| Option | Cities | Suppliers | Frequency | Est. Records/Month |
|--------|--------|-----------|-----------|-------------------|
| A | Kalamazoo only | All 3 | Weekly | ~146K |
| B | Kalamazoo + Battle Creek | All 3 | Weekly | ~292K |
| C | All 3 cities | All 3 | Weekly | ~438K |

**Rationale:** Retail prices don't change daily. Home Depot absorbs commodity fluctuations before passing to customers. Weekly data is sufficient for contractor quoting.

**Target price:** $400-600/month during validation, moving to standard rates once we have paying customers.

### Email Sent to X-Byte

```
Subject: Restructuring Our Data Scope - Frequency & Coverage Options

Hi Shail,

Thanks again for working with us on the $800/month validation rate. We really appreciate X-Byte supporting us during this early stage, and we understand pricing moves to standard rates once we have paying customers.

As we finalize our data strategy, I've been researching how often retail prices actually change at Lowe's and Home Depot.

What I found: These retailers don't update shelf prices daily. Home Depot specifically absorbs commodity price fluctuations before passing them to customers, and both chains follow weekly promotional cycles. For our use case (contractor quoting), weekly data would fully meet our needs.

If we switch to weekly updates instead of daily, could we expand our geographic coverage while keeping costs low during validation?

I'd like pricing on these three options (all 3 suppliers, weekly updates):

| Option | Cities | Suppliers | Frequency |
|--------|--------|-----------|-----------|
| A | Kalamazoo only | All 3 | Weekly |
| B | Kalamazoo + Battle Creek | All 3 | Weekly |
| C | Kalamazoo, Battle Creek, Lansing | All 3 | Weekly |

For reference:
- Current: ~1.1M records/month (1 city, daily)
- Option A: ~146K records/month
- Option B: ~292K records/month
- Option C: ~438K records/month

Given the lower data volume, we're hoping to find validation pricing that works for both of us. Once we have paying customers and move to standard pricing, we'd look to increase frequency and coverage with you.

Let me know what's possible. Happy to jump on a call if easier.

Thanks,
Seph
```

---

## Market Analysis

### Why Kalamazoo Is Sufficient

| Factor | Details |
|--------|---------|
| Population | ~75,000 |
| Estimated contractors | 500-1,500 |
| Contractors needed to validate | 10 |
| Conversion rate needed | 0.7% - 2% |
| Warmest connection | Located in Kalamazoo |

### Michigan Market Context

- 71,000 - 157,000 licensed contractors statewide
- ~14,300 specialty trade contractor establishments
- Construction job growth: +5.3% year-over-year
- Industry outlook: Growing through 2027

### Target Markets

| City | Population | Lowe's | Home Depot | Menards | Warm Contacts |
|------|------------|--------|------------|---------|---------------|
| Kalamazoo | ~75K | ✅ | ✅ | ✅ | Warmest connection |
| Battle Creek | ~50K | ✅ | ❌ | ✅ | Drew |
| Lansing | ~115K | ✅ | ✅ | ✅ | None |

---

## Lifestyle Business Math

| Milestone | Customers | Monthly Revenue | Annual |
|-----------|-----------|-----------------|--------|
| Validation | 10 | $290 | $3,500 |
| Year 1 | 75-100 | $2,200-2,900 | $26-35K |
| Year 2 | 200-300 | $5,800-8,700 | $70-104K |
| Year 3 | 400-500 | $11,600-14,500 | $140-175K |

**Target:** Comfortable, not rich. 500 customers at $29/month = ~$175K/year.

---

## Drew (AI Assistant) Status

### Current Problems
- Architecture is wrong (agentic loop instead of state machine)
- Claude decides what to do next, causing unpredictable behavior
- Skips steps, asks same questions twice, bundles questions

### Solution Available
- State machine draft exists at `docs/state-machine-draft.ts`
- 3-5 days of work to implement
- Would fix ~70% of issues

### Decision
- Not required for launch
- Can validate QuoteCat without AI assistant
- Fix Drew after validating core product value

---

## Competitive Position

| Competitor | Pricing | Sweet Spot |
|------------|---------|------------|
| FieldPulse | Per-user, custom | Small-med |
| Jobber | Per-user (~$49+) | <50 techs |
| ServiceTitan | $200+/tech | 100+ techs |
| **QuoteCat** | $29/mo Pro, $79/mo Premium (5 techs) | 5-20 techs |

**Not trying to beat Jobber.** Targeting lifestyle business serving Michigan contractors.

---

## Key Insights

### On Market Size Concerns
"We're not trying to win Michigan right now. We're trying to find out if ONE contractor will pay $29/month for this app."

### On Data Strategy
"Don't spend money on data until a contractor tells you they need it."

### On Validation
"The question isn't 'Is Kalamazoo big enough?' The question is 'Will contractors pay $29/month for QuoteCat?'"

### On Starting Small
- Amazon started with books only
- Uber started in San Francisco only
- Validate first, expand later

---

## DIY Scraping Analysis (Decided Against)

### Why Considered
- Could save $600-700/month
- Extend runway by ~5 months

### Why Rejected
- 2-4 weeks to build + ongoing maintenance
- Distracts from validation/sales
- Anti-bot measures make it unreliable
- With $33K runway, time is better spent on customers

---

## Next Steps

1. ✅ Email sent to X-Byte with restructured options
2. ✅ Co-founder aligned on Kalamazoo strategy
3. ⏳ Wait for X-Byte response
4. 📋 Make list of 10 best contractor contacts in Kalamazoo
5. 📋 Draft simple outreach message
6. 📋 Start calling once data is sorted

---

## Co-Founder Alignment

**Key points communicated:**
- Kalamazoo is sufficient for validation (500+ contractors, we need 10)
- Lifestyle business goals (~$175K/year, not Jobber competitor)
- Start small, prove it works, then expand
- Every successful company started smaller than expected

**Outcome:** Wife/co-founder is on board with the plan.

---

## Important Reminders

1. **Don't touch retirement ($338K TSP)** - That's for the future, not for startup validation
2. **The app works** - QuoteCat is functional, just needs users
3. **Warm connections are the advantage** - Worth more than any ad budget
4. **Validation before optimization** - Get 10 paying customers, then worry about everything else

---

*Session ended with co-founder alignment achieved and X-Byte negotiation email sent.*

---

## February 5, 2026 - X-Byte Response & Publishing Plan

### X-Byte Update

**Option C confirmed at $675/month** (all 3 cities, weekly extraction)

Response sent to Shail:
- Switch to new scope immediately
- Request **Friday extractions** (all 3 retailers start new promo cycles Thursday, Friday captures freshest data)
- Apply $125 overpayment ($800 paid - $675 new rate) as credit, start clean billing March 1st
- Asked for turnaround time on new city configurations

### App Publishing Plan

| Priority | Task | Status |
|----------|------|--------|
| 1 | Submit iOS to App Store | Ready - EAS configured, Build #123 on TestFlight |
| 2 | Build Android APK for testing | Ready - all deps support Android, only 2 Platform.OS checks |
| 3 | Test Android on emulator/device | ~100 builds since last Android test |
| 4 | Fix Android-specific UI issues | TBD after testing |
| 5 | Google Play Store listing | After Android works |

### Key Finding: Android Readiness

Despite not testing Android since ~Build 20-30, the codebase is clean:
- EAS build profiles configured (APK for testing, app-bundle for Play Store)
- Package ID: `ai.quotecat.app`
- All dependencies have full Android support
- Hermes + New Architecture enabled
- Main risk: untested UI after 100 builds of iOS-focused development

### Pricing Research: Best Day for Weekly Data Extraction

All three retailers start new promotional cycles on **Thursday**:
- Home Depot: Regular ads Thu→Thu, Pro ads Mon→Mon
- Lowe's: Regular ads Thu→Wed
- Menards: Ads start Thursday, run 10-14 days

**Friday** is optimal - new prices propagated, data stays fresh through the full work week.
