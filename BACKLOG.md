# QuoteCat Backlog

**Canonical "what's left" index across the QuoteCat ecosystem.** One scannable list. For full design context on any item, drill into the linked source file.

**Last updated:** 2026-06-09 (v1.2.8 shipped to ASC + Play Internal; v1.2.7 fully live on both stores)
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
- **🚨 Netlify Node 22 cutover (by 2026-06-16)** — `quotecat-portal/netlify.toml` pins `NODE_VERSION = "20"`. Netlify is forcing system Node 22 on June 16, after which `@netlify/plugin-nextjs` won't run on the old version. Fix: bump to `"22"` and push. ~2 min. Surfaced during v1.2.9 deploy 2026-06-12.
- **Revert verbose Stripe error message before live launch** — `quotecat-portal/src/app/api/stripe/connect/route.ts` currently returns the raw Stripe SDK error message in 500 responses (commit `0fab2f7`, 2026-06-12). Added to diagnose the v1.2.9 sim sandbox auth flow. Fine in test mode; in live mode leaks internal detail to client-facing UI. Revert to the generic "Failed to create Stripe account" response before flipping `card_payments_enabled=true`. ~2 min.
- **Netlify plugin-nextjs bump** — `@netlify/plugin-nextjs@5.15.3` is outdated; latest is `5.15.11`. Patch versions, non-breaking. Bump in `package.json`, redeploy. ~5 min. Pair with the Node 22 cutover above.

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

**Approved scope after web Claude peer review (2026-06-09):** original v1.2.7 was a 15-item mega-bundle that reproduced the v1.2.6 antipattern, collided Stripe with the founder-video messaging moment, and underweighted two-codebase deployment skew. Split into deliberate releases. v1.2.7 is now the pure Mike-response sprint. Full implementation plan: `~/.claude/plans/declarative-sparking-oasis.md`.

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

## 🟡 v1.2.9 — Card payments (Pro+ feature) (~9-12h, ships exactly 2 weeks post-founder-video)

> **Renumbered 2026-06-09:** was v1.2.8; user chose to pull pricebook power-up forward as the next release. Card payments now sit behind it in the queue. Founder-video timing discipline still holds — v1.2.9 ships 2 weeks after the video drops, not based on v1.2.8 timing.

**Why deferred from v1.2.7:** Stripe charges contractors ~2.9%+30¢ (Stripe's fee, not ours). Ships card payments too close to the founder video's "keep every dollar" punch and the optics get muddied — even though the claim stays accurate, the audience hasn't had time to absorb it. Defer 2 weeks past the video drop (fixed delay, not a "measure when the moment lands" vibe — that's ungameable). Use the gap to prepare the deliberate framing instead of trying to time the social signal.

**Brand framing (locked 2026-06-09 after web Claude peer review):** *"QuoteCat never takes a cut of any payment, ever. The no-fee methods — Zelle, cash, check — are there for everyone. Card always carries a processor fee (Stripe's, not ours); a couple of other methods can too."* This is the honest version of what was originally "card is the only thing that costs money" — Stripe's fee comes out of what the contractor receives (they get ~97% of card payments), not what the customer pays; and Venmo G&S / PayPal G&S / Cash App Business all carry seller fees too depending on how the contractor configures them. Use this framing verbatim in BACKLOG justification, in-app copy, release notes, and the proactive video follow-up note. **Core story:** Free tier = the genuinely-free path (Zelle / cash / check, plus optional configuration of fee-bearing methods at the contractor's discretion). Card = the paid convenience that always carries a processor fee.

**Architectural rule (locked 2026-06-09):** Free contractors NEVER share a QuoteCat-hosted URL, link, QR, or web page with their customer. The entire web layer (Share-as-Link, `/pay/[id]`, `/q/[id]`, `/c/[id]`) is exclusively Pro+. Free's customer-facing surface is the PDF only — no QR, no payment URL, nothing pointing to QuoteCat. Card payments therefore become a Pro+ feature.

**Strategic fork named explicitly (per web Claude 2026-06-09):** Two coherent strategies exist for card payments:
- **Strategy A (LOCKED) — Card is the Pro hook.** Stripe Connect available only to Pro+. Free has no path to card payments. Bundles cleanly with the Pro web-surface upgrade.
- **Strategy B (rejected, named for honesty) — Card universal via Stripe-hosted Payment Links.** Stripe Payment Links (`pay.stripe.com/...`) live on Stripe's domain, NOT QuoteCat's. A Free contractor could put a Stripe Payment Link on their PDF and accept cards without ever touching a QuoteCat-hosted page. The Pro hook would then be the unified web experience (tappable methods, status sync), not card access itself. Coherent but rejected because it puts more support surface on QuoteCat for less differentiation.

**Signals to watch post-launch (revisit Strategy A if either fires):**
- Free→Pro conversion rate (quantitative, PostHog) — if it doesn't move on this release
- Qualitative sentiment from Mike + support inbox + user feedback for "I lost a client because I couldn't take cards" — approximate signal, not dashboard-able, but real

### Scope

- **Stripe Connect collection — Pro and Premium** — Move Stripe Connect onboarding from Premium-portal-only to Pro+ mobile. (Premium retains portal access too.) New `lib/stripeConnect.ts` wrapper using `expo-web-browser` `WebBrowser.openAuthSessionAsync`. New screen inside existing Business Settings → Payment Collection section at `business-settings.tsx:277-297` as a sibling tile to existing Payment Methods (rename to "Other Payment Methods" for clarity). Tier-gated at mount: Free → paywall fires via `presentPaywallAndSync()`. Portal API route at `quotecat-portal/src/app/api/stripe/connect/route.ts` has no internal tier check — accept `source=mobile` param in POST body to adjust `return_url` to a mobile-friendly close-session page (no `app.json` deep-link scheme needed). Stripe **Checkout** (not Elements) for the card-pay flow — solo dev shouldn't build custom PCI UI; revisit only if conversion data demands it. Apple compliance OK (contractor's merchant account, not IAP). Pro and Premium get identical card capability — no artificial Premium-only card perk (Premium's differentiator is contracts + team management, not cards). ~6-7h.
- **Tappable payment methods + Stripe card button on Pro+ portal pages** — On `quotecat-portal/src/app/pay/[id]/page.tsx` (lines 169-179 currently render methods as plain text), upgrade Venmo / Cash App / PayPal to real `<a href>` tags using the URI schemes from `lib/pdf.ts:buildPaymentLink` (browsers don't strip hrefs the way `expo-print` does — they actually work on the web). Add a "Pay by Card" button that fires Stripe Checkout when the contractor has Stripe Connect set up + the launch feature flag is enabled (see deployment-skew note below). Apply same pattern to `/q/[id]/QuoteView.tsx`, `/q/[id]/TierGroupView.tsx`, `/c/[id]/ContractView.tsx`. Page reads contractor tier from the invoice/quote/contract — Pro+ → full tappable; if a Free contractor's record somehow loads → degrade to plain text (defense-in-depth, but Free never has a path to share these URLs in the first place). ~45 min - 1h portal work.
- **🚨 Deployment-skew mitigation (CRITICAL — web Claude catch 2026-06-09)** — Portal deploys instantly when merged; mobile is gated behind Apple review (24-48h, possibly weeks if rejected). Without a feature flag, the portal's new "Pay by Card" button + tappable hrefs go live BEFORE Pro contractors have a mobile path to enable Stripe Connect (the portal dashboard is Premium-only, so Pro contractors literally have no setup surface until mobile lands). **Fix:** add a `card_payments_enabled` boolean flag (env var or a single row in a `feature_flags` table, your call). Portal Pay-by-Card button + tappable hrefs render only when the flag is true. Flip the flag *after* the mobile build is approved AND propagating to TestFlight / production. ~10 min portal work + the discipline to not flip the flag early. This is the same shape as the Request Changes deployment skew we flagged in v1.2.7 planning — don't repeat the mistake.
- **Locked "Card Payments (Pro)" tile in mobile Business Settings** — Visible to Free with parenthesized tier suffix; tap fires `presentPaywallAndSync()`. Same upsell pattern as v1.2.7 export menu locks. Reinforces upgrade story without exposing capability. ~30 min.
- **Stripe support FAQ / help-doc (NEW — web Claude catch 2026-06-09)** — More Pro+ contractors onboarding to Stripe = more "payout didn't arrive," "verification failed," "1099-K showed up," "dispute came in" questions hitting the support inbox. Stripe handles the actual compliance/processing, but the volume of "I don't know if this is QuoteCat or Stripe" tickets goes up. Prep a help-doc *before* launch with top 5-7 questions + clear "Stripe handles this (contact them at...)" vs "QuoteCat handles this (here's where...)" routing. ~1h. Saves real triage time later for solo-dev support load.
- **Proactive video follow-up note (NEW — web Claude catch 2026-06-09)** — Goes on the same channel as the founder video, ~2 weeks after the video drops, on or just before v1.2.8 launch. Two paragraphs max. Owns the addition loudly instead of hoping no one connects the dots — that's a trust win, not damage control. Draft (use the locked brand framing verbatim):
  > *"You asked about cards. Here's how I think about it: QuoteCat still takes nothing on any payment, ever. The no-fee methods — Zelle, cash, check — are there for everyone. Card always carries a processor fee (Stripe's, not ours); a couple of other methods can too. Card is in if you need it. Most QuoteCat contractors will never enable it because Venmo and Zelle handle the job — and that's the point."*
- **Google OAuth duplicate-email check** — Ride-along investigation only if scoped to <30 min and self-contained. The v1.2.7 fix patched the email/password `signUp` path; OAuth uses `signInWithIdToken` which surfaces duplicate-account-via-different-provider conflicts differently. Skip if it pulls into a broader auth refactor.
- **Documentation + marketing** — Update `docs/QUOTECAT_FEATURES.md` tier tables to mark card payments as Pro+. Update `CLAUDE.md` pricing section. Update `website/index.html` Pro card bullet using the locked brand framing (no "keep 100%" absolutism — that's the v1.2.6 falseclaim we already truthed-up).
- **Free tier unchanged.** Free PDFs stay exactly as v1.2.7 ships. No QR. No payment URL. No Stripe surface on the PDF. Free contractors continue to display Venmo / Cash App / Zelle / check as plain text on the PDF. The "Card Payments (Pro)" tile in Business Settings is visible to Free users but tapping fires the paywall.

### Locked decisions from web Claude peer review (2026-06-09)

| OQ | Decision |
|---|---|
| OQ2 — Timing measurement | Fixed 2 weeks post-video. Don't try to measure "moment landed." |
| OQ3 — Stripe Elements vs Checkout | Stripe Checkout. Solo dev should not build custom PCI UI. |
| OQ4 — Mobile return-URL | `?source=mobile` query param + thin close-session page. No `app.json` changes, no deep-link scheme. |
| OQ5 — Pro vs Premium card differentiation | Identical for both. No artificial Premium-only card perk. Premium's diff stays contracts + team. |
| OQ6 — Video follow-up | Proactive note required, ~2 weeks post-video, locked brand framing verbatim. |
| OQ7 — Google OAuth dup-email | Ride-along investigation only if <30 min and self-contained. |

---

## 🟡 v1.2.8 — "Build your pricebook your way" (~16-19h, shared native rebuild)

> **Pulled forward 2026-06-09:** was v1.2.9; user opted for fast push past v1.2.8 card payments (which needs the founder-video timing window). Pricebook power-up is the next release. Coherent three-feature theme + one native rebuild covers all three.

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

2026-06-09 (late) — v1.2.8 "Build your pricebook your way":

- CSV/XLSX pricebook import (mobile + portal) — commit `99ee695` (mobile) + `070e8e5` (portal)
- Barcode pricebook scanner with exact-SKU lookup + SKU as first-class form field — commit `cf9b76d`
- Strava-style shareable Pricing Health Check card (anonymous, 600×600 PNG via react-native-view-shot) — commit `8b20528`
- Dashboard widget for Pricing Health Check (Pro+, default-on, dismissable) — commit `a6bdf72`
- Perf: lazy-loaded expo-camera (BarcodeScannerModal) + xlsx (only loads for XLSX files) — commit `8b20528`
- iOS build 213 submitted to App Store Connect (TestFlight processing)
- Android versionCode 60 submitted to Google Play Internal track (manual promotion pending)
- All four features verified in iOS sim; barcode scanner specifically still needs real-device 4-of-5 UPC decode verification before public release

2026-06-09 (earlier) — v1.2.7 Mike-response sprint, both stores fully live:

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
