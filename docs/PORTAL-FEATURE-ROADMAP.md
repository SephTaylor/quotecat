# Portal Feature Roadmap

## Last Updated: Feb 12, 2026

---

## Priority Summary

| Feature | Priority | Status | Notes |
|---------|----------|--------|-------|
| **Price Data Integration** | High | Planned | Add supplier items to pricebook, show market comparison |
| **Change Orders Sync** | High | Planned | Plan saved in `CHANGE-ORDERS-SYNC-PLAN.md` |
| **Calendar View** | Medium | Backlog | After launch |
| **Client Portal** | Nice to have | Backlog | Magic link dashboard for clients |
| **Profitability Tracking** | Someday | Backlog | Track actual vs quoted costs |
| **Recurring Invoices** | Low | Backlog | Auto-generate monthly invoices |

---

## High Priority (Pre/Near Launch)

### 1. Price Data Integration

**Problem:** Pricebook is disconnected from real-time supplier pricing.

**Solution:**
- Let users browse supplier catalog and add items to their pricebook
- When added, item links to catalog (source_product_id)
- User controls their price (can differ from market)
- Show market comparison when link exists:
  - "Your price: $4.25 | Market: $3.49 (22% above)"
- Assemblies can show aggregate comparison

**Depends on:** xByte data pipeline (completed Feb 12, 2026)

---

### 2. Change Orders Sync

**Problem:** Change orders exist in mobile app (AsyncStorage) but don't sync to portal.

**Solution:** Full sync implementation - see `CHANGE-ORDERS-SYNC-PLAN.md`

**Requires:**
- Supabase migration (change_orders table)
- Mobile: SQLite storage + sync service
- Portal: API routes + UI components
- New TestFlight build

**Estimated:** ~825 lines of code across 10 files

---

## Medium Priority (After Launch)

### 3. Calendar View

**Problem:** Jobs have dates but no visual calendar in portal.

**Solution:**
- Month/week calendar view of scheduled jobs
- Click job to view details
- Drag-and-drop rescheduling
- Color-code by status or job type
- Worker assignment visibility

---

## Nice to Have (Backlog)

### 4. Client Portal

**Problem:** Clients get individual links but can't see full history.

**Solution:**
- Magic link per client (no password)
- Dashboard showing all their quotes, contracts, invoices
- Pay outstanding invoices
- Reduces "resend the link" support requests

---

### 5. Profitability Tracking

**Problem:** No way to track actual job costs vs quoted amounts.

**Solution:**
- "Edit Actuals" on completed jobs
- Enter actual materials, labor, expenses
- Show profit/loss per job
- Analytics: profitability by job type, client, time period

---

### 6. Recurring Invoices

**Problem:** Maintenance contracts require manual invoice creation each month.

**Solution:**
- Create recurring invoice schedule
- Set frequency (monthly, quarterly, etc.)
- Auto-generate invoices
- Optional auto-email

---

## Current Portal Features (Implemented)

- Quotes management with tier groups
- Contracts with e-signatures
- Invoices with Stripe payments
- Team management (workers + techs)
- Job tracking with magic links
- Pricebook with CSV import/export
- Analytics dashboard
- Business settings with Stripe Connect
