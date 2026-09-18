# Change orders: what is actually there, and why

Written 2026-09-17, from a discovery pass against the live database, the app source, the
portal source and git history. No code or data was changed.

Read this before touching change orders. The short version is that the feature was built,
worked, and was **deliberately switched off in January**, keeping its read side alive. Anyone
who starts from the current code without knowing that will either rebuild the thing that was
rejected, or conclude the feature was never finished. Both are wrong.

---

## 1. The January decision, which is the starting point

`docs/change-order-simplification-plan.md`, dated **7 January 2026**, marked
**IMPLEMENTED**. Its own statement of the problem:

> The current change order flow is too complex:
> 1. Edit approved quote → add items → save → CO modal → create CO
> 2. Quote reverts to original (confusing, user thinks they lost work)
> 3. Must navigate: purple button → CO list → tap pending CO → approve/reject
> 4. No way to edit a pending CO (must cancel and redo)
> 5. Too many screens, overwhelming UX

What it replaced that with: editing an approved quote now saves immediately and appends a
formatted text block to the quote's change history field. No change order is created.

**What it removed**, checked off as done:

- the `ChangeOrderModal` component and its use in the quote editor
- the change order mode flag in the materials navigation
- the purple change order banner on the edit screen

**What it deliberately kept**, each annotated in the original:

- the change order routes and screens, "kept for historical data viewing"
- the snapshot and diffing logic, "kept, used for auto-logging"
- the change order database and storage functions, "kept for historical data"

So the current state is not an unfinished feature. It is a **finished feature with its
creation path removed on purpose**, and a read side left standing so older data stayed
visible.

**This matters for Mike's plan** because the January complaint was that the quote appeared
to revert and the user thought they had lost work. Mike's design does not have that problem:
a change order becomes its own document that gets signed and sent, rather than a modal that
rewinds the quote you were editing. But the failure mode is documented, and rebuilding the
old shape would walk straight back into it.

---

## 2. What that leaves running today

**Nothing in the app creates a change order.** Verified by reading the files, not by
searching them: `ChangeOrderModal` is exported but mounted nowhere; `useChangeOrders` returns
`create`, `update` and `remove`, and **both** of its consumers destructure only
`{ changeOrders, loading, netChange, refresh }`; and no code anywhere constructs a change
order object.

`ChangeOrderList.handleAddChange` says so itself, in a comment: the fall-through to the quote
editor is temporary and *"the manual '+ New CO from scratch' flow is planned per the Billing
Workflow (v2) plan Mike approved but not built yet."*

**Everything that reads one still works.** The list on the quote review screen (gated to Pro
and Premium at `app/(forms)/quote/[id]/review.tsx:860`), the detail screen with approve and
delete, the change order counts and badges on the dashboard and quotes tabs, the PDF
generator, the types, the sync layer.

**The empty state makes a promise the app no longer keeps.** It reads: "When you edit this
approved quote, changes to materials, labor, or scope will be tracked here as change orders
you can send for re-approval." Editing an approved quote writes text to the change history
field and sets the quote back to draft. The v1.2.17 fix made that empty state
*discoverable*, which is why Mike found it. The empty state is all there is.

---

## 3. What the live database says

Introspected directly, not read from migration files, because the two disagree.

**`change_orders` has zero rows.** Across all 38 accounts.

**Migration 024 was only partly applied.** It declares four indexes and an `updated_at`
trigger. Live, the table has **only its primary key index and no triggers at all**. Migration
027 (the share tokens) applied cleanly, so this is partial application of one migration, not
a missing one.

**Shape**: 18 columns. The quote link is required and there is no contract link. The number
is an integer. Status is constrained to pending, approved or cancelled. Nothing for
signatures, schedules, completion or a description of its own. The only free text is a `note`
field, labelled "Reason for Change (Optional)" in the interface.

**`change_order_shares` exists, has its indexes, has zero rows, and is referenced by no code
anywhere.** It carries tokens, expiry and revocation. It is a clean stub waiting for a
customer-facing page.

**Neighbouring volumes**: 37 invoices, 28 quotes, 5 contracts, 3 signatures, 0 change orders.

**Tier spread**: 29 free, 9 premium, **zero Pro**.

---

## 4. Two storage layers that do not agree

Swept the whole app for this, not just change orders.

**Change orders are the only entity still living in AsyncStorage**, and the split is exactly
one import line: `modules/changeOrders/hooks/useChangeOrders.ts:13` imports from
`../storage`, the AsyncStorage implementation. That hook is what powers the list on the quote
review screen and the standalone list screen.

Everything else on that side of the app is already on SQLite. Quotes, invoices and clients
were migrated by `lib/asyncStorageMigration.ts`. Products, categories, assemblies and the
pricebook are on SQLite, and their old AsyncStorage key definitions in `lib/storageKeys.ts`
have **zero consumers**, so those are dead declarations. Clients touch AsyncStorage only to
remember the last created client id, which is a pointer, not a store. The remaining
AsyncStorage keys are all legitimate small key-value state: preferences, theme, session, sync
metadata and locks, feature flags, review prompt counters, startup counters, logo.

`lib/asyncStorageMigration.ts` does not handle change orders despite the table comment in
`lib/database.ts` describing the table as migrated from AsyncStorage.

### Three consequences, in order of severity

**1. Re-enabling creation on the existing hook writes to the wrong database.** The hook's
`createChangeOrder`, `updateChangeOrder` and `deleteChangeOrder` are all the AsyncStorage
versions. Sync only ever reads SQLite. So a change order created through the current hook
would **never reach the cloud and never reach a second device**, silently, for a paying
customer. This is the single most dangerous thing in the change order code right now, and it
is invisible today only because nothing calls the create function.

**2. On an install that had change orders before January, the list and the detail screen
disagree.** The list reads AsyncStorage and shows them. Tapping one routes to the detail
screen, which reads SQLite by id and does not find it. Anyone carrying pre-January data has a
list of change orders that cannot be opened.

**3. `cleanupAsyncStorage()` exists and is never called.** Quotes, invoices and clients were
copied into SQLite and their AsyncStorage originals were left in place. Harmless today
because nothing reads those keys, but it is unbounded stale duplicate data on every device,
and a trap for anyone who later reads one of those keys and gets a frozen pre-migration
snapshot. The migration itself is guarded, so it cannot double-import.

### Recommended resolution

Do not keep both. In order:

1. Extend `lib/asyncStorageMigration.ts` to carry change orders across, so the pre-January
   history the January decision deliberately preserved is not thrown away.
2. Point `useChangeOrders` at `storageSQLite`. One import line.
3. Delete `modules/changeOrders/storage.ts`.
4. Call `cleanupAsyncStorage()` once the change order key is included in it, and drop the
   dead key definitions in `lib/storageKeys.ts`.

Steps 1 and 2 must land **before** any work that re-enables creation, or the first new change
order goes to a store nothing syncs.

---

## 5. What to look out for

**The missing `updated_at` trigger becomes a real bug as soon as the portal writes.** Sync
pulls incrementally with `.gt("updated_at", since)` (`lib/changeOrdersSync.ts:276`), and
today the device writes that timestamp itself, so it works. When a customer signs a change
order on the web and the portal updates the row server side, **nothing will bump
`updated_at`, and no device will ever pull the change.** This has to be fixed before the
customer-facing page ships, not after.

**Foreground sync skips change orders.** `hooks/useForegroundSync.ts` syncs quotes, invoices
and clients. Change orders sync only on auth initialisation (`lib/auth.ts:304`) and on a fire
and forget upload at write time, whose failures are logged and swallowed.

**There are no Pro accounts.** The Pro path (change orders on quotes rather than contracts)
cannot be tested on a real account and needs a deliberately created test user.

**The diff engine is real, working and unused.** `modules/changeOrders/diff.ts`,
`createSnapshot`, `calculateDiff`, `resetSnapshot` and the `useChangeDetection` hook all
exist and are exported. The quote editor reimplemented the same comparison inline instead of
calling them. Decide whether to adopt the module or delete it rather than leaving both.

**Leftover debris**: `formatChangeHistory` at `app/(forms)/quote/[id]/edit.tsx:497` is
defined and never called, orphaned when the inline version at line 655 replaced it.

---

## 6. Blast radius

Small, which is the one piece of good news.

Four read sites touch change orders, and all four read a table that is empty in the cloud and
only reachable in AsyncStorage for anyone still carrying data from a build older than
January.

**There is no production change order data to preserve.** Any migration against this table is
additive against an empty table. The risk is in the surrounding code paths, not the data.

The portal is not affected at all. Its only change order references are the plan review pages
that describe the feature to Mike, and the plan registry. There is no functional change order
code in the portal.

---

## 7. What this changes about the build

The work is not "add change orders." It is **re-enable change orders in the shape Mike
designed**, which is a document that gets signed and sent rather than a modal that rewinds a
quote.

Most of the parts are still in the box: storage on both sides, sync in both directions, the
diff engine, the PDF generator, the detail screen, the types, and an unused share token
table that is exactly what the customer-facing page needs.

What genuinely has to be built is a creation path that produces a document, the signing flow
around it, and the billing on top. What has to be **decided first** is whether creation hangs
off editing a quote again (the January shape, which failed) or off an explicit "add a change
order" action (which is what a signable document implies).

---

## 8. How to re-check any of this

- Live schema and data: query the Supabase project directly rather than reading
  `supabase/migrations/`. The two disagree on migration 024.
- Whether anything creates a change order: search for its required fields
  (`quoteTotalBefore`, `laborDelta`), not for function names. Function names find
  definitions; required fields find construction.
- Beware shell globbing when searching. Unquoted `--include=*.ts` fails outright in zsh and
  prints a shell error rather than returning no matches, which reads like an empty result.
