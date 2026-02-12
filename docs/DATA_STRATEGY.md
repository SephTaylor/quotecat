# QuoteCat Data Strategy

**Last Updated:** January 27, 2026

## Executive Summary

Launch with **Lowe's only** across three target markets (Kalamazoo, Battle Creek, Lansing) to minimize cost while validating product-market fit. Expand to Home Depot and Menards after validation.

---

## Target Markets

| Market | Population | Lowe's | Home Depot | Menards |
|--------|------------|--------|------------|---------|
| Kalamazoo | ~75K | ✅ | ✅ | ✅ |
| Battle Creek | ~50K | ✅ | ❌ | ✅ |
| Lansing | ~115K | ✅ | ✅ | ✅ |

**Warm connections:** Drew (Battle Creek), plus contacts in Kalamazoo and Lansing.

---

## Current Situation

- **Users:** 0
- **Runway:** Limited
- **Data vendor:** X-Byte Enterprise Crawling
- **Menards status:** Broken (100% of products showing "Not_Available")

---

## Pricing Options (X-Byte)

| Scope | Records/Month | Cost/Month | Notes |
|-------|---------------|------------|-------|
| All 3 suppliers, all markets | 2,700,000 | $1,650 | Includes broken Menards data |
| Previous scope | 900,000 | $800 | Unclear supplier mix |
| **Lowe's only (proposed)** | ~600,000? | ~$400-600? | Needs quote from X-Byte |

---

## Recommended Strategy: Lowe's Only

### Phase 1: Validation (Now)

**Suppliers:** Lowe's only
**Markets:** Kalamazoo, Battle Creek, Lansing
**Goal:** Validate that contractors will use the app

**Why Lowe's only:**
1. Present in all 3 target markets
2. Reliable data (no stock issues)
3. Lowest cost - preserves runway
4. Enough to validate core product value
5. Not paying for broken Menards data

**Success criteria:**
- Drew uses QuoteCat on a real job
- Get feedback on what's missing vs. what's valuable
- Learn if pricing data matters or if quoting speed is the real value

### Phase 2: Expansion (After Validation)

**Trigger:** At least 5 active users OR paying customers

**Add Home Depot:**
- Covers Kalamazoo and Lansing (not Battle Creek)
- Two major national brands feels "complete" for marketing

**Add Menards:**
- Only after X-Byte fixes the stock data issue
- Or if user feedback strongly requests it

---

## Contractor Shopping Patterns

Based on Drew (Battle Creek):
- **Lumber:** Lowe's
- **Hardware:** Menards
- **Preferred:** Home Depot (but none in Battle Creek)

**Insight:** Contractors use different suppliers for different categories. Lowe's covers the highest-volume category (lumber) for initial validation.

---

## What To Tell X-Byte

> "Thanks for the updated pricing. Given that we're in validation phase with zero users, we'd like to start with a smaller scope. Can you quote us on **Lowe's data only** for these 3 Michigan markets: Kalamazoo, Battle Creek, and Lansing? We'll expand to Home Depot and Menards once we've validated product-market fit."

---

## Key Principles

1. **Bad data is worse than no data** - Don't include Menards until stock issue is fixed
2. **Validate before scaling** - One supplier is enough to learn if the product works
3. **Preserve runway** - Don't pay $1,650/month to test a hypothesis
4. **Launch focused, expand later** - Amazon started with books, Uber started with black cars in SF

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Contractors need Menards for hardware | Drew can manually check Menards; app still provides value for lumber quotes |
| "Incomplete" perception in marketing | Position as "Lowe's pricing for Michigan contractors" - honest and focused |
| X-Byte won't offer single-supplier pricing | Negotiate; worst case, pay for smallest viable package |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-27 | Start with Lowe's only | Zero users, limited runway, Menards data broken |
| 2026-01-27 | Defer Menards | 100% "Not_Available" status is unusable |
| 2026-01-27 | Target 3 Michigan markets | Warm connections in Kalamazoo, Battle Creek, Lansing |

---

## Next Steps

1. [ ] Request Lowe's-only quote from X-Byte
2. [ ] Get Drew using the app on a real job
3. [ ] Collect feedback on what's missing vs. valuable
4. [ ] Revisit strategy after 5 active users
