# Change Orders: Portal Sync Implementation Plan

## Status: PLANNED (Not Started)

## Problem

Change orders exist in the mobile app (AsyncStorage) but don't sync to Supabase, so the portal can't display them.

---

## Current State

| Component | Status | Details |
|-----------|--------|---------|
| **Mobile: Types** | Done | `lib/types.ts` - ChangeOrder, ChangeOrderItem, ChangeOrderStatus |
| **Mobile: Diff Logic** | Done | `modules/changeOrders/diff.ts` - snapshot & compare |
| **Mobile: Storage** | AsyncStorage only | `modules/changeOrders/storage.ts` - NOT in SQLite |
| **Mobile: UI** | Done | List, Card, Modal, DiffView components |
| **Mobile: Screens** | Done | `/change-order/[id]`, `/change-orders/[quoteId]` |
| **Mobile: Sync** | Missing | No `changeOrdersSync.ts` |
| **Supabase: Table** | Missing | No `change_orders` table |
| **Portal: API** | Missing | No routes |
| **Portal: UI** | Missing | No components |

---

## Implementation Plan

### 1. Supabase Migration

**File:** `supabase/migrations/022_create_change_orders_table.sql`

```sql
CREATE TABLE change_orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  quote_number TEXT,                    -- "Q-001" for display
  number INTEGER NOT NULL,              -- CO #1, #2, #3 within quote

  -- The diff (stored as JSONB)
  items JSONB NOT NULL DEFAULT '[]',    -- ChangeOrderItem[]
  labor_before NUMERIC DEFAULT 0,
  labor_after NUMERIC DEFAULT 0,
  labor_delta NUMERIC DEFAULT 0,

  -- Totals
  net_change NUMERIC NOT NULL,
  quote_total_before NUMERIC NOT NULL,
  quote_total_after NUMERIC NOT NULL,

  -- Metadata
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, cancelled

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,                   -- soft delete

  created_by_tech_id UUID REFERENCES auth.users(id)  -- if created by a tech
);

-- Indexes
CREATE INDEX idx_change_orders_user ON change_orders(user_id);
CREATE INDEX idx_change_orders_quote ON change_orders(quote_id);
CREATE INDEX idx_change_orders_status ON change_orders(status);

-- RLS
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own change orders"
  ON change_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own change orders"
  ON change_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own change orders"
  ON change_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own change orders"
  ON change_orders FOR DELETE
  USING (auth.uid() = user_id);

-- Grant access
GRANT ALL ON change_orders TO authenticated;
```

---

### 2. Mobile: SQLite Storage

**File:** `lib/database.ts` - Add change orders table and CRUD

```sql
CREATE TABLE IF NOT EXISTS change_orders (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  quote_number TEXT,
  number INTEGER NOT NULL,
  items TEXT NOT NULL,           -- JSON string
  labor_before REAL DEFAULT 0,
  labor_after REAL DEFAULT 0,
  labor_delta REAL DEFAULT 0,
  net_change REAL NOT NULL,
  quote_total_before REAL NOT NULL,
  quote_total_after REAL NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

CREATE INDEX IF NOT EXISTS idx_co_quote_id ON change_orders(quote_id);
```

**New functions needed:**
- `listChangeOrdersDB(quoteId: string): ChangeOrder[]`
- `getChangeOrderByIdDB(id: string): ChangeOrder | null`
- `saveChangeOrderDB(co: ChangeOrder): void`
- `saveChangeOrdersBatchDB(cos: ChangeOrder[]): void`
- `deleteChangeOrderDB(id: string): void`
- `getLocallyDeletedChangeOrderIdsDB(): string[]`

---

### 3. Mobile: Update Storage Module

**File:** `modules/changeOrders/storage.ts`

Change from AsyncStorage to SQLite calls (same pattern as invoices).

---

### 4. Mobile: Sync Service

**File:** `lib/changeOrdersSync.ts` (new file, ~300 lines)

Following the exact pattern from `invoicesSync.ts`:

```typescript
export async function syncChangeOrders(): Promise<SyncResult>
export async function uploadChangeOrder(co: ChangeOrder): Promise<boolean>
export async function downloadChangeOrders(): Promise<ChangeOrder[]>
```

---

### 5. Mobile: Integrate Sync

**File:** `lib/initializeAuth.ts`

Add change orders to the sync chain:

```typescript
import { syncChangeOrders } from "./changeOrdersSync";

// In initializeAuth(), add to sync sequence
try {
  await syncChangeOrders();
} catch (error) {
  console.error("Change orders sync failed:", error);
}
```

---

### 6. Portal: API Routes

**File:** `src/app/api/change-orders/route.ts`
- GET - List change orders for a quote
- POST - Create new change order

**File:** `src/app/api/change-orders/[id]/route.ts`
- GET - Single change order
- PATCH - Update status (approve/cancel)
- DELETE - Soft delete

---

### 7. Portal: Quote Detail Integration

**File:** `src/app/dashboard/quotes/[id]/page.tsx`

Add to data fetching:

```typescript
const changeOrdersResult = await supabase
  .from('change_orders')
  .select('*')
  .eq('quote_id', quoteId)
  .is('deleted_at', null)
  .order('number', { ascending: true });
```

---

### 8. Portal: Change Orders UI Component

**File:** `src/components/ChangeOrdersSection.tsx` (new)

- List of COs with number, date, net change, status
- Click to expand/view details
- Approve/Cancel actions
- Net total summary

---

### 9. Portal: QuoteForm Integration

**File:** `src/app/dashboard/quotes/[id]/QuoteForm.tsx`

```tsx
{changeOrders.length > 0 && (
  <ChangeOrdersSection
    changeOrders={changeOrders}
    quoteId={quote.id}
    onStatusChange={handleCOStatusChange}
  />
)}
```

---

## Files Summary

| File | Action | Est. Lines |
|------|--------|------------|
| `supabase/migrations/022_create_change_orders_table.sql` | Create | ~60 |
| `lib/database.ts` | Modify | +80 |
| `modules/changeOrders/storage.ts` | Modify | ~50 changes |
| `lib/changeOrdersSync.ts` | Create | ~300 |
| `lib/initializeAuth.ts` | Modify | +10 |
| `portal/src/app/api/change-orders/route.ts` | Create | ~80 |
| `portal/src/app/api/change-orders/[id]/route.ts` | Create | ~60 |
| `portal/src/app/dashboard/quotes/[id]/page.tsx` | Modify | +15 |
| `portal/src/app/dashboard/quotes/[id]/QuoteForm.tsx` | Modify | +20 |
| `portal/src/components/ChangeOrdersSection.tsx` | Create | ~150 |

**Total: ~825 lines of code**

---

## Implementation Order

1. Migration - Create Supabase table
2. Mobile SQLite - Add table and CRUD to database.ts
3. Mobile storage update - Switch from AsyncStorage to SQLite
4. Mobile sync - Create changeOrdersSync.ts
5. Mobile integration - Add to auth init
6. Test mobile sync - Verify COs sync to cloud
7. Portal API - Create routes
8. Portal UI - Create ChangeOrdersSection
9. Portal integration - Add to QuoteForm
10. End-to-end test - Create CO on mobile, view in portal

---

## Edge Cases

1. **Tech accounts** - COs created by techs should use owner's user_id
2. **Tier groups** - COs are per-quote, not per-tier-group
3. **Archived quotes** - COs on archived quotes should be read-only
4. **Conflict resolution** - Last-write-wins (same as quotes/invoices)
5. **Offline creation** - CO created offline syncs when back online

---

## Requires

- New TestFlight build (mobile changes)
- Database migration deployment
