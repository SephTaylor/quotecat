# Build 124 Troubleshooting

## Issue
Build 124 fails to install from TestFlight with error: "Could not install QuoteCat"
Build 123 installed successfully.

## Build Info
- **Build 124 ID:** `f49d55c9-d837-4585-b643-97d3aff65119`
- **Version:** 1.1.0
- **Date:** January 14, 2026
- **Build 123:** Last known working build

## Changes Between Build 123 and 124

Full diff saved to: `docs/BUILD_124_CHANGES.diff`

### Files Changed (12 files, +827/-179 lines)

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `app/(main)/invoice/[id].tsx` | +454 | **Record Payment feature** - modal, state, handlers, styles |
| `docs/DREW_ARCHITECTURE.md` | +268 | Documentation only |
| `lib/pdf.ts` | +103/-? | Math fixes - markup on line items only, client-facing display |
| `lib/calculations.ts` | +43/-? | Math fixes - centralized calculation functions |
| `lib/validation.ts` | +37/-? | Validation changes |
| `app/(forms)/quote/[id]/review.tsx` | +34/-? | Use centralized calculateQuoteTotals |
| `lib/contracts.ts` | +13/-? | Use centralized calculateQuoteTotal |
| `lib/spreadsheet.ts` | +13/-? | Math fixes for CSV export |
| `components/SwipeableInvoiceItem.tsx` | +13/-? | Use centralized calculateInvoiceTotal |
| `modules/quotes/useQuoteForm.ts` | +12/-? | Minor changes |
| `lib/invoicesSQLite.ts` | +9/-? | Minor changes |
| `app/(main)/wizard.tsx` | +7/-? | Minor changes |

### Detailed Change Summary

#### 1. Record Payment Feature (`app/(main)/invoice/[id].tsx`)
- Added payment modal state variables
- Added `handleOpenPaymentModal()` function
- Added `handleRecordPayment()` function
- Added payment modal UI with:
  - Amount input (with formatting)
  - Payment method selector (grid of options)
  - Date picker
  - Note field
- Added styles for payment button, modal, method grid
- Updated total card to show remaining balance and payment summary

#### 2. Math Calculation Fixes
Files: `lib/calculations.ts`, `lib/pdf.ts`, `lib/contracts.ts`, `lib/spreadsheet.ts`

**Change:** Markup now applies to line items ONLY, not to:
- Material estimate (contractor's guess with margin baked in)
- Labor (contractor's rate with margin baked in)

**Calculation order:**
1. Line items total
2. Apply markup to line items
3. Add material estimate (no markup)
4. Add labor (no markup)
5. Apply tax to subtotal
6. Apply percentage for partial invoices

#### 3. Centralized Calculations
Files: `app/(forms)/quote/[id]/review.tsx`, `components/SwipeableInvoiceItem.tsx`

**Change:** Switched from inline calculations to centralized functions:
- `calculateQuoteTotals()` from `lib/calculations.ts`
- `calculateInvoiceTotal()` from `lib/calculations.ts`

#### 4. Other Minor Changes
- `lib/validation.ts` - Validation updates
- `modules/quotes/useQuoteForm.ts` - Minor updates
- `lib/invoicesSQLite.ts` - Minor updates
- `app/(main)/wizard.tsx` - 7 line change

## Troubleshooting Steps to Try

1. **Revert all changes and rebuild** - Confirm it's our changes causing the issue
2. **Revert one file at a time** - Binary search for the problematic file
3. **Check simulator** - See if it runs on simulator with these changes
4. **Check build logs** - Look for warnings during EAS build
5. **Check Xcode crash logs** - If it installs but crashes immediately

## Notes

- TypeScript errors exist in `settings.tsx` and `Picker.tsx` but these were present in build 123 (pre-existing)
- No config files changed (app.json, eas.json, package.json unchanged)
- Only JS/TS code changes - shouldn't typically affect installation

## Stashed Changes (NOT in build 124)
- `stash@{0}: WIP: Drew Material Checklist Flow - hybrid state machine`
