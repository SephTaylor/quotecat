# Paywall copy

**Written 2026-09-13.** For the RevenueCat v2 paywall attached to the `default` offering.

**Every feature below was verified against `lib/features.ts` and `lib/user.ts`, not against
marketing memory.** Do not add a line without checking the gate.

⚠️ **Use RevenueCat price variables, never typed prices.** Templates expose the package price and
the yearly saving. Typing `$29.99` creates a number that goes stale the day a price changes and
that will not localise. Verified US prices for reference only: Pro $29.99 / $289.99, Premium
$79.99 / $789.99. Annual is roughly two months free on both.

---

## Header

**Headline:** Send quotes that look like your business

**Subhead:** Unlimited quotes and invoices, your logo instead of ours, and a link your client can
open on any device.

---

## Pro tab

**Price:** monthly or yearly, yearly preselected. Let the template compute the saving.

- Unlimited quotes, invoices and exports
- Your logo on everything you send. No QuoteCat branding
- Your full pricebook instead of 50 items
- Assemblies, so a job you have done before takes one tap
- Cloud sync across every device you use
- Send a link your client opens in a browser, not just a PDF
- Accept card payments from your clients. QuoteCat takes no cut
- Change orders for when the job changes
- Your profit margin across the whole business, not just one quote
- A Pricing Health Check that tells you whether you are charging enough

**Button:** Start Pro

---

## Premium tab

**Headline for the tab:** Get it signed, not just sent

Everything in Pro, plus:

- Contracts your client signs on their phone
- Drew builds the quote with you, start to finish
- Multi-worker labour, so a crew job prices correctly
- Invite your techs and workers and run the job as a crew
- The full web portal for quoting at a desk
- Priority support

**Button:** Start Premium

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
