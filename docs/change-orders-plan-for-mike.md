# QuoteCat — Contract Change Orders

Hey Mike,

You raised this one when you asked about adding a **work change order** to a signed contract, with both signatures, so the extra dollars flow onto the contract total. Here's how I'm proposing it works. Read through and push back on anything that doesn't match how you actually run your jobs.

## What it is

A **Change Order** is a mini-contract that lives inside an already-signed contract. Same signing flow as the main contract — you sign it, send it to the customer, they sign it — but instead of standing on its own, an approved change order adds its dollar amount to the parent contract's total. When the job's done, everything rolls up into the final invoice.

Think of it as: *the original contract said $10,000. You added a $500 change order for extra outlets. The contract's effective total is now $10,500.*

## When you can start a change order

Change orders only exist on a **fully signed** contract — both you and the customer have signed, and work is either in progress or hasn't been marked complete yet.

- **If the contract status is "Signed"** → the "Create Change Order" button appears.
- **If the contract is still in Draft, Sent, or Viewed** → no change order, because the customer hasn't agreed to the base contract yet. Edit the contract itself.
- **If the contract is "Completed"** → no change order. Once the job is closed out, it's closed out. If something new comes up, you create a fresh contract for that work. (*Question for you at the bottom.*)
- **If the contract is "Declined" or "Expired"** → no change order. The base contract is dead.

## The happy path

1. Contract is signed by both parties. Work has started.
2. Customer wants to add scope (extra outlet, upgraded fixture, extra day of labor — whatever).
3. You tap **Create Change Order** on the contract screen.
4. You fill in a **description** (what's being added or changed) and a **dollar amount** (what it'll cost).
5. You sign the change order. Same signature pad as contracts.
6. You tap **Send** — same share sheet — the customer gets a link to review and sign.
7. Customer opens the link, sees the change order (description + amount + your signature), and hits **Sign**, **Decline**, or **Request Changes**.
8. If they **sign**: change order status → **Signed**. The contract's effective total updates. You get a notification.
9. When the job wraps up, you **Mark Complete** on the contract and create the invoice. The invoice shows the original contract line + each approved change order as its own line item.

## The full decision map

Change orders follow the same state machine you already know from contracts. Here's every branch mapped out.

**On the contractor side:**

- If change order is in **Draft** and you haven't signed yet → your only action is **Sign**.
- If change order is in **Draft** and you've signed → your only action is **Send**.
- If change order is **Sent** or **Viewed** (with the customer) → you can **Share** the link again, or **Revert to Draft** to edit.
- If change order is **Signed** (customer signed) → it's approved and rolled into the contract total. No further action; it just shows up as an approved change order on the contract.
- If change order is **Changes Requested** → customer has sent back a message. You **Revert to Draft**, make the changes, sign, re-send. Same loop as contracts.
- If change order is **Declined** → customer said no with a reason. You can **Revert to Draft** to re-pitch, or leave it dead.
- **Revert to Draft** on a change order clears both signatures — same behavior as contracts.

**On the customer side (on the portal):**

- If they see a change order awaiting their signature → three buttons: **Sign** / **Decline** / **Request Changes**. Sign requires typing their name first (same guardrail as contract signing).
- If they **Sign** → success takeover screen: *"Change Order approved. Total added to your project."*
- If they **Decline** with a reason → success takeover: *"You declined this change order. The contractor has been notified."*
- If they **Request Changes** with a message → success takeover: *"The contractor has been notified about your requested changes."*
- If they revisit the link after responding → they see their own response with the message they wrote. They can't accidentally re-sign or change their mind through the portal.

**On the parent contract:**

- If a change order is **in-flight** (Sent, Viewed, Changes Requested) → the contract screen shows the change order's status and its pending amount. The "Mark Complete" button is **disabled** with a note: *"Resolve the pending change order before marking this contract complete."*
- If a change order is **Signed** (approved) → it counts toward the contract's total. Contract's "Mark Complete" is available.
- If a change order is **Declined** or **Voided** → it doesn't affect the contract total. Contract behaves as if the change order was never there.

**Notifications** (same as contracts):

- Customer signs a change order → contractor gets an in-app notification: *"[Client] approved a change order on [Project]."*
- Customer declines → *"[Client] declined a change order on [Project]."* with their reason.
- Customer requests changes → *"[Client] requested changes on a change order for [Project]."* with their message.

## What you see vs what the customer sees

| State | You see (mobile) | Customer sees (portal) |
|---|---|---|
| Draft, unsigned | "Sign" button on the change order | Nothing — it hasn't been sent |
| Draft, you signed | "Send to Client" button | Nothing yet |
| Sent | "Share Link" button + status "Sent" | Change order details, Sign / Decline / Request Changes |
| Viewed | "Share Link" + status "Viewed" | Same as Sent (they opened it) |
| Signed | Rolled into contract total, marked as "Approved" | Success screen — "Change Order approved" |
| Changes Requested | Amber banner with their message + "Revert to Draft" button | Their message, no more action |
| Declined | Red banner with their reason + "Revert to Draft" button | Their reason, no more action |

## Questions for you

I've made some default calls but want your gut check on these three before we build:

1. **One in-flight change order at a time, or many?** In real work, you sometimes discover *three things at once* — bad drywall, missing outlet, wrong tile. Should the app let you send three separate change orders at once and track them independently? Or force you to bundle discoveries into one change order at a time? My default: **allow parallel change orders**, because it matches how discoveries happen on-site. But it's more moving parts on your screen.

2. **Description + amount, or full line items?** Simplest version: one description ("Extra electrical work in kitchen") and one dollar amount ("$450"). Fuller version: line items like a mini-quote, with materials and labor broken out. My default: **description + amount for v1**, add line items later if it turns out you need them. Faster to fill out on-site.

3. **Reopening a completed contract for a late change order.** Sometimes work is "done" but the customer wants one more thing right before final walkthrough. My default: **no reopening** — you create a new small contract for the add-on. Cleaner records. But if you'd rather be able to reopen a completed contract to add a change order, tell me and I'll design for that.

Let me know your calls on 1–3 and anything I got wrong on the flow above. Once you sign off, I'll build this into v1.2.15.

— JoSeph
