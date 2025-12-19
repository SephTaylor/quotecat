# QuoteCat Project Status - REFERENCE FILE

**Last Updated:** October 27, 2025
**Version:** 1.1.0
**Branch:** integration/all-features

---

## QUICK REFERENCE: WHAT'S DONE VS WHAT'S NOT

### ✅ FULLY IMPLEMENTED (100% Working)

**Core Features:**
- Quote CRUD (create, edit, delete, duplicate)
- Quote status workflow (Draft → Sent → Approved → Completed → Archived)
- Pin/favorite quotes
- Material selection (100+ products in catalog)
- Assembly system (8 seed assemblies + custom creation) - PRO FEATURE
- PDF export with company branding
- CSV export
- Dashboard with stats, value tracking, pinned/recent quotes
- Company details editor (name, email, phone, website, address)
- Company logo upload (local AsyncStorage, appears on quote/invoice PDFs) - PRO FEATURE
- Invoice system (create from quotes, PDF export, status tracking) - PRO FEATURE
- Contract system (create from approved quotes, digital signatures via web) - PREMIUM FEATURE
- Settings with customization options
- Business Settings screen (invoices, contracts, pricing defaults)

**Monetization:**
- Free/Pro tier system (defaults to "pro" for TestFlight)
- Usage tracking (quotes, PDFs/month, CSVs/month)
- Feature gates (assemblies, export limits, value tracking)
- Monthly counter resets
- All enforcement logic ready

**UI/UX:**
- Light/dark mode themes
- Gradient backgrounds
- Swipe gestures (delete, duplicate, pin)
- Undo delete functionality
- 22 active screens with Expo Router v6
- Drawer + Tab + Stack navigation

**Technical:**
- AsyncStorage persistence with legacy migration
- PostHog analytics integration (configured, working)
- EAS Build configured
- App icon (Drew the cat) and splash screen

**App Store Prep:**
- Bundle IDs: `com.quotecat.app` (iOS + Android)
- Icons and splash screen complete
- Privacy policy & terms (exist on website)
- EAS project ID: `dc5517f1-c28a-4507-804b-406cee16ff3c`

**Website (Netlify - Live):**
- 5 pages: index.html, faq.html, privacy.html, terms.html, signin.html
- Fully standardized spacing and navigation across all pages
- Hamburger menu with Sign In button on all pages
- "Beta Coming Soon" status badge on all pages
- Sign in/sign up page ready for Supabase auth (Phase 2)
- Template documentation: `website/PAGE-TEMPLATE.md`
- Auto-deploys when pushing to git (Netlify watches repository)

---

### ❌ NOT IMPLEMENTED (Don't Assume These Work)

**Phase 1 - Blocked by Apple Developer Account:**
- Authentication (login/signup screens)
- Supabase Auth integration
- Tier checking from cloud
- Local → Cloud migration
- Cloud sync

**Phase 2 - After TestFlight:**
- Authentication (hook up signin.html to Supabase)
- Stripe payment integration on website
- Spots remaining counter on website
- Email automation

**Phase 3 - Future:**
- 1Build supplier API integration
- Real-time pricing
- Quote Wizard (Premium feature)
- Migrate logos to Supabase Storage (for multi-device sync + contracts)
- Add company logo to contract PDFs
- Team collaboration

---

## CURRENT STATUS

**Apple Developer Account:** ⏳ Pending activation (24-48 hours from payment)

**Next Step:** Build iOS app with EAS and submit to TestFlight

**Phase:** Waiting period - All Phase 1 prep complete

---

## KEY FILE LOCATIONS

**Quotes:**
- Storage: `modules/quotes/storage.ts`
- Types: `lib/types.ts`
- Keys: `@quotecat/quotes` (primary), `quotes`, `qc:quotes:v1` (legacy)

**Catalog:**
- Products: `modules/catalog/seed.ts` (100+ products)
- Service: `modules/catalog/productService.ts`
- Cache: `@quotecat/products_cache`

**Assemblies:**
- Seeds: `modules/assemblies/seed.ts` (8 assemblies)
- Storage: `modules/assemblies/storage.ts`
- Calculator: `modules/assemblies/expand.ts`
- Cache: `@quotecat/assemblies_cache`

**Monetization:**
- User state: `lib/user.ts` (tier, usage counters)
- Feature gates: `lib/features.ts`
- Storage: `@quotecat/user_state`

**Settings:**
- Preferences: `lib/preferences.ts`
- Storage: `@quotecat/preferences`
- Includes: dashboard prefs, privacy prefs, company details

**Analytics:**
- PostHog: `lib/app-analytics.ts`
- Product analytics: `lib/analytics.ts`

**Export:**
- PDF: `lib/pdf.ts`
- CSV: `lib/spreadsheet.ts`
- Hook: `modules/quotes/useExportQuote.ts`

**Website:**
- All pages: `website/*.html`
- Template: `website/PAGE-TEMPLATE.md`
- Deployed via: Netlify (auto-deploys on git push)

---

## IMPORTANT DEFAULTS

**Default Tier:** `"pro"` (in `lib/user.ts:63`)
- **Why:** TestFlight testers need to test all Pro features
- **Before Public Launch:** Change to `"free"`

**Free Tier Limits:**
- Quotes: 10 total
- PDFs: 3 per month
- CSVs: 1 per month

**Pro Tier:** Unlimited everything + assemblies + custom branding

---

## ENVIRONMENT VARIABLES

**Required (but app works without them - local-first):**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://eouikzjzsartaabvlbee.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_KlF-GkTNxPy3CYwF9DOvZA_PNjEJnyr
```

**Configured and Working:**
```bash
EXPO_PUBLIC_POSTHOG_API_KEY=phc_VlsYtaWnutxDu5dZDsfsJk8E4XKLl4iiENUtJ4gZTYX
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

---

## APPLE COMPLIANCE - CRITICAL

**✅ ALLOWED in app:**
- Show "🔒 Pro Feature" badges
- "Learn More" button → Opens website in Safari
- Login screen for users who bought on website
- Display current tier in settings

**❌ NOT ALLOWED in app:**
- Any pricing ($29, $79, etc.)
- "Buy", "Purchase", "Subscribe", "Upgrade" buttons
- Payment forms
- Urgency messaging with pricing

**Compliant Flow:**
1. App shows locked feature + "Learn More"
2. Opens quotecat.app in Safari
3. User buys via Stripe on website
4. Returns to app and logs in
5. App checks Supabase tier
6. Unlocks Pro features

---

## STORAGE KEYS REFERENCE

```typescript
// Quotes
@quotecat/quotes          // Primary
quotes                    // Legacy (still read)
qc:quotes:v1             // Legacy (still read)

// User & Settings
@quotecat/user_state      // Tier, usage counters
@quotecat/preferences     // Dashboard, company, privacy
@quotecat/theme          // Light/dark mode

// Features
@quotecat/assemblies_cache
@quotecat/products_cache
@quotecat/products_sync_timestamp
@quotecat/product_usage   // Local analytics
```

---

## ANALYTICS EVENTS TRACKED

**App Lifecycle:**
- `app_opened`, `app_backgrounded`

**Quotes:**
- `quote_created`, `quote_updated`, `quote_deleted`, `quote_duplicated`

**Materials:**
- `material_added`, `material_removed`, `material_search`

**Assemblies:**
- `assembly_created`, `assembly_used`, `assembly_deleted`

**Exports:**
- `pdf_generated`, `pdf_shared`, `csv_exported`

**Other:**
- `review_opened`, `company_details_updated`, `calculator_used`, `labor_added`, `markup_changed`, `error_occurred`, `save_failed`

---

## TESTING NOTES

**Free/Pro Toggle:**
- Settings screen has debug "Toggle Free/Pro Tier" button
- Allows manual testing of tier restrictions
- Remove before public launch

**Default State:**
- New users start as Pro (TestFlight)
- All features unlocked by default
- Usage counters track but don't enforce limits yet

---

## WHEN APPLE APPROVES - NEXT STEPS

1. **Build iOS:**
   ```bash
   eas build --platform ios --profile preview
   ```

2. **Submit to TestFlight**
3. **Add beta testers**
4. **Gather feedback**
5. **Iterate based on feedback**
6. **Then:** Build auth system (Phase 2)

---

## PHASE ROADMAP

**Phase 1 (TestFlight - Current):**
- ✅ All core features
- ✅ App Store prep
- ⏳ Apple approval
- ⏳ TestFlight distribution

**Phase 2 (Monetization - After Feedback):**
- Login/signup + Supabase Auth
- Tier checking from cloud
- Auto-migration (local → cloud)
- Landing page + Stripe
- Email automation
- Launch founder pricing

**Phase 3 (Enhancement - 1-2 months):**
- 1Build supplier API
- Real-time pricing
- Quote Wizard (Premium)
- Public App Store launch

---

## RECENT WORK COMPLETED

**Current Session (Oct 27, 2025):**
- ✅ Fixed PostHog host URL (US cloud: `https://us.i.posthog.com`)
- ✅ Verified analytics working (events flowing)
- ✅ Verified company details saving correctly
- ✅ Verified quote duplication working
- ✅ Comprehensive project audit
- ✅ Website standardization: spacing, navigation, header consistency
- ✅ Created FAQ page (12 questions)
- ✅ Created Sign In/Sign Up page with toggle
- ✅ Added "Beta Coming Soon" badge to all pages
- ✅ Fixed logo spacing (Drew + QuoteCat text closer)
- ✅ Created website template documentation
- ✅ Deployed all website updates to Netlify

**Recent Commits:**
- Website improvements and new sign in page
- Legal pages and App Store prep
- Landing page UI improvements
- Mobile responsiveness
- Drew mascot branding

---

## COMMON MISTAKES TO AVOID

1. **Don't assume auth is built** - signin.html UI exists, but Supabase auth NOT hooked up yet
2. **Don't assume cloud sync works** - Everything is local-first currently
3. **Don't assume Supabase is active** - Client configured but not used
4. **Don't assume pricing can be shown in app** - Apple will reject
5. **Remember default tier is "pro"** - For TestFlight testing
6. **Don't build Phase 2 features before TestFlight feedback** - Wait for user validation
7. **Remember Netlify auto-deploys** - Pushing to git automatically triggers Netlify deployment

---

## SUPABASE STATUS

**Configured but NOT active:**
- Client initialized in `lib/supabase.ts`
- Database schema documented (9 tables)
- Tables NOT deployed yet
- Auth NOT integrated yet
- No data in cloud yet

**When to activate:**
- After TestFlight feedback validates need for auth/sync
- Phase 2 implementation

---

## NETLIFY DEPLOYMENT

**URL:** TBD (user has Netlify configured)

**Deployment Process:**
1. Make changes to `website/*.html` files
2. `git add website/*`
3. `git commit -m "message"`
4. `git push origin integration/all-features`
5. Netlify automatically detects push and deploys (1-2 minutes)

**IMPORTANT:** Netlify watches the git repository and auto-deploys. Don't ask user about deployment - just push to git!

**Website Pages:**
- `index.html` - Landing page (1200px container)
- `faq.html` - FAQ with 12 questions (900px container)
- `privacy.html` - Privacy policy (900px container)
- `terms.html` - Terms of service (900px container)
- `signin.html` - Sign in/sign up page (900px container)

**Design Standards:**
- Header: Always 1200px wide (`.header-container`)
- Content: 1200px (landing) or 900px (text pages) (`.container`)
- Logo: 100px desktop → 60px mobile, with -20px/-12px margin
- Spacing: 60px/80px desktop, 40px/60px mobile
- All pages have: hamburger menu, status badge, Sign In button
- Template: `website/PAGE-TEMPLATE.md`

---

**END OF REFERENCE FILE**

This file should be read at the start of each session to avoid incorrect assumptions about project status.
