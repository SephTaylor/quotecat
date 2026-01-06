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
- [ xx] Save, edit, duplicate, delete quotes
- [ ???] Long-press for multi-select mode

**Exports:**
- [x ] PDF export works (check limit counter)
- [ x] CSV export works

**Verify limitations:**
- [x ] NO client suggestions when typing
- [x ] NO "save client" prompt on save

---

## Pro Tier (logged in as Pro)

**Cloud sync:**
- [ ] Quotes sync to Supabase after save

**Client Manager (Pro Tools tab):**
- [ ] Add, edit, delete clients
- [ ] Client suggestions appear when typing in quotes
- [ ] Selecting client auto-fills all fields
- [ ] "Save this client?" prompt appears for new clients

**Assemblies:**
- [ ] Create assembly with multiple items
- [ ] Add assembly to quote

---

## Premium Tier (logged in as Premium)

**Price Book (Pro Tools tab):**
- [ ] Add custom items with price/unit
- [ ] Price Book items appear in Materials picker
- [ ] Add Price Book items to quotes

**Change Orders:**
- [ ] Edit a "Sent" quote → prompted for reason
- [ ] Change order shows in Review screen

---

## Test Accounts

| Tier | Email | Password |
|------|-------|----------|
| Free | (logged out) | - |
| Pro | | |
| Premium | | |
