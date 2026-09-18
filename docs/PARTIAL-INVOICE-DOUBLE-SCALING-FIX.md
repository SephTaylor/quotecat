# Partial invoices bill the square of the percentage

Written 2026-09-18. Verified against the live database and by reading every site that touches
the invoice percentage, in both the app and the portal.

---

## The bug

Ask for a 50% down payment and the app invoices 25%. Ask for 30% and it invoices 9%. The
requested percentage *p* is billed as *p squared*.

The scaling happens twice. `createInvoiceFromQuote` multiplies item quantities, labor and the
material estimate by the percentage and saves that, **and** stores the percentage on the row.
Every reader then sees `percentage < 100` and multiplies the total by it again.

The app and the portal agree with each other, so the contractor is not shown one number while
the customer gets another. They are both shown the wrong one.

**Production impact: none. Zero rows are affected.**

An earlier draft of this document said INV-003 was under-billed by half. That was wrong, and
the way it was wrong is worth recording. The figure was calculated by assuming the row had
been pre-scaled, rather than by checking. It had not been.

INV-003 holds the **full** job (36 troffers, 12 sensors, 6 exit signs, 36 bypass kits, labor
$5,500), identical to its source quote `Oakwood Office Lighting Retrofit`. The job totals
$16,745.35 and the invoice displays $8,372.68, which is exactly half. **It is correct.** It
appears to be seeded data written straight to the database rather than created through
`createInvoiceFromQuote`, which is why it escaped the pre-scaling.

There is a useful accident in that: INV-003 is a full-amount row carrying `percentage = 50`
that renders correctly everywhere. It is a working example of the model this change adopts.

**The bug in the code is real and unchanged.** Anything created through the app today is
double-scaled. On this same job, the app would store half the quantities and half the labor,
then halve the total again at render, and a 50% deposit would show **$4,186.34** instead of
$8,372.68. The feature is reachable from the quote review screen, behind a prompt asking for a
down payment percentage between 1 and 99. Nobody has used it, which is luck rather than
design.

---

## The fix goes on the write side, and the code says so itself

Two ways to resolve a double-scale: stop scaling at write, or stop scaling at read. The
existing code already tells us which was intended.

The portal PDF renders a deduction row (`quotecat-portal/src/lib/pdf.ts:1036`):

```
Subtotal                    $15,797.50
Tax (6%)                       $947.85
Partial Invoice (50%)       -$8,372.68
Invoice Total                $8,372.68
```

That row only makes sense if the stored invoice holds the **whole job** and the percentage
deducts the part not being billed yet. Today the line items are already halved, so the
document deducts half from a number that was already half, and the result is incoherent as
well as wrong.

The portal's own creation preview agrees. `dashboard/invoices/new/page.tsx:264` computes
`getQuoteTotal(quote) * (percentage / 100)` from the **unscaled** quote, so the contractor is
shown the correct figure at the moment of creation and then the created invoice shows a
quarter.

There is also a presentation problem that disappears with this fix. Scaling quantities means
a 50% invoice on ten outlets prints **five outlets**, and an odd quantity prints something
like 1.5 outlets. The customer receives a document describing work that is not what was
agreed.

**Decision: an invoice row stores the full amounts. The percentage is applied once, at read
time, and shown to the customer as a deduction.**

---

## The change

### 1. Stop pre-scaling at write. Four sites, two files.

- `quotecat/lib/invoices.ts`, `createInvoiceFromQuote` (~190 to 198)
- `quotecat/lib/invoices.ts`, `createInvoiceFromContract` (~250 to 257)
- `quotecat-portal/src/app/api/invoices/route.ts`, contract branch (~93 to 100)
- `quotecat-portal/src/app/api/invoices/route.ts`, quote branch (~140 to 147)

Each drops the `multiplier` from items, labor, material estimate and overhead, and copies the
source values straight across. Keep setting `percentage` and `isPartialInvoice`. Keep the
notes prefix, which already reads "50% Payment for [job]".

### 2. Add the deduction line to the app PDF

The portal PDF explains itself. The app PDF does not: it multiplies the grand total silently
and offers only a "50% Down Payment" badge (`quotecat/lib/pdf.ts:670`). With full amounts
restored, a customer would see line items totalling $16,745.35 and a total of $8,372.68 with
nothing connecting them.

Add the same deduction row the portal uses, so the app and portal documents match.

### 3. No data correction is needed

This step was planned and then dropped. INV-003 was checked against its source quote and
already holds full amounts, so it conforms to the new model without being touched. There are
no other partial invoices in production.

### What deliberately does not change

**All eleven read sites stay exactly as they are.** They already implement the intended model:
`lib/calculations.ts:120`, `lib/pdf.ts:602`, and nine sites across the portal covering the
dashboard list, the invoice detail page, the customer payment page, the payment success page,
`handleInvoicePayment.ts:47` and the portal PDF.

Touching them would be the larger, riskier change and would leave the documents incoherent.

---

## Risks, and what we are doing about them

**Deployment order does not matter, and that is worth understanding rather than assuming.**
We are only changing what gets **written**. Every reader already assumes full amounts. So an
old app reading a row written by the new portal gets the **correct** number, and a new app
reading an old row gets the same wrong number it always did. There is no version in which
this makes an existing invoice worse.

The one consequence of lag: an app version still carrying the old code keeps creating
pre-scaled invoices. That argues for getting the app update out promptly, not for sequencing
the two releases.

**Profitability would have started double-counting. Fixed as part of this change.**
`calculateInvoiceProfitability` takes revenue from `totals.subtotal` and costs from the raw
material and labor figures, none of which the percentage is applied to. The dashboard margin
card sums profit and revenue across every paid invoice.

Under the old pre-scaled data that summed correctly by accident: each partial held a
scaled-down copy of the job, so two halves added up to one job. With full amounts stored, each
half would have reported the **whole** job's profit and the dashboard would have counted it
twice.

So `calculateInvoiceProfitability` now scales revenue, material cost and labor cost by the
billed share. The margin percentage is unchanged (a partial invoice has the same margin as the
job), but the absolute figures are now the invoice's own slice and the slices still add up.
This was not a pre-existing bug. It is a regression this change would have introduced, caught
before shipping.

**Payment processing is in the blast radius.** `handleInvoicePayment.ts:47` applies the
percentage, so Stripe currently charges the doubly-scaled amount. After the fix it charges the
right one. Test a real partial payment end to end rather than trusting the display.

**No write to production is required.** The data correction that was planned turned out to be
unnecessary once the row was actually inspected.

---

## Dead code removed alongside

`lib/invoicesSQLite.ts` has been **deleted**. It was an orphaned duplicate of the whole invoice
layer, created 3 January in the SQLite migration, last touched 8 January, with **zero imports
anywhere** in the app.

It mattered because it carried the pre-fix markup rule. The commit that corrected markup
(`424a1a2`, "fix markup calculation") landed 14 January, six days after that file stopped being
maintained, so it still applied markup to labor and overhead where the canonical calculation
applies it to line items only. It also carried this same double-scaling bug.

Same function name as the live one, different answer. One wrong import would have silently
changed every invoice total in the app.

---

## Verification

1. **Before touching anything**, record what INV-003 currently displays in the app, in the app
   PDF, and on the portal. Those three numbers are the baseline.
2. **Create a 50% invoice from a quote** and confirm the app, the app PDF, the portal list, the
   portal detail page and the portal PDF all show half the job, not a quarter.
3. **Confirm the line items read correctly.** Ten outlets should print as ten outlets, with the
   deduction row explaining the total.
4. **Create a 50% invoice from a contract** and repeat. The contract path is separate code in
   both the app and the portal.
5. **Create one from the portal** as well as the app. Four write sites, all four exercised.
6. **Create a 100% invoice** and confirm nothing changed: no percentage stored, no deduction
   row, no behaviour difference.
7. **Take a real partial payment** through the customer payment page and confirm the charge
   matches the invoice.
8. **Confirm INV-003 has not moved.** It reads $8,372.68 today and that is correct. If this
   change is right, it still reads $8,372.68 afterwards. This row is the regression test.
9. **Publish per platform** (`--platform ios`, `--platform android`); the web bundle still
   fails on `expo-sqlite` so `--platform all` does not work.
