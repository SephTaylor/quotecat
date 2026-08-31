# FOLLOWUPS

> **⚠️ For the scannable "what's left" index, see [`BACKLOG.md`](./BACKLOG.md) at the repo root.** That file consolidates everything across FOLLOWUPS, CLAUDE.md, the codebase audit, plan docs, and conversation context into one navigable list.
>
> **This file** keeps the detailed design context for items that need depth (Stripe webhook fix, Industry Mode + i18n, Sentry source maps procedure, etc.). BACKLOG.md links here when an item needs the full backstory.

---

Tracked follow-ups deliberately deferred from the subscription/Manage Account refactor PR. Each one is small enough to do later, but big enough to deserve being tracked rather than living in chat history.

Update this file when work is completed (move to "Done" section) or when new follow-ups are identified.

---

## 🚨 Highest-leverage still-open item (verified 2026-07-04)

**The Portal Stripe webhook fix (below) has been sitting for two months while card payments went live in v1.2.9.** Verified 2026-07-04: `PRICE_TO_TIER` in `quotecat-portal/src/app/api/stripe/webhook/route.ts:17-41` still contains the ten stale `price_1SRYud...` / `price_1Sqdi...` IDs from the 2026-04-29 audit; no calls to `upsert_subscription_event` RPC; no calls to `inviteUserByEmail`; still writes directly to `profiles`.

As soon as the marketing site drives real subscription traffic, Premium buyers will silently get downgraded to Pro and new customers will get zero invite email. Pull this into a near-term sprint — arguably the single highest-priority still-open item across FOLLOWUPS and BACKLOG.

---

## Open

### 🟡 Strategically deferred: xByte supplier-pricing catalog sync

**Status:** Indefinitely deferred as of 2026-05-22. Not "TBD next quarter" — a deliberate strategic choice to not invest more here.

**Why deferred:**
The xByte integration was a "data comprehensiveness" play — the bet was that real Lowe's / Home Depot / Menards pricing would be a moat. Reality: it's a 4th-level convenience feature, not a reason people pay $29-79/month. The actual moat (clarified during the launch-prep work) is the **financial intelligence layer** — overhead-loaded labor rates, target margin enforcement, "are you actually making money on this?" feedback. That moat works without automated supplier sync. Manual price entry + custom pricebook is enough for most contractors.

**What stays usable:**
- The xByte feature flag (`CATALOG_SYNC_ENABLED = false` in `modules/catalog/productService.ts`) remains as the kill switch
- The edge functions (`sync-xbyte`, `ingest-prices`) and the `INGEST_API_KEY` auth pattern remain in place — minor maintenance only
- The catalog table + product schema stay (used by manual pricebook entries today)
- Re-enabling later is still possible if trades scale demands automated sync

**When to revisit:**
- If we hit ~500 paying trades users who collectively express that manual price entry is their #1 pain point
- Or if a partnership/aggregator deal makes the cost meaningfully lower
- Or if a competitor differentiates on real-time pricing and starts taking trades market share specifically because of it

Until any of those happen, this stays off. Effort previously earmarked for xByte goes to financial-intelligence features (Pricing Foundation Setup, AI Business Performance Coach) instead.

### 🟢 Planned: Industry Mode (Trades vs Services) + Spanish i18n — combined feature

**Status:** Validated by real-world signal (2026-05-22). Committed to build. Sequencing: after xByte catalog re-enablement so the materials tab gating ships in the same pass. **Spanish i18n is part of this work**, not a separate effort — the string-sweep is identical, and doing them together avoids a second sweep later.

**Why:**
The app's data model is already industry-agnostic (quotes, line items, tier pricing, assemblies, clients, invoicing, e-sign, portal). What makes it "feel like" a construction app is surface-level — terminology, default seed catalog, and a handful of trades-specific tabs. A real signal landed when Joseph's lawyer expressed interest in using QuoteCat for legal-services estimates; he'd already conceptualized using assemblies as a "menu of standard service packages." The data model fits other markets cleanly; only the labels and visible surface need to shift.

The deeper rationale (see CLAUDE.md Vision section, updated 2026-05-22): the product's actual moat is the **financial intelligence layer** — margin awareness, overhead-loaded labor rates, "are you actually making money on this?" feedback. That's industry-agnostic by design. Any service business that sells time + expertise needs the same answer. Trades was the launch market because that's where the founder had domain expertise, not because the underlying value prop is trades-specific.

Professional services (legal, consulting, agencies, accountants) is also a less-crowded market than trades — potentially higher LTV per customer, fewer entrenched competitors. Industry mode is the engineering work; the financial intelligence the customer actually pays for is already there.

**Scope (one feature, three layers):**

1. **Terminology + i18n layer.** Use a real i18n library (`react-i18next` + `expo-localization`). Each translation file structured as `{ trades: { ... }, services: { ... } }` so industry mode and locale share the same keyed lookup. Sweep every hardcoded string throughout the app once, replace with `t('key.path', { context: industry })`. Both English (en) and Spanish (es) translation tables ship at launch.

   Example terminology mappings (English):
   - `t('job')` — trades: "Job" / services: "Engagement" or "Matter"
   - `t('labor')` — trades: "Labor" / services: "Billable Hours"
   - `t('assembly')` — trades: "Assembly" / services: "Service Package"
   - `t('workers')` — trades: "Workers" / services: "Associates" or "Team"
   - `t('materials')` — trades: "Materials" / services: hidden (see layer 2)

   Same keys exist in `es.json` with translations for each industry context.

2. **Feature visibility layer.** Same `profiles.industry` setting drives both terminology and conditional rendering. Services users don't see trades-only tabs at all:
   - **Trades-only (hidden for Services):** Materials catalog tab (xByte), tradecraft content / Drew when re-enabled (built on construction knowledge), job-site address fields, supplier preferences (Home Depot / Lowes / Menards), worker-license fields.
   - **Universal (always shown, optionally relabeled):** quote creation, tier pricing, assemblies / service packages, clients, invoicing, e-sign, portal, cloud sync, PDF export.

3. **Industry-specific seed data.** When a new user picks an industry at onboarding, seed their pricebook + sample assemblies with that vertical's defaults (trades: construction categories; services: consultation / document prep / representation / travel / etc.). Existing users default to trades; setting can be changed in Settings. Seed labels also localized per active locale.

**DB change:** add `profiles.industry` enum (`trades | services | other`). Optional: also `profiles.locale` if user wants to override device default.

**App change:** two pieces in onboarding — "What kind of business?" (industry, three buttons) and optional locale picker (defaults to device language via `expo-localization`). Both persist immediately. All downstream UI reads from the settings.

**Marketing copy:** intentionally NOT in scope for v1. Site stays trades-positioned and English-only. Re-position + translate site only after Services or Spanish-speaking customers actually accumulate (target ~20 paying users in each segment before any positioning shift). One product, multiple surfaces — same pattern other vertical SaaS uses.

**Strategic value of the combined effort:**
- Industry mode + Spanish unlocks US Hispanic legal/consulting/agency market (Services + es).
- Trades + Spanish unlocks ~30% of US construction workforce currently underserved by English-only tools.
- Trades + Spanish also unlocks Costa Rica trades market.
- Each new locale added later is just translation work — no engineering.

**Validation step before code (1-week experiment):**
Let Joseph's lawyer use the app as-is for a real client engagement. Capture concrete friction:
- Which labels did he have to mentally translate?
- Which seed categories did he wish were different?
- Did anything in the flow break for non-construction work?
- Did the PDF export look professional for legal use, or scream "construction"?

Use that friction list to ground the v1 terminology choices instead of guessing what lawyers want.

**Estimated effort (combined industry mode + Spanish i18n):**
- i18n library setup + config (`react-i18next`, `expo-localization`): 2-3 hours
- String sweep across the app (replace hardcoded strings with `t()` calls): 5-7 hours
- English translation tables, both industry contexts: 2-3 hours
- Spanish translation tables, both industry contexts: 3-4 hours (initial pass; refine with native speaker review)
- Industry-specific seed data per vertical × per locale: 2-3 hours per combination
- Feature-visibility gating + tab conditionals: 2-3 hours
- Onboarding question (industry + locale): 1 hour
- DB migration + profiles columns: 30 minutes
- Testing on real device for industry × locale combinations: 3-4 hours
- Native-speaker Spanish review pass: 1-2 hours (outsource or friend-of-the-family)
- **Total: ~2-2.5 weeks of focused work**

For comparison: doing them sequentially would be ~1.5 weeks (industry) + ~1 week (i18n) = ~2.5 weeks, with the cost of touching every string twice. Combined saves ~0.5 week and avoids the rework.

**Sequencing constraint:** ship this in the same release as xByte catalog re-enablement (currently behind `CATALOG_SYNC_ENABLED = false`). Reason: the materials tab hiding logic is the most prominent feature-visibility delta, and it doesn't really matter until the materials feature is actually on. Doing both at once means one release, one validation pass.

**Bigger strategic question to revisit later:**
If Services becomes a meaningful segment (>20% of paying users, or higher LTV/CAC than trades), decide whether to split QuoteCat into two product lines or keep unified. Premature now; defer that decision until there's data.

### 🔴 Sentry source maps upload — HIGH PRIORITY, within first week post-launch

**Verified still open 2026-07-04.** `app.json` still has the bare `"@sentry/react-native/expo"` plugin string — no `{ url, organization, project }` config. Every prod crash is still landing as minified gibberish.

**Priority:** Within first week post-launch. Not gating tonight's build.

**Discovered:** 2026-05-07 while wiring Sentry for launch.

**What's missing:** Sentry crash reporting is now wired (commit pending), but source maps aren't being uploaded during EAS builds. Every crash that lands in Sentry will reference minified JavaScript code instead of original source. Triaging real production bugs becomes 10× harder until this is fixed.

**Fix:**
1. Generate a Sentry auth token at https://sentry.io/settings/account/api/auth-tokens/ with `project:releases` and `org:read` scopes
2. Add to EAS prod environment: `SENTRY_AUTH_TOKEN=<value>` (visibility: Sensitive, NOT Plain text)
3. Look up the org slug and project slug in Sentry dashboard URLs
4. Update `app.json` plugin config from bare `"@sentry/react-native/expo"` to `["@sentry/react-native/expo", { "url": "https://sentry.io/", "organization": "<org-slug>", "project": "<project-slug>" }]`
5. Build new versions on iOS + Android — source maps upload automatically during the build

Estimated time: ~15 minutes of work, then one build cycle for the upload to take effect.

### 🔴 Portal Stripe webhook handler is broken for marketing-site subscriptions

**Verified still open 2026-07-04.** Two months since discovery. Recent portal webhook work (`531fc7c`, `575f8e2`, `ffcaa78`, `032ff78`) was for **Stripe Connect** (contractor merchant accounts for card payments), a completely different endpoint. The marketing-site `/api/stripe/webhook/route.ts` still has the ten stale `price_1SRYud...` / `price_1Sqdi...` IDs, still writes directly to `profiles`, still has no `upsert_subscription_event` call, still has no `inviteUserByEmail` call. See the "🚨 Highest-leverage" note at the top.

**Priority:** Pre-HGTV / before any real marketing-site Stripe traffic. NOT blocking IAP launch.

---

#### 🔎 SKILL-ASSISTED REVIEW 2026-08-30 — the stale price IDs are not the only problem

Ran the Stripe plugin's `stripe:stripe-best-practices` Skill against
`src/app/api/stripe/webhook/route.ts`. It returned **12 findings**. The three most severe
were **spot-checked against the source and all three confirmed** — see the verification
note at the bottom.

**⚠️ The remaining nine are UNVERIFIED agent output.** Treat them as leads, not facts.
This project has history here: `MOBILE_PORTAL_AUDIT.md` records 9 of 27 findings from an
earlier agent audit being outright misreads. Verify before acting.

**CONFIRMED (checked against source 2026-08-30):**

1. **Every failure path returns HTTP 200, so Stripe never retries.** Line 128 returns
   `{received: true}` unconditionally after the switch; every handler failure is a
   `console.error` plus a bare `return`. A transient Supabase error while writing a
   subscription means the customer is charged and has no entitlement, permanently. No
   dead-letter table, no reconciliation job. Inconsistent too:
   `stripe.subscriptions.retrieve` throws and produces a proper 500 with retry, while a
   DB error does not. **Transient failures should return 5xx — Stripe retries with
   backoff for up to 3 days.**

2. **The idempotency key collides across genuinely different events.** Line 267:
   `p_event_id: \`sub_upd_${subscription.id}_${subscription.status}\``. Status is
   unchanged across most updates, so every active→active transition shares one key and
   the RPC returns `skipped_duplicate`. Concretely: a user upgrades Pro→Premium, the key
   matches an earlier update, the write is skipped, and they pay for Premium while
   staying on Pro. **`event.id` is the correct key** and is globally unique per delivery,
   but `event` is never passed into the handlers.

3. **`Date.now()` disables the RPC's out-of-order protection.** Lines 268 and 336. The
   RPC has a `skipped_out_of_order` branch that only works if the timestamp comes from
   Stripe (`event.created * 1000`). Worse, the handlers disagree — line 192 uses
   `subscription.start_date`, lines 268 and 336 use wall clock. A delayed redelivery of
   an old event always looks newer than current state and can re-activate a cancelled
   subscription.

**UNVERIFIED — plausible, needs checking before anyone acts:**

4. Entitlement granted before payment settles — `session.payment_status` is never
   checked and line 183 hardcodes `p_status: 'active'`. No
   `checkout.session.async_payment_succeeded` handler exists.
5. `mapStripeStatus` maps `past_due`, `unpaid`, and `incomplete` all to `'active'`, and
   defaults to `'active'` for unknown statuses. No `invoice.payment_failed` handler.
6. Cancellation fails **open** on an unknown price ID — user keeps the paid tier forever.
   A cancel does not need the price at all.
7. Seat price IDs may belong to a different Stripe account — `PRICE_TO_TIER` entries
   share the infix `Cz2LFZfwAI` while `PRICE_TO_SEATS` entries share `EJ6nOeXQIm`.
   Testable with `stripe prices retrieve price_1Sqdi4EJ6nOeXQImH8Yp6Ls9`.
8. Seat purchase is not idempotent and read-modify-writes the whole `preferences` blob.
9. Seat removal never clears `seat_subscriptions` and looks the user up by a different
   key than the purchase used.
10. Supabase errors are discarded — only `data` is destructured, so a transient error is
    indistinguishable from "user not found."
11. `item.current_period_end` reads the raw webhook payload, whose API version is set by
    the Dashboard endpoint config, not by the SDK constructor. If that endpoint is
    pre-Basil this throws a `RangeError` on every subscription update.
12. All work, including an outbound Resend call, happens before the ACK.

**Verification method, for the record:** three claims checked by reading the cited lines
directly. All held, including the subtle one — line 192 really does use Stripe's
timestamp while 268 and 336 use wall clock, so the handlers are genuinely inconsistent.

**Why the hit rate was better than the 2026-06 audit:** that one asked "do these two
codebases behave the same," which requires holding two systems in mind and inferring from
both — and that is where it hallucinated. This one asked "what is wrong with this one
file," and every claim cited a line the agent had actually read. **Claims about what a
single file does are more reliable than claims about how two systems differ.**

**Discovered:** 2026-04-29 during post-IAP-fix Stripe webhook config verification. No production impact yet because zero real Stripe customers have flowed through the marketing site (audit confirmed live Stripe Customers tab has only one $0-spend record).

**Repo affected:** `quotecat-portal` (separate repo, separate Vercel deploy from the QuoteCat app)

**File:** `quotecat-portal/src/app/api/stripe/webhook/route.ts`

#### Root cause

The portal handler maintains its own `PRICE_TO_TIER` map (lines 16-40 in current production). All 10 price IDs in that map were verified missing in Stripe via API on 2026-04-29:

```
❌ price_1SRYudEJ6nOeXQImORnpOn57   (was: Founder Pro Monthly $29)
❌ price_1Sqdi0EJ6nOeXQImgNqqgXe3   (was: Founder Pro Yearly)
❌ price_1SRYzJEJ6nOeXQImUR9ZE9dg   (was: Founder Premium Monthly)
❌ price_1Sqdi1EJ6nOeXQImyT9xgVwB   (was: Founder Premium Yearly)
❌ price_1Sqdi1EJ6nOeXQImkAgDKGax   (was: Pro Monthly)
❌ price_1Sqdi2EJ6nOeXQImK5BZmdv9   (was: Pro Yearly)
❌ price_1Sqdi2EJ6nOeXQImXnZGM8ff   (was: Premium Monthly)
❌ price_1Sqdi2EJ6nOeXQImpve8MWHO   (was: Premium Yearly)
❌ price_1SRYxvEJ6nOeXQImgcguc1Tb   (legacy)
❌ price_1SRYzpEJ6nOeXQImLJcob9DI   (legacy)
```

Live price IDs are in `docs/ENTITLEMENT_AUDIT.md` (the `price_1T1u...` IDs) and in the QuoteCat app repo at `supabase/functions/_shared/product_tier_map.ts` and `supabase/functions/create-checkout/index.ts:52-66`.

#### Symptom

The portal is the sole configured Stripe webhook endpoint. When a real marketing-site subscription purchase fires `checkout.session.completed`, the portal's handler:

1. Receives the event with `priceId = 'price_1T1u...'` (live, real)
2. Looks up `PRICE_TO_TIER[priceId]` → key not found → defaults to `|| 'pro'` (line 157 of the route file)
3. Sets `profiles.tier = 'pro'` regardless of what the user actually bought
4. Writes `profiles.stripe_customer_id`, `profiles.stripe_subscription_id` directly via `supabase.from('profiles').update(...)`
5. Does **not** write to the `subscriptions` table (the new model from migration 025)

**Visible consequences for real Stripe customers:**
- Premium purchasers silently downgraded to Pro tier
- Pro purchasers happen to land on the right tier by coincidence (the default is 'pro')
- Manage Account returns 404 for any Stripe-paid user — no `subscriptions` row exists, so the new `create-portal-session` Edge Function's lookup misses

#### Secondary issue: missing invite flow for new customers

The portal handler at lines 184-186 logs `New customer ${customerEmail} - account will be linked on signup` and does nothing else. It does NOT call `auth.admin.inviteUserByEmail`. A brand-new customer (no existing auth.users row) buys a subscription via the marketing site → portal logs the message → user never gets the welcome email or invite, has no idea what to do, can't access the app.

The QuoteCat app's old `supabase/functions/stripe-webhook/index.ts` had the invite flow before the refactor; the refactor preserved it in our new `stripe-webhook` Edge Function. But the portal — which is what production actually hits — never had it.

#### `SEAT_PRICES` may also be stale

The same file contains `PRICE_TO_SEATS` (lines 43-52, used by webhook) and the seat checkout endpoint at `quotecat-portal/src/app/api/stripe/seats/checkout/route.ts` references `SEAT_PRICES` (lines 10-15). All four seat IDs (`price_1Sqdi3...`, `price_1Sqdi4...`) were NOT yet verified against Stripe on 2026-04-29 (verification was paused as scope creep). Should be checked as part of the fix.

#### Fix scope

In `quotecat-portal/src/app/api/stripe/webhook/route.ts`:

1. **Refresh `PRICE_TO_TIER`** with the live IDs from `docs/ENTITLEMENT_AUDIT.md` (the `price_1T1u...` IDs). Keep the structure; just replace the keys.
2. **Replace direct `profiles.update` calls** in `handleSubscriptionCheckout`, `handleSubscriptionUpdate`, and `handleSubscriptionCancelled` with calls to the `upsert_subscription_event` RPC (defined in migration 025). This writes a `subscriptions` row AND syncs `profiles.tier` atomically. Pattern is in our QuoteCat app's `supabase/functions/stripe-webhook/index.ts` — copy the `callUpsert` helper.
3. **Add invite flow** for new customers in `handleSubscriptionCheckout` mirroring the QuoteCat app's `ensureUserExists` function (in `supabase/functions/stripe-webhook/index.ts`). This calls `auth.admin.inviteUserByEmail`, then upserts the profile row to add the Stripe customer ID. The handle_new_user trigger creates the profile row from the auth.users INSERT.
4. **Verify and update `SEAT_PRICES`** in both `webhook/route.ts` and `seats/checkout/route.ts` — query Stripe API to confirm the four seat price IDs are still active. If stale, find the live ones (search Stripe by product name or list active prices) and update both files.
5. **Welcome email** — the QuoteCat app's old `stripe-webhook/index.ts` (preserved through the refactor) has a Resend-powered welcome email with a Pricing Guide CTA. The portal does not currently send one. Decide: copy that into the portal handler, OR delegate by having the portal handler enqueue an email via a different path. Quickest is to copy it.

#### Repo state caveat (2026-04-29)

The portal repo currently has 13 modified files + 2 untracked files from prior unrelated work (profitability calculations, team member rates, etc.). Resolve / commit / stash those before applying this fix to avoid mixing concerns in a single commit.

#### Verification plan after fix

1. **Stripe test mode checkout via marketing site:**
   - Browser, sign out of QuoteCat
   - Go to https://quotecat.ai, click Buy on Premium Monthly (or any subscription)
   - Complete Checkout with a Stripe test card or 100%-off coupon
2. **Database checks:**
   - `profiles.tier='premium'` (correct tier, not default 'pro')
   - `subscriptions` row exists with `source='stripe'`, `tier='premium'`, `external_id` matches Stripe `subscription.id`, `stripe_customer_id` populated
3. **Welcome email arrives** at the address used
4. **App sign-in:** open the email's set-password link, set password, sign in to the app, confirm tier badge shows "PREMIUM"
5. **Manage Account:** tap → opens Stripe billing portal in browser
6. **Cancellation flow:** cancel from billing portal → portal webhook fires `customer.subscription.deleted` → `subscriptions.status='expired'`, `profiles.tier='free'`

#### Reference for context

- `9535c1f feat: rebuild subscription / Manage Account architecture` — the QuoteCat app commit. Patterns to copy live in `supabase/functions/stripe-webhook/index.ts`.
- `docs/ENTITLEMENT_AUDIT.md` — canonical price → tier reference. **Don't introduce a third copy of the price map** in the portal; copy from the audit doc and treat the audit doc as source of truth across both repos.
- `supabase/migrations/025_rebuild_subscriptions.sql` — defines `upsert_subscription_event` RPC. The portal will call it via the Supabase JS client `supabase.rpc('upsert_subscription_event', { ...params })`.

---

### 🔴 `signup_completed` has NEVER fired — the email path is structurally unreachable

**Found 2026-08-28** by auditing the full PostHog event taxonomy for the first time.
Zero `signup_completed` events, ever, across 24 distinct event names on record. Supabase
has 36 profiles, so people are demonstrably signing up.

**The email path is the definite bug.** `app/(auth)/sign-up.tsx:318`:

    // Check if email confirmation is required
    if (data.session) {
      // User is signed in immediately (email confirmation disabled)
      ...
      trackEvent(AnalyticsEvents.SIGNUP_COMPLETED, { provider: "email", tier: "free" });
    }

Email confirmation IS enabled — line 278 sets
`emailRedirectTo: "https://quotecat.ai/confirmed.html"` — so `data.session` is always
null on signup and the else branch at :369 runs instead ("We sent you a confirmation
link"). **The tracking call is unreachable.** Every email signup ever has taken the
untracked branch.

**Apple (:198) and Google (:236) are unproven.** They gate on
`if (isNewSignup)` from `ensureProfileExists()`, which correctly returns true when it
creates a profile. No `on_auth_user_created` trigger exists to race it, and profile
`created_at`/`updated_at` deltas are irregular rather than clustered, so nothing
server-side is pre-creating profiles. Most likely explanation is simply that few or no
users have signed up via OAuth. Provider mix could not be confirmed — the
`quotecat_mcp_ro` role has no grant on `auth.users`, which is the least-privilege
boundary working as designed.

**THE FIX:** move the call out of the session check. The account was created either way;
whether it has been confirmed is a property, not a precondition.

    trackEvent(AnalyticsEvents.SIGNUP_COMPLETED, {
      provider: "email",
      tier: "free",
      confirmation_pending: !data.session,
    });

**That also buys a metric we do not currently have:** how many people sign up and never
confirm. Given 36 profiles and an activation rate where 88% never create a quote, the
unconfirmed gap may be a meaningful part of that story.

⚠️ **Check `sign-in.tsx:143` before shipping the fix.** It also fires
`SIGNUP_COMPLETED`, on the sign-IN screen. That may be legitimate (a first OAuth sign-in
does create an account) but if it is misplaced it will double-count once the email path
starts working.

**Why this matters beyond the metric.** The code comment on that event says: *"these are
the conversion-funnel events the marketing push depends on. Without them we can't read
the funnel."* A marketing push then ran (100+ notepads dropped in Lansing and Battle
Creek, August 2026) and the funnel could not be read — because the event it depended on
had never fired once.

---

### 🟡 Other events defined but never emitting (found in the same 2026-08-28 audit)

Full taxonomy is 24 event names. These are declared in `lib/app-analytics.ts` and absent
from PostHog:

| Event | Status | Likely explanation |
|---|---|---|
| `csv_generated`, `csv_shared` | never fired | needs checking — are the call sites wired? |
| `pdf_limit_nudge_shown` / `_upgrade_tap` / `_dismiss` | never fired | **probably innocent** — only 35 users have ever generated a PDF, so nobody has hit the 10/month ceiling |
| `quote_created` | **stopped 2026-06-19** | suspicious: `quote_updated` still fires through 2026-08-26. Either the creation path changed or quotes are now created via a route that does not track |
| `error_occurred` | **stopped 2025-10-28** | 12 events from one user, then silence. Sentry shows errors happen, so this is almost certainly not wired to the real error paths |

`quote_created` and `error_occurred` are the two worth investigating. The PDF-limit nudge
is low volume rather than broken, and that distinction matters — do not "fix" something
that is simply waiting for traffic.

**The general lesson, worth keeping:** instrumenting is not the same as verifying the
instrument works. Confirm an event actually arrives before trusting any dashboard built
on it.

---

### 🟡 `appVersionSource: local` leaves an uncommitted `app.json` after every build

**Found 2026-08-28** while writing the `google-play-release` Skill, and confirmed by an
actual `git diff`: `app.json` was sitting uncommitted with iOS 227→228 and Android
74→75, left over from an earlier build.

**Mechanism.** `eas.json` sets `"appVersionSource": "local"` with
`build.production.autoIncrement: true`. Version state therefore lives in the repo, so
the build bumps `ios.buildNumber` and `android.versionCode` by editing `app.json`. EAS
does not commit it (a build tool committing to your repo would be worse), so the change
just sits in the working tree.

**Consequence if forgotten.** The next build increments from a stale base, and the repo
stops recording which version code shipped with which commit.

## ⛔ DO NOT "FIX" THIS BY SWITCHING TO REMOTE — corrected 2026-08-30

**An earlier version of this entry recommended `appVersionSource: "remote"`. That
recommendation was made without reading the git history and is wrong.**

`git log -S appVersionSource -- eas.json` leads to commit **`9fa6710`, 2026-06-05:
"fix(eas): switch to local appVersionSource — single source of truth in app.json."** This
project **was** on remote, and remote caused a production incident:

> "iOS builds kept shipping at v1.2.5 despite app.json being at 1.2.6 for days. Root
> cause: eas.json was set to appVersionSource: "remote", which tells EAS to use its own
> server-side version registry as the source of truth for the App Version string. The
> registry was never synced when we bumped app.json, so EAS shipped 1.2.5 builds."
>
> "The eas build:version:set CLI command turns out to bump build_number only, not the App
> Version string. Not documented clearly in the help text — **found out by burning three
> iOS builds today** (208, 209, and 829aaa64)."

**The uncommitted-app.json tradeoff was accepted deliberately, in that same commit:**

> "each build will now produce a buildNumber bump commit in git. That's noise but it's
> **honest noise** — the commit history shows exactly which build numbers shipped at which
> versions, which is actually useful for debugging release issues like the one we hit
> today."

**So local is the considered choice and remote is the known hazard. Leave it.**

### The real gap is smaller than it looked

That commit assumed autoIncrement "bumps these values directly in app.json after each
build **and commits them back to git**." **It does not commit them** — verified
2026-08-28, when iOS 227→228 and Android 74→75 were found sitting in the working tree.

So the design is sound; only the auto-commit assumption was wrong.

**Fix: commit the bump as part of shipping.** Already handled in two places as of
2026-08-30 — the `google-play-release` Skill documents it, and the `/ship` slash command
does it as an explicit step. **No config change needed.**

✅ **DONE 2026-08-30 (`970f1c7`).** The commit's own closing note suggested a release-prep
check that `app.json` build numbers are AHEAD of the highest existing build number before
triggering. That is now `/ship` preflight: it runs `eas build:list` for both platforms,
compares against `app.json`, and **stops** if `app.json` is behind rather than raising it
silently. Consumed numbers count, including failed and cancelled builds.

**Related:** the `google-play-release` Skill documents this gotcha. Worth recognising
that half of that Skill is compensating for a config decision rather than teaching
genuine judgment — if we switch to remote, that section should be deleted, not kept.
The parts worth keeping are the ones that cannot be enforced: the `production` submit
profile publishing to the `internal` track, and knowing when a new SDK means the Data
Safety form needs updating.

### 🟢 MCP server: add a live-schema Resource (deferred to after 2026-09-02)

**Status:** deliberately deferred. Considered on 2026-08-30 and **decided against building
before the HUB interview** — implementing a protocol primitive with no operational need,
two days before being asked about it, is worse than being able to explain why it is absent.
Revisit after.

**What the server exposes today.** Tools only — `check_entitlement_drift`,
`check_user_state`, `free_tier_pressure`. MCP defines three server primitives:

| Primitive | Controlled by | Purpose |
|---|---|---|
| Tools | Model | Actions the model invokes |
| Resources | Application | Passive read-only context the app pulls in |
| Prompts | User | Workflow templates the user explicitly picks |

**Prompts — not planned.** There is one user (Joe), reached through one client (Claude
Code), which already has slash commands. `/ship` is a slash command and works. An MCP
Prompt would be the same function with more indirection and no additional reach.

**Resources — one candidate that holds up: the live database schema.**

The test for whether a Resource earns its place is whether the data is *already reachable
by the client*. Most candidates fail it — Claude Code sits in the repo, so `lib/user.ts`
(`FREE_LIMITS`) is one Read away and a Resource mirroring it is redundant.

The schema passes:

- **The current shape of a table is not in any single file.** It is the result of applying
  37 incremental migrations in order. Reconstructing `profiles` means mentally replaying
  every `ALTER TABLE` across the whole directory.
- **A written-down copy would rot**, which is exactly why "database schema notes" was
  rejected as a Skill candidate. The conclusion then was *"schema questions have a better
  answer: query the live database."* A Resource is that answer, structured.
- It is **passive reference data**, which is the Resource shape rather than the Tool shape.

**Sketch:** `schema://public/{table}` as a resource template, reading
`information_schema.columns` / `table_constraints` through the existing read-only role.
`resources/list` enumerates tables; `resources/read` returns columns, types, nullability,
defaults, and constraints.

**Prerequisite:** the `quotecat_mcp_ro` role currently has `GRANT SELECT` on exactly two
tables (`profiles`, `subscriptions`). Reading `information_schema` needs its own grant.
Grant only what the schema read requires — do not widen the role to all tables to make
this easier.

**Effort:** ~2 hours including the grant and testing the handshake.

### 🔴 Data Safety / privacy disclosures are missing RevenueCat and Sentry (found 2026-08-30)

**This is a live compliance gap, not a docs problem.** Both SDKs are shipped and both
process user data, and neither appears in the third-party disclosure list that was
submitted to Google Play (or, by extension, in the App Store privacy answers).

| SDK | Version | What it receives |
|---|---|---|
| `react-native-purchases` (RevenueCat) | ^9.10.5 | Subscription purchases, app user IDs |
| `@sentry/react-native` | ~7.2.0 | Crash reports, device and OS info |

**Why it happened.** The disclosure list lived as a hardcoded copy in `CLAUDE.md`, and
later a second copy in the `google-play-release` Skill. Neither is generated from
`package.json`, so adding an SDK never forced an update. The Skill even carries a warning
about this exact failure mode ("it is easy to add an SDK and forget the disclosure") while
itself carrying the incomplete list. **A fact inside a Skill rots exactly like a fact
inside a doc.**

**Fixed so far (docs only):** both lists now include RevenueCat and Sentry, and both now
say to regenerate from `package.json` rather than trust the copy.

**Still to do — the part that actually matters:**
1. Update the **Play Console Data Safety form** with both.
2. Review **App Store Connect privacy answers** for the same omission.
3. Confirm `https://quotecat.ai/privacy` names both.
4. Consider deriving the list from `package.json` at release time instead of maintaining
   a copy at all.

**Urgency:** do it before the next store submission. A mismatch between what the app does
and what the form says is a compliance issue, and both stores treat it as one.

### 🟡 OTA updates are fully wired and have never once been used (found 2026-08-30)

**What is configured.** `expo-updates@~29.0.16` is installed, `app.json` has
`updates.url` pointing at the EAS endpoint, `eas.json` assigns a `channel` to all three
build profiles, and three channels exist (`development`, `preview`, `production`) each
with a matching branch. This was set up deliberately on 2026-01-08 in `1f966bd`
("feat: ... OTA updates").

**What has actually happened.** Nothing. `eas branch:list` reports
`Runtime Version: N/A` and `Group ID: N/A` for all three branches — **zero updates have
ever been published on any channel** in the ~8 months since.

**The discipline is being followed, though.** `runtimeVersion` is a hardcoded string
(not a policy like `{"policy": "appVersion"}`) and it has tracked `version` exactly
through every release since 1.2.12: 1.2.12, .13, .14, .15, .16, .17, .18. Nobody has
let it drift.

#### Why this matters — the trap is in the interaction, not either file alone

An OTA update only reaches installs whose **`runtimeVersion` matches exactly**. Because
`runtimeVersion` is bumped in lockstep with `version`, every release starts a fresh
cohort with zero carryover. That is correct and safe (JS should never land on a build
with different native code) but it has a consequence worth understanding **before** an
emergency rather than during one:

⚠️ **`app.json` on disk is the version you are building NEXT, not the version users are
running.** The moment `version`/`runtimeVersion` are bumped to prepare a build, a
publish from that working tree targets a runtime **nobody has installed yet**. The
publish succeeds, reports success, and reaches **zero users** — a silent no-op that
looks exactly like a working hotfix.

**And the first use will almost certainly be an emergency**, because that is what OTA is
for: shipping a JS fix without waiting on App Store review. That is the worst possible
moment to discover an untested path.

#### What to do

1. **Do a dry run while nothing is on fire.** Publish a trivial no-op change to the
   `preview` channel, install a `preview` build, confirm it actually lands. Roughly
   30 minutes, and it converts "configured" into "known to work."
2. **Write down the pre-publish check:** confirm the `runtimeVersion` in the working
   tree matches the `version` users are actually running (App Store Connect / Play
   Console), not the one being prepared. If they differ, publish from the release tag,
   not from `main`.
3. **Know the rollback.** `eas update:republish` points a branch back at an earlier
   update group. Worth reading once now rather than under pressure.
4. **Only then consider it available as a hotfix path.** Until step 1 is done, treat
   OTA as unavailable and plan on a store submission.

**Not urgent** — nothing is broken, and never having used OTA has cost nothing so far.
It matters the first time a bad build reaches production, and its value is entirely in
being tested beforehand.

**Effort:** ~30 min dry run, plus adding the pre-publish check to `/ship` or the
`google-play-release` Skill.

### Phase 2 cleanup of `profiles` Stripe columns

After the new `subscriptions`-based flow is verified in production for a few weeks:

- Drop `profiles.stripe_customer_id` (currently still dual-written)
- Drop `profiles.stripe_subscription_id` (currently still dual-written)
- Update `supabase/functions/delete-account/index.ts:81` to read `stripe_customer_id` from the `subscriptions` table instead of `profiles`
- Decide whether `profiles.tier` becomes a generated column derived from active subscription, or stays dual-written. Recommended: stays dual-written (simpler; mobile app still reads `userState.tier` from AsyncStorage cached from `profiles.tier`).

### `presentPaywallAndSync` race window

**Verified partially mitigated 2026-07-04.** The 2s sleep is still there (`lib/revenuecat.ts:154` — `await new Promise(r => setTimeout(r, 2000))`), so the underlying race window is unchanged. But defense-in-depth logic was added around line 166+ that refuses to downgrade tier based on a stale Supabase read, which prevents the visible flicker even when the webhook chain takes longer than 2s. Symptom masked; root cause untouched. Convert to poll-with-timeout if we ever want to reclaim UI responsiveness in the fast-webhook case.

`lib/revenuecat.ts:73-74` waits a fixed 2 seconds after a successful purchase, then reads `profiles.tier` once. If the RevenueCat webhook is slower than 2s end-to-end, the read sees stale tier and the UI shows free briefly.

Fix: convert from `await sleep(2000); fetch()` to a poll-with-timeout: poll `profiles.tier` every 500ms for up to 10 seconds, return as soon as it shows the new tier. Bail out gracefully if it never arrives (user can refresh manually).

Defer until: we observe the race firing during verification or in production. If verification passes cleanly with the current 2s wait, leave it.

### Optional: `webhook_events` audit table

Not built in this PR. Add later if we ever need event-level debugging beyond what RC and Stripe dashboards provide.

If we add it: `id` (event_id from provider, unique), `source`, `payload` (JSONB), `received_at`, `processed_at`, `error` (nullable). Webhook handlers insert at start, update with result.

### Stripe secret key rotation (post-PR)

The current live Stripe secret key (`sk_live_...0J00JmrGyvUO`) was pasted into the Claude chat transcript on 2026-04-28 during the audit. Roll it once more so the secret captured in chat history is invalidated.

Procedure: Stripe → Developers → API keys → "Roll key" on the active secret → 12-hour grace → update Supabase Edge Function secrets via Management API → verify production via `create-checkout` smoke test → let old key expire.

### Delete the orphaned `sk_live_...NZXG` Stripe secret key

`sk_live_...NZXG` (created Nov 10, 2025) hasn't been used since Jan 17. Recommend deleting from Stripe → Developers → API keys.

### `STRIPE_*_PRICE_ID` Supabase Edge Function secrets

There are four Supabase secrets that aren't referenced anywhere in current edge function code:
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `STRIPE_PREMIUM_MONTHLY_PRICE_ID`
- `STRIPE_PREMIUM_YEARLY_PRICE_ID`

The actual prices used in the code are hardcoded in `supabase/functions/create-checkout/index.ts` and `supabase/functions/stripe-webhook/index.ts`. Verify these env vars aren't used by something I missed; if confirmed unused, delete from Supabase secrets.

### `.env`-in-git-history credential rotation

`.env` was historically committed to git (commits `b6b6e35`, `8303582`). Anyone who has ever cloned the repo could have those values in their local git history.

Roll all of these:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_ACCESS_TOKEN`
- (Stripe key already being rolled per the item above)

After rotation, optionally scrub history with `git filter-repo` and force-push. (More invasive; only do if you're confident about who has clones.)

### Stripe `incomplete` status mapping

`stripe-webhook` currently maps Stripe's `incomplete` status to our `'active'` enum (initial card-setup state). If the user's card is declined right after checkout, Stripe will eventually fire a `customer.subscription.updated` event with status `incomplete_expired` (terminal) — the webhook downgrades to `'expired'` correctly.

**Verify post-launch:** with a real declined-card test, confirm the chain of events results in the user losing access. If the chain doesn't fire as expected, either flip `incomplete` to `'expired'` immediately (safer) or add an explicit grace-period state.

### Stripe `paused` status mapping

`stripe-webhook` maps Stripe's `paused` status to our `'active'` enum because we don't currently use Stripe's [Pause Collection](https://stripe.com/docs/billing/subscriptions/pause-payment) feature. If/when QuoteCat starts pausing subscriptions (e.g., for seasonal contractor pause-and-resume), revisit this mapping — paused users probably shouldn't have full access.

### Alert on `rc_webhook_orphan_user` logs (post-launch)

The RC webhook's orphan-user grace handling acknowledges and skips events whose `app_user_id` doesn't exist in `profiles`. Pre-launch this is fine — the orphans we've seen (e.g., `65082a64-d6ea-4158-a5a0-3fbe38b7d0d0`) are leftovers from anonymous-purchase users who got cleaned up.

Post-launch, if a real customer's `auth.users` row gets deleted but their RC subscription persists, we want to know fast and have a recovery process. Specifically:

- Set up an alert (Supabase log drain → PagerDuty/email/Slack) on `console.warn` lines containing `rc_webhook_orphan_user`
- Document the recovery procedure: usually involves matching the original_app_user_id in RC to a current Supabase user (if they re-signed up) and using RC's customer migration API to relink

The alert is the trigger. Without it, orphan events log silently and we'd only notice via support tickets ("I paid but the app says I'm free").

### GoTrue admin DELETE bug for some legacy users

During Step 9 cleanup (2026-04-29), `joseph@quotecat.ai` returned 500 `Database error deleting user` from `DELETE /auth/v1/admin/users/{id}` even after we patched the row's NULL `is_super_admin` column. A direct SQL `DELETE FROM auth.users WHERE id = ...` succeeded immediately and CASCADE-deleted all dependent rows correctly.

GoTrue must have some preflight or post-step that fails for legacy rows, independent of the column-NULL issues we already fixed. The other 5 users in the same batch deleted cleanly via the admin API; joseph was the only one that needed the SQL fallback.

**Practical impact:** if `delete-account` (which uses `auth.admin.deleteUser` per `delete-account/index.ts:233`) ever fires for a similarly-affected legacy user, it'll fail. New users created after the GoTrue fix that introduced this issue won't be affected.

**Recovery:** if a `delete-account` call fails, fall back to direct SQL via Management API (`DELETE FROM auth.users WHERE id = '<uuid>'`). Postgres CASCADEs handle the rest.

Worth investigating once we have time: Supabase support ticket with the `error_id` from a future failure should clarify what GoTrue's choking on.

### Smoother Google Sign-In: migrate from expo-auth-session to native SDK

**Verified still open 2026-07-04.** `@react-native-google-signin/google-signin` is not in `package.json`; mobile app still uses `expo-auth-session/providers/google`.

Today, after sign-out → tap "Sign in with Google" → user goes through the full account picker every time (because `expo-auth-session` opens a fresh in-app browser session with no memory of prior Google login). Once signed in, session persists across app launches; this only affects the sign-out → sign-back-in path.

Pros use **`@react-native-google-signin/google-signin`** (native SDK, not web-based OAuth) which integrates with the OS-level Google account manager. Repeat sign-ins become "Continue as `<email>`" with one tap; `signInSilently()` is also available for truly background sign-in restore.

**Migration cost:** ~half-day work — add config plugin, install native dependency, drop in `google-services.json` / `GoogleService-Info.plist`, swap `expo-auth-session/providers/google` calls for native SDK calls in `sign-in.tsx` and `sign-up.tsx`, fresh native build cycle. Apple Sign-In path stays the same.

**Priority:** Polish, not blocking. Real users sign in once and stay signed in. Worth doing once the launch dust settles.

### 🟡 Nothing expires a subscription except an inbound webhook (found 2026-08-26)

Subscription expiry is **entirely event-driven, with no backstop**. If a webhook
never arrives, a subscription stays `active` forever and the user keeps their
tier indefinitely.

The happy path is correct: RC sends `EXPIRATION` →
`revenuecat-webhook/index.ts` calls `upsert_subscription_event` with
`p_status: "expired"` → the RPC recomputes `profiles.tier` from the user's
remaining `status = 'active'` rows (`025_rebuild_subscriptions.sql:218-236`) →
premium drops to free. Stripe has an equivalent path. Nothing wrong with any of
that. The problem is it's the *only* path.

**Evidence that there is no second line of defence:**

- `current_period_end` is only ever **written** (both webhooks) and read once in
  `create-portal-session` for ordering. It **never gates access** — not in the
  mobile app, not in the portal, not in any RPC. The column is descriptive only.
- `profiles.tier_expires_at` is declared in `001_initial_schema.sql:16` and
  referenced **nowhere in any codebase**. Dead column.
- No `pg_cron` job reconciles subscriptions. (Note the mechanism exists —
  `cleanup-deleted` already runs on a DB cron via `net.http_post` — so adding
  one has precedent and needs no new infrastructure.)

**The row that surfaced this:** `awaknows@gmail.com`, `profiles.tier = premium`,
subscription `active / premium / play_store`, `started_at`
2026-05-13T22:02:21Z, `current_period_end` 2026-05-14T01:32:20Z. Still `active`
three months later.

Note the duration: **3½ hours.** That is a Play Store *test* purchase (Play
compresses subscription durations for license testing), not a real customer. So
this is almost certainly stale test data rather than a lost paying user — but it
demonstrates the gap exactly: the subscription ended, no `EXPIRATION` was
processed, and nothing has noticed in three months.

**Why the obvious fix is wrong.** A naive sweep (`current_period_end < now()` →
expire) would contradict a deliberate decision already in the code. The
`BILLING_ISSUE` branch of `revenuecat-webhook/index.ts:235-237` states the tier
persists until `EXPIRATION` fires — correct, because Play and Apple both have
retry/grace windows where the period end is in the past but the subscription is
still legitimately alive. A naive sweep would downgrade paying customers
mid-retry. See **Apple grace period (`in_grace_period` status)** below, which is
the same underlying issue from the other direction.

**Options, cheapest first:**

1. Sweep with a generous grace buffer — only expire when `current_period_end <
   now() - interval '21 days'` (past Apple's 16-day grace). Crude but safe, and
   catches exactly the case above.
2. Periodic reconciliation against the RevenueCat REST API, which is the actual
   source of truth for store subscriptions. More correct, more work.
3. Defensive read: have entitlement checks consider `current_period_end`
   alongside `status`. Touches many call sites; least attractive.

**Priority: low right now, rising with scale.** At 6 paid accounts a missed
webhook is a one-off you can fix by hand. It becomes real when there are enough
subscribers that dropped webhooks are routine. Do it before any meaningful
subscriber growth, not before launch.

**Immediate cleanup (optional):** set that one row to `status = 'expired'` and
let the RPC recompute, or leave it — it's test data.

### Apple grace period (`in_grace_period` status)

Apple gives users a 16-day grace period when an IAP renewal fails. Currently the new `subscription_status` enum is `active | canceled | expired` only. RC reports a separate `BILLING_ISSUE` event during grace period.

If users start losing access prematurely or keeping access too long during failed renewals, add an `in_grace_period` enum value and handle the `BILLING_ISSUE` event explicitly. `ALTER TYPE … ADD VALUE` is cheap.

### Reconcile Supabase migration tracking table

The `supabase_migrations.schema_migrations` table on remote is empty/sparse — most or all of the ~28 migrations in `supabase/migrations/` are applied to the live database but were never recorded in the tracking table (likely because they were applied via the SQL editor instead of `supabase db push`).

Symptom: `npx supabase db push` tries to re-apply every migration, hits "relation already exists" errors, and aborts. Discovered 2026-05-07 while pushing `026_lockdown_products_rls.sql` (which we ended up applying via SQL editor instead).

**Fix when there's time:** for each migration version in the directory, run `npx supabase migration repair --status applied <version>`. After all are marked applied, `db push` will work cleanly for future migrations.

Not blocking — SQL editor is fine for one-offs in the meantime. Worth doing before any sizeable schema change so the tooling is ergonomic again.

### Service role key rotation

The `SUPABASE_SERVICE_ROLE_KEY` value was pasted into a Claude Code chat transcript on 2026-05-07 (when reading the cleanup-deleted cron config). The key is also already in the cron's HTTP request config and presumably in shell profile / build env. Not a meaningful new exposure given how widely it's already deployed, but worth scheduling a rotation alongside the other credential rotation work.

When rotating: update `SUPABASE_SERVICE_ROLE_KEY` in Supabase Edge Function secrets, then update the `Authorization: Bearer ...` header on the cleanup-deleted cron job's `net.http_post` SQL definition with the new value.

---

### 🟡 Portal: "Buy more seats" CTA only routes to 5-pack

**Verified still open 2026-07-04.** `TechList.tsx:68` still hardcodes `const selectedPackage = 'fivepack'; // Only 5-pack available for now`. Single-pack not exposed.

**Spotted:** 2026-06-05 by user inspecting `portal.quotecat.ai/dashboard/team`.

**The bug:** The "buy more seats" / "buy more techs" CTA in the Premium contractor's team management area routes only to the 5-pack purchase flow. The single-pack option exists in the underlying Stripe / billing setup but the button doesn't expose it as a choice.

**Why it matters:** A Premium contractor who needs to add **one** tech sees only the 5-pack price and may bounce rather than over-buy. Conversion friction on a real intent signal.

**Fix:** Add the single-pack option to the seat-purchase selector in `quotecat-portal/src/app/dashboard/team/` (likely the worker-invite or tech-invite flow). Should route to the Stripe single-seat checkout endpoint that already exists per the portal API audit (`/api/stripe/seats/checkout`).

**Effort:** Small — likely a single component change + a price/route map update. ~30 min if the single-pack price ID is already in env.

---

### 📋 SCOPED — Office Staff role (portal-only team members, unlimited/free)

**Verified still open 2026-07-04.** No migration for `office` role exists in `quotecat-portal/supabase`. No role handling in `dashboard/team`. Build planned for 2026-06-06 didn't happen; item is still pure spec.

**Spec written 2026-06-05, build planned 2026-06-06.** Full design lives at `quotecat-portal/docs/office-role-plan.md` (committed to the portal repo).

**One-line summary:** A third team-member role alongside Workers and Techs. Portal access only (no app), unlimited seats at no extra cost on Premium. The wedge for turning the portal into a full back-office business suite.

**Strategic framing (from owner):**

> "Field workers go in the field — they're free and unlimited. Office staff go in the office — they're free and unlimited too. The only thing we charge extra for is people who use the app to build quotes (techs)."

**Effort:** ~6h. See spec for migration, file list, default permissions profile, test matrix, mobile-side sign-in check, and post-ship marketing updates.

**Coordination note:** Spec includes one small mobile change — blocking sign-in for `role: 'office'` users with a "use portal" message. That violates the tonight-scope "no mobile changes" rule but is appropriate for the feature build day. Get explicit go-ahead before touching mobile.

---

### 🟡 Portal: site performance feels subjectively slow

**Spotted:** 2026-06-05 by user navigating `portal.quotecat.ai`.

**The signal:** User reported the portal feels slow during normal navigation. No specific page or interaction called out — broad subjective impression.

**Candidates worth profiling when investigating:**

- Next.js bundle size + tree-shaking (run `next build` and inspect `.next/analyze/` output)
- Server-component vs client-component boundaries — pages currently marked `"use client"` that could be split
- Supabase query waterfalls on `/dashboard` — could be N+1 patterns or sequential awaits that should be `Promise.all`
- Image optimization — confirm `next/image` is used everywhere and the `images.domains` config covers Cloudinary
- Font loading strategy — `next/font` vs external `<link>` with FOUT/FOIT impact
- `CalendarView.tsx` (~457 LOC) doing heavy client-side computation on each render — memoize date calculations and job grouping if not already
- Realtime / interval polling that may be firing more than needed
- Vercel/Netlify edge function cold starts on API routes

**Recommended first pass:** Run Lighthouse against `/dashboard` in incognito, capture LCP/TBT/CLS, then iterate on the worst-scoring metric.

**Effort:** 2-4 hour audit pass + iterative fixes based on findings.

---

## Done

### `1modernrelic@gmail.com` — undiscovered 9th paid user (moved to Done 2026-07-04)

The 2026-04-28 audit identified 8 users with `tier IN ('pro','premium')`. Webhook verification on 2026-04-29 surfaced a 9th: `1modernrelic@gmail.com` (`65082a64-d6ea-4158-a5a0-3fbe38b7d0d0`), created 2026-04-20. They had a real Play Store Pro Monthly purchase that died with `BILLING_ERROR` and now sit at `tier='free'` — which is correct.

Not currently a problem. Noting because the audit underestimated total active testers by one. If you do another audit pass before public launch, expect the count to be 23 users / 2 real paid IAP / 6 dropped-to-free / Drew + Wyatt at premium / 13 free testers. The arithmetic was off-by-one because expired-billing-error users sit at `tier='free'` so they didn't appear in the paid-users query.
