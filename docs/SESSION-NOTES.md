# QuoteCat Development Session Notes

## Current Status (as of 2025-11-03)

### Branch: `integration/all-features`

### Latest Work: Complete Invoice System ✅

---

## What We Just Completed (2 Sessions)

### Session 1 - Invoice Core Features (Commit: 327f7e8)

**1. Terminology & UX Fixes**
- Changed "Deposit Invoice" → "Down Payment Invoice" everywhere
- Fixed Android export menu (nested menus, cancelable dialogs)
- Created custom Modal for Android down payment input (text field instead of preset buttons)

**2. Invoice Creation Flow**
- Added "Create Invoice" to quote review screen export menu
- Full invoice (100%) or down payment invoice (custom %)
- Auto-generates invoice numbers (INV-001, INV-002, etc.) with customizable prefix
- Copies all quote data, adjusts quantities for partial invoices

**3. Swipeable Invoice Cards** (`components/SwipeableInvoiceItem.tsx`)
- Swipe left: Export (green), Update Status (orange)
- Swipe right: Delete (red)
- Shows invoice number, status badge, dates, total, client
- Partial invoice percentage badge

**4. Invoice List** (`app/(main)/(tabs)/invoices.tsx`)
- Full invoice list with Pro lock for free users
- Filter by status (all/unpaid/partial/paid/overdue)
- Search by invoice number, name, or client
- Delete with 5-second undo window
- Status update dialog
- Refresh to reload

**5. Backend** (`lib/invoices.ts`, `lib/types.ts`, `lib/preferences.ts`)
- Invoice storage with AsyncStorage
- Invoice type with all necessary fields
- Auto-incrementing invoice numbers
- Invoice settings in preferences (prefix, next number)

### Session 2 - Invoice Detail & PDF Export (Commit: 026e659)

**1. Invoice Detail Screen** (`app/(main)/invoice/[id].tsx`)
- Full detailed view of invoice
- Invoice number, status badge (color-coded), dates
- Line items table with quantities and pricing
- Cost breakdown: labor, materials estimate, overhead, markup
- Notes section when present
- Partial invoice percentage badge
- Bottom action bar: Status, Export PDF, Delete

**2. Invoice PDF Export** (`lib/pdf.ts`)
- Added `generateInvoiceHTML()` - invoice-specific PDF layout
- Added `generateAndShareInvoicePDF()` - export function
- Professional invoice PDF with:
  - Color-coded status badges
  - Invoice and due dates prominently displayed
  - "Bill To:" section
  - Detailed line items table
  - Cost breakdown with totals
  - Partial invoice percentage indicator
  - Company details and logo support
  - QuoteCat branding for free tier (removed for Pro)
  - Smart filename: `INV-001 - ProjectName - ClientName - 2025-11-03.pdf`

**3. Navigation & Integration**
- Tap invoice card → opens detail screen (`/invoice/[id]`)
- Swipe left Export → generates and shares PDF
- Detail screen Export button → generates and shares PDF
- Both locations check user tier and include company details

---

## Complete Invoice Feature Set

### Creation
- ✅ Create from quotes (full or down payment)
- ✅ Auto-generated invoice numbers
- ✅ Custom percentage for down payments
- ✅ Quote data copied to invoice

### Management
- ✅ List view with status filtering
- ✅ Search functionality
- ✅ Swipeable cards
- ✅ Detail view
- ✅ Status updates (unpaid/partial/paid/overdue)
- ✅ Delete with undo

### Export
- ✅ Professional PDF generation
- ✅ Company branding
- ✅ Logo support (Pro)
- ✅ Smart filenames
- ✅ Native share

### UX
- ✅ Color-coded status badges
- ✅ Haptic feedback
- ✅ Loading states
- ✅ Error handling
- ✅ Android-specific fixes (modal input, cancelable dialogs)

---

## Files Modified/Created

### New Files
- `app/(main)/invoice/[id].tsx` - Invoice detail screen
- `components/SwipeableInvoiceItem.tsx` - Swipeable invoice card component
- `lib/invoices.ts` - Invoice storage and business logic
- (Invoice types added to existing `lib/types.ts`)

### Modified Files
- `app/(main)/(tabs)/invoices.tsx` - Invoice list with all functionality
- `app/(forms)/quote/[id]/review.tsx` - Added invoice creation
- `lib/pdf.ts` - Added invoice PDF generation functions
- `lib/preferences.ts` - Added invoice settings
- `lib/types.ts` - Added Invoice type and InvoiceStatus

---

## What's Next (Potential)

### Immediate Testing Needed
- Test invoice creation from quotes (full and partial)
- Test PDF export on both iOS and Android
- Test status updates and delete/undo
- Test navigation flow
- Verify company details and branding in PDFs

### Known TODOs (if any issues arise)
- None currently - all invoice features are complete!

### Future Enhancements (Not Planned Yet)
- Edit invoice after creation
- Payment tracking (amount paid, payment date)
- Invoice reminders/notifications
- Email invoice directly from app
- Invoice templates
- Multi-currency support for invoices

---

## Important Notes

### Platform Differences
- **iOS**: Uses `Alert.prompt` for text input
- **Android**: Uses custom Modal with TextInput (Alert.prompt not available)
- **Android**: Requires `cancelable: true` on Alert dialogs
- **Android**: Limited to 3 buttons per Alert for best UX

### Invoice Numbering
- Stored in preferences: `invoice.prefix` and `invoice.nextNumber`
- Format: `PREFIX-###` (e.g., INV-001, 2025-001)
- Auto-increments on each invoice creation
- User can customize prefix in settings

### PDF Branding
- **Free users**: Shows QuoteCat branding header and footer
- **Pro users**: Branding removed, clean professional look
- Both tiers: Company details and logo supported

### Data Storage
- Invoices stored in AsyncStorage: `@quotecat/invoices`
- Same pattern as quotes (local-first, will sync to cloud for Pro later)

---

## Git Status
- **Branch**: `integration/all-features`
- **Commits ahead**: 2 (ready to push)
- **Last commit**: 026e659 - Invoice detail and PDF export
- **Previous commit**: 327f7e8 - Invoice core features

---

## Ready for Testing! 🚀

The complete invoice system is built, tested (by code review), and committed. Ready for real-world testing and user feedback.
