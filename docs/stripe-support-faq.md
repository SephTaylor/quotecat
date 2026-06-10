# Stripe support FAQ — for contractor questions about card payments

**Audience:** QuoteCat support (you, solo) when a contractor asks about how card payments work or hits an issue.

**Core principle:** QuoteCat takes nothing from card payments — ever. Stripe charges their standard processor fee (~2.9% + 30¢) directly to the contractor's connected account. We are the rails; Stripe is the processor.

**Routing rule:** Anything about money movement, payouts, disputes, refunds, account verification status, tax docs → **Stripe Dashboard / Stripe Support**. Anything about which features unlock card payments, why a button doesn't appear, or whether the invoice flipped to paid → **QuoteCat support (us)**.

---

## Q1. "I set up Stripe but my customer doesn't see the Pay-by-Card button. Why?"

The Pay-by-Card button only shows once **Stripe has verified your account**. Setup happens in two phases:

1. **You finish onboarding** — fills in identity, business, bank info inside the Stripe sheet.
2. **Stripe verifies the info** — this is asynchronous, typically minutes but can take longer if Stripe needs additional documents.

Once Stripe finishes, they send us a webhook (`account.updated` with `chargesEnabled: true`) and the button appears on all of your shared invoices automatically.

If it's been more than an hour: check your Stripe Dashboard → Settings → Business profile. Stripe will show whether they're waiting on additional documents from you.

**Why we wait:** if we showed the button before Stripe was ready, your customer would hit a failure at checkout. Better to fall back to your other payment methods (Venmo, Zelle, check) than ship a broken button.

---

## Q2. "I started onboarding but the browser sheet closed. Now what?"

Open the QuoteCat app → Business Settings → Card Payments. You'll see "Setup in progress" with a **Continue setup** button — tap it to pick up where you left off. Your progress is saved on Stripe's side; you don't start over.

If the screen still shows "Connect with Stripe" (not "Continue setup"), the sheet closed before any Stripe account was created — tap Connect with Stripe to start fresh. (Common cause: tapping the button, then immediately swiping the sheet away before any page loaded.)

---

## Q3. "How much does QuoteCat take from each card payment?"

**Zero.** QuoteCat does not take a cut of any payment, ever.

Stripe charges their standard processor fee — currently ~2.9% + 30¢ per successful charge. That fee is deducted by Stripe directly from the payment before it lands in your bank. You keep the rest.

This is why we say "the no-fee methods are Zelle, cash, and check — those carry zero on either side. Card always carries Stripe's fee. Most contractors will never enable cards because Venmo and Zelle handle the job. That's the point."

---

## Q4. "When does the money show up in my bank?"

That's a Stripe question. Open **Stripe Dashboard** → Payouts. The default schedule is typically rolling 2-day for new accounts; Stripe may shorten it after a few weeks of activity. Stripe shows the exact next-payout date and amount.

QuoteCat does not control payout timing, and we do not see your balance — we just flip the invoice to Paid when Stripe tells us a charge succeeded.

---

## Q5. "A customer disputed a payment. What do I do?"

That goes through Stripe. You'll get an email from Stripe about the dispute (`charge.dispute.created`); open the Stripe Dashboard and follow their dispute-evidence flow. Stripe has good documentation on this.

We don't have visibility into disputes on our side — they live entirely in Stripe.

---

## Q6. "How do I refund a customer?"

Through the **Stripe Dashboard** → find the payment → Refund. Full or partial. The refund lands back on the customer's card; Stripe handles it.

We don't currently have a refund button in the QuoteCat app. If a refund pushes the invoice below the total, we don't automatically flip the status back from Paid — you'd manually mark the invoice as partial or unpaid via the invoice screen. (Future improvement.)

---

## Q7. "Customer paid by Venmo first, then by card for the rest. Will the invoice say Paid?"

Yes. The Pay-by-Card link automatically shows the **remaining balance** (invoice total minus whatever you've already recorded via the Record Payment screen). When Stripe confirms the card payment, we add it to the cumulative paid amount. If the cumulative meets or exceeds the invoice total, status flips to Paid.

Both payments show up in your invoice's payment history — the Venmo entry you recorded, plus the Stripe one we auto-recorded.

---

## Q8. "I'm a 1099 contractor — does QuoteCat handle my taxes for card income?"

Stripe issues 1099-K forms directly when you cross the IRS reporting threshold. They mail it to you, or it's downloadable from Stripe Dashboard → Documents at year-end.

QuoteCat does not issue tax documents. Card payment income lives in Stripe; non-card payment income lives in your QuoteCat invoice history.

---

## Q9. "I want to turn off card payments. How?"

Two options:

1. **Disconnect Stripe entirely:** Stripe Dashboard → Settings → Account → close account. (Aggressive — also stops any in-flight payouts.)
2. **Keep Stripe but hide the button:** open a Stripe support ticket asking to disable charges. Once Stripe sets `charges_enabled = false`, the Pay-by-Card button disappears on the next invoice share. (Recommended — reversible.)

There isn't currently a toggle in the QuoteCat app for this — it's a future improvement.

---

## Q10. "Can my customer pay in installments / financing?"

Stripe Checkout in our current setup supports card payments only (no Affirm / Klarna / Pay-in-4). If a customer wants to pay in installments, they'd negotiate that with you directly — record each partial payment via the Record Payment screen on the invoice.

---

## Quick reference — what's a QuoteCat issue vs a Stripe issue

| Issue | Talk to |
|---|---|
| Pay-by-Card button missing despite finishing onboarding | QuoteCat first (check Card Payments screen) → Stripe if still missing after an hour |
| Money not in bank yet | **Stripe Dashboard → Payouts** |
| Need a refund | **Stripe Dashboard** |
| Dispute / chargeback notice | **Stripe Dashboard** |
| Invoice didn't flip to Paid | QuoteCat (check the webhook fired — for now, send the invoice ID) |
| Tax forms (1099-K) | **Stripe Dashboard → Documents** |
| Identity / business verification rejected | **Stripe Dashboard → Settings → Business profile** |
| Stripe payouts changed schedule | **Stripe Dashboard** |
| Want to turn off card payments | Stripe (close account or disable charges) |
| Want to change which bank account payouts go to | **Stripe Dashboard → Settings → Payouts** |

---

## What we WILL ship eventually but haven't yet

- In-app refund flow (for now: Stripe Dashboard).
- In-app card-payment toggle (for now: Stripe Dashboard).
- Push notification when a card payment lands (for now: invoice flips to Paid on next app open).
- Disputed-payment in-app alerts (for now: Stripe emails you).

Set this expectation up front when contractors ask — none of these are blockers for accepting card payments.
