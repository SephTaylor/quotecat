// QuoteCat Complete Feature Reference - Typst Document
// Brand colors: Orange #F97316, Dark #1a1a1a, Light #f5f5f5

#set page(
  paper: "us-letter",
  margin: (x: 0.75in, y: 0.85in),
  fill: rgb("#1a1a1a"),
  header: align(right)[
    #text(fill: rgb("#666666"), size: 9pt)[https://quotecat.ai]
  ],
  footer: align(center)[
    #text(fill: rgb("#666666"), size: 9pt)[
      © 2026 QuoteCat. All rights reserved.  ·  Page #context counter(page).display()
    ]
  ]
)

#set text(
  font: "Helvetica Neue",
  fill: rgb("#f5f5f5"),
  size: 10pt
)

#set par(justify: false, leading: 0.6em)

#set heading(numbering: none)

#show heading.where(level: 1): it => {
  v(0.35in)
  block(
    width: 100%,
    fill: rgb("#F97316"),
    inset: (x: 12pt, y: 10pt),
    radius: 4pt,
    text(fill: rgb("#000000"), weight: "bold", size: 16pt)[#it.body]
  )
  v(0.15in)
}

#show heading.where(level: 2): it => {
  v(0.2in)
  text(fill: rgb("#F97316"), weight: "bold", size: 13pt)[#it.body]
  v(0.05in)
  line(length: 100%, stroke: 0.5pt + rgb("#F97316"))
  v(0.1in)
}

#show heading.where(level: 3): it => {
  v(0.12in)
  text(fill: rgb("#f5f5f5"), weight: "bold", size: 11.5pt)[#it.body]
  v(0.04in)
}

#show heading.where(level: 4): it => {
  v(0.08in)
  text(fill: rgb("#cccccc"), weight: "bold", size: 10.5pt)[#it.body]
  v(0.02in)
}

#show link: it => {
  text(fill: rgb("#F97316"))[#it]
}

#show raw: it => {
  if it.block {
    block(
      width: 100%,
      fill: rgb("#0a0a0a"),
      inset: 8pt,
      radius: 3pt,
      text(font: "Menlo", size: 9pt, fill: rgb("#f5f5f5"))[#it]
    )
  } else {
    box(
      fill: rgb("#2a2a2a"),
      inset: (x: 3pt, y: 1pt),
      outset: (y: 2pt),
      radius: 2pt,
      text(font: "Menlo", size: 8.5pt, fill: rgb("#F97316"))[#it]
    )
  }
}

#set table(
  fill: (col, row) => if row == 0 {
    rgb("#F97316")
  } else if calc.even(row) {
    rgb("#252525")
  } else {
    rgb("#1f1f1f")
  },
  stroke: 0.5pt + rgb("#444"),
  inset: 7pt,
)

#show table.cell.where(y: 0): set text(fill: rgb("#000000"), weight: "bold", size: 9.5pt)
#show table.cell: set text(size: 9pt)

#let horizontalrule = {
  v(0.1in)
  line(length: 100%, stroke: 0.5pt + rgb("#444"))
  v(0.1in)
}

// Title Page
#align(center)[
  #v(1.1in)
  #image("../assets/images/qc-icon-1024.png", width: 1.8in)
  #v(0.25in)
  #text(fill: rgb("#F97316"), size: 36pt, weight: "bold", tracking: 0.5pt)[QuoteCat]
  #v(0.45in)
  #text(fill: rgb("#f5f5f5"), size: 26pt, weight: "bold")[Complete Feature Reference]
  #v(0.15in)
  #text(fill: rgb("#a0a0a0"), size: 13pt)[Mobile app · Web portal · v1.2.6]
  #v(0.4in)
  #line(length: 40%, stroke: 1pt + rgb("#F97316"))
  #v(0.25in)
  #text(fill: rgb("#a0a0a0"), size: 11pt, style: "italic")[
    Every tier claim verified against source code — citations inline
  ]
  #v(0.9in)
  #text(fill: rgb("#666666"), size: 10pt)[Generated 2026-06-05  ·  quotecat.ai]
]

#pagebreak()

#strong[Verified against v1.2.6 codebase on 2026-06-05.] Every tier
claim in this document was confirmed by reading the source. When this
doc disagrees with marketing copy or older docs, this doc is
authoritative --- the gating lines are cited inline.

#horizontalrule

== What QuoteCat is
<what-quotecat-is>
QuoteCat is a quoting, invoicing, and contract platform for contractors
and small trade businesses. It ships in three pieces:

- #strong[Mobile app] (`quotecat/`) --- React Native / Expo, iOS +
  Android. The primary work surface for every contractor regardless of
  tier.
- #strong[Web portal] (`quotecat-portal/`, served at
  `portal.quotecat.ai`) --- Next.js 16. The contractor's logged-in web
  workspace. #strong[Premium only.] The same codebase also serves
  client-facing document URLs (`/q/[id]`, `/c/[id]`, `/pay/[id]`) ---
  these are generated and sent by #strong[Pro+ contractors] to their
  clients for online approvals, signatures, and payments. Free
  contractors can only share PDFs. A separate client magic-link login at
  `/client/*` lets clients of Pro+ contractors aggregate documents from
  one or more contractors.
- #strong[Shared backend] --- Supabase (Postgres + Auth + Edge
  Functions), Stripe (subscription billing + Connect for client
  payments), Twilio (SMS), Anthropic Claude (Drew AI), OpenAI
  embeddings, X-Byte (supplier pricing --- currently paused).

#horizontalrule

== Subscription tiers
<subscription-tiers>
Three tiers. Tier is stored on the Supabase `profiles.tier` column as
lowercase strings `"free" | "pro" | "premium"`. The mobile app keeps a
local mirror in `UserState.tier` (`lib/user.ts:7`).

#figure(
  align(center)[#table(
    columns: 4,
    align: (auto,auto,auto,auto,),
    table.header([Tier], [Founder price], [Regular price], [Founder
      cap],),
    table.hline(),
    [#strong[Free]], [\$0], [\$0], [---],
    [#strong[Pro]], [\$29/mo], [\$49/mo], [First 50 customers],
    [#strong[Premium]], [\$79/mo], [\$109/mo], [First 25 customers],
  )]
  , kind: table
  )

Founder pricing is locked forever for early adopters.

=== Free tier monthly limits
<free-tier-monthly-limits>
From `FREE_LIMITS` in `lib/user.ts:23`:

#figure(
  align(center)[#table(
    columns: 2,
    align: (auto,auto,),
    table.header([Resource], [Limit],),
    table.hline(),
    [Quote creations], [10 / month],
    [PDF exports], [10 / month],
    [Spreadsheet (CSV) exports], [10 / month],
    [Invoice PDF exports], [10 / month (always with QuoteCat branding)],
    [Pricebook items], [50 total (not monthly --- total)],
  )]
  , kind: table
  )

Counters reset on the 1st of each month.

=== Apple compliance
<apple-compliance>
The mobile app has no in-app pricing UI and no in-app purchase flow.
Free users tap "Upgrade" and are routed to `quotecat.ai` in the system
browser where they buy via Stripe. RevenueCat is used only to read
subscription status after the web purchase completes.

#horizontalrule

== Mobile app features
<mobile-app-features>
=== Authentication
<authentication>
- Email + password (Supabase Auth)
- Apple Sign-In (iOS) --- `usesAppleSignIn: true` in `app.json`
- Google Sign-In (iOS + Android)
- Biometric login (Face ID / Touch ID) for returning users
- Password recovery via email magic link

All sign-in methods are available to all tiers.

=== Dashboard (`app/(main)/(tabs)/dashboard.tsx`)
<dashboard-appmaintabsdashboard.tsx>
#figure(
  align(center)[#table(
    columns: (33.33%, 33.33%, 33.33%),
    align: (auto,auto,auto,),
    table.header([Surface], [Tier], [Notes],),
    table.hline(),
    [Quote stats: total / draft / sent / approved / to-invoice /
    follow-ups], [Free], [],
    [#strong[Business value tracking] (sent value, approved value,
    to-invoice value)], [Pro+], [`canAccessValueTracking()` ---
    `lib/features.ts:167`],
    [#strong[Average profit margin card] (from paid
    invoices)], [Pro+], [Requires `showMargin` preference + default
    labor rates configured],
    [Recent quotes / recent invoices], [Free], [Free users see all their
    own quotes/invoices],
    [#strong[Recent
    contracts]], [Premium], [`isPremium && preferences.showRecentContracts`],
    [#strong[Cloud sync indicator] + last sync time], [Pro+], [Renders
    only when sync is available],
    [Change order count badges on approved quotes], [Pro+], [],
    [First-run onboarding flow], [Free], [Sets target margin + business
    defaults],
    [Section show/hide toggles], [Free], [Every card on the dashboard
    can be dismissed],
  )]
  , kind: table
  )

=== Quotes
<quotes>
#strong[Quote creation + editing] (`app/(forms)/quote/[id]/edit.tsx`):

#figure(
  align(center)[#table(
    columns: (33.33%, 33.33%, 33.33%),
    align: (auto,auto,auto,),
    table.header([Capability], [Tier], [Gating],),
    table.hline(),
    [Create a quote], [Free (10/mo cap) / Pro+
    unlimited], [`canCreateQuote()` --- `lib/features.ts:10`],
    [Edit name, client (name/email/phone/address), notes, follow-up
    date], [Free], [],
    [Add materials from catalog or pricebook], [Free], [],
    [#strong[Quick custom items] (inline add: name + price, amber-tinted
    background)], [Free], [Build \#141. No catalog ID required.],
    [Adjust quantity with stepper, swipe to delete/edit, undo via
    snackbar], [Free], [],
    [Labor: simple flat cost + cost rate], [Free], [],
    [#strong[Labor: per-worker team mode] (assign specific team members
    to labor lines)], [Premium], [`canAccessMultiWorkerLabor()` ---
    `lib/features.ts:152`],
    [Markup % and tax %], [Free], [],
    [Status workflow: draft → sent → approved → completed → archived (+
    declined)], [Free], [],
    [Pin to top, follow-up reminders, duplicate as
    template], [Free], [],
    [#strong[Materials margin indicator] on quote edit (color-coded if
    `targetMaterialsMarginPercent > 0`)], [Free], [No tier gate.
    `edit.tsx:1603`. Became Free in v1.2.5.],
    [#strong[Multi-tier pricing] (Good/Better/Best bundles) --- linked
    quotes via `tierGroupId`], [Free], [Create tier modal at edit; when
    one is approved, others auto-archive],
    [#strong[Change order tracking] (history of edits to approved
    quotes)], [Pro+], [`canAccessChangeOrders()` ---
    `lib/features.ts:102`],
    [Auto-save on blur, client autocomplete from saved
    clients], [Free], [],
  )]
  , kind: table
  )

#strong[Quotes list] (`app/(main)/(tabs)/quotes.tsx`):

Search, filter (8 status filters), sort by date / amount / name / client
\/ follow-up date, multi-select for bulk actions (delete, archive,
status change), swipe actions, pull-to-refresh triggers cloud sync
(Pro+).

#strong[Quote review + export] (`app/(forms)/quote/[id]/review.tsx`):

#figure(
  align(center)[#table(
    columns: (33.33%, 33.33%, 33.33%),
    align: (auto,auto,auto,),
    table.header([Capability], [Tier], [Gating],),
    table.hline(),
    [Full preview with materials, labor, tax, totals], [Free], [],
    [Export PDF], [Free (10/mo cap, QuoteCat branding) / Pro+ unlimited,
    custom branding], [`canExportPDF()` --- `lib/features.ts:31`],
    [Export CSV spreadsheet], [Free (10/mo) / Pro+
    unlimited], [`canExportSpreadsheet()` --- `lib/features.ts:56`],
    [#strong[Share as Link] (sends client a `portal.quotecat.ai/q/[id]`
    URL for online viewing + approval)], [Pro+], [`review.tsx:508` ---
    `if (isPro || isPremium)`. Quote auto-syncs to cloud before share.],
    [#strong[Export all tiers as single PDF] (bundles)], [Free (counts
    against PDF quota)], [],
    [Create invoice from this quote], [Free], [Eligible from approved or
    completed quotes],
    [Create contract from this quote], [Premium], [],
    [Change orders section on approved/completed quotes], [Pro+], [],
    [Company logo + terms appear on PDF if configured], [Free], [],
  )]
  , kind: table
  )

=== Invoices (`app/(main)/(tabs)/invoices.tsx`)
<invoices-appmaintabsinvoices.tsx>
#figure(
  align(center)[#table(
    columns: (33.33%, 33.33%, 33.33%),
    align: (auto,auto,auto,),
    table.header([Capability], [Tier], [Gating],),
    table.hline(),
    [Create / view / manage invoices], [Free], [All tiers have invoice
    access --- `lib/features.ts:109`],
    [Status workflow: unpaid / partial / paid / overdue], [Free], [],
    [Create from quote (approved or completed)], [Free], [],
    [#strong[Create from contract]], [Premium], [Contract picker only
    renders for Premium],
    [Auto invoice numbering, due dates, partial payment
    tracking], [Free], [],
    [Export PDF], [Free (10/mo cap, #strong[always with QuoteCat
    branding]) / Pro+ unlimited, no branding], [`canExportInvoice()` ---
    `lib/features.ts:117`],
    [#strong[Share as Link] (sends client a
    `portal.quotecat.ai/pay/[id]` URL for online
    payment)], [Pro+], [`invoice/[id].tsx:303, 2020` --- share menu
    disabled for Free],
    [#strong[Send payment reminder] to client (SMS or email
    channel)], [Pro+], [`sendInvoiceReminder()` ---
    `lib/invoices.ts:554`],
    [Multi-select bulk delete + bulk status update], [Free], [],
  )]
  , kind: table
  )

=== Contracts (`app/(main)/(tabs)/contracts.tsx`)
<contracts-appmaintabscontracts.tsx>
#strong[Premium-only.] Free and Pro users see a locked state with an
upsell to upgrade. Gating: `isPremium = effectiveTier === "premium"`
(`contracts.tsx:41`).

- Create contract from approved quote
- Full contract template editing
- Send to client for e-signature (signing happens via web portal)
- Track sent / viewed / signed / completed status
- PDF export

=== Pricebook (`app/(main)/price-book.tsx`)
<pricebook-appmainprice-book.tsx>
#figure(
  align(center)[#table(
    columns: (33.33%, 33.33%, 33.33%),
    align: (auto,auto,auto,),
    table.header([Capability], [Tier], [Gating],),
    table.hline(),
    [Create, edit, delete custom pricing items], [Free (50 items total
    cap) / Pro+ unlimited], [`FREE_LIMITS.pricebookItems = 50`],
    [Search and filter by category], [Free], [],
    [Use items in quotes and assemblies], [Free], [],
    [Cloud sync of pricebook], [Pro+], [Auto-syncs on save for Pro+],
  )]
  , kind: table
  )

=== Assemblies --- Pro+
<assemblies-pro>
Assemblies are reusable templates for common jobs (e.g., "frame a room")
that bundle multiple products with fixed or computed quantities. Pro+
via `canAccessAssemblies()` (`lib/features.ts:81`).

#figure(
  align(center)[#table(
    columns: (50%, 50%),
    align: (auto,auto,),
    table.header([Screen], [Purpose],),
    table.hline(),
    [`assemblies.tsx` (tab)], [Browse "My Assemblies" + "Community"
    tabs, add to a quote],
    [`assemblies-browse.tsx`], [List user's custom assemblies with
    search],
    [`assembly-manager.tsx`], [Create / edit / delete custom
    assemblies],
    [`assembly-editor/[id].tsx`], [Edit assembly items + computed
    quantities],
    [`copy-assembly/[id].tsx`], [Duplicate an assembly template],
    [`community-assemblies.tsx`], [Browse shared assemblies
    (trade-filtered, sortable), vote, copy to library],
  )]
  , kind: table
  )

=== Drew --- AI assistant (`app/(main)/wizard.tsx`)
<drew-ai-assistant-appmainwizard.tsx>
Drew runs as a Supabase Edge Function (`drew-agent`) calling Claude
Sonnet 4 with prompt caching enabled.

#figure(
  align(center)[#table(
    columns: (33.33%, 33.33%, 33.33%),
    align: (auto,auto,auto,),
    table.header([Mode], [Tier], [Gating],),
    table.hline(),
    [#strong[Build a quote with Drew] (full conversational
    quote-building flow with material checklists, product selection,
    labor entry, save)], [Premium], [`canAccessWizard()` ---
    `lib/features.ts:145`],
    [#strong[Ask Drew a question] (general quoting / pricing /
    construction advice)], [All tiers], [`canAccessDrewSupport()` ---
    `lib/features.ts:160`],
  )]
  , kind: table
  )

Free and Pro users see a single "Ask Drew" entry. Premium users see a
two-button intro (Build Quote vs Ask Drew).

=== Toolbox (`app/(main)/(tabs)/pro-tools.tsx`)
<toolbox-appmaintabspro-tools.tsx>
The Toolbox tab is the central hub for all calculators and tools. Each
tile shows a locked state for tiers that can't access it.

#strong[Free tools] (all tiers):

#figure(
  align(center)[#table(
    columns: (50%, 50%),
    align: (auto,auto,),
    table.header([Tool], [File],),
    table.hline(),
    [Labor Rate Calculator], [`app/(main)/labor-rate-calculator.tsx`],
    [Overhead Calculator (8-step
    wizard)], [`app/(main)/overhead-calculator.tsx`],
    [Markup Calculator], [`app/(main)/markup-calculator.tsx`],
    [Profit Margin
    Calculator], [`app/(main)/profit-margin-calculator.tsx`],
    [Client Manager (CRM-style)], [`app/(main)/client-manager.tsx`],
    [Price Book (50-item cap on Free)], [`app/(main)/price-book.tsx`],
  )]
  , kind: table
  )

#strong[Pro tools] (Pro+):

#figure(
  align(center)[#table(
    columns: (50%, 50%),
    align: (auto,auto,),
    table.header([Tool], [File],),
    table.hline(),
    [#strong[Pricing Health Check] --- audits last 90 days of quotes vs
    target margin, shows estimated lost profit, flags underpriced quotes
    (v1.2.6 headline feature)], [`app/(main)/pricing-health-check.tsx`],
    [Assembly Manager], [`app/(main)/assembly-manager.tsx`],
    [Assembly Library], [`app/(main)/assemblies-browse.tsx`],
    [Job Calculator (compute material quantities from job
    dimensions)], [`app/(main)/job-calculator.tsx`],
  )]
  , kind: table
  )

#strong[Premium tools] (Premium):

#figure(
  align(center)[#table(
    columns: 2,
    align: (auto,auto,),
    table.header([Tool], [File],),
    table.hline(),
    [Team Members], [`app/(main)/team-members.tsx`],
    [Contracts], [`app/(main)/(tabs)/contracts.tsx`],
    [Premium Portal link (deep-links into the web portal)], [---],
  )]
  , kind: table
  )

=== Team Members (Premium)
<team-members-premium>
`app/(main)/team-members.tsx`. Manage workers with billable rate + cost
rate per person. Used by per-worker labor mode on quote edit. Syncs to
Supabase so the web portal can assign jobs to these workers.

=== Change Orders (Pro+)
<change-orders-pro>
#figure(
  align(center)[#table(
    columns: (50%, 50%),
    align: (auto,auto,),
    table.header([Screen], [Purpose],),
    table.hline(),
    [`app/(main)/change-orders/[quoteId].tsx`], [List all change orders
    for a quote],
    [`app/(main)/change-order/[id].tsx`], [Diff view: items
    added/removed/modified, labor, markup, total],
  )]
  , kind: table
  )

Surfaces on approved quotes via dashboard + quote edit + quote review.

#strong[Known limitation:] Change orders persist locally (AsyncStorage /
SQLite) but #strong[do not yet sync to Supabase], so they are not
visible in the web portal. Plan: `docs/CHANGE-ORDERS-SYNC-PLAN.md`.

=== Settings (`app/(main)/settings.tsx`)
<settings-appmainsettings.tsx>
- Profile (email, tier badge)
- #strong[Manage Account] → opens Stripe subscription portal (Pro+ only)
- #strong[Delete Account] (all tiers)
- Pricing defaults: markup %, labor rate, labor cost rate, target
  margin, materials margin target
- Theme (light / dark / auto)
- Dashboard customization (show/hide each card)
- Business Settings (company name, phone, email, address, logo, website,
  payment methods listed for invoices)
- Price Book link
- #strong[Cloud Sync] panel (Pro+): status, last sync time, manual sync
  button with cooldown, sync counts per data type
- Privacy policy + terms links
- Restore Purchases (subscription recovery)
- Sign Out (resets local user state, clears analytics identity)

=== Cloud Sync (Pro+)
<cloud-sync-pro>
Pro and Premium users get bi-directional sync between the local device
store and Supabase. Synced data: quotes, invoices, clients, pricebook
items, team members, business settings, assemblies. Free users stay 100%
local --- their data never touches Supabase.

Sync triggers: pull-to-refresh on dashboard / quotes / invoices, manual
sync button in Settings, post-sign-in.

=== Onboarding
<onboarding>
First-run users see an onboarding flow that captures business defaults
and sets a target margin. Resumable from the notifications area.

#horizontalrule

== The contractor portal --- `portal.quotecat.ai` (Premium only)
<the-contractor-portal-portal.quotecat.ai-premium-only>
The #strong[portal] is the contractor's web workspace at
`portal.quotecat.ai`. Logging into the portal --- at all --- requires
Premium. Pro and Free contractors work entirely on mobile; the portal is
not part of their plan.

Gating: the `/dashboard/*` layout enforces `profile.tier === 'premium'`
(`dashboard/layout.tsx:50`). Every contractor route lives under
`/dashboard/*`.

=== Portal routes (all Premium)
<portal-routes-all-premium>
#figure(
  align(center)[#table(
    columns: (50%, 50%),
    align: (auto,auto,),
    table.header([Route], [Purpose],),
    table.hline(),
    [`/dashboard`], [KPI overview: revenue MTD, outstanding, overdue,
    pending, needs-attention, recent activity, profitability widget],
    [`/dashboard/quotes` + `/[id]` + `/new`], [Full quote management on
    the web --- line items, labor, materials, tax, markup, pricebook +
    team member integration],
    [`/dashboard/invoices` + `/[id]` + `/new`], [Invoices list + detail.
    Detail page includes SMS reminder button and QuickBooks sync button
    (if connected).],
    [`/dashboard/contracts` + `/[id]` + `/new`], [Contract list / detail
    \/ creation],
    [`/dashboard/clients` + `/new`], [CRM-style client database],
    [`/dashboard/jobs` + `/new`], [Job management: scheduled /
    in-progress / completed],
    [`/dashboard/team`], [Two tabs --- Workers (manage team, assign jobs
    via SMS magic link) and Techs (invite secondary users to the
    contractor account with permission flags)],
    [`/dashboard/messages` + `/new`], [Client messaging across web + SMS
    channels],
    [`/dashboard/pricebook`], [Custom pricebook with CSV import/export],
    [`/dashboard/profitability`], [Labor rate + overhead wizard,
    calculates real margin],
    [`/dashboard/analytics`], [Revenue trend, conversion funnel, deal
    size, close time, win rate, collection rate],
    [`/dashboard/settings`], [Profile, branding, billing tier, Stripe
    Connect setup, SMS settings, worker verification toggle],
  )]
  , kind: table
  )

=== Premium-only portal capabilities (verified in API + UI)
<premium-only-portal-capabilities-verified-in-api-ui>
#figure(
  align(center)[#table(
    columns: (50%, 50%),
    align: (auto,auto,),
    table.header([Feature], [Where],),
    table.hline(),
    [#strong[Two-way SMS via Twilio] --- provision dedicated number,
    send to clients + workers, receive via webhook, voice
    handling], [`/api/twilio/*`],
    [#strong[QuickBooks Online sync] --- OAuth, push invoices,
    auto-create QB customers, single-invoice or bulk
    sync], [`/api/quickbooks/*`],
    [#strong[Team management] --- workers (with magic-link assignment) +
    techs (secondary user accounts with permission
    flags)], [`/dashboard/team` + `/api/team-members`,
    `/api/job-assignments`, `/api/team/techs/*`],
    [#strong[Stripe Connect] --- accept client payments directly,
    dashboard link to Express account], [`/api/stripe/connect`],
    [#strong[Invoice SMS
    reminders]], [`/api/invoices/[id]/send-reminder`],
    [#strong[Job notifications to
    client/worker]], [`/api/jobs/[id]/notify-client`,
    `/api/job-assignments/notify`],
  )]
  , kind: table
  )

=== What's NOT in the portal yet
<whats-not-in-the-portal-yet>
- #strong[Change orders] --- no routes, no API, no UI. Mobile-only
  feature for now. Sync plan documented in
  `docs/CHANGE-ORDERS-SYNC-PLAN.md`.
- #strong[Scheduling calendar UI] --- job assignments exist as records
  but no visual calendar
- #strong[Workflow automation rules engine] --- not built
- #strong[DocuSign / Adobe Sign integration] --- signatures are manual
  pad only
- #strong[1099 / tax reports] --- not built
- #strong[Payroll integration] --- not built

#horizontalrule

== Other web-served surfaces (not part of the portal)
<other-web-served-surfaces-not-part-of-the-portal>
These exist on the same Next.js codebase but are #strong[not] the
contractor portal. They serve clients and workers --- no contractor
login.

=== Client-facing document URLs --- Pro+ share targets
<client-facing-document-urls-pro-share-targets>
When a Pro or Premium contractor sends a quote or invoice to a client,
the client opens one of these URLs in a browser. No client login needed
--- the document ID is the access token. #strong[Free contractors cannot
generate these links] and must share PDFs instead (mobile share sheet →
email / SMS / any system share target). The "Share as Link" option in
the mobile app is gated to Pro+ at `review.tsx:508` and
`invoice/[id].tsx:303`.

#figure(
  align(center)[#table(
    columns: (33.33%, 33.33%, 33.33%),
    align: (auto,auto,auto,),
    table.header([Route], [Purpose], [Generated by],),
    table.hline(),
    [`/q/[id]`], [Quote view. If quote is part of a tier group, shows
    Good/Better/Best comparison view.], [Pro+ contractor (mobile "Share
    as Link")],
    [`/c/[id]`], [Contract view + signature pad. Marks contract viewed
    on load. Client signs electronically.], [Premium contractor
    (contracts are Premium-only)],
    [`/pay/[id]`], [Invoice payment. If the contractor has Stripe
    Connect (Premium): Stripe checkout. Otherwise: shows configured
    alternative methods (Zelle, Venmo, Cash App, PayPal, check,
    wire).], [Pro+ contractor (mobile "Share as Link")],
    [`/pay/[id]/success`], [Payment confirmation], [---],
  )]
  , kind: table
  )

=== Client magic-link login at `/client/*` --- Pro+
<client-magic-link-login-at-client-pro>
A separate flow where a client logs in once with a magic link and sees
#strong[all] documents (across history) from the contractors they've
worked with. This is distinct from the per-document share URLs above ---
those are one-document-at-a-time URLs sent by the contractor. The client
magic-link login is a client-controlled hub.

Code (`/api/client-portal/request-link:76`) allows clients of
#strong[Pro or Premium] contractors. Magic links expire after 15
minutes.

#figure(
  align(center)[#table(
    columns: (50%, 50%),
    align: (auto,auto,),
    table.header([Route], [Purpose],),
    table.hline(),
    [`/client/login`], [Client requests magic link (sent to email)],
    [`/client/verify`], [Magic link verification],
    [`/client/dashboard`], [Client hub: all quotes, invoices, contracts,
    jobs from one or more contractors],
    [`/client/messages`], [Client-initiated messages with the
    contractor],
  )]
  , kind: table
  )

=== Worker magic link at `/worker/[token]`
<worker-magic-link-at-workertoken>
When a Premium contractor assigns a worker to a job, the worker receives
an SMS with a 30-day magic link. They don't need an account --- they
just open the link.

#figure(
  align(center)[#table(
    columns: (50%, 50%),
    align: (auto,auto,),
    table.header([Route], [Purpose],),
    table.hline(),
    [`/worker/[token]`], [30-day expiring magic link. Shows job details,
    address, schedule. Worker submits updates + photos and changes job
    status.],
    [`/my-jobs`], [Worker dashboard of all assigned jobs (session-authed
    via token)],
  )]
  , kind: table
  )

Worker assignment is part of the Premium-only Team Management feature,
so workers only exist in the system when their contractor is Premium.

=== Server-side surface (notable API routes, both portal and public-link)
<server-side-surface-notable-api-routes-both-portal-and-public-link>
- Quote PDF generation via Puppeteer + headless Chromium
- Tier-group PDFs for Good/Better/Best bundles
- Stripe webhooks for payment confirmation
- Twilio webhooks for incoming SMS + voice
- QuickBooks OAuth callback + token refresh
- Resend (transactional email)

#horizontalrule

== Mobile vs.~portal --- what the contractor does, where
<mobile-vs.-portal-what-the-contractor-does-where>
"Portal" below means `portal.quotecat.ai` (the contractor's logged-in
workspace, Premium only). The client-facing document URLs (`/q`, `/c`,
`/pay`) are listed separately --- they're not contractor portal access,
they're share targets generated by Pro+ contractors.

#figure(
  align(center)[#table(
    columns: (25%, 25%, 25%, 25%),
    align: (auto,auto,auto,auto,),
    table.header([Capability], [Mobile], [Portal (portal.quotecat.ai,
      Premium)], [Client share URLs (Pro+ contractors only)],),
    table.hline(),
    [Create / edit quotes], [All tiers], [✓], [---],
    [Create / edit invoices], [All tiers], [✓], [---],
    [Create / send contracts], [Premium], [✓], [---],
    [Share quote with client], [---], [---], [Pro+: link at `/q/[id]`.
    Free: PDF only via mobile share sheet.],
    [Send invoice to client for online payment], [---], [---], [Pro+:
    link at `/pay/[id]`. Free: PDF only.],
    [Client signs contract online], [---], [---], [Premium contractor:
    link at `/c/[id]`],
    [Two-way SMS messaging], [✗], [✓], [---],
    [QuickBooks sync], [✗], [✓], [---],
    [Stripe Connect onboarding], [✗], [✓], [---],
    [Team member management], [Premium], [✓], [---],
    [Assign workers to jobs (SMS magic link)], [✗], [✓], [---],
    [Drew AI quote building], [Premium], [✗ (mobile only)], [---],
    [Pricing Health Check], [Pro+], [✗ (mobile only)], [---],
    [Change Orders], [Pro+ (local-only)], [✗], [---],
    [Assemblies], [Pro+], [✗], [---],
    [Multi-tier bundles (Good/Better/Best)], [Free (create)], [✓
    (Premium portal view)], [Pro+: client sees comparison view at
    `/q/[id]`],
    [Offline-first], [✓], [✗], [n/a],
    [Client magic-link login (`/client/*`)], [---], [n/a], [Pro+],
  )]
  , kind: table
  )

#horizontalrule

== Cross-cutting topics
<cross-cutting-topics>
=== Data architecture
<data-architecture>
- Free users: 100% local. Quotes + clients in SQLite (migrated from
  AsyncStorage), preferences in AsyncStorage. Never touches Supabase.
- Pro+ users: local store + Supabase mirror. Auto-migration on first
  sign-in (one-way local → cloud). Conflict resolution is
  last-write-wins.

=== Auth model
<auth-model>
- #strong[Mobile:] Supabase Auth (email/password, Apple ID, Google),
  plus biometric unlock for returning users
- #strong[Portal contractor login at `portal.quotecat.ai/login`:]
  Premium only. Free + Pro contractors don't sign into the portal ---
  they work on mobile.
- #strong[Client magic-link login at `/client/login`:] 15-min expiry.
  Code allows clients of Pro and Premium contractors
  (`request-link/route.ts:76`).
- #strong[Worker magic link via SMS:] 30-day expiry, issued by Premium
  contractors when assigning jobs.
- #strong[Client-facing document URLs] (`/q`, `/c`, `/pay`): no client
  login at all --- document ID is the access token. But #strong[only
  Pro+ contractors can generate and send these links]. Free contractors
  share PDFs via the mobile share sheet instead.

=== Payments
<payments>
- Subscription billing (contractor pays QuoteCat): Stripe via the
  marketing site at `quotecat.ai`. No in-app pricing on mobile to avoid
  Apple's 30% commission.
- Client → contractor invoice payments (contractor gets paid by client):
  Stripe Connect on the portal --- Premium contractors only.
- Alternative payment methods (Zelle, Venmo, Cash App, PayPal, check,
  wire) can be configured per-contractor and surface on the public
  `/pay/[id]` page.

=== Analytics + crash reporting
<analytics-crash-reporting>
- PostHog for product analytics, both mobile and marketing site.
  Identifies user via Supabase user ID after sign-in.
- Sentry for crash + error reporting on mobile.
- Marketing site analytics route through a reverse proxy at `/ingest/*`
  to bypass ad blockers (`netlify.toml`).

=== Third-party integrations actively used
<third-party-integrations-actively-used>
Supabase, Stripe (subscription + Connect), Anthropic Claude (Drew),
OpenAI embeddings (Drew tradecraft search), Twilio (SMS, Premium only),
QuickBooks Online (Premium only), Resend (email), Cloudinary (image
storage), RevenueCat (subscription status), PostHog (analytics), Sentry
(crash reporting), Apple + Google identity providers.

#strong[Currently paused:] X-Byte supplier pricing API. The "Drew
references supplier catalog" path is commented out in
`supabase/functions/drew-agent/index.ts:547-568`. Drew still references
the contractor's own pricebook.

#horizontalrule

== Founder pricing
<founder-pricing>
Early adopters lock founder pricing for life:

- #strong[Pro:] \$29/mo vs.~\$49/mo regular (\~40% off) --- first 50
  customers
- #strong[Premium:] \$79/mo vs.~\$109/mo regular (\~28% off) --- first
  25 customers

Price increases trigger at customer-count milestones, not time-based
deadlines.

#horizontalrule

== How QuoteCat compares
<how-quotecat-compares>
Verified against current QuoteCat shipping features only --- competitor
figures are public list pricing as of mid-2026.

#figure(
  align(center)[#table(
    columns: (25%, 25%, 25%, 25%),
    align: (auto,auto,auto,auto,),
    table.header([Capability], [QuoteCat
      Premium], [FieldPulse], [Jobber],),
    table.hline(),
    [Monthly cost (5 users / flat)], [\$79 (founder) / \$109
    (regular)], [\$600+ (per-user)], [\$300+ (per-user)],
    [AI quote building], [✓ (Drew)], [✗], [✗],
    [Pricing Health Check audit], [✓], [✗], [✗],
    [E-signatures], [✓], [✓], [✓],
    [Online payments], [✓ (Stripe Connect)], [✓], [✓],
    [Custom pricebook + CSV import], [✓], [✓], [✓],
    [Two-way SMS messaging], [✓ (Twilio)], [✓], [✓],
    [QuickBooks sync], [✓], [✓], [✓],
    [Mobile platforms], [iOS + Android], [iOS + Android], [iOS +
    Android],
    [Worker magic-link portal], [✓], [---], [---],
    [Multi-tier bundle quotes], [✓], [---], [---],
    [Offline-first mobile], [✓], [partial], [partial],
    [Per-user pricing], [No (flat)], [\$100/user], [\$50/user],
  )]
  , kind: table
  )

#strong[QuoteCat's positioning:] flat-rate pricing means adding team
members doesn't increase the bill. The financial-intelligence layer
(true overhead-loaded labor rates, target margin enforcement, the
Pricing Health Check audit) is the moat --- competitors stop at "we
generated a quote," QuoteCat tells you whether the quote is actually
profitable.

#horizontalrule

== Getting started
<getting-started>
+ Download QuoteCat from the App Store or Google Play
+ Create an account (email, Apple ID, or Google)
+ Run the onboarding flow --- set company details, default markup,
  target margin
+ Create your first quote with the "+" button (or use Drew on Premium)
+ Send to client via email, text, or any system share target
+ Get paid when client accepts and pays

#horizontalrule

== Support
<support>
- #strong[Email:] support\@quotecat.ai
- #strong[In-app:] "Ask Drew" --- available on all tiers for general
  quoting / pricing / construction questions
- #strong[Marketing + legal:] quotecat.ai/support, quotecat.ai/privacy,
  quotecat.ai/terms

#horizontalrule

#emph[QuoteCat --- know your numbers, send the right quote, run a better
business.]
