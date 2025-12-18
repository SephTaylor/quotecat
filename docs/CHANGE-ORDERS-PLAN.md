# Change Orders Feature Plan

## Overview

Change Orders (COs) track modifications to quotes after they've been sent to clients. Instead of creating separate CO documents, edits to a quote are automatically detected and can be saved as a Change Order.

## User Value

1. **Paper trail** - Document every scope change with timestamps
2. **Get paid for scope creep** - Every addition has a price attached
3. **Clear communication** - Client sees exactly what changed and cost impact
4. **Professional image** - Formal CO PDFs vs. text messages
5. **Know where you stand** - Running total always accurate

## Data Model

### ChangeOrder Type

```typescript
type ChangeOrderItem = {
  productId?: string;
  name: string;
  unit: string;
  unitPrice: number;
  qtyBefore: number;      // 0 if newly added
  qtyAfter: number;       // 0 if removed
  qtyDelta: number;       // +3, -2, etc.
  lineDelta: number;      // dollar impact of this line
};

type ChangeOrderStatus = "pending" | "approved" | "cancelled";

type ChangeOrder = {
  id: string;
  quoteId: string;
  number: number;         // CO #1, #2, #3

  // The diff
  items: ChangeOrderItem[];
  laborBefore: number;
  laborAfter: number;
  laborDelta: number;

  // Totals
  netChange: number;          // total dollar impact
  quoteTotalBefore: number;   // snapshot
  quoteTotalAfter: number;    // snapshot

  // Metadata
  note: string;               // "Client requested deck railing"
  status: ChangeOrderStatus;
  createdAt: string;
  updatedAt: string;
};
```

### Storage

```typescript
// Key: @quotecat/change-orders
type ChangeOrderStore = {
  [quoteId: string]: ChangeOrder[];
};
```

## Tier Selection Logic

When client picks a tier from linked quotes:

1. Selected tier → status: `approved`
2. All sibling tiers → status: `archived`

Switching tiers only allowed if no COs exist on currently approved tier.

## CO Creation Flow (Auto-Diff)

1. User opens quote (status: `sent` or `approved`)
2. System snapshots current state (items, labor, total)
3. User makes edits
4. On save, system calculates diff
5. If material changes detected (dollar amount changed):
   - Modal: "These changes add/remove $X. Save as Change Order?"
   - Options: [Save as CO] [Just Save] [Cancel]
6. If [Save as CO]:
   - Prompt for note (optional)
   - Status defaults to `pending`
   - CO created with diff data
   - Quote updated to new state

## When COs Can Be Created

| Quote Status | Can Create CO? |
|--------------|----------------|
| draft        | No             |
| sent         | Yes            |
| approved     | Yes            |
| completed    | No             |
| archived     | No             |

## Edit Warning

When editing a quote that has COs:

> "This quote has 2 change orders. Editing may affect your totals. [View Change Orders]"

Dismissible banner, doesn't block editing.

## CO Statuses

- **Pending** - Proposed, awaiting client approval. Can be deleted.
- **Approved** - Client agreed. Can be cancelled (keeps record).
- **Cancelled** - Was approved but reversed. Stays in history, doesn't count toward total.

## Project Total Calculation

```
Project Total = Current Quote Total
```

Note: Quote total already reflects all changes. COs are just a historical record of what changed and when.

## UI Components Needed

### 1. Quote Detail - Change Orders Section
- Shows below items/labor
- "Change Orders (3)" header
- List of COs with: number, date, net change, status badge
- Tap to view CO detail

### 2. CO Detail Screen
- Header: "Change Order #2"
- Status badge (Pending/Approved/Cancelled)
- Date created
- Note (if any)
- Items section:
  - Added items (green +)
  - Removed items (red -)
  - Modified items (show qty change)
- Labor change (if any)
- Net change amount
- Actions: Approve / Cancel / Delete (based on status)

### 3. Save Modal (CO Prompt)
- Triggered on save when material changes detected
- Shows: net change amount, items changed count
- Note input field
- Buttons: [Save as Change Order] [Just Save] [Cancel]

### 4. Edit Warning Banner
- Shown at top of quote edit screen
- "This quote has X change orders. Editing may affect your totals. [View Change Orders]"
- Dismissible

### 5. Tier Selection UI
- "Select This Option" button on each tier
- Confirmation: "Select [Tier Name] as the chosen option?"
- After selection: selected tier shows "Selected" badge, others grayed out

## PDF Export

### CO PDF Contents
- Header: "Change Order #X"
- Reference: Quote name, client name
- Date
- Table: Item | Qty Change | Unit Price | Line Impact
- Labor change (if any)
- Net change
- New project total
- Note
- Signature line (future)

## Implementation Order

1. **Data model & storage** - Types, CRUD functions
2. **Diff logic** - Snapshot, compare, calculate changes
3. **CO list on quote detail** - View existing COs
4. **CO detail screen** - View single CO
5. **Save modal** - Prompt on material changes
6. **Edit warning banner** - When quote has COs
7. **Tier selection** - Approve/archive siblings
8. **PDF export** - CO as document
9. **Status management** - Approve/cancel flows

## Future Enhancements

- Client signature capture
- Email CO to client
- CO approval workflow (send for approval, track response)
- Analytics (CO frequency, average change amount)
