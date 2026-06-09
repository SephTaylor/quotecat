# QuoteCat Backlog

**Canonical "what's left" index across the QuoteCat ecosystem.** One scannable list. For full design context on any item, drill into the linked source file.

**Last updated:** 2026-06-09 (v1.2.7 shipped to ASC + Play Internal)
**Sources merged:** `FOLLOWUPS.md`, `CLAUDE.md`, `docs/codebase-health-audit-2026-06-01.md`, `quotecat-portal/docs/office-role-plan.md`, this session's conversation, code-level TODOs.

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

## 🟡 v1.2.7 — Mike-response sprint (~5-7h, JS-only)

**Approved scope after Kellie peer review (2026-06-09):** original v1.2.7 was a 15-item mega-bundle that reproduced the v1.2.6 antipattern, collided Stripe with the founder-video messaging moment, and underweighted two-codebase deployment skew. Split into deliberate releases. v1.2.7 is now the pure Mike-response sprint. Full implementation plan: `~/.claude/plans/declarative-sparking-oasis.md`.

### Pre-work
- ✅ **Prod DB `quotes.status` CHECK constraint** — verified 2026-06-09. Live constraint allows `'draft', 'sent', 'approved', 'declined', 'completed', 'archived'` — matches `lib/types.ts` exactly. No drift. v1.3.0 Request Changes migration just needs `ALTER TABLE quotes DROP CONSTRAINT + ADD CONSTRAINT` with `'needs_revision'` appended. (Bonus: currency constraint allows `USD, CAD, EUR, CRC` — Costa Rica colón already in there.)
- **10-min `expo-print` href survival spike** — generate PDF with anchor tag, open in iOS Files / sim, tap. Cash App / PayPal use HTTPS URLs (open Safari if href survives); Venmo uses `venmo://` (needs device with Venmo). If hrefs survive → tappable claim is true. If stripped → drop the tappable-links line from release notes (anchors degrade to plain text — zero regression). Still outstanding.

### Mike's feedback items
- **Rename "Create Tier" → "Add Option"** — display strings only at `edit.tsx:1948,2071,2072,2073,2074`, `quotes.tsx:1036,1037,1038,1039`, `dashboard.tsx:988,989,990,991`, `SwipeableQuoteItem.tsx:230`. ZERO code/var/column renames. Bundle mechanics untouched. ~30 min.
- **Auto-prompt "Mark as Sent?" on quote PDF export** — `review.tsx` after `handleExportPDF:129` resolves, if status === "draft", prompt to flip to Sent. ~1h.
- **Payment methods on quote PDFs** — extract `lib/pdf.ts:560-589` payment-methods block into shared helper; wire to `generateQuoteHTML:25`; delete stale comment at line 549. ~1h.
- **Tappable payment links in PDFs** — Venmo / Cash App / PayPal anchor tags with URI schemes. Zelle / check / wire / other stay text-only. Conditional on href spike result. ~30 min - 3h.
- **Clearer in-quote status control signposting** — `edit.tsx:1068-1087` chips are already Pressable; subtle border + chevron + "Status" label. ~30-45 min.

### Bug fix from Mike triage
- **Auto-approve prompt on Quote → Contract path** — `review.tsx:445` `handleCreateContract`, before calling `createContractFromQuote`, check status. If not Approved/Completed, show *"Mark as Approved and continue?"* alert. Fixes silent-null at `lib/contracts.ts:53`. ~1h.

### Adjacent tinies (JS, low-risk, ride with the sprint)
- **Export menu locks** — `review.tsx:501-614` show all options with 🔒 prefix on tier-gated entries; tap → paywall. Same on Android Alert variant 564-612. ~45 min.
- **Duplicate-email signup UX fix** — check `data.user.identities.length === 0` after `signUp()` in `sign-up.tsx:268` (email/password) and `:214` (Google OAuth — corrected from prior :195). Show "Email already registered" with Sign In button. ~15 min.

---

## 🟡 v1.2.8 — Card payments (Pro+ feature) (~8-10h, deliberate messaging post-founder-video)

**Why deferred from v1.2.7:** Stripe charges contractors 2.9%+30¢ even at-cost; ships card payments days after the founder video's "keep every dollar / I don't touch your money" punch — optics whiplash. Defer until video moment lands, then frame deliberately: *"you asked for cards, here it is through your own Stripe account, and I still make nothing — Stripe charges their standard rate, not me."*

**Architectural rule (locked 2026-06-09):** Free contractors NEVER share a URL, link, QR, or web page with their customer. The entire web layer (Share-as-Link, `/pay/[id]`, `/q/[id]`, `/c/[id]`) is exclusively Pro+. Free's customer-facing surface is the PDF only, and the PDF stays plain text — no QR, no payment URL, no Stripe surface, nothing that points to the web. Card payments therefore become a Pro+ feature in v1.2.8, NOT an all-tier ungating like the original plan said. The Pro upgrade pitch reduces to one sentence: *"Pro unlocks your customer's web link. They tap any payment option, including card. Free contractors send a PDF — payment happens off-app via Venmo, Cash App, Zelle, or check."*

- **Stripe Connect collection — Pro and Premium** — Move Stripe Connect onboarding from Premium-portal-only to Pro+ mobile. (Premium retains portal access too.) New `lib/stripeConnect.ts` wrapper using `expo-web-browser` `WebBrowser.openAuthSessionAsync`. New screen inside existing Business Settings → Payment Collection section at `business-settings.tsx:277-297` as a sibling tile to existing Payment Methods (rename to "Other Payment Methods" for clarity). Tier-gated at mount: Free → paywall fires via `presentPaywallAndSync()`. Portal API route at `quotecat-portal/src/app/api/stripe/connect/route.ts` has no internal tier check — accept `source=mobile` param in POST body to adjust `return_url` to a mobile-friendly close-session page. Apple compliance OK (contractor's merchant account, not IAP). ~7-9h.
- **Tappable payment methods + Stripe card button on Pro+ portal pages** — On `quotecat-portal/src/app/pay/[id]/page.tsx` (lines 169-179 currently render methods as plain text), upgrade Venmo / Cash App / PayPal to real `<a href>` tags using the same URI schemes from `lib/pdf.ts:buildPaymentLink` (browsers don't strip hrefs the way `expo-print` does — they actually work on the web). Add a "Pay by Card" button that fires Stripe checkout when the contractor has Stripe Connect set up. Page reads contractor tier from the invoice/quote: Pro+ contractors → full tappable experience; if a Free contractor's invoice somehow loads (e.g., direct URL hit) → degrade to plain text (defense-in-depth, but Free contractors never have a path to share this URL in the first place). ~30-45 min portal work. Apply same pattern to `/q/[id]` (quote view) and `/c/[id]` (contract view) for consistency.
- **Free tier unchanged.** Free PDFs stay exactly as v1.2.7 ships. No QR. No payment URL. No Stripe surface. Free contractors continue to display Venmo / Cash App / Zelle / check as plain text on the PDF. The "Set up card payments" tile in Business Settings is visible to Free users but tapping fires the paywall — surfaces what they're missing without giving them the capability.
- **Documentation + marketing.** Update `docs/QUOTECAT_FEATURES.md` tier tables to mark card payments as Pro+. Update `CLAUDE.md` pricing section. Update `website/index.html` Pro card bullet to highlight "Accept card payments via Stripe (at-cost, QuoteCat takes nothing)" or similar honest framing. Founder video shouldn't need to be re-shot — its claim ("I don't touch your money") stays accurate; cards just add an optional Pro feature where Stripe charges its standard fee.

---

## 🟡 v1.2.9 — "Build your pricebook your way" (~16-19h, shared native rebuild)

**Why grouped:** all three require native rebuilds (`expo-camera`, `expo-document-picker`, `react-native-view-shot`). Share one build cycle. Coherent theme: scanner = one item at a time at the store; CSV/XLSX import = bulk from supplier extract; share card = turn audit results into reach.

- **Barcode pricebook scanner (Pro)** — `expo-camera` install. Scanner modal with reticle + 2s debounce. Header-right icon on `app/(main)/price-book.tsx`. Free→paywall gate. Add `getPricebookItemBySkuExact(sku)` to `lib/pricebook.ts` (existing substring LIKE is wrong for barcodes). Broaden `NSCameraUsageDescription` at `app.json:60` (verified — not 62). Barcode types: `upc_a, upc_e, ean13, ean8, code128, code39`. Match → existing edit modal pre-populated; no match → create modal with `sku` pre-filled. Verify: 5 consecutive scans on real device Release build, 4-of-5 in ~3s, iOS + Android Samsung Galaxy. ~7-8h.
- **CSV/XLSX pricebook import (Pro)** — `expo-document-picker` install. Move `xlsx` from devDeps to deps. New `app/(main)/pricebook-import.tsx`: file pick → parse → column-mapping UI (name, unitPrice required; sku, unitType, category, description optional) → preview → submit. Mobile uses existing `savePricebookItemsBatch`. Portal UI: new `dashboard/pricebook/import/page.tsx` — backend `POST /api/pricebook/import` route ALREADY exists (validates name + price, normalizes unit_type, 1000-item cap, row-level errors). Mobile ~3-4h + Portal ~1-2h. Pro+ gating. Pairs with future Kendall partnership for negotiated-pricing imports.
- **Strava-style shareable Pricing Health Check card (Pro)** — `react-native-view-shot` for HTML-to-image. New `components/HealthCheckShareCard.tsx`: anonymous (no client names), shows flagged count + lost profit + window + QuoteCat branding. Share button on `pricing-health-check.tsx` after hero card at line 271. Data fields from `analyzeQuoteHealth()`. Verify on iOS + Android, iMessage + WhatsApp + native share sheet. ~4-5h.

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
- **Request Changes (full threaded version) — v1.3.0** — earlier "lite" version was deferred during the v1.2.7 re-scope; instead of shipping lite + full separately, ship the proper threaded version directly in v1.3.0. Proper conversation log: threaded back-and-forth on each quote/contract, contractor replies inline, full timeline with timestamps, history preserved across revisions. Schema: `needs_revision` in quote + contract status enums; `quote_revisions` / `contract_revisions` tables for history; `client_notes` no longer needed as standalone column. Push notification on each new client message. Critical to coordinate portal-mobile deploy (feature flag on portal until mobile builds approved). Two-codebase coordination — accept full QA cost. ~14-18h.
- **Standalone contract creation + read-only lock on signed contracts — v1.3.0** — "Start a New Contract" entry in Contracts tab opens the quote form in contract-creation mode (`?mode=contract-creation` route param); save atomically creates the underlying quote + contract pair. Architectural rule: every contract has an underlying quote, always. Quote stays visible in Quotes tab with a "Contract" chip on row. Read-only lock when contract has signatures attached (signed contract edit would invalidate signature). Removes the dead-end at `app/(main)/(tabs)/contracts.tsx:165-167` ("You need an approved quote first"). ~3-4h.
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

2026-06-09 — v1.2.7 Mike-response sprint:

- All 8 v1.2.7 items shipped — commit `b65165d` (feature work) + `53273a0` (v1.2.8 lock + EAS build-number bumps)
- iOS build 212 submitted to App Store Connect (TestFlight processing)
- Android versionCode 59 submitted to Google Play Internal track (manual promotion to Production pending)
- v1.2.7 scope: "Create Tier" → "Add Option" sweep, auto-Sent prompt after PDF export, payment methods on quote PDFs, auto-approve prompt on Quote→Contract (fixes silent createContractFromQuote null), tappable payment URL scheme codepath (expo-print verified to strip hrefs — falls back to plain text), status chip "Tap a status to update" hint, export menu locks for tier upsell, duplicate-email signup detection
- Key strategic decision locked: Free contractors NEVER share URLs/links/QR/web pages with customer. Web layer is exclusively Pro+. v1.2.8 reframed: card payments become Pro+ feature, not all-tier ungating

2026-06-05:

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
