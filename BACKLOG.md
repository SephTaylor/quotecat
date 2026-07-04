# QuoteCat Backlog

**Canonical "what's left" index across the QuoteCat ecosystem.** One scannable list. For full design context on any item, drill into the linked source file.

**Last updated:** 2026-07-04 (v1.2.17 shipping — Mike-feedback fixes + CO discoverability)
**Sources merged:** prior BACKLOG.md, `FOLLOWUPS.md`, `CLAUDE.md`, portal plan-review system, this session's conversation, code-level TODOs.

---

## 🚨 Needs your verification (status uncertain)

Items where I think the work might already be done but couldn't auto-verify. **Please confirm status — if shipped, move to "Done" section.**

- [ ] **Marketing copy ↔ card payments alignment** — was deferred 2026-06-23 pending `card_payments_enabled` flag flip. Card payments *did* ship in v1.2.9. Need to verify (a) the flag is flipped in prod, (b) the homepage / FAQ / tier cards / llms.txt sweep was executed. If flag is still off, remains blocked; if flipped without the sweep, still open.
- [ ] **Portal Stripe webhook handler for marketing-site subscriptions** — significant portal work landed since (`531fc7c` split Connect events, `575f8e2` dedicated /webhook/payments). Verify `PRICE_TO_TIER` map refresh, invite flow for new marketing-site customers, welcome email. May or may not be fully done.
- [ ] **`@types/uuid` Tier 1 item** — was rolled back June 2 due to uuid major-version jump. Re-attempt when convenient.
- [ ] **CLAUDE.md drift items (8 stale claims)** — Tier 1 audit item. Includes "all data local" misleading, Drew tier gating, xByte status. Some may have naturally corrected via later doc passes.
- [ ] **Wyatt + Drew TestFlight → public App Store transition** — was operational pending Apple review at v1.2.6. Multiple public releases have shipped since (v1.2.7 → v1.2.17). Presumed done.
- [ ] **`1modernrelic@gmail.com` undiscovered 9th paid user** — FOLLOWUPS.md notes as "resolved" in body text but item still listed under "Open." Confirm and move.
- [ ] **Sentry source maps upload** — status unknown. Confirm whether ever configured. If not, still ~15 min config.

---

## 🟠 Tomorrow / near-term

- **Credential rotations** — Stripe secret (was pasted into a Claude chat 2026-04-28), .env-in-git-history keys (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`), orphaned `sk_live_...NZXG` unused since Jan 17. Rotate systematically. Full procedure at `FOLLOWUPS.md:232-262`.
- **Post-1.2.17 verification pass** — TestFlight processing + Play Console internal delivery for build 226/73 (Mike fixes) and build 227/74 (CO empty state). Confirm both land, notify Mike so he can test the Edit Item fix.
- **Mike's Billing Workflow (v2) plan — awaiting sign-off** — refined answers on Q1 / Q2 / Q3 pushed to portal 2026-07-04 (`fbc42a6`). Mike has been messaged. Once he confirms the direction, unblocks the CO buildout below.
- **Assembly sync RLS root cause** — this session diagnosed the sync error as account-switch data collision (previous user's data in local SQLite colliding with new user's session). Deferred fix, but worth investigating post-launch. Related to the "User Data Isolation on Account Switch" note in CLAUDE.md.

---

## 🎯 Billing Workflow buildout (post-Mike-signoff)

The manual Change Order flow Mike approved in Billing Workflow (v2). Blocked on his sign-off of the three refined questions. Once he says go:

- **Manual "+ New Change Order" flow** (the actual code for the plan). First-class CO creation on approved quotes (Pro+) and contracts (Premium). New CO builder form: description, amount, optional line items, optional schedule. Not diff-triggered — user-initiated.
- **Complete button on CO detail view** — implementing the "Bill in full when complete" default. Tap Complete → "Send $X invoice for CO 1000.1?" → one confirm fires the invoice.
- **Nested CO numbering** — 1000.1 → 1000.1.2 → 1000.1.2.3. Auto-assigned, no cap. Per-CO cost tracking for job-costing.
- **CO-level payment schedules** — each CO can carry its own optional schedule independent of the parent contract's schedule.
- **Per-CO signatures** — same dual-signature flow as the parent contract, portal handoff, Sign / Decline / Request Changes on the customer end.
- **Schedule amendment flow** — Required Acknowledge by default with 7-day contractor override ("confirmed via phone / email / in-person" + text note). Light "Schedule Amendment" affidavit for larger amendments.
- **Delete auto-detect CO flow** — after manual create ships, decide whether to keep the current diff-triggered auto-detect flow or scrap it (my rec: scrap; contractors should be actor, not app).
- **GC middleman contact-copy** — "Notify additional contacts on amendments" field on contract; contractor copies both GC and end customer. Backlog per Mike's Q1 comment. Not v1.3, don't lose it.

---

## 🎯 Mike's other plans (in review or awaiting review)

- **Multi-User Workflow plan** (`portal/src/app/plan/multi-user-workflow`) — Tech + Worker roles. Foreman-assembles / Owner-approves. Magic-link Worker portal (no app install). Mike has not been assigned yet — invite via `plan_reviewers` table when ready.
- **Job Costing (v2) plan** (`portal/src/app/plan/job-costing`) — PO numbering, actuals-vs-estimated, margin as trend + anomaly detector, mileage. Mike is assigned (his index shows 12/11 orphans from v1 pre-rewrite — expects re-review).

---

## 🌱 Onboarding / activation follow-ups (from this session)

FTU refactor shipped in v1.2.16. These are the promised "later" pieces:

- **Contextual prompts at moments of relevance** — first quote save → prompt for company name; first PDF generation → prompt for logo with tier-aware copy ("PDFs stay QuoteCat-branded until Pro"); first gray margin indicator → prompt for overhead.
- **Free-tier logo upload** — UX-only change. `lib/pdf.ts` already supports via `includeBranding` flag. Logo shows in app UI; PDF stays QC-branded until Pro. This session confirmed the plumbing exists.
- **Animated app-tour intro** — nice-to-have. SVG paths + Reanimated drawing lines between features on first launch. "Some day" per the conversation.
- **Nudge users toward the setup card** — if activation numbers still lag after FTU refactor deploy, next lever is a hint on the dashboard or firing contextual prompts.

---

## 🌱 Planned strategic features (from prior BACKLOG, still open)

- **v1.3.0 scheduling** — mobile personal calendar + portal team dispatch. Pro mobile gets agenda view; Premium portal gets drag-drop dispatch calendar with realtime. Portal `CalendarView.tsx` already exists; mobile is greenfield (~13-16h). Closes biggest competitive gap per `docs/COMPETITOR-ANALYSIS.md`.
- **Standalone contract creation + read-only lock on signed contracts — v1.3.0** — "Start a New Contract" entry in Contracts tab opens the quote form in contract-creation mode; save atomically creates the underlying quote + contract pair. Read-only lock when signatures attached. Removes the "You need an approved quote first" dead-end. ~3-4h.
- **Industry Mode (Trades vs Services) + Spanish i18n combined feature** — adds `profiles.industry` enum + `react-i18next` + locale picker. Ships in same release as xByte re-enablement. ~2-2.5 weeks. (`FOLLOWUPS.md:31-100`)
- **Pricing Foundation Setup (App + Portal)** — guided onboarding combining Overhead Calculator + Labor Rate Calculator + target margin into one flow. Synced between mobile and portal. 🎯 NEAR-TERM. Partially unblocked — v1.2.16 SetupProgressCard already deep-links to these calculators.
- **AI Business Performance Coach** — Premium scoring + personalized advice via Claude. 🎯 NEAR-TERM. (`CLAUDE.md` Future Feature Ideas)
- **Contract type selector (Premium, v1.4+)** — fixed-price, cost-plus, T&M, GMP, unit-price. Type-specific templates + calculation logic + margin checks. On-thesis: picking the right contract type IS a financial-intelligence decision.
- **Unified `/client/{token}` portal — single-view multi-document client experience (v1.5+)** — one portal per contractor-client relationship instead of separate magic links for each quote/contract/invoice. `add_client_tokens.sql` migration exists.
- **Per-team-member "views" (v1.4+)** — owner-configurable custom dashboards per role/user. Captured at `quotecat-portal/docs/office-role-plan.md`.

---

## ⚡ Portal performance backlog

- **NotificationBell polling reduction** — currently 3 queries every 2 min per active user. Options: interval bump to 5 min, single Postgres RPC, Supabase realtime subscription. ~30 min / 2h / 3h.
- **Detail pages RSC conversion** — `invoices/[id]`, `contracts/[id]`, `profitability`, `messages` marked `'use client'`. Split into server-rendered shells + client islands. ~1-2h each, ~200-400ms LCP improvement per page.
- **Lazy-load `lib/pdf.ts` + `html2pdf.js` via `dynamic()`** — drops main bundle by ~150-200KB. ~1h.
- **`pay/[id]` perf** — 2 sequential queries (invoice → profile). Second depends on first's `user_id`; needs PostgREST embedded select. Revisit with confidence around the right syntax.
- **Option B portal gating: middleware migration** — long-term arch fix. Move tier check from layout to Next.js middleware; zero Supabase queries in layout-render. ~1-2 days.
- **Portal site perf audit pass (broader)** — Lighthouse on `/dashboard`, iterate. ~2-4h.

---

## 🧹 Marketing site

- **Sweep beyond `index.html` for stale claims** — `faq.html`, `support.html`, `privacy.html`, `terms.html` not re-checked in the last card-payments truth-up. Grep patterns: "keep 100%", "2.9%", "100 spots", "Priority phone support". 15-30 min.
- **v1.2.13 → v1.2.17 marketing beats** — homepage / features / release-notes for the string of releases. Screenshot pipeline refresh already done for v1.2.12; extend for FTU + Add to Calendar + margin polish.
- **Premium card update post Office Staff ship** — unlimited office staff seats line once feature lives. (`quotecat-portal/docs/office-role-plan.md`)
- **Workers vs Techs vs Office Staff explainer** — info-tooltip pattern on Premium card once Office Staff ships.

---

## 📊 Data & analytics

- **Startup Kit welcome email** — fires on email confirmation or Apple/Google OAuth signup. Resend transactional with kit PDF link. `welcome_kit_sent_at` column on profiles for idempotency. ~5h standalone.
- **PostHog dashboards for v1.2.15 conversion funnel** — event instrumentation shipped (nudges, first-quote congrats, PDF-limit). Insights saved this session. Watch trends.
- **Drift #2: partial-invoice analytics design** — "Cash collected vs Completed jobs only" toggle. Mobile + portal coordinated. Both currently have inconsistent behavior on `percentage < 100` invoices. Affects only analytics surfaces.
- **Sentry instrumentation expansion** — pipe `trackEvent(ERROR_OCCURRED)` from sync/RevenueCat/Drew/auth catch blocks to Sentry — currently swallowed silently. ~1h.

---

## 🌱 Future ideas (not scoped, sorted by area)

From `CLAUDE.md` "Future Feature Ideas" section. Listed for navigability; defer scoping until product signal warrants.

### Quotes
- Supplier Price Trend Alerts (uses weekly xByte data for "Home Depot raised lumber 8% this week")
- Time & Materials quoting (T&M alongside flat-rate)

### Invoices
- Payment reminders for overdue invoices — partially shipped (Pro+ has `sendInvoiceReminder`). Auto-send intervals still future.
- Payment Reminders auto-cadence (3/7/14 day intervals)

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
- Hybrid state machine (Phase 2) — server-side flow + Claude for personality only. ~60-70% additional cost reduction after prompt caching (which is already live). See CLAUDE.md "Current Work: Drew Quote Wizard" section.

### Analytics
- Win Rate Dashboard (with tier-group bundle handling — approved bundle = 1 win, all declined = 1 loss)

### Integrations & Marketplace
- Local Supplier Network — self-service supplier portal for catalog uploads (Phase 2/3)
- xByte real-time supplier pricing — deferred; not the moat. Manual entry + custom pricebook covers most contractors.

### Growth
- Regional Expansion Referral System — unique referral codes, threshold-based subscription extensions (6 Pro subs in a region → notify + auto-extend referrer 2 months)

### Onboarding messaging
- "Double-counting overhead" differentiator — most contractors on spreadsheets or other apps build overhead into labor rate AND deduct it again. QuoteCat does it right. Messaging opportunity in Overhead Calculator completion, first profit indicator, marketing.

---

## 🔧 Technical debt / hygiene

From `docs/codebase-health-audit-2026-06-01.md` (still mostly accurate):

### Tier 1 (low effort, high impact)
- ✅ `calculateQuoteTotals` duplication — shipped `fed5c8a`
- ✅ Delete `_old/` directory — shipped `6e57200`
- ⏳ `@types/uuid` addition — needs careful uuid-version handling (see "Needs verification" above)
- ⏳ CLAUDE.md drift items — 8 stale claims to update

### Tier 2 (~half to full day)
- Get TypeScript back to 0 errors — currently ~24 pre-existing errors in portal, some in mobile too (surfaced during this session's typechecks). ~4-6h.
- Decide `expo-dev-client` location — ~30 min decision
- Fix the 5 performance smells — ~2-3h

### Tier 3 (~2-3 days)
- Split `lib/database.ts` into domain files (`quotesDB.ts`, `invoicesDB.ts`, etc.)
- Extract `useInvoiceForm` hook (mirror `useQuoteForm`)
- Extract `useDashboardState` hook
- Unify calculation source of truth (one canonical `lib/calculations.ts`)
- Build `lib/syncManager.ts` orchestrator (replaces ad-hoc cooldown duplication)
- Audit the portal codebase with same 3-D sweep (architecture/bloat, duplication/dead code/stale docs, TS/deps/perf) — ~1 day.

### Tier 4 (longer-term)
- Remove `as any` escape hatches at cloud-data ingress; add Zod or similar runtime validation
- Decide Drew tier gating (currently inconsistent)
- Decide xByte fate (finish OR delete + update CLAUDE.md)
- Add smoke-test layer for calculation pipeline (PDF totals vs invoice totals vs dashboard totals must agree)

---

## 🔐 Subscription & auth hygiene

From `FOLLOWUPS.md`:

- **Phase 2 cleanup of `profiles` Stripe columns** — after new `subscriptions` flow verified, drop `profiles.stripe_customer_id` and `profiles.stripe_subscription_id`. Update `delete-account/index.ts:81` reads.
- **`presentPaywallAndSync` race window** — fixed 2-second sleep → poll-with-timeout (500ms × up to 10s). Defer until race fires in production.
- **Optional `webhook_events` audit table** — for event-level debugging beyond RC/Stripe dashboards.
- **`STRIPE_*_PRICE_ID` env vars cleanup** — 4 Supabase secrets not referenced in current edge function code. Verify unused, delete.
- **Stripe `incomplete` status mapping verification** — post-launch declined-card test.
- **Stripe `paused` status mapping** — revisit if/when seasonal pause-and-resume is used.
- **Alert on `rc_webhook_orphan_user` logs** — post-launch monitoring.
- **GoTrue admin DELETE bug for legacy users** — recovery procedure documented (SQL fallback). Worth investigating with Supabase support.
- **Apple grace period (`in_grace_period` status)** — if users start losing access prematurely during failed renewals, add enum value and handle `BILLING_ISSUE` event.
- **Reconcile Supabase migration tracking table** — most migrations applied via SQL editor, not recorded in `schema_migrations`. `npx supabase db push` fails. Fix: `migration repair --status applied` per version.
- **Smoother Google Sign-In: migrate from `expo-auth-session` to `@react-native-google-signin/google-signin`** — repeat sign-ins become "Continue as user" with one tap. ~half-day.

---

## 🛒 Portal-specific

- **"Buy more seats" CTA only routes to 5-pack** — single-pack option exists but button doesn't expose it. ~30 min.
- **Change Orders sync from mobile → portal** — mobile has COs working locally; portal doesn't render them. Schema gap. Plan: `docs/CHANGE-ORDERS-SYNC-PLAN.md`. Blocked until manual CO flow ships (this backlog's Billing Workflow buildout section).

---

## 💻 Code-level TODOs found in source

| Location | Comment |
|---|---|
| `lib/analytics.ts:49` | `TODO: Send anonymous analytics if user opted in` |
| `lib/analytics.ts:138` | `TODO: Implement when ready for cloud analytics` |
| `lib/pricebookMatching.ts:20` | `TODO: Performance optimization for large pricebooks (1000+ items)` |
| `modules/settings/index.ts:13` | `TODO: later read from persistence / profile` |
| `quotecat-portal/src/app/api/twilio/webhook/route.ts:195` | `TODO: use contractor's timezone` |

Deprecation aliases (kept for back-compat, clean up during a refactor cycle, not piecemeal):

| Location | Comment |
|---|---|
| `lib/teamMembers.ts:107,110,113` | 3 `@deprecated` function aliases (`getTeamMembers`/`getTeamMemberById`/`searchTeamMembers`) |
| `lib/wizardApi.ts:455` | `@deprecated Use searchCatalog instead for large catalogs (30k+ products)` |
| `lib/browser.ts:66` | `@deprecated Use openProductSearch instead — direct URLs are blocked by retailers` |
| `lib/reminders.ts:498` | `@deprecated Use getCloudNotifications instead` |
| `lib/database.ts:2135` | `@deprecated Use searchProductsFTS instead` |
| `modules/assemblies/storageSQLite.ts:157` | `@deprecated Use clearDeletedAssemblyId for individual tombstones` |

---

## ✅ Recently shipped (July 2026)

**2026-07-04 — v1.2.17 (Mike-feedback + CO discoverability):**
- Custom Item edit modal — KeyboardAvoidingView so Save stays above numeric keypad; outside-tap dismisses keyboard, not modal (Mike bug report on v1.2.14). Commit `0f1f99a`.
- WorkerPickerModal — "New" label next to + icon + prominent "Add a new worker" CTA in empty state (Mike discoverability). Commit `0f1f99a`.
- ChangeOrderList empty state on approved Pro+ quotes with "Edit quote to add a change" button. Fixes the Pro-feature-invisibility bug. Commit `204560f`.
- Two builds shipped: 226/73 (first two fixes), 227/74 (bundled all three).

**2026-07-04 — Portal plan-review counter fix + refined answers:**
- Filter counters by current registry section keys — v1 orphaned rows no longer inflate "answered" counts. Commit `c163773`.
- Refined answers to Mike's Q1/Q2/Q3 pushed as three new sections on the change-orders (Billing Workflow v2) plan. "New since you reviewed" amber banner at top. PLAN_REGISTRY updated. Commit `fbc42a6`.

**2026-07-02/03 — v1.2.16 (FTU refactor):**
- DashboardHeroCard (first-run "Start your first quote" CTA that hides once user has any quote/invoice). Session-dismissable.
- SetupProgressCard (non-blocking, collapsible 4-step setup checklist replacing the old blocking Modal wizard). Session-dismissable. Starts collapsed so hero owns primary attention.
- QuotesEmptyState (three variants: start / filtered / followup) with big orange first-quote CTA.
- Dashboard "Welcome back!" + "business overview" filler removed. Sync indicator survives as a small right-aligned line.
- Blocking OnboardingFlow.tsx deleted entirely.
- Commits: `8f4b371`, `7d4af23`.

**2026-07-02 — v1.2.15 (Add to Calendar + conversion nudges + polish):**
- Add to Calendar on quotes and contracts (one-tap .ics handoff to native calendar; contractor time-management, no portal or tier gating).
- First-quote celebration modal with Unlock Pro CTA + features preview.
- PDF-limit nudge with next-reset date and Unlock Pro path.
- Materials markup $-impact tooltip on quote edit.
- iOS 18 header pill flicker fix (quote review, contract edit, contract sign, assembly calculator).
- Assembly-sync tier gate to stop RLS errors on Free tier.
- Quote work-date persistence through SQLite (schema v20) + Supabase (migration 033).
- In-app review prompt (`expo-store-review`) after quote-approved win moments. ~3-day install guard, 90-day between-prompt guard, 2-win minimum.
- Analytics: FirstQuoteNudge / PdfLimitNudge shown / upgrade tap / dismiss events. Marketing-site `calculator_engaged`, `app_store_click`, `cta_clicked`, `page_scroll_depth` 25/50/75/100.

**2026-06-2X — v1.2.14 (contract workflow redesign + foreground sync + Request Changes):**
- Linear contract status flow with one rollback (Revert to Draft clears sigs).
- Morph primary action button (Sign / Send / Share / Complete).
- Read-only status badge.
- Customer Decline + Request Changes channel from portal.
- Foreground sync.
- Triggered by Mike Kane's beta feedback.

**2026-06 — v1.2.13 (quality release):**
- Dark-mode fixes across the app.
- Signature UX polish.
- Financial-intelligence polish (margin indicator, target margin flow).

**2026-06 — v1.2.12 (IAP + screenshot pipeline):**
- Subscription / Manage Account refactor (structural commit `9535c1f` + IAP follow-ups `375168d`, `bca4eac`).
- RC re-alias on every paywall/restore.
- Instant tier propagation post-purchase (no sign-out/in needed).
- Refreshed screenshot pipeline: 10 framed PNGs at 1284×2778, financial-intelligence story arc.

**2026-06 — v1.2.9 → v1.2.10 (card payments + version cleanup):**
- Card payment acceptance for Pro+ contractors via Stripe Connect. Mobile in-app onboarding. QuoteCat takes no cut; Stripe charges standard processor fee.
- Portal v1.2.9 ungate + Connect events split (`531fc7c`, `575f8e2`).
- Hotfix v1.2.9.1 → v1.2.10 clean 3-part version.

**Portal since 2026-06-09:**
- Plan review system built (`88ea3c2`, `ad2e2db`, `b7cd6be`, `8430c5f`).
- Plans v2: Billing Workflow + Multi-User + revised Job Costing (`818346a`, `2898b92`, `f6d9bbf`).
- Mike v1 wrap-up preserved as read-only context (`2898b92`).
- Contract Decline + Request Changes UI (`8fffad4`, `eb0457e`).
- Netlify Node 22 cutover + Netlify plugin bump + Stripe error revert (`81d3265`, `7717671`).
- Stripe webhook Connected events endpoint split (`531fc7c`, `ffcaa78`, `032ff78`).
- Contract fetch dedupe + fire-and-forget viewed update (`853e1b7`).

---

## How to maintain this file

- **Add** items at the top of their bucket as they're discovered. Cite source.
- **Move** items to "Recently shipped" with commit hash when done.
- **Re-validate** the "Needs verification" section first whenever this file is consulted — that's where confusion lives.
- **De-duplicate** when items appear in multiple sources. Canonical pointer goes to the most-detailed source.
- **Don't re-explain** items here when their detail lives in FOLLOWUPS.md or a `docs/*-plan.md`. Link to them.
