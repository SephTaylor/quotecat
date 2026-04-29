# Entitlement Audit — RevenueCat / Stripe / IAP

**Status:** ✅ Complete
**Owner:** Seph
**Last verified:** 2026-04-28

This is the **canonical source-of-truth** for which products grant which entitlements across all three payment surfaces (App Store, Play Store, Stripe). The webhook code (`supabase/functions/revenuecat-webhook/index.ts`, `supabase/functions/stripe-webhook/index.ts`) is built against this doc — `PRODUCT_TIER_MAP` constants in code must match the IDs here byte-for-byte.

If you change any product or price ID in any store, update this doc and the matching code constant in the same change.

---

## Where to log in

| What | URL | What to look at |
|---|---|---|
| **RevenueCat dashboard** | https://app.revenuecat.com | Entitlements, Products, Offerings, Customers — the main thing you're auditing |
| **App Store Connect** | https://appstoreconnect.apple.com | My Apps → QuoteCat → Subscriptions. Confirms the four iOS product IDs are real and active in production. |
| **Google Play Console** | https://play.google.com/console | All apps → QuoteCat → Monetize → Products → Subscriptions. Source of the Android SKU strings to fill into the table below. |
| **Stripe Dashboard** | https://dashboard.stripe.com/products | Confirms each Stripe price ID is real and currently active. Use the search bar with the full `price_…` string. |
| **Stripe Customers (for Wyatt question)** | https://dashboard.stripe.com/customers | Search `wyattstephan@stephanelectric.com`. Open his record → Subscriptions tab → if invoices show $0 paid or a 100% coupon was applied, he was comped; if real charges, he was charged. |
| **Supabase dashboard** | https://supabase.com/dashboard/project/eouikzjzsartaabvlbee | Only needed if Claude asks for a SQL query result; otherwise you don't need to touch this during the audit. |

---

## Why this doc exists

The entitlement layer was originally built when QuoteCat was Stripe-only. IAP was bolted on later. Across three payment surfaces, products and entitlements drifted (e.g. "click Pro Monthly, get Premium" — RC dashboard had a Pro product silently granting the `premium` entitlement). This doc enforces a clean two-entitlement model and makes drift detectable.

---

## Intended state

### Entitlements

Exactly two entitlements exist:

- `pro`
- `premium`

Any other entitlement (e.g. `founder_pro`, `lifetime_premium`, `legacy_premium`) should be deleted or archived in RevenueCat.

### Tier ranking

`free` < `pro` < `premium`. Code that needs to compare tiers uses this ordering.

---

## Product → Entitlement mapping

Each row is one product. **Every product grants exactly one entitlement, never two.** Use full IDs — do not truncate.

### iOS (App Store)

| Product ID | Should grant | Verified in RC? | Fixed if wrong? |
|---|---|---|---|
| `ai.quotecat.app.pro.monthly` | `pro` | ✅ | n/a |
| `ai.quotecat.app.pro.yearly` | `pro` | ✅ | n/a |
| `ai.quotecat.app.premium.monthly` | `premium` | ✅ | n/a |
| `ai.quotecat.app.premium.yearly` | `premium` | ✅ | n/a |

**Source of truth:** `QuoteCatProducts.storekit` in this repo.
**Verify production matches:** [App Store Connect](https://appstoreconnect.apple.com) → My Apps → QuoteCat → Subscriptions. The four product IDs above should appear in the subscription group.
**RC mapping lives at:** [RevenueCat](https://app.revenuecat.com) → Project → Products → filter by App Store.

### Android (Play Store)

Fill in actual SKU strings from [Play Console](https://play.google.com/console) → All apps → QuoteCat → Monetize → Products → Subscriptions. Each subscription has a "Product ID" / "Base plan ID" — that's the full SKU string we want.

Format: `<product_id>:<base_plan_id>`. Google Play webhook events identify by the product_id portion; RC's UI shows the full colon-form.

| Product / SKU (full) | Product ID | Base plan ID | Should grant | Verified in RC? | Fixed if wrong? |
|---|---|---|---|---|---|
| `ai.quotecat.app.pro.monthly:pro-monthly-base` | `ai.quotecat.app.pro.monthly` | `pro-monthly-base` | `pro` | ✅ | n/a |
| `ai.quotecat.app.pro.yearly:pro-yearly-base` | `ai.quotecat.app.pro.yearly` | `pro-yearly-base` | `pro` | ✅ | n/a |
| `ai.quotecat.app.premium.monthly:premium-monthly-base` | `ai.quotecat.app.premium.monthly` | `premium-monthly-base` | `premium` | ✅ | n/a |
| `ai.quotecat.app.premium.yearly:premium-yearly-base` | `ai.quotecat.app.premium.yearly` | `premium-yearly-base` | `premium` | ✅ | n/a |

**Orphan to archive during cleanup step 3:** "Test Store" → `Yearly` / `yearly` product (`prodcd9702cd19`, created Feb 27, 2026). Confirmed: no entitlements, no offerings, no transactions. Pure leftover from initial RC SDK integration. Safe to archive (and the parent "Test Store" app entry too if RC allows).

**RC mapping lives at:** [RevenueCat](https://app.revenuecat.com) → Project → Products → filter by Play Store.

### Stripe

**Audit-time finding (2026-04-28):** RevenueCat has **no Stripe products configured** — only App Store and Play Store. Marketing-site Stripe purchases bypass RevenueCat entirely and go directly to our `stripe-webhook` Edge Function, which writes `profiles.tier` based on a `PRICE_TO_TIER` map inside that function.

This means the "Verified in RC?" column doesn't apply to Stripe rows. Instead, the table below is the canonical reference for what `stripe-webhook`'s `PRICE_TO_TIER` constant must contain. The implementation PR will rewrite that map to match this table exactly.

**Verify each price ID is real and active:** [Stripe Products dashboard](https://dashboard.stripe.com/products) → click into a product → look at the prices listed. Or paste the full `price_…` ID into Stripe's search bar. (Optional pre-PR sanity check; the PR will also fix any drift.)

| Price ID (full string) | Stripe nickname | Should grant | Active in Stripe? | Fixed in code? |
|---|---|---|---|---|
| `price_1T1uXbCz2LFZfwAIva1Pfr7y` | Founder Pro Monthly ($29/mo) | `pro` | ✅ | pending PR |
| `price_1T1uYyCz2LFZfwAIPyDQTA28` | Founder Pro Yearly ($290/yr) | `pro` | ✅ | pending PR |
| `price_1T1uYzCz2LFZfwAIgnNYeAi4` | Founder Premium Monthly ($79/mo) | `premium` | ✅ | pending PR |
| `price_1T1uYzCz2LFZfwAIWloEKf1W` | Founder Premium Yearly ($790/yr) | `premium` | ✅ | pending PR |
| `price_1T1uZ0Cz2LFZfwAI552310fx` | Pro Monthly regular ($39/mo) | `pro` | ✅ | pending PR |
| `price_1T1uZ0Cz2LFZfwAInEPGan4F` | Pro Yearly regular ($372/yr) | `pro` | ✅ | pending PR |
| `price_1T1uZ1Cz2LFZfwAIQ94BNZ02` | Premium Monthly regular ($99/mo) | `premium` | ✅ | pending PR |
| `price_1T1uZ1Cz2LFZfwAIuqAtNru0` | Premium Yearly regular ($948/yr) | `premium` | ✅ | pending PR |

All 8 verified active via Stripe API on 2026-04-28. Nicknames + amounts match the table exactly.

Source: `supabase/functions/create-checkout/index.ts` and `website/index.html`.

### Stripe (one-time purchases — NOT subscriptions, do not map to entitlements)

| Price ID | Description |
|---|---|
| `price_1TAbNKCz2LFZfwAIUmDthbeb` | Pricing Guide $29 (one-time) |

These should not appear in any entitlement mapping. Listed here so future-you doesn't accidentally try to map them.

---

## Audit checklist (work top to bottom)

### 1. Entitlements list is exactly two

- [x] Open [RevenueCat → Project → Entitlements](https://app.revenuecat.com)
- [x] Confirm `pro` exists (linked to 4 products)
- [x] Confirm `premium` exists (linked to 4 products)
- [x] **Delete or archive every other entitlement** — none existed; only `pro` and `premium` present (verified 2026-04-28)

Removed entitlements:
- _(none, or list)_

### 2. Each product in the tables above is mapped to exactly the right entitlement

In [RevenueCat → Project → Products](https://app.revenuecat.com), for every row in the three tables above:
- Click into the product
- Look at "Attached entitlements" (or similar — RC's UI shows which entitlements this product grants)
- Mark the "Verified in RC?" column ✅ if it matches the intended state, ❌ if not
- If ❌, fix it in RC (remove wrong entitlement, attach the right one) and mark "Fixed?" ✅
- If a product in the tables doesn't exist in RC, that's a separate problem — note it in the "Notes" section at the bottom

### 3. Archive orphan products / offerings

- [x] In [RevenueCat → Products](https://app.revenuecat.com), list every Product that is NOT in the tables above
- [x] Archive or delete each one

Removed products:
- "Test Store" → `Yearly` / `yearly` (`prodcd9702cd19`) — leftover from initial RC SDK integration; had no entitlements, no offerings, no transactions. Archived 2026-04-28.

### 4. Check RC offerings (the bundles shown to the app)

- [x] Open [RevenueCat → Offerings](https://app.revenuecat.com)
- [x] Confirm the offering(s) the app fetches contain only products from the tables above
- [x] Offering in use: `default` ("QuoteCat Subscriptions"), 4 packages, marked as default. Math: 4 packages × 2 platforms (iOS + Android) = 8 products. ✅

### 5. Smoke test — sandbox purchase

- [ ] _Deferred_ — static verification of every product → entitlement mapping in step 2 provided equivalent signal (each product showed exactly the right single entitlement attached). The defensive `ENTITLEMENT_DRIFT` logging in the new webhook (implementation PR) will catch any future divergence between product_id and entitlement_id at runtime, which is a stronger guarantee than a one-time sandbox test. Run a sandbox purchase later if you want belt-and-suspenders confirmation, but it is not gating the implementation PR.

### 6. Sign-off

- [x] All eight rows in iOS + Android tables show ✅ Verified
- [x] All eight rows in Stripe table show ✅ Active
- [x] Sandbox test — deferred (rationale in step 5)
- [x] No orphan entitlements or products remain
- [x] Date verified: **2026-04-28**

**Audit complete.** Proceeding to implementation PR per approved plan.

Once all boxes are checked, tell Claude: **"Entitlement audit complete."** Then Claude proceeds to write migration + webhook + edge function + mobile client changes against this verified state.

---

## Pre-launch user cleanup decisions (2026-04-29)

Of the 8 testers in `profiles` with `tier='pro'` or `'premium'` at audit time, none had real Stripe revenue (verified — live Stripe Customers shows only one $0-spend record). Decision: drop the 6 non-real paid accounts to `tier='free'` and clear stale Stripe IDs. Backfill subscription rows only for the 2 real IAP accounts.

| Account | Action | Why |
|---|---|---|
| `jobhato@gmail.com` | Backfill `source='play_store'` (or `app_store` — confirm before running) | Real IAP, dev's primary test device |
| `jobhato@icloud.com` | Backfill once platform is confirmed | Real IAP, dev's secondary device |
| `seph.taylor@outlook.com` | `tier='free'`, clear Stripe IDs | Dev's work email; Stripe history was test-mode only |
| `joseph@quotecat.ai` | `tier='free'`, clear Stripe IDs | Dev's email under different name; only $0-spend Stripe record exists |
| `pro@quotecat.ai` | `tier='free'`, clear Stripe IDs | Test account |
| `premium@quotecat.ai` | `tier='free'`, clear Stripe IDs | Test account |
| `foxrider12@icloud.com` (Drew) | **Leave at `tier='premium'`** | Manual VIP grant kept; Manage Account returns "no active subscription" (acceptable). Future re-grants would go through comp code flow. |
| `wyattstephan@stephanelectric.com` (Wyatt) | **Leave at `tier='premium'`** | Same — manual VIP grant kept. |

After cleanup:
- Database honestly reflects "2 real IAP users + 20 free." No phantom paid accounts.
- Drew, Wyatt, and any future VIP get access via the comp-code workflow documented in `docs/COMP_CODES.md`.
- The Manage Account button no longer shows "no active subscription" errors because the only paid users have real subscription rows.

Still needed before running cleanup + backfill:
- [ ] Confirm `jobhato@gmail.com` platform (likely `play_store` per build 39 — confirm)
- [ ] Confirm `jobhato@icloud.com` platform — check on device or in [RC → Customers](https://app.revenuecat.com)

---

## Notes / surprises found during audit (2026-04-28)

1. **iOS + Android RC config was already clean.** Every product mapped to exactly one correct entitlement, no `pro+premium` double-grants. The historical Pro→Premium symptom was either a one-time misconfiguration that had already been quietly fixed, or the user actually tapped Premium at purchase. Either way, current state is good and the new webhook's `ENTITLEMENT_DRIFT` logging will catch any future regression.

2. **Test Store leftover archived.** `prodcd9702cd19` ("Yearly") had been sitting unattached since RC SDK integration in Feb 2026.

3. **RevenueCat does not have any Stripe products configured.** Marketing-site Stripe purchases bypass RC entirely. This means the Stripe → tier mapping is purely a code concern, owned by `stripe-webhook`'s `PRICE_TO_TIER` constant. The implementation PR will rewrite that constant to match this doc.

4. **Old/orphan Stripe secret keys exist.** Two `sk_live_…` keys were active in the Stripe dashboard. The Nov 10, 2025 key (`…NZXG`) hadn't been used since Jan 17 — recommend deleting as a cleanup task.

5. **Stripe live secret key was rotated during this audit.** Old key (digest `62b50c2e…e9f1`) replaced with a new one in Supabase Edge Function secrets. Verified `create-checkout` works with the new key. The new secret was pasted into the chat transcript during this work — recommend rolling it again as a follow-up cleanup, since chat transcripts can be persisted.

6. **Four extra Stripe-related Supabase secrets exist** that we didn't audit: `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_YEARLY_PRICE_ID`, `STRIPE_PREMIUM_MONTHLY_PRICE_ID`, `STRIPE_PREMIUM_YEARLY_PRICE_ID`. None are referenced in the current `supabase/functions/` code (which uses hardcoded constants), so they appear to be dead config. Recommend listing in `FOLLOWUPS.md` for verification + cleanup.

