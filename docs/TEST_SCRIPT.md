# QuoteCat Test Checklist

## Quick Smoke Test (5 min)
Do this after every build:

- [x ] App launches without crash
- [ x] Create a quote (+ button top-right)
- [ x] Add materials, save quote
- [ x] Quote shows in list
- [ x] Swipe left → duplicate/export
- [ x] Swipe right → delete
- [ x] Export PDF, verify it looks right

---

## Free Tier (logged out)

**Quotes:**
- [ x] Create quote with name, client info
- [ x] Add materials from catalog (+/- buttons work)
- [ x] Labor, markup, tax calculate correctly
- [ x] Save, edit, duplicate, delete quotes
- [ x] Long-press for multi-select mode

**Exports:**
- [x ] PDF export works (check limit counter)
- [ x] CSV export works

**Verify limitations:**
- [x ] NO client suggestions when typing
- [x ] NO "save client" prompt on save

---

## Pro Tier (logged in as Pro)

**Cloud sync:**
- [ x] Quotes sync to Supabase after save

**Client Manager (Pro Tools tab):**
- [x ] Add, edit, delete clients
- [ x] Client suggestions appear when typing in quotes
- [ x] Selecting client auto-fills all fields
- [ x] "Save this client?" prompt appears for new clients

**Assemblies:**
- [x ] Create assembly with multiple items
- [x ] Add assembly to quote


⏺ Pro Features to Test:

 x - Cloud sync - Quotes, invoices, clients syncing to Supabase
 x - Client manager - Save clients, auto-populate on quotes
 x - Custom assemblies - Create, edit, use on quotes
 x - Company branding - Logo and company info on PDF exports
  x - PDF/CSV exports - Unlimited exports working
  x - Change order tracking - The flow we just built (modify approved quote → changes logged)
  x- Invoices - Create from quotes, track payment status
  - Multi-device - Sign in on another device, data appears

---

## Premium Tier (logged in as Premium)

**Price Book (Pro Tools tab):**
- [ ] Add custom items with price/unit
- [ ] Price Book items appear in Materials picker
- [ ] Add Price Book items to quotes

**Change Orders: PORTAL ONLY**
- [ ] Edit a "Sent" quote → prompted for reason
- [ ] Change order shows in Review screen

---

## Test Accounts

| Tier | Email | Password |
|------|-------|----------|
| Free | (logged out) | - |
| Pro | | |
| Premium | | |
