# Change Order Simplification Plan

## Problem
The current change order flow is too complex:
1. Edit approved quote → add items → save → CO modal → create CO
2. Quote reverts to original (confusing - user thinks they lost work)
3. Must navigate: purple button → CO list → tap pending CO → approve/reject
4. No way to edit a pending CO (must cancel and redo)
5. Too many screens, overwhelming UX

## Solution: Simplified Auto-Logging

### New Flow
1. Edit approved quote normally
2. Add/remove items - changes stay visible in the form
3. User taps Save → changes save immediately
4. Brief toast: "Changes saved and logged to notes"
5. Done

### Visual Indicator for New Items
- Newly added items get a subtle background tint
- Soft green color:
  - Light mode: `rgba(34, 197, 94, 0.1)`
  - Dark mode: `rgba(34, 197, 94, 0.15)`
- No text badges or tags (keeps UI clean)

### Auto-Append to Notes
When saving an approved quote with changes, auto-append to notes:
```
---
Change History

[Jan 7, 2026 - 2:15 PM]
Added: Romex 14/2 250ft (5) +$475.00
Net change: +$475.00
---
```

### What to Remove
- [x] The `ChangeOrderModal` component and its usage in edit.tsx
- [x] The CO mode flag (`coMode`) in materials navigation
- [x] The purple change order banner on edit screen
- [ ] ~~The `/change-orders/[quoteId]` route and screens~~ (kept for historical data viewing)
- [ ] ~~The `shouldTrackChanges` logic in useQuoteForm~~ (kept - used for auto-logging)
- [ ] ~~The `originalSnapshotRef` and diffing logic~~ (kept - used for auto-logging)
- [ ] ~~The change order database/storage functions~~ (kept for historical data)

### What to Add
- [ ] `isNewItem` flag on QuoteItem type (future polish)
- [ ] Background tint style for new items in SwipeableMaterialItem (future polish)
- [x] Auto-append change history to notes in saveQuote flow
- [x] Toast notification after saving approved quote with changes

### Files Modified
- `app/(forms)/quote/[id]/edit.tsx` - Removed CO modal, simplified save flow, added notes auto-append
- `app/(forms)/quote/[id]/materials.tsx` - Removed coMode, always saves directly

### Implementation Order
1. ~~Remove CO modal and coMode flow~~ ✅
2. ~~Make materials always save directly (like non-approved quotes)~~ ✅
3. ~~Add notes auto-append on save for approved quotes~~ ✅
4. Add subtle background tint for new items (future polish)
5. ~~Add toast confirmation~~ ✅
6. ~~Remove unused CO screens/routes~~ (kept for historical data)
7. ~~Clean up unused code~~ ✅

---

*Created: Jan 7, 2026*
*Status: IMPLEMENTED - Core simplification complete*
