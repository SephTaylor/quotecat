# QuoteCat TODO

## In Progress

_(Nothing currently in progress)_

## Planned

### Payment History
- [ ] Add invoice_payments table for multiple payment tracking
- [ ] Update portal invoice detail to show payment history list
- [ ] Update mobile app to show payment history

### Platform Expansion
- [ ] iPad support - add max-width constraints for larger screens
- [ ] Android support - test on emulator, fix issues, submit to Play Store

### Quote Enhancements
- [ ] Add hourly labor rate calculation option (toggle flat rate vs hours × hourly rate)

## Completed

_(Track completed items here)_

---

## To Verify (Found in Other Docs)

_Review these items - some may be done, some may still be pending._

### Email Setup (from CLAUDE.md - Jan 6, 2026)
- [ ] Create `noreply@quotecat.ai` in GoDaddy
- [ ] Configure SMTP in Supabase (host: smtpout.secureserver.net, port 465)
- [ ] Customize "Invite User" email template with QuoteCat branding
- [ ] Test full checkout → email → password setup → app login flow

### Drew Wizard (from CLAUDE.md)
- [ ] Phase 2: Implement hybrid state machine (60-70% more cost savings)
- [ ] Phase 3: Model optimization (switch to Haiku if needed)
- [ ] Investigate $0 draft quotes appearing after Drew sessions

### Stashed Features (from CLAUDE.md - Nov 24, 2025)
- [ ] `lib/types.ts` - Add `clientEmail`, `clientPhone`, `clientAddress`, `taxPercent`
- [ ] `lib/pdf.ts` - Tax calculation display, client contact info
- [ ] `lib/invoices.ts` - Add `QuickInvoiceData` type, `createQuickInvoice()`
- [ ] `app/(forms)/quote/[id]/edit.tsx` - UI for tax %, client email/phone/address
- [ ] `app/(main)/(tabs)/invoices.tsx` - Fixed Invoice import, Quick Invoice button
- [ ] `app/(forms)/invoice/` - Quick Invoice form screen (new route)

### Future Feature Ideas (from CLAUDE.md)
- [ ] Sync optimization - parallelize critical data sync
- [ ] Change Order Management (Portal, Premium)
- [ ] Contracts: Decline/Request Changes option for clients
- [ ] Drew visibility toggle - button to show/hide Drew FAB

### VIP Testers to Create (from CLAUDE.md)
- [ ] Drew: foxrider12@icloud.com (lifetime premium)
- [ ] Wyatt: wyattstephan@stephanelectric.com (lifetime premium)

### Build Issues (from BUILD_124_TROUBLESHOOTING.md)
- [ ] Build 124 installation failure - needs diagnosis

### Change Orders Feature (from CHANGE-ORDERS-PLAN.md)
- [ ] Full implementation (9 steps) - not started

### Team Features (from TEAM_FEATURES_PLAN.md)
- [ ] Team/tech management for Premium users (post-launch priority)

### Platform & Integration (from PRODUCT-OVERVIEW.md)
- [ ] Supplier integration (1Build API, real-time pricing)
- [ ] Android app
- [ ] Web app (Expo web)
- [ ] Desktop app (Electron, future)
