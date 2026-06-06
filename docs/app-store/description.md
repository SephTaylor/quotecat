# QuoteCat - Store Listings (v1.2.6)

Last updated: 2026-06-06. Target: v1.2.6 production submission (v1.2.5 cleared Apple/Google review on 2026-06-02 and is live).

These are the production copy blocks for App Store Connect and Google Play. Paste-ready when submitting v1.2.6 for review. v1.2.5's release notes are archived at the bottom of this file for reference.

**Aligned with these v1.2.6 deliverables (all in `main` at commit `0fa8714` or earlier):**
- Pricing Health Check shipped in `app/(main)/pricing-health-check.tsx` + `lib/pricingHealth.ts` (commit `208a91a`)
- Drew now only uses the user's pricebook (supplier catalog lookup disabled while xByte is paused — `supabase/functions/drew-agent/index.ts`, commit `0fa8714`)
- All "supplier catalog with real local pricing" claims removed across all surfaces
- "Workers who clock in/out via web" claim removed (not actually shipping; verified)
- Free-tier 10 quotes/month correctly stated everywhere (was inaccurately implied as unlimited)
- **2026-06-06 truth-up:** all "zero payment processing fees / keep 100% / save $8,700/year" claims removed to match the website rewrite. Card payments via Stripe still incur Stripe's standard processor rate — QuoteCat takes zero on top of that, but the contractor doesn't literally keep 100% on cards. Zelle/Venmo/cash/check ARE fully free. Honest framing used throughout. Also softened "Job scheduling and worker assignment" to "Job scheduling" — the visual calendar is v1.3.0.

**Reminder for the deploy day:** edge functions don't ride in the EAS binary. When you click "Submit for Review" in App Store Connect for v1.2.6, also run `npx supabase functions deploy drew-agent` so the "Drew references your pricebook only" claim in the release notes is actually true the moment review starts.

---

## App Store Connect

### App Name
QuoteCat - Professional Quotes

### Subtitle (30 char max)
Know your real profit per job

### Promotional Text (170 char max — editable any time without re-review)
See real-time profit margin and estimated profit on every quote — now free. Stop guessing what you make on every job.

### Keywords (100 char max, comma-separated, no spaces)
estimate,profit,margin,invoice,electrician,plumber,HVAC,contractor,billing,quote,field service

### Description (4000 char max)

Stop guessing what you make on every job.

QuoteCat shows your real profit on every quote, so you know if you're making money before you send it. Mobile app + web portal.

No QuoteCat fees, ever. Other apps charge per user every month — we don't.

Open the app. Build your quote. See your real margin in real time. Send it.

---

REAL MARGIN ON EVERY QUOTE — FREE

- Real-time profit margin indicator on every quote (green / yellow / red as you type)
- Estimated profit number on every quote
- Set your overhead once, QuoteCat builds it into your pricing
- No upgrade required to see your numbers

---

FREE TIER

- 10 quotes per month
- Unlimited clients
- Custom pricebook (saved on your device, up to 50 items)
- 10 quote PDFs, 10 invoice PDFs, 10 CSV exports each month
- Labor Rate, Overhead, Markup, and Profit Margin calculators in the app
- No QuoteCat fees on payments. Zelle, Venmo, CashApp, bank, check are 100% free. Cards run at standard Stripe rates with zero markup from us.

---

PRO — $29/MONTH (FOUNDER PRICING, FIRST 50 SPOTS LOCKED FOREVER)

Everything in Free, plus:

- Unlimited quotes and unlimited PDF / CSV / invoice exports
- Dashboard profit summary — average margin and total profit across paid jobs
- Pricing Health Check — one-tap audit of your last 90 days that flags underpriced quotes and shows estimated profit left on the table
- Shareable quote links (text or email) — clients accept or decline from their phone
- Real-time notifications when a client views, accepts, or declines
- Good / Better / Best tiered pricing in one shareable link
- Custom assemblies (reusable product bundles for repeat jobs)
- Community Assemblies — browse templates from other pros
- Cloud-synced pricebook across all your devices
- Your logo on PDFs, QuoteCat watermark removed
- The Contractor Pricing Guide included free ($29 value)

---

PREMIUM — $79/MONTH (FOUNDER PRICING, FIRST 25 SPOTS LOCKED FOREVER)

Everything in Pro, plus the FULL QuoteCat platform — mobile app + web portal at portal.quotecat.ai:

In the mobile app:
- Drew AI — talk through the job, Drew references your pricebook to build the quote
- Digital contracts with e-signatures
- Team Members — add your crew, track labor costs per worker
- 1 Field Tech license + unlimited worker seats

On the web portal:
- Full business dashboard — quotes, invoices, contracts, clients, pricebook, team, jobs in one desktop place
- Two-way client texting with your own business phone number (business hours + after-hours auto-reply)
- Job scheduling — assign workers to jobs, they get a phone-authenticated link to see their work
- Analytics dashboard
- QuickBooks sync
- Email and SMS reminders for overdue invoices
- Profitability setup that feeds your mobile app's margin math

Client-facing pages (no login required for your clients):
- Quote-viewing pages (tap accept or decline)
- Contract signing pages with e-signature
- Payment pages

---

WORKS OFFLINE

Quote, calculate, and generate PDFs at the job site without internet. Pro syncs to the cloud when you're back online.

---

BUILT FOR YOUR TRADE

General contractors. Electricians. Plumbers. HVAC techs. Framers. Roofers. Welders. Builders. Tradespeople.

---

Free to start. No credit card required.

Less paperwork. More jobs.

---

Subscription Information:

QuoteCat offers the following auto-renewable subscriptions:

- QuoteCat Pro (Monthly)
- QuoteCat Pro (Yearly)
- QuoteCat Premium (Monthly)
- QuoteCat Premium (Yearly)

Payment will be charged to your Apple ID at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period at the cost listed above. You can manage and cancel your subscriptions by going to your Apple ID account settings on your device.

Privacy Policy: https://quotecat.ai/privacy
Terms of Use: https://quotecat.ai/terms

### What's New in This Version (release notes)

Two upgrades this release:

- Pricing Health Check (Pro) — one-tap audit of your last 90 days of quotes. Shows which were underpriced and roughly how much profit was left on the table. Uses the same margin math as the live indicator on every quote, so the audit verdict matches what you saw when you sent it.
- Drew now builds quotes from your pricebook only (Premium) — your prices, no surprises. Cleaner suggestions, faster decisions.

### App Review Notes

Demo Account: Premium tier enabled for full feature access.

Sign-in: reviewer@quotecat.ai / QuoteCat2026!

Testing Guide:
- Create a quote: Tap + on Dashboard, add line items manually or from your pricebook (Toolbox > Price Book)
- Real margin / estimated profit: Visible on every quote in the editor — green/yellow/red indicator
- Pricing Health Check (Pro): Toolbox > Pro Tools > Pricing Health Check — audits recent quotes for underpricing
- Drew AI (Premium): Tap the orange chat button (lower-right of Dashboard), try "I need to quote a 200 amp panel upgrade" — Drew will reference items from the demo account's pricebook
- Send quote: Tap Send to preview portal link (use PDF export for testing without sending)
- Invoices / Contracts: Top menu
- Community Assemblies (Pro): Assemblies tab — browse templates

App works offline; quotes sync when back online (Pro tier).

We have selected and submitted all four IAP subscription products with this app version. Subscriptions are properly linked to this build.

Privacy Policy: https://quotecat.ai/privacy
Terms of Use: https://quotecat.ai/terms

---

## Google Play Console

**Note:** This section was reconciled against the live Google Play Console listing on 2026-06-06 and reflects what's actually deployed (which had drifted from what was in this doc previously). Truth-up edits applied — see the file header for context. Two typos fixed in the same pass: "Inclues" → "Includes", "QuoteCat Feed" → corrected by deleting (false claim removed).

### App name (30 char max)
QuoteCat

### Short description (80 char max)
Precise quotes, zero BS.

### Full description (4000 char max)

Stop guessing what you make on every job.

QuoteCat is the contractor quoting app that shows your real profit on every quote — so you know if you're making money before you send it. Build a professional quote in 5 minutes on-site, send a shareable link to your client, and get paid directly. No QuoteCat fees, ever.

Built for contractors, plumbers, electricians, HVAC technicians, framers, roofers, welders, and builders.

Real Margin On Every Quote — Free
• Real-time profit margin indicator on every quote
• Estimated profit shown before you send
• Set your overhead once, QuoteCat builds it into your pricing
• No upgrade required to see your numbers

Pricing Health Check (Pro)
• One-tap audit of your last 90 days of quotes
• See which quotes were underpriced and how much profit was left on the table
• Same math as the live margin indicator — if a quote ran red on the editor, it shows up here
• Tap any flagged quote to review it

Lightning-Fast Quoting
• Create professional quotes in minutes
• Add materials, labor, and markup
• Quick estimate mode for jobs you already know using assemblies
• Duplicate quotes for similar jobs

Assemblies (Pro+)
• Pre-built assemblies for common tasks
• Create custom assemblies for your specialty
• Browse Community Assemblies from other pros
• Save product bundles for recurring jobs
• Build quotes 10x faster with reusable templates

Professional Exports
• PDF quotes with your company info
• CSV export for record-keeping
• Add your logo and remove the QuoteCat watermark with Pro

Business Management
• Dashboard with quote value tracking
• Status workflow: Draft → Sent → Approved → Completed
• Search and filter by client, project, or status

Invoices
• Convert quotes to invoices with one tap
• Track paid, unpaid, and overdue
• Professional invoices with your branding

Client Manager
• Save client contact info
• View quote history by client
• Quick access to repeat customers

Works Offline
• Create and edit quotes without internet
• Perfect for job sites with poor connectivity
• Cloud sync across devices with Pro and Premium

Free Calculators and Guides
• Labor Rate Calculator
• Overhead Calculator
• Markup Calculator
• Profit Margin Calculator
• 90-Day Contractor Startup Kit
• Contractor Pricing Guide ($29, free with Pro and Premium)
• All available at quotecat.ai/resources

No QuoteCat Fees, Ever
• We don't take a cut of your payments and we don't add a markup on card processing
• Zelle, Venmo, CashApp, bank transfer, check — 100% free
• Cards run at standard Stripe rates (~2.9% + 30¢) with zero markup from us
• Other apps charge per user every month — we charge a flat rate

Premium Features
• Drew AI — talk through the job, Drew references your pricebook to build the quote
• Includes 1 field tech license at no additional cost
• Digital contracts with e-signatures
• Two-way client texting
• Job scheduling
• Web portal with business analytics
• Team and worker management
• QuickBooks sync
• Priority support

Built for contractors by developers who care. QuoteCat streamlines the part you hate — so you can get back to your real work.

Subscription Information:

QuoteCat offers the following auto-renewable subscriptions:
• QuoteCat Pro (Monthly)
• QuoteCat Pro (Yearly)
• QuoteCat Premium (Monthly)
• QuoteCat Premium (Yearly)

Payment will be charged to your Google Play account at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period at the cost listed above. You can manage and cancel your subscriptions through your Google Play account.

Privacy Policy: https://quotecat.ai/privacy
Terms of Use: https://quotecat.ai/terms

### Release notes (500 char max for Play)
Pricing Health Check (Pro): one-tap audit of your last 90 days that flags underpriced quotes and shows estimated profit on the table. Same math as the live margin indicator. Drew (Premium) now builds quotes from your pricebook only — your prices, no surprises.

### v1.2.6 additions — folded in 2026-06-06

Three additions to the Google Play description for v1.2.6:

- **Pricing Health Check (Pro) section** inserted after "Real Margin On Every Quote — Free" (4 bullets mirroring the Apple description)
- **Drew AI bullet** added as the first bullet under Premium Features (headline distinctive feature, leads the section)
- **Community Assemblies bullet** added to the Assemblies (Pro+) section as the 3rd bullet

Approximate character count after additions: ~3750 of 4000 (was 3349). Still well under the 4000 limit.

---

## Day-of deploy sequence (when you're ready to ship v1.2.6)

1. **Trigger EAS build:**
   ```
   eas build --platform all --profile production --auto-submit --non-interactive --no-wait
   ```
2. **While the build runs**, paste the Apple description / promotional text / keywords / what's new / app review notes from this doc into App Store Connect (for the new v1.2.6 version).
3. **Same for Google Play Console** — paste the Full description / Short description / Release notes.
4. **When iOS build lands in App Store Connect**, attach it to the v1.2.6 version and click **Submit for Review**.
5. **The moment you click Submit**, in a terminal run:
   ```
   npx supabase functions deploy drew-agent
   ```
   This deploys the edge function change so Drew's pricebook-only behavior matches the release notes from the moment review starts.

---

## Archived release notes (for reference)

### v1.2.5 (App Store)
Stop guessing what you make on every job. Real-time profit margin and estimated profit are now free on every quote — see if you're making money before you send it. Also: better visibility on custom line items in the quote editor.

### v1.2.5 (Google Play)
Stop guessing what you make on every job. Real-time profit margin and estimated profit are now free on every quote. Plus better visibility on custom line items in the quote editor.
