# QuoteCat Backlog

**Canonical "what's left" index across the QuoteCat ecosystem.** One scannable list. For full design context on any item, drill into the linked source file.

**Last updated:** 2026-06-05
**Sources merged:** `FOLLOWUPS.md`, `CLAUDE.md`, `docs/codebase-health-audit-2026-06-01.md`, `docs/v1.2.7-plan.md`, `quotecat-portal/docs/office-role-plan.md`, this session's conversation, code-level TODOs.

---

## 🚨 Needs your verification (status uncertain)

Items where I think the work might already be done but couldn't auto-verify. **Please confirm status — if shipped, move to "Done" section.**

- [ ] **`1modernrelic@gmail.com` undiscovered 9th paid user** — FOLLOWUPS.md notes this as "resolved" in body text but item still listed under "Open." Move to Done if you agree. (`FOLLOWUPS.md:285`)
- [ ] **CLAUDE.md drift items (8 specific stale claims)** — Tier 1 of the audit. Includes "all data local" misleading, Drew tier gating ambiguity, "1Build" should be xByte, xByte status, etc. (`docs/codebase-health-audit-2026-06-01.md:195`)
- [ ] **`@types/uuid` Tier 1 item** — partially attempted June 2, rolled back due to uuid major-version jump. Status: still open with a specific path forward documented. (`docs/codebase-health-audit-2026-06-01.md:194`)
- [ ] **Stripe webhook fix in portal — "13 modified files + 2 untracked" caveat is now outdated** — those files were committed tonight (`af14eff`). Confirm the OTHER parts of that FOLLOWUPS entry (`PRICE_TO_TIER` map refresh, RPC migration, invite flow, welcome email) are still open. (`FOLLOWUPS.md:119-205`)
- [ ] **Items from CLAUDE.md "Pending Features (Stashed)"** — that section names features stashed in November 2025. Worth verifying which ones eventually shipped (e.g., taxPercent, client contact fields, Quick Invoice). (`CLAUDE.md`, section "📋 Pending Features (Stashed - Nov 24, 2025)")

---

## 🟠 Tomorrow

- **Office Staff role build** — third team-member role, portal-only, unlimited free seats on Premium. ~6h. Spec at `quotecat-portal/docs/office-role-plan.md`. Includes one coordinated mobile sign-in block (the only mobile change needed).

---

## 🔴 Pre-launch critical (do soon — high impact)

- **Sentry source maps upload** — without this, every production crash is minified gibberish. ~15 min config + one build cycle. Full procedure documented. (`FOLLOWUPS.md:102-117`)
- **Portal Stripe webhook handler is broken for marketing-site subscriptions** — `PRICE_TO_TIER` map references dead Stripe price IDs, doesn't write to new `subscriptions` table, no invite flow for new customers, no welcome email. Premium purchasers silently downgraded to Pro. (`FOLLOWUPS.md:119-205`)
- **Stripe secret key rotation** — `sk_live_...0J00JmrGyvUO` was pasted into a Claude chat 2026-04-28. (`FOLLOWUPS.md:232`)
- **Delete orphaned `sk_live_...NZXG` Stripe secret** — unused since Jan 17. (`FOLLOWUPS.md:238`)
- **`.env`-in-git-history credential rotation** — rotate `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`. (`FOLLOWUPS.md:252-262`)
- **Apple review of v1.2.6** — pending, operational. When clears, push "Pricing Health Check" headline copy to homepage.
- **Wyatt + Drew TestFlight → public App Store transition** — operational, after v1.2.6 clears.

---

## 🟡 v1.2.7 scope (already committed in plan)

Full plan: `docs/v1.2.7-plan.md`.

- **Barcode pricebook scanner** — `expo-camera` install, scanner modal, integration with pricebook modal. ~7-8h. (`docs/v1.2.7-plan.md`)
- **Strava-style shareable Pricing Health Check card** — `react-native-view-shot`, share button on health-check screen. ~4-5h. (`docs/v1.2.7-plan.md`)
- **Stripe Connect collection for all tiers** — ungate Stripe Connect from portal-Premium-only to mobile-all-tiers. Share-as-Link stays Pro+ (deliberate friction-removal upgrade hook). PDF-with-QR-code for Free. ~7-9h. (`docs/v1.2.7-plan.md`)
- **Analytics identity instrumentation** — ✅ shipped tonight (`024f21d`). Just waits for next build to take effect for users.
- **Duplicate-email signup UX fix** — when a user tries email/password sign-up with an email that already has an account, Supabase silently returns success without sending a confirmation email (anti-enumeration security behavior). Our `sign-up.tsx:268-358` then misleadingly shows "Check your email" but no email comes. Fix: check `data.user.identities.length === 0` right after `signUp()` returns — that's Supabase's signal that the email is already registered. Show "Email already registered — try signing in" prompt with a "Sign In" button instead. Apply to both the Google OAuth path (~line 195) and email/password path (~line 268). ~15 min. Ships with next mobile build alongside the analytics identity wiring already merged.

---

## ⚡ Portal performance backlog

Tonight shipped: dashboard page Promise.all, dashboard layout cache+parallel+slim, `q/[id]` + `worker/[token]` parallelization. Remaining:

- **NotificationBell polling reduction** — currently 3 queries every 2 min per active user. Three fix options: interval bump to 5 min (cheap), single Postgres RPC (better), Supabase realtime subscription (best). ~30 min / 2h / 3h depending on choice.
- **Detail pages RSC conversion** — `invoices/[id]`, `contracts/[id]`, `profitability`, `messages` and other pages marked `'use client'` could be split into server-rendered shells + client islands. ~1-2h each, ~200-400ms LCP improvement per page.
- **Lazy-load `lib/pdf.ts` + `html2pdf.js` via `dynamic()`** — drops main bundle by ~150-200KB. ~1h. (Portal audit candidate #4)
- **`pay/[id]` perf** — 2 sequential queries (invoice → profile). Second depends on first's `user_id`, so requires PostgREST embedded select syntax. Skipped tonight to avoid runtime errors from guessed FK constraint name. Revisit with confidence around the right syntax.
- **Option B portal gating: middleware migration** — long-term arch fix. Move tier check from layout to Next.js middleware so layout-render does zero Supabase queries. Hybrid approach keeps tech-account check in layout with React `cache()`. ~1-2 days (not hours, as initially miscalled tonight). Requires tier-in-JWT decision + auth helpers alignment.
- **Portal site perf audit pass (broader)** — Lighthouse on `/dashboard`, profile LCP/TBT/CLS, iterate. ~2-4h. (`FOLLOWUPS.md:367-386`)

---

## 🧹 Marketing site

- **Sweep beyond `index.html`** — `faq.html`, `support.html`, `privacy.html`, `terms.html` were NOT re-checked tonight for any straggler stale claims. Same patterns to grep: "keep 100%", "2.9%", "100 spots", "Priority phone support". 15-30 min.
- **Premium card update post Office Staff ship** — add line about unlimited office staff seats once feature is live. (`quotecat-portal/docs/office-role-plan.md`)
- **Workers vs Techs vs Office Staff explainer** — refresh the info-tooltip pattern on the Premium card to include all three roles once Office Staff ships.
- **v1.2.6 "what's new" homepage push** — Pricing Health Check as the headline beat once Apple review clears.

---

## 📊 Data & analytics

- **Drift #2: partial-invoice analytics design** — "Cash collected vs Completed jobs only" toggle. Mobile + portal coordinated. Both currently have inconsistent behavior on `percentage < 100` invoices; both are wrong in different ways. Affects only analytics surfaces, not financial transactions. v1.3.x design decision needed before implementation.
- **Startup Kit welcome email** — fires on email confirmation OR Apple/Google OAuth signup. Resend transactional with kit PDF link (not attachment). `welcome_kit_sent_at` column on profiles for idempotency. ~5h standalone build. Picked option B (standalone, not v1.2.7) in tonight's discussion.
- **PostHog dashboards** — App Health, Quote Lifecycle Funnel, Problems all built tonight. Marketing→Mobile funnel + activation deferred until traffic is bigger and signal worthwhile.
- **Sentry instrumentation expansion** — `Sentry.setUser` after sign-in ✅ done tonight via `identifyUser`. Pipe `trackEvent(ERROR_OCCURRED)` from sync/RevenueCat/Drew/auth catch blocks to Sentry too — currently swallowed silently. ~1h.

---

## 🌱 Planned strategic features

- **Industry Mode (Trades vs Services) + Spanish i18n combined feature** — adds `profiles.industry` enum + `react-i18next` + locale picker. Ships in same release as xByte re-enablement. ~2-2.5 weeks. (`FOLLOWUPS.md:31-100`)
- **v1.3.0 scheduling — mobile personal calendar + portal team dispatch** — Pro mobile gets agenda view; Premium portal gets drag-drop dispatch calendar with realtime. Portal `CalendarView.tsx` already exists; mobile is greenfield (~13-16h). Closes biggest competitive gap per `docs/COMPETITOR-ANALYSIS.md`.
- **Pricing Foundation Setup (App + Portal)** — guided onboarding combining Overhead Calculator + Labor Rate Calculator + target margin into one flow. Synced between mobile and portal. (`CLAUDE.md`, in "Future Feature Ideas" → marked 🎯 NEAR-TERM)
- **AI Business Performance Coach** — premium scoring + personalized advice via Claude. (`CLAUDE.md`, in "Future Feature Ideas" → marked 🎯 NEAR-TERM)
- **Two-way SMS texting** — Premium-only via Twilio. **Already shipped on portal**; mobile-side equivalent (if any) TBD. (`FOLLOWUPS.md` Office Staff entry confirms portal has it)
- **QuickBooks sync** — Premium-only. **Already shipped on portal**. (`CLAUDE.md` Future Feature Ideas — may need de-listing as already done)
- **Change Orders sync to portal** — mobile has change orders working locally, portal doesn't render them. Schema gap. Plan: `docs/CHANGE-ORDERS-SYNC-PLAN.md` (in repo).
- **Per-team-member "views" (v1.4+)** — owner-configurable custom dashboards per role/user. Captured at `quotecat-portal/docs/office-role-plan.md` "Future direction" section.

---

## 🌱 Future ideas (not scoped, sorted by area)

From `CLAUDE.md` "Future Feature Ideas" section. Listed for navigability; defer scoping until product signal warrants.

### Quotes
- Supplier Price Trend Alerts (uses weekly X-Byte data for "Home Depot raised lumber 8% this week")
- Time & Materials quoting (T&M alongside flat-rate)
- Materials Margin Indicator — ✅ shipped in v1.2.5 (Free tier per CLAUDE.md). Should be moved to Done if still listed.
- Quick Custom Items — ✅ shipped in Build #141 (Free tier per CLAUDE.md). Should be moved to Done.

### Invoices
- Payment reminders for overdue invoices ("Send Reminder" CTA + auto-send intervals) — partially shipped (Pro+ has `sendInvoiceReminder`). Auto-send intervals still future.

### Communication / Premium add-ons
- Workflow automations (Knock.app for delivery)
- Google Review requests + management
- Email/SMS marketing campaigns
- Referral program

### Field Operations
- GPS tracking + route optimization (Phase 1: GPS waypoints on clock-in/out)
- Job photos (before/after)

### Drew AI
- Site Visit Mode (voice-to-scope recording, Whisper API)
- Drew visibility toggle

### Analytics
- Win Rate Dashboard (with tier-group bundle handling)

### Integrations & Marketplace
- Local Supplier Network — self-service supplier portal for catalog uploads (Phase 2/3)
- Spanish language support — folded into Industry Mode + i18n combined feature above

### Growth
- Regional Expansion Referral System — unique referral codes, threshold-based subscription extensions

---

## 🔧 Technical debt / hygiene

From `docs/codebase-health-audit-2026-06-01.md`:

### Tier 1 (low effort, high impact)
- ✅ `calculateQuoteTotals` duplication — shipped `fed5c8a`
- ✅ Delete `_old/` directory — shipped `6e57200`
- ⏳ `@types/uuid` addition — needs careful uuid-version handling (see "Needs verification" above)
- ⏳ CLAUDE.md drift items — 8 stale claims to update

### Tier 2 (~half to full day)
- Get TypeScript back to 0 errors — ~4-6h. Currently 24 pre-existing errors in portal (counted tonight).
- Decide `expo-dev-client` location — ~30 min decision
- Fix the 5 performance smells — ~2-3h

### Tier 3 (~2-3 days)
- Split `lib/database.ts` into domain files (`quotesDB.ts`, `invoicesDB.ts`, etc.)
- Extract `useInvoiceForm` hook (mirror `useQuoteForm`)
- Extract `useDashboardState` hook
- Unify calculation source of truth (one canonical `lib/calculations.ts`)
- Build `lib/syncManager.ts` orchestrator (replaces ad-hoc cooldown duplication)
- Audit the portal codebase with same 3-D sweep (architecture/bloat, duplication/dead code/stale docs, TS/deps/perf) — ~1 day. **Note:** tonight's perf work did pieces of this informally.

### Tier 4 (longer-term)
- Remove `as any` escape hatches at cloud-data ingress; add Zod or similar runtime validation
- Decide Drew tier gating (currently inconsistent)
- Decide xByte fate (finish OR delete + update CLAUDE.md)
- Add smoke-test layer for calculation pipeline (PDF totals vs invoice totals vs dashboard totals must agree)

---

## 🔐 Subscription & auth hygiene

From `FOLLOWUPS.md` (the Manage Account refactor follow-ups):

- **Phase 2 cleanup of `profiles` Stripe columns** — after new `subscriptions` flow is verified, drop `profiles.stripe_customer_id` and `profiles.stripe_subscription_id`. Update `delete-account/index.ts:81` reads. (`FOLLOWUPS.md:209`)
- **`presentPaywallAndSync` race window** — fixed 2-second sleep → poll-with-timeout (500ms × up to 10s). Defer until race fires in production. (`FOLLOWUPS.md:218`)
- **Optional `webhook_events` audit table** — for event-level debugging beyond RC/Stripe dashboards. (`FOLLOWUPS.md:226`)
- **`STRIPE_*_PRICE_ID` env vars cleanup** — 4 Supabase secrets not referenced anywhere in current edge function code. Verify unused, then delete. (`FOLLOWUPS.md:242`)
- **Stripe `incomplete` status mapping verification** — post-launch declined-card test. (`FOLLOWUPS.md:264`)
- **Stripe `paused` status mapping** — revisit if/when seasonal pause-and-resume is used. (`FOLLOWUPS.md:270`)
- **Alert on `rc_webhook_orphan_user` logs** — post-launch monitoring. (`FOLLOWUPS.md:274`)
- **GoTrue admin DELETE bug for legacy users** — recovery procedure documented (SQL fallback). Worth investigating with Supabase support. (`FOLLOWUPS.md:291`)
- **Apple grace period (`in_grace_period` status)** — if users start losing access prematurely during failed renewals, add enum value and handle `BILLING_ISSUE` event. (`FOLLOWUPS.md:313`)
- **Reconcile Supabase migration tracking table** — most migrations applied via SQL editor, not recorded in `schema_migrations`. `npx supabase db push` fails because of it. Fix: `migration repair --status applied` per version. (`FOLLOWUPS.md:319`)
- **Service role key rotation** — alongside other credential rotations. (`FOLLOWUPS.md:329`)
- **Smoother Google Sign-In: migrate from `expo-auth-session` to `@react-native-google-signin/google-signin`** — repeat sign-ins become "Continue as user" with one tap. ~half-day. (`FOLLOWUPS.md:303`)

---

## 🛒 Portal-specific

- **"Buy more seats" CTA only routes to 5-pack** — single-pack option exists but button doesn't expose it. ~30 min. (`FOLLOWUPS.md:337-348`)
- **MarginIndicator dead-code cleanup** — ✅ shipped tonight in `af14eff`. (No action; for ref only.)

---

## 💻 Code-level TODOs found in source

Tonight's grep across both repos:

| Location | Comment |
|---|---|
| `lib/analytics.ts:49` | `TODO: Send anonymous analytics if user opted in` |
| `lib/analytics.ts:138` | `TODO: Implement when ready for cloud analytics` |
| `lib/teamMembers.ts:107,110,113` | 3 `@deprecated` function aliases (`getTeamMembers`/`getTeamMemberById`/`searchTeamMembers`) — old names still exported for back-compat |
| `lib/pricebookMatching.ts:20` | `TODO: Performance optimization for large pricebooks (1000+ items)` |
| `lib/wizardApi.ts:455` | `@deprecated Use searchCatalog instead for large catalogs (30k+ products)` |
| `lib/browser.ts:66` | `@deprecated Use openProductSearch instead - direct URLs are blocked by retailers` |
| `lib/reminders.ts:498` | `@deprecated Use getCloudNotifications instead` |
| `lib/database.ts:2135` | `@deprecated Use searchProductsFTS instead` |
| `modules/settings/index.ts:13` | `TODO: later read from persistence / profile` |
| `modules/assemblies/storageSQLite.ts:157` | `@deprecated Use clearDeletedAssemblyId for individual tombstones` |
| `quotecat-portal/src/app/api/twilio/webhook/route.ts:195` | `TODO: use contractor's timezone` |

Most of these are deprecation aliases kept for back-compat — clean them up during a refactor cycle, not piecemeal.

---

## ✅ Recently shipped (kept for context, can be archived)

Tonight (2026-06-05):

- Marketing site truth-up (false claims removed, Founder Hotline block added) — commit `19b4524`
- Analytics identity instrumentation (PostHog + Sentry tied to Supabase user) — commit `024f21d`
- `review_opened` event instrumentation — commit `024f21d`
- Doc refresh: features, plans, FOLLOWUPS pointers — commit `63932c2`
- Branded features PDF — commit `3a1e153`
- Portal dashboard query Promise.all — commit `1307788`
- Portal dashboard layout cache+parallel+slim — commit `8dff519`
- Portal `q/[id]` + `worker/[token]` parallelization — commit `116b226`
- Office Staff plan doc — commit `89fc3c0` (portal repo)
- FOLLOWUPS pointer to Office Staff spec — commit `976bb21`
- Portal billable_rate bundle + Drift #1 + MarginIndicator landmine cleanup — commit `af14eff` (portal repo)

Earlier this cycle:

- v1.2.6 Pricing Health Check — awaiting Apple review
- v1.2.5 Materials Margin Indicator → Free tier
- Build #141 Quick Custom Items — Free tier
- Tier 1 audit items: `calculateQuoteTotals` dedup (`fed5c8a`), `_old/` removal (`6e57200`)
- Pricing Strategy Q1-Q5 marketing decisions

---

## How to maintain this file

- **Add** items at the top of their bucket as they're discovered. Cite source.
- **Move** items to "Recently shipped" with commit hash when done.
- **Re-validate** the "Needs verification" section first whenever this file is consulted — that's where confusion lives.
- **De-duplicate** when items appear in multiple sources. The canonical pointer goes to the most-detailed source (usually FOLLOWUPS.md).
- **Don't re-explain** items here when their detail lives in FOLLOWUPS.md or a `docs/*-plan.md`. Link to them.
