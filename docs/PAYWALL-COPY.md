# Paywall copy

**Written 2026-09-13.** For the RevenueCat v2 paywall attached to the `default` offering.

**Every feature below was verified against `lib/features.ts` and `lib/user.ts`, not against
marketing memory.** Do not add a line without checking the gate.

⚠️ **Use RevenueCat price variables, never typed prices.** Templates expose the package price and
the yearly saving. Typing `$29.99` creates a number that goes stale the day a price changes and
that will not localise. Verified US prices for reference only: Pro $29.99 / $289.99, Premium
$79.99 / $789.99. Annual is roughly two months free on both.

---

## ✅ LIVE as of 2026-09-13, revision 15

Paywall `pwf219640be5f547f1`, attached to offering `ofrng0f95143aea` (`default`) and published.
**This section reflects exactly what customers see.** Edit the paywall, then edit this.

**Headline:** You can see one job. Now see the business.

**Subhead:** Your margin across every job, whether you are charging enough, and no limits on
what you send.

The headline deliberately extends the marketing site's H1, "Stop guessing what you make on every
job." Margin is a **Free** feature, so the paywall cannot sell margin. It sells **scope**: the
same insight applied to the whole business rather than the quote in front of you.

### Pro tab

- Unlimited quotes, invoices and exports
- Your logo on everything. No QuoteCat branding
- Cloud sync, assemblies and your full pricebook
- Client links and card payments, with no cut taken
- Your margin across the business, plus a Pricing Health Check

### Premium tab

- Everything in Pro
- Contracts your client signs on their phone
- Multi-worker labour, so a crew job prices correctly
- Invite your techs and workers and run the job as a crew
- The full web portal for quoting at a desk
- Priority support

🚫 **Drew was removed from the paywall 2026-09-13 at Joseph's direction.** Do not put it back
without asking. Drew quote-building is still Premium-gated in code (`canAccessWizard`), it is
simply not being promised on the paywall.

### Also live

- Brand mark: the app icon, uploaded to RevenueCat's CDN, 22x22.
- Legal links: `https://quotecat.ai/terms/` and `https://quotecat.ai/privacy/`, **with trailing
  slashes** (they 301 without).
- Annual preselected on both tabs. Prices and savings come from package variables.

⚠️ **THE PAYWALL WOULD NOT SERVE UNTIL THE LEGAL URLS WERE SET.** The Terms and Privacy buttons
existed with `destination: "terms"` and `destination: "privacy_policy"` but no URL behind either.
The SDK fell back to the stock template and a clean reinstall did not fix it. **If a paywall ever
silently refuses to serve, check the dashboard for validation errors first.**

⚠️ **Concurrent edits clobber each other.** The dashboard editor writes the whole document, so a
browser tab holding an old revision will overwrite API changes on save, with no conflict warning.
It happened once here. **Refresh the editor before editing; close it before asking Claude to.**

---

## Founder pricing line

Put it under the price, small:

> Founder pricing. Your rate stays where it is for as long as you stay subscribed.

🚫 **Do not write a spot counter.** "Only 43 left" needs a live number RevenueCat cannot supply,
so it becomes a maintained lie the moment it is wrong.

---

## Trial variant, once introductory offers exist

**One subscription group means one trial per customer, ever** (group `QuoteCat Subscriptions`,
id 21953485, verified 2026-09-13). Put the trial on **Premium**, because a customer who only gets
one look should see the tier that is hardest to imagine from a description.

- **Button:** Start 14 days free
- **Under the button:** Free for 14 days, then the price shown. Cancel any time in Settings.
- **On the Pro tab, if Pro has no trial:** say so plainly rather than leaving it ambiguous.

---

## Rules this copy already follows

- **No steering to outside payment.** Nothing references the website or any other way to pay.
  Prior releases were tuned for this, commits `37da275` and `096a316`.
- **The card-payments line says QuoteCat takes no cut**, which is true and is a real difference
  from Jobber and Housecall Pro. It does not claim payments are free, because the processor's fee
  is still the contractor's cost.
- **No dashes, no emoji, no pipes.**
- **Every claim maps to a gate in `lib/features.ts`.**

## Corrections made 2026-09-13, after checking the code

- **"Dashboard tracking of what your quotes are worth" was removed.** It was based on
  `canAccessValueTracking` in `lib/features.ts`, which is **dead code — defined and never called
  anywhere.** It gates nothing, so Free already has whatever it was meant to protect. Selling it
  would have been charging for something people already have.
- **Replaced with two verified Pro analytics.** The **Pricing Health Check**
  (`app/(main)/pricing-health-check.tsx` checks `isPro`) and the **average profit margin card**
  (`app/(main)/(tabs)/dashboard.tsx:855`, gated `isPro && preferences.showMargin`).
- **The split is real and worth understanding:** per-quote margin is Free, business-level analytics
  are Pro. That is the line to sell against, and it is defensible because it is where the code
  actually draws it.
- **Financial intelligence stays OUT of the paywall. It is in the Free tier.** Joseph confirmed
  2026-09-13 that `CLAUDE.md` is stale on this. The margin work is free; the Pro-only analytics is
  the Pricing Health Check.
- **Team seats added to Premium, without a price.** Confirmed shipped in the portal
  (`dashboard/team/page.tsx`, `seatsUsed` against `max_team_seats`, with tech invitations).

⛔ **Never put a seat price on this paywall.** The competitive memory records $25 singles and a
$100 five-pack. If seats are not sold through in-app purchase, naming that price on an App Store
paywall is steering toward outside payment, which is the exact thing commits `37da275` and
`096a316` were tuned to avoid. Describe the capability, not the price.
