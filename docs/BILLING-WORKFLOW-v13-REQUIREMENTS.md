# Billing Workflow v1.3: requirements status

Written 2026-09-17, after reading Mike Kane's full review.

**Source of truth for the plan**: the page Mike actually reviewed, at
`portal.quotecat.ai/plan/change-orders`. The four older change order documents in this
folder (`CHANGE-ORDERS-PLAN.md`, `CHANGE-ORDERS-SYNC-PLAN.md`,
`change-orders-plan-for-mike.md`, `change-order-simplification-plan.md`) all predate it and
are superseded. Last touched between December 2025 and July 2026.

**Source of truth for Mike's position**: 27 recorded responses, 15 with comments, running
2026-07-02 through 2026-09-10.

---

## 1. The finding that reorders everything

The plan describes a change order as a document: something you build, sign, send for
countersignature, bill on its own schedule, and mark complete.

**In the app today a change order is not a document. It is a record of an edit.**

You open an approved quote, change something, and the app captures what the total was
before, what it is after, and an optional sentence about why. That is the whole feature. A
change order has no scope text of its own, no signature, no payment terms, no customer
view, and no way to be attached to a contract. It only ever attaches to a quote.

So the gap between the plan and the code is not a list of missing features. It is a change
in what the thing **is**. That is what forces the build order below.

### What is already built

Contract signing works end to end. The contractor signs on the phone, the customer opens a
link, signs in the browser, and can also decline or request changes. That flow is real and
it is the model the plan says change orders should copy.

There is also an unused table called `change_order_shares`, which was meant to be the
customer link for a change order. Nothing anywhere in the app or the portal references it.
It is an empty slot waiting for the work below.

### What is not built at all

**Progressive billing does not exist.** Not partly, not in draft. There is no payment
schedule, no milestone, no percentage, nowhere to store any of it. Everything the plan says
about deposits, milestones and percentages is unwritten.

Invoices are also not connected to contracts. An invoice can point back at a quote, but not
at a contract and not at a change order. Billing a milestone requires that link.

---

## 2. What Mike has settled

These are closed. He either agreed with no comment or agreed and explained why.

- **Numbering.** His scheme, adopted exactly. Contract 1000, then 1000.1, then 1000.1.2.
  **No cap on depth.** He asked whether a cap would force a new contract, was told no (a cap
  would only force a new change order at the parent level), and agreed.
- **Reopening a finished job for a late change order.** Allowed, and the contract number is
  retained. His words: this will happen on almost every job and the number is the anchor for
  cost tracking, especially when it is tied to a purchase order number.
- **Change orders bill independently of the parent contract.** His $5,000 contract with a
  $10,000 change order is the case that killed the old approach.
- **Default billing for a change order is "bill in full when complete."** This was his
  proposal, not ours. He wanted a Complete button, because the customer will not want to pay
  until the work is done. Adopted and made the default.
- **Percentages, not fixed dollar amounts.** His experience is that no contractor he knows
  uses a set dollar amount.
- **Change orders sign the same way contracts do.** Same signature pad, same customer link,
  same three buttons.
- **Tier availability.** Free gets nothing. Pro gets change orders and billing on quotes.
  Premium adds them on contracts. He called it reasonable.
- **Acknowledge is required, with a contractor override after 7 days.** He pushed back hard
  on acknowledgement being merely informational, and the required version plus the override
  is what he agreed to.

---

## 3. What Mike asked for on 2026-09-10

One new request, attached to his agreement on the acknowledgement question:

> "Looks good but if possible under contractor manual override after 7 days: if customer
> signed a hard contract or change order (paper) would be nice if a pic of signature could
> be added to the particular file in the app for easy future reference or for easy
> visibility to multi users"

Read plainly: when a customer signs on paper instead of on the screen, let the contractor
photograph that signature and keep it with the record, so anyone on the crew can see the
job really was signed.

This is a sensible ask and it is cheap to build **once change orders can hold a signature at
all**. It is not cheap to build before that, because there is nowhere to put it.

It is also not fully specified. See the questions in section 5.

---

## 4. Build order, and why it cannot be shuffled

Four stages. Each one needs the one before it. Nothing here can be parallelised except
within a stage.

### Stage one: make a change order a document

Give a change order its own identity instead of treating it as an edit to a quote.

That means it can belong to a contract as well as a quote (today it can only belong to a
quote, which is why Premium contract change orders are impossible). It means the number
becomes text like `1000.1.2` instead of a plain counter, and it knows which change order it
hangs off. It means it carries its own scope description and its own status through a
signing life, rather than just pending, approved or cancelled.

**Why first**: every other stage writes to this record. Building signing or billing on top
of the current shape means building it twice.

**Ships nothing the customer sees.** This is groundwork.

### Stage two: signing

Let a change order be signed by the contractor, sent to the customer, and countersigned,
using the same machinery contracts already use.

The customer side needs a page that does not exist yet. The link table is already there and
unused, so this is building the page, not inventing the mechanism.

**Mike's photo request lands here**, because this is the stage that creates a place for a
signature to live. Doing it in the same stage costs very little. Doing it earlier is not
possible.

**Why second**: a change order has to be signable before it can be billable, because the
plan ties billing to signature (bill in full when signed is one of the four options).

**First stage the customer sees anything.**

### Stage three: payment schedules and billing

This is the largest stage and it is genuinely new construction, not modification.

A schedule is a list of milestones, each a percentage of its parent, summing to 100. A
contract can have one. Each change order can have its own. Marking a milestone due produces
an invoice, which means invoices finally need to know which contract and which change order
they came from.

The Complete button lives here too, since "bill in full when complete" is the default and
Complete is what fires the invoice.

**Why third**: it needs stage one for the record and stage two for the signature that
triggers billing.

**This stage is the one with unresolved requirements.** See questions three and four.

### Stage four: schedule amendments and acknowledgement

Changing a schedule after signing, the customer's acknowledgement banner, the 7-day
contractor override with a note saying how it was actually confirmed, and the Share or
Email prompt that tells the customer there is something to look at.

**Why last**: you cannot amend a schedule that does not exist.

**This stage has an unresolved requirement.** See question five.

---

## 5. Open questions for Mike

Six. Stages one and two can start without answers. Stages three and four cannot finish
without them.

### Question one: does a photographed signature count as signed?

If a customer signs on paper and the contractor photographs it, is that change order
**Signed**, or is it still on the 7-day manual override with a photo attached as proof?

This matters more than it sounds. Mike's whole position is "I want everything with my
customer LOCKED IN." A photo treated as a real signature is stronger for him and weaker for
us, because we did not witness it and cannot timestamp it the way we can a signature taken
on the screen. A photo treated as evidence attached to an override is honest about what it
is, but it leaves the change order in a status he may not accept.

Our recommendation is evidence attached to the override, not a substitute signature. He
should get the choice, because he is the one who has to defend it when a customer refuses to
pay.

**Blocks**: stage two.

### Question two: is the photo for change orders only, or contracts too?

He wrote "the particular file," which could be either. Contracts get signed on paper at
least as often as change orders do. If it is both, it costs almost nothing extra in stage
two and a lot more later.

**Blocks**: stage two.

### Question three: what does Complete do when a change order has its own schedule?

He asked for a Complete button that bills the change order in full. That is clean when the
change order has no schedule.

But the plan also offers a custom schedule per change order. If a change order has three
milestones and two are already invoiced, and the contractor taps Complete, what should
happen? Bill the remaining balance? Do nothing, because the schedule governs? Hide the
button entirely when a schedule exists?

Nobody has answered this because nobody has asked it.

**Blocks**: stage three.

### Question four: when a change order moves the total, what happens to milestones already invoiced?

This one is a real defect in the plan, not just a gap.

The plan says every milestone is a percentage of the parent total, and that when the total
changes each milestone automatically recomputes. That is correct and helpful for milestones
that have not been billed.

For a milestone that has already been invoiced, it is wrong. A 30% deposit invoiced at
$4,500 against a $15,000 contract would silently become $6,000 the moment a change order
pushed the contract to $20,000. The invoice the customer already has would no longer match
the app.

The likely right answer is that an invoiced milestone freezes at its dollar amount and the
remaining milestones absorb the change. But Mike tracks profit per change order, so how this
reconciles is his call, not ours.

**Blocks**: stage three. This is the most important of the six.

### Question five: what counts as a "larger" amendment?

The acknowledgement answer he agreed to says that larger schedule amendments get a light
signature rather than a plain acknowledgement. Nobody ever said larger than what. There is
no threshold, no percentage, no dollar figure.

**Blocks**: stage four.

### Question six: what does a Pro change order number hang off?

His numbering scheme is written around contracts, and contracts are Premium. Pro gets change
orders on quotes instead. So on Pro, does the first change order on quote Q-1042 become
1042.1, or something else?

Small, but it shows up on the printed change order and on the purchase order reference, so
it should be right the first time.

**Blocks**: stage one (mildly). Can be decided without him if he does not care.

---

## 5a. Sprint to release mapping

Four sprints, three releases.

**First release: sprints one and two together.** Sprint one shows the user nothing (it is
the document model), so shipping it alone has no value. Sprint two is what Mike can hold:
change orders he can build, sign, send and get countersigned, plus the paper signature
photo. At the end of it he can run a job with change orders from beginning to end.

**Second release: sprint three.** Payment schedules, percentage milestones, the Complete
button, and invoices that finally know which contract and which change order they came
from. This is the largest sprint and all of it is new construction.

**Third release: sprint four.** Schedule amendments, the acknowledgement banner, the 7 day
contractor override.

**The honesty point that went into the plan page**: Mike said he wants to run a whole house
through the app from beginning to end. The first release gets him change orders end to end.
It does not get him deposits or milestone invoicing. If that is what beginning to end means
to him, he is waiting on the second release, and he needed to be told that before he starts
the job rather than during it.

---

## 6. One thing that was deferred, and is now back in front of him

Mike's strongest objection was never really about acknowledgement. It was this:

> "Also keep in mind the contractor using your app may not be the end customer. My customer
> may be a general contractor whose customer is the end customer. General contractors don't
> always communicate well with end customer. I want everything with my customer LOCKED IN.
> If the general didn't communicate with his customer that's his problem."

He is describing being a subcontractor. The person he signs with is not the person who owns
the building, and he wants the person he signs with pinned down regardless of what happens
further up the chain.

The answer he was given was a future feature (copy additional contacts on amendments),
explicitly pushed to the backlog and out of v1.3. He accepted that without arguing.

Worth being honest that his underlying worry is unaddressed. The 7-day override does not
solve it, because it is not about the customer being slow. It is about the wrong customer
being on the paperwork.

**This is now question five on the plan page**, rather than sitting silently on a backlog.

The useful reframing: what he described is not a notification problem, which is what the
backlog item was written as. Two different readings, and they land in different sprints.

- If the end customer just needs to be **copied on updates**, that is an extra contacts
  field on the contract, and it belongs in **sprint four** with the amendment notices.
- If the end customer needs to be **named on the paperwork** so nobody can later claim they
  never knew, that is part of who signs, and it belongs in **sprint two**.

If he answers with the second reading, **the first release changes shape**. That is the
reason this could not stay on a backlog: it is a scope question disguised as a nice to
have.

---

## 7. A gap in the review itself

There are four plan pages. Mike has reviewed three of them:

- change orders, 27 responses, current through 2026-09-10
- progressive billing, 13 responses, last touched 2026-07-02
- job costing, 12 responses, last touched 2026-07-02

**Multi-user workflow has zero responses. He has never opened it.**

That is the plan built out of his own foreman-assembles-owner-approves comment, and his new
photo request points straight into it when he says "for easy visibility to multi users."

Stage three and stage four do not depend on it. But his September comment is partly a
multi-user comment sitting on a billing plan, and that plan has not been read.

---

## 8. Verdict

**Not a fully defined requirement.**

Stages one and two are fully defined and can begin now, with the single caveat that
questions one and two should be answered before the photo piece is designed. That is a
conversation, not a blocker, and everything else in those two stages is settled.

Stages three and four are not ready. Four and five are genuine holes, and question four is a
defect that would produce wrong invoices if built as written.

**Done on 2026-09-17**: the plan page at `portal.quotecat.ai/plan/change-orders` now opens
with the five questions, followed by the list of what he has already settled, followed by a
collapsed block holding the full plan and all sixteen of his prior answers rendered
read-only.

**Sprint and release sequencing was deliberately kept off that page.** It was written for
us, and in front of a tester it read as doubt about whether the work would land in his build.
It lives here instead. Question six (the Pro numbering anchor) is stated to him as a decision
already made rather than asked, so he can object but does not have to answer.

The verbal promise about what his test build contains is a separate call, and it is the one
place where the sequencing above still has to be told to him honestly.

He has also made it clear he is waiting:

> "When you have all changes complete, uploaded, and working let me know. I have a new house
> I need to quote soon and I will use your app for the whole process from beginning to end."
