# Comp Codes — Granting Free / Discounted Access

This is how you give a tester, partner, or appreciative user paid access without manually editing the database. Comp users redeem codes through the real payment platforms (Apple, Google, Stripe), the platforms tell us via webhook, and the user ends up with a normal `subscriptions` row — same as anyone who paid.

**Rule:** never manually `UPDATE profiles SET tier=...` or `INSERT INTO auth.users` to grant access. Those paths bypass the platforms and break things later (see the Drew incident, 2026-04-28).

---

## Why this approach

Apple, Google, and Stripe all support comp / promo codes natively:
- Apple **Offer Codes** — App Store
- Google Play **Promo Codes** — Play Store
- Stripe **Coupons** + **Promotion Codes** — applied at checkout

When a user redeems one, the underlying purchase fires the same webhook our paying users do — RC sends `INITIAL_PURCHASE` (with `event.store="APP_STORE"` etc.), or Stripe sends `checkout.session.completed`. Our webhook writes a real `subscriptions` row with `source='app_store' | 'play_store' | 'stripe'`. Manage Account works correctly because the user genuinely has a subscription on that platform.

No `promotional` source. No special-case database paths. One unified flow.

---

## Apple — Offer Codes (iOS)

**What it is:** A code a user enters in the App Store app to redeem a free or discounted subscription. They can use it once per Apple ID. Codes can grant any combination of months free, intro pricing, or pay-as-you-go.

**Where to create:**
1. https://appstoreconnect.apple.com → My Apps → QuoteCat → **Subscriptions**
2. Click into the subscription you want to comp (e.g., `ai.quotecat.app.premium.monthly`)
3. Scroll to **Subscription Offers** → **Offer Codes** → **Create Code**
4. Set: number of customers eligible, expiration date, offer details (e.g., "1 year free, then $79.99/mo")
5. Apple generates a one-time URL or code per customer, OR a custom code that you can share

**How user redeems:**
- Tap the URL on iOS → opens App Store, prompts to redeem
- Or open App Store → Account → "Redeem Gift Card or Code" → enter the code

**Effect on our system:**
- Apple processes the redemption
- RC fires `INITIAL_PURCHASE` webhook with `event.store="APP_STORE"`, `event.product_id="ai.quotecat.app.premium.monthly"`, `event.environment="PRODUCTION"`
- Our webhook writes `subscriptions` row with `source='app_store'`, `tier='premium'`, real `external_id`
- User's `profiles.tier` updates to `premium` automatically

**Limits:** offer codes have an expiration date but the resulting subscription renews normally. For "lifetime free" you'd issue a long-term offer (e.g., 5 years) and re-issue when it runs out — Apple does not natively support truly perpetual comps.

**Reference:** https://developer.apple.com/app-store/subscriptions/#offer-codes

---

## Google — Promo Codes (Android)

**What it is:** A code redeemed in the Play Store. Two types:
- **One-time** codes — single-use per Google account; grant a free trial or discount on a specific subscription
- **Vanity** codes — custom string, multi-use, configurable

**Where to create:**
1. https://play.google.com/console → All apps → QuoteCat → **Monetize** → **Promo codes**
2. Click **Create promo code**
3. Choose code type, configure (eligible products, redemption limit, expiry)
4. Google generates code(s); export as CSV to share

**How user redeems:**
- Open Play Store app → profile → Payments & subscriptions → Redeem code
- Or tap a Play Store URL with the code

**Effect on our system:**
- Same as Apple — RC fires `INITIAL_PURCHASE` with `event.store="PLAY_STORE"`, our webhook writes `subscriptions` row with `source='play_store'`

**Limits:** Google's promo codes have stricter rules — typically 1-time use, must apply to a specific product, and you can only generate ~500/quarter.

**Reference:** https://support.google.com/googleplay/android-developer/answer/6321495

---

## Stripe — Coupons + Promotion Codes (Marketing Site)

**What it is:** A discount applied at Stripe Checkout. Two parts:
- **Coupon** — the discount logic (e.g., "100% off forever", "first 3 months free")
- **Promotion code** — a customer-facing string that maps to a coupon (e.g., `LAUNCHPARTNER`, `FRIENDS50`)

**Where to create:**
1. https://dashboard.stripe.com/coupons → **+ New**
2. Configure:
   - Type: percent off (use 100% for free) or amount off
   - Duration: forever, once, or N months
   - Eligible products: restrict to specific subscription price IDs if you want
3. After creating the coupon, https://dashboard.stripe.com/promotion-codes → **+ New**
4. Attach to the coupon, set the customer-facing code string, set expiration / usage limits

**How user redeems:**
- On the marketing site checkout, the user pastes the code into Stripe Checkout's "Add promotion code" field
- The marketing site already supports this if Stripe Checkout is configured with `allow_promotion_codes: true` (verify in `supabase/functions/create-checkout/index.ts`)

**Effect on our system:**
- Stripe processes checkout with discount applied (could be $0)
- Stripe fires `checkout.session.completed` webhook
- Our `stripe-webhook` writes `subscriptions` row with `source='stripe'`, real `external_id`, real `stripe_customer_id`
- User's `profiles.tier` updates

**Best fit for:** lifetime / multi-year comps. Stripe coupons can be `forever` duration with 100% off, which makes them the cleanest path for permanent VIP access.

**Reference:** https://stripe.com/docs/billing/subscriptions/coupons

---

## Picking the right platform for a comp

| User context | Best platform |
|---|---|
| iOS-only user | Apple offer code |
| Android-only user | Google promo code |
| User is on web / wants flexibility / lifetime grant | Stripe coupon (most flexible duration) |
| Don't know what they'll use | Stripe coupon — works on the marketing site, doesn't require iOS/Android device |

When in doubt, default to a Stripe code — broadest reach, best for "lifetime free" semantics.

---

## What this replaces

This document replaces the previous `docs/VIP_USER_CREATION.md` (deleted), which described how to manually `INSERT INTO auth.users` for VIP grants. That approach caused real problems (Drew's row had NULL columns that broke admin auth across all users on 2026-04-28). Don't bring it back.

If a comp code is genuinely the wrong fit for a use case, raise it as a discussion before reaching for raw SQL.
