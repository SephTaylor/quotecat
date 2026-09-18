# Change orders: the shared contract between mobile and the portal

Written 2026-09-18. **Read this before writing change order code on either surface.**

The portal has no change order code today. It will. When it does, it must behave identically
to the app, and the way that fails is well documented: on 2026-09-18 the app and the portal
each carried their own invoice profitability calculation, they drifted, and the portal spent
an unknown period telling Premium users a profitable job had lost money. Nobody noticed
because each surface looked internally consistent.

This file exists so change orders do not repeat that.

---

## 1. What a change order is

**A modification to a signed contract.**

A quote is a proposal. Once the customer accepts it and a contract is created and signed by
both parties, the quote has done its job and becomes history. The contract is the
authoritative instrument: both sides have agreed what work happens and what gets paid for it.

When the work changes, you do not rewrite that instrument. You issue a **modification against
it**, and that modification is itself a billable document that gets signed the same way.

Consequences that follow, and that neither surface may quietly reinterpret:

- **It is not a diff.** It does not describe how a quote changed. It describes work.
- **It is not created by editing the parent.** You cannot edit a signed contract. Creation is
  always "build a new document", never "change something and let the app notice".
- **It has one parent type: a contract.** Free and Pro do not get change orders. Pro has no
  contracts, and a Pro user revising a quote should simply revise the quote.

---

## 2. One data model, and Supabase is canonical

The cloud schema is the source of truth. SQLite mirrors it. If they diverge, the sync layer
maps field by field and **a column that exists on one side and not the other is silently
dropped in transit**, with no error.

Current shape set by migration 038 and SQLite schema v22.

**Parent.** `contract_id` is the parent. `quote_id` is nullable and legacy: pre-January rows
hang off a quote and are preserved rather than rewritten, per the January decision to keep
that history. A database constraint requires at least one parent, so orphans are impossible.

**Nesting.** `parent_change_order_id` points at another change order, with cascade delete.
Uncapped depth, which Mike confirmed.

**Its own text.** `description` is what work this modification covers. `note` remains "reason
for change" and is not a substitute.

**Completion.** `completed_at` is set when the contractor taps Complete. It drives Mike's
default billing option, bill in full when complete.

---

## 3. Status lifecycle: identical to contracts, deliberately

```
draft → sent → viewed → signed → completed
                 ↓
        declined | changes_requested | expired
```

**These are the exact contract statuses**, same spellings, including `changes_requested` with
the underscore. A change order signs the way a contract signs, so it moves the way a contract
moves. Any surface inventing its own vocabulary here creates a disagreement about what state a
document is in.

Three legacy values also remain valid: `pending`, `approved`, `cancelled`. Those are from when
a change order was a diff on a quote. **Accept them, display them, never produce them.**

---

## 4. Numbering: a counter and a printed number

`number` is a plain integer counter, scoped to the parent. The first modification to a contract
is 1 regardless of what other contracts exist. Nested change orders count within their own
parent. This is settled and implemented.

`display_number` is the human-facing dotted string that prints on the document and doubles as
a purchase order reference.

**Decided 2026-09-18.** The display number appends to the parent's number verbatim:

```
CTR-001            the signed contract
  CTR-001.1        first modification
  CTR-001.2        second
  CTR-001.3        third
    CTR-001.3.1    a change to that third modification
```

Siblings count up. Depth appears only when you modify a modification.

Implemented once, in `lib/changeOrderNumbering.ts`, which is pure string logic with no imports
so the portal can mirror it exactly. **Do not write a second version.**

The parent's number is appended whole, prefix included, because the contract prefix is a user
setting (CTR, CON, anything). Parsing it off would break the day someone changes it.

Mike described the alternative reading in July, where each successive change order adds a
level: 1000.1, then 1000.1.2, then 1000.1.2.3. Rejected because the eighth reads
1000.1.2.3.4.5.6.7.8, which does not fit a purchase order field and forces you to count
segments to know which change order you hold, and because it leaves no notation for the nesting
he separately asked for. He was told the decision rather than asked, on the plan page.

---

## 5. Rules for the portal when it gets change order code

**Do not reimplement anything in this file.** Statuses, parent rules, the counter, and later
the display scheme, all have exactly one definition. If the portal needs logic the app already
has, the answer is to share or mirror it deliberately with a comment pointing here, never to
write a second version that happens to agree today.

**Totals and money follow the same rule.** Change orders will grow payment schedules,
milestones and invoices. Every one of those is a place where two implementations can drift.
The invoice profitability bug of 2026-09-18 was exactly this and it was user-visible.

**When you change a rule here, change it here first**, then both surfaces. A rule that lives
in two code files and no document is a rule that will diverge.

---

## 6. Known duplication hazards, already present

These exist today and are not caused by change orders, but they are the same pattern and they
show how easily it happens.

- **Invoice totals** are computed in at least four places: the app's `lib/calculations.ts`,
  the app's PDF generator, the portal's pay page, and `handleInvoicePayment.ts`. The last one
  carries a comment saying "If the formula changes in one place, change both", which is the
  smell rather than the fix.
- **Invoice labor cost** genuinely disagrees between surfaces right now: the portal passes
  empty labor entries and an empty team list, so it always uses the flat default ratio, while
  the app uses per-worker rates. Parked in BACKLOG.

Do not add change orders to this list.
