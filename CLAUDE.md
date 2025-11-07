# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuoteCat is a React Native Expo app for creating and managing construction quotes. It allows users to build quotes from a product catalog, manage materials, calculate labor costs, and generate PDFs. The app uses local AsyncStorage for persistence with plans to migrate to Supabase.

## Website Deployment (CRITICAL)

**IMPORTANT:** The quotecat.ai website is hosted on Netlify and deploys from the `integration/all-features` branch, NOT `main`.

- **Production branch:** `integration/all-features`
- **Website files:** `website/` directory
- **Hosting:** Netlify
- **Domain:** quotecat.ai (migrated from GoDaddy to Netlify)
- **Forms:** Netlify Forms enabled for beta signups

When making website changes:
1. Work in `integration/all-features` branch (or merge to it before pushing)
2. Push to `integration/all-features` to trigger Netlify deploy
3. Deploys typically take 10-15 seconds
4. Check Netlify dashboard for deploy status

## Commands

### Development

```bash
npm install              # Install dependencies
npx expo start           # Start Metro bundler
npx expo start -c        # Start with cache cleared
npm run android          # Run on Android
npm run ios              # Run on iOS
npm run web              # Run on web
```

### Code Quality

```bash
npm run lint             # Run ESLint (expo lint)
```

### Environment Setup

Create a `.env` file at project root with:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

If these are missing, you'll see an error in development. Restart Metro after adding: `npx expo start -c`

## Architecture

### Module System

The codebase uses a modular architecture with domain-specific modules in `modules/`:

- **quotes**: Quote persistence and business logic using AsyncStorage. Handles legacy key migration from multiple storage keys.
- **catalog**: Product catalog with categories (framing, drywall, electrical, plumbing). Products have id, name, unit, and unitPrice.
- **assemblies**: Templates for groups of products with computed quantities (e.g., "frame a room" uses dynamic qty calculations based on room dimensions).
- **materials**: Product selection UI with Map-based selection state.
- **wizard**: Multi-step form navigation system with validation.
- **library**: In-memory storage for reusable entries (assemblies, templates). Designed to swap with Supabase later.
- **core/ui**: Shared UI components (FormScreen, BottomBar, MoneyInput, Stepper, Screen).
- **providers**: Context providers for app-wide state.
- **settings**: App settings and configuration.
- **review**: Quote review and PDF generation logic.

### File Structure Conventions

- `modules/[domain]/index.ts`: Main exports for the module
- `modules/[domain]/types.ts`: TypeScript types and interfaces
- `modules/[domain]/ui/`: React components specific to that domain
- `lib/`: Cross-cutting utilities (storage, supabase, quotes API)
- `app/`: Expo Router file-based routing
  - `app/(main)/`: Main tab navigation screens
  - `app/(forms)/`: Form and wizard screens
  - `app/_layout.tsx`: Root layout with SafeAreaProvider

### Routing

Uses Expo Router (v6) with file-based routing:

- `/` → Home screen (quote list)
- `/quote/[id]/edit` → Edit quote form
- `/quote/[id]/materials` → Material selection
- `/quote/[id]/review` → Review and generate PDF
- `/wizard/...` → Multi-step quote creation wizard

### Data Layer

**Quotes Storage (`modules/quotes/index.ts`)**:

- Uses AsyncStorage with legacy key migration
- Reads from multiple keys: `@quotecat/quotes`, `quotes`, `qc:quotes:v1`
- Always writes to primary key: `@quotecat/quotes`
- De-duplicates by id, preferring latest updatedAt/createdAt
- Normalizes data with forward-compatible extra fields

**Library Storage (`modules/library/`)**:

- Currently in-memory Map
- Designed to swap with Supabase without changing call sites
- Exports: `saveEntry`, `getAll`, `getByKind`, `removeEntry`

**Quote Types**:

- `StoredQuote`: Persisted quote with id, name, clientName, items[], labor, timestamps
- `QuoteItem`: Product reference with productId, name, unitPrice, qty, optional currency
- Both types support forward-compatible extra fields via `[key: string]: any`

**Normalization**:

- `normalizeQuote()` and `normalizeItem()` ensure data integrity
- Computes total on save (never trust stored totals)
- Handles missing/invalid timestamps gracefully

### Path Aliases

- `@/*` maps to project root
- Configured in both `tsconfig.json` and `babel.config.js`
- Use `@/modules/...`, `@/lib/...`, `@/constants/...` for imports

### TypeScript

- Strict mode enabled
- Expo base config extended
- Excludes: `node_modules`, `app/_old`, `modules/_old`

### Key Dependencies

- **Expo Router**: File-based navigation (v6)
- **React Native Reanimated**: Animations (keep plugin LAST in babel.config.js)
- **AsyncStorage**: Local persistence
- **Supabase**: Backend (configured but not fully integrated)
- **expo-print & expo-sharing**: PDF generation

## Important Patterns

### Async Storage Patterns

When working with quotes, always use the repo functions in `modules/quotes/index.ts`:

- `listQuotes()`: Returns all quotes sorted by most recent
- `getQuoteById(id)`: Fetch single quote
- `saveQuote(quote)`: Create or update (auto-merges and timestamps)
- `updateQuote(id, patch)`: Partial update
- `deleteQuote(id)`: Remove quote

### Form State Management

Multi-step forms use the wizard pattern:

- Define steps with id, title, optional validate function
- Validation returns error message or null/undefined
- See `modules/wizard/types.ts` for `WizardStep<TState>` interface

### Assembly Expansion

Assemblies can have fixed or computed quantities:

- `{ productId, qty }`: Fixed quantity
- `{ productId, qtyFn: (vars) => number }`: Computed from variables
- See `modules/assemblies/expand.ts` for pricing logic

### Navigation Defaults

Quote UI components accept optional `onPress`/`onLongPress` handlers. When omitted, they default to navigating to edit screen. See `modules/quotes/ui/index.ts:8`.

## Code Style

### ESLint

- Uses expo's flat config format
- Ignores `dist/*`
- Note: `import/no-named-as-default` is silenced for this project

### Prettier

- Active for formatting
- Ignores `_old/` directories
- Run format before commits

### Recent Fixes

- Import warnings silenced for default exports
- Quote UI handlers now accept optional callbacks
- Unescaped apostrophes fixed in JSX strings

---

## 🎯 Business Model & Monetization Strategy

### CRITICAL: Avoid Apple's 30% Commission

**DO NOT implement in-app purchases in Phase 1.** All payments must go through external website to avoid Apple taking 30%.

**Allowed in App:**
- ✅ Show locked features with "Pro" badge
- ✅ "Learn More" button → opens website in Safari
- ✅ Login screen for users who bought on website
- ✅ Check subscription tier after login
- ✅ Display current tier in settings

**NOT Allowed in App:**
- ❌ Any pricing displayed ($29, $79, etc.)
- ❌ "Buy", "Purchase", "Subscribe" buttons
- ❌ Payment forms
- ❌ Urgency messaging with pricing ("Only 47 spots at $29!")
- ❌ Price comparisons

### Pricing Tiers (As of Jan 2025)

**Free Tier:**
- Price: $0
- Features: Unlimited quotes (local only), 25 quotes/month, 5 PDF exports/month, 2 CSV exports/month
- No assemblies, no cloud sync

**Pro Tier - Founder Pricing:**
- Price: $29/mo or $290/yr (first 500 customers, locked forever)
- Regular price: $99/mo or $990/yr
- Features: Everything in Free + unlimited exports, custom assemblies, cloud sync, multi-device, company branding

**Premium Tier - Founder Pricing:**
- Price: $79/mo or $790/yr (first 100 customers, locked forever)
- Regular price: $199/mo or $1,990/yr
- Features: Everything in Pro + company logo on PDFs, Quote Wizard, advanced analytics, team collaboration (future), priority support

**Price Increase Triggers:**
- Primary: Hit customer cap (100 Pro = $49, 500 Pro = $99)
- Secondary: 90 days from TestFlight launch
- Backup: High conversion rate (>20%) for 30 days

### User Journey (Compliant)

1. User downloads free app from App Store
2. Uses app, sees "🔒 Pro Feature"
3. Taps "Learn More" → Opens quotecat.app in Safari
4. Website shows pricing, urgency, spots remaining
5. Buys via Stripe on website
6. Gets email with login credentials
7. Returns to app → Logs in
8. App checks Supabase: tier = 'pro'
9. Pro features unlock ✅

---

## 🗄️ Database Architecture (Supabase)

### Supabase Instance

- **Project:** QuoteCat Production
- **URL:** Configured in `.env` as `EXPO_PUBLIC_SUPABASE_URL`
- **Auth:** Anonymous key in `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Region:** US-based
- **Access:** Supabase dashboard at supabase.com

### Tables (9 total)

**User & Subscription:**
1. `profiles` - User accounts, tier, company details, usage tracking, preferences
2. `subscriptions` - Payment history, tier management, billing info
3. `usage_events` - Analytics, feature usage tracking

**Quote Data:**
4. `quotes` - Cloud-synced quotes with RLS (Pro/Premium only)
5. `assemblies` - Custom assembly templates (Pro/Premium only)

**Product Catalog (Supplier API):**
6. `suppliers` - Lowe's, Home Depot, Menards, 1Build
7. `categories` - Product categories (Framing, Drywall, etc.) - **✅ Seeded with 7 categories**
8. `products` - Full product catalog with real-time pricing - **✅ Seeded with 368 AI products**
9. `product_prices` - Price history tracking

### Current Product Catalog Status (Nov 2024)

**Live in Supabase:**
- 368 AI-estimated products across 7 categories
- Categories: Framing, Fasteners, Drywall, Electrical, Plumbing, Roofing, Masonry
- All products marked as `data_source: 'ai_estimated'`
- App syncs from Supabase via pull-to-refresh
- Smart status indicator shows "Online (Up to date)" when synced

**Ready for Retailer Data:**
- Migration 004 prepared (adds `retailer` field to products table) - **NOT run yet**
- Import script ready: `supabase/import_retailer_data.ts`
- Documentation: `supabase/IMPORT_GUIDE.md`, `supabase/RETAILER_DATA_SPEC.md`
- When retailer data arrives: Run migration 004 → Import CSV → Sync to app

### Security

All tables have Row-Level Security (RLS):
- Users can only see their own quotes/assemblies/profiles
- Product catalog is public read, service role only for writes
- Soft deletes via `deleted_at` (never lose data)

### Helper Functions

- `user_has_tier(required_tier)` - Check if user meets tier requirement
- `get_spots_remaining(tier, pricing)` - Count remaining founder slots
- `reset_monthly_usage()` - Reset PDF/CSV counters monthly

---

## 🔌 Supplier API Integration Plan

### Architecture

```
Supplier APIs (Lowe's, HD, Menards, 1Build) OR RetailGators (web scraping service)
    ↓
Supabase (products & categories tables) ← Central catalog
    ↓
App Cache (AsyncStorage) ← Fast, offline access
    ↓
User creates quotes with real-time pricing
```

### Data Flow

1. **Background Job (daily):** Supplier API OR RetailGators CSV → Supabase products table
2. **App startup:** Supabase products → AsyncStorage cache
3. **User creates quote:** Reads from AsyncStorage (fast, offline)
4. **Periodic sync (when online):** Check Supabase for price updates

### Target Suppliers

**Official APIs (Preferred):**
- **1Build** (Primary - aggregates multiple suppliers) - outreach sent
- **Lowe's** (Direct API) - exploring
- **Home Depot** (Direct API) - exploring
- **Menards** (Direct API) - emails sent to webedi@menards.com, sppurchasing@menards.com

**Interim Solution (RetailGators):**
- **RetailGators** (Web scraping service, Houston TX, 51-200 employees)
- Provides Menards, Home Depot, Lowe's product & pricing data
- $300/month BASIC plan (10,000 SKUs, daily updates)
- Use case: Bootstrap with real data while pursuing official partnerships
- Status: **Inquiry sent Nov 4, 2024** - awaiting response (see "Waiting For" section)

### Product Data Structure

- Real-time pricing and availability
- Product images and descriptions
- SKU, category, supplier info
- Retailer identifier (homedepot, lowes, menards)
- Data source tracking (ai_estimated, retailer_scraped, api_live, user_submitted)
- Stock quantities
- Last sync timestamp

**ALL TIERS** can access supplier catalog (free tier has quote limits, not catalog limits).

---

## 📱 Migration Strategy (Local → Cloud)

### Free Users
- All data stays in AsyncStorage (local only)
- Never touches Supabase
- Offline-first, no cloud sync

### Pro/Premium Users (First Login)

**Auto-migration on first sign-in:**

1. User logs in → Check if cloud has data
2. If cloud empty but local has data → Migrate
3. Show: "Importing your 15 quotes to cloud..."
4. Upload quotes, assemblies, company details to Supabase
5. Keep local data as cache
6. Success: "Your data is now backed up!"

**Ongoing sync:**
- Local AsyncStorage = Fast cache
- Supabase = Source of truth + backup
- Bi-directional sync (future)
- Conflict resolution: last-write-wins

**Migration happens:**
- Automatically on first Pro/Premium login
- One-time, one-way (local → cloud)
- Non-destructive (keeps local copy)
- Progress indicator shown to user

---

## 🚀 Current Status (Nov 2024)

### ✅ Complete

**MVP Features:**
- Quote management (create, edit, delete, duplicate)
- Product catalog (368 AI-estimated products across 7 categories)
- PDF/CSV export with company branding
- Assembly system (Pro feature)
- Dashboard with value tracking
- Light/dark mode with gradients
- Swipe gestures, pin quotes, status workflow
- Pull-to-refresh product sync
- Smart status indicator for sync state
- Product search with auto-expanding categories

**Technical:**
- React Native + Expo SDK 54
- Expo Router v6
- AsyncStorage (local-first)
- EAS Build configured
- 0 lint errors/warnings
- Version 1.1.0

**Database:**
- Supabase project set up
- All 9 tables created with RLS
- 7 categories seeded (Framing, Fasteners, Drywall, Electrical, Plumbing, Roofing, Masonry)
- 368 AI products seeded and syncing to app
- Migration files documented
- Helper functions implemented

**Retailer Data Pipeline (Prepared):**
- ✅ Migration 004 created (adds retailer field + multi-retailer support)
- ✅ Import script built (`supabase/import_retailer_data.ts`)
- ✅ Data validation with category/unit mapping
- ✅ Import documentation (`supabase/IMPORT_GUIDE.md`)
- ✅ Data spec for RetailGators (`supabase/RETAILER_DATA_SPEC.md`)
- ✅ Product type updated with optional `retailer` and `dataSource` fields

### 📝 For New Claude Sessions

**When starting a new conversation, read:**
1. This entire CLAUDE.md file (you're reading it now!)
2. Recent commits: `git log --oneline -5` and `git log -1 --format=full`
3. Retailer import docs: `supabase/IMPORT_GUIDE.md` and `supabase/RETAILER_DATA_SPEC.md`
4. Current branch status: `git status`

**Key context to understand:**
- App is LIVE and working with 368 AI products syncing from Supabase
- Retailer data pipeline is BUILT and ready to execute when data arrives
- Waiting on RetailGators to negotiate 3k SKUs/retailer pricing
- Next major work: Auth screens + cloud sync (Phase 1)
- All monetization must go through website (NOT in-app) to avoid Apple's 30% cut

### ⏳ Waiting For

**RetailGators Response (Nov 4, 2024):**
- **Initial inquiry:** Sent with 5 key questions (legal, sample, updates, pilot, scope)
- **Detailed requirements:** Sent (3 retailers, 7 categories, ~2-3k SKUs, daily updates)
- **Latest discussion:** Clarified we need **~3,000 SKUs per retailer (9,000 total)** for comprehensive live catalog
  - Original offer: 10k SKUs per retailer = $900/month (likely overkill - 30k total products)
  - Our analysis: Need 1,500-2,000 per retailer minimum, 3k gives us healthy buffer
  - **Action needed:** Follow up to negotiate pricing for 3k/retailer (estimate $300-400/month)
- **Waiting for:**
  - Legal posture answer (indemnity vs "as-is")
  - Sample CSV with all required fields
  - Pricing for 3k SKUs/retailer tier
  - 30-day pilot terms
  - Daily update delivery method

**Official API Responses:**
- Menards: webedi@menards.com, sppurchasing@menards.com (emails sent)
- 1Build: Outreach sent
- Parallel track while exploring RetailGators

**Apple Developer:**
- Payment processed ($99/year)
- Account pending activation (24-48 hours)
- Ready for TestFlight build when approved

### 🔜 Next Steps (Priority Order)

**New Laptop Setup (COMPLETE ✅):**
- ✅ Cloned repository to new laptop
- ✅ Installed Node.js, npm, Git
- ✅ Created .env with Supabase credentials
- ✅ App running successfully with product sync working
- ✅ All recent work committed and pushed to `integration/all-features`

**Immediate (This Week):**
1. **Follow up with RetailGators** - Negotiate pricing for 3k SKUs/retailer (~$300-400/month vs $900)
2. **Decide on data source** - RetailGators pilot vs wait for official APIs
3. **Apple Developer activation** - Check status, ready for TestFlight build
4. Build iOS app with EAS
5. Submit to TestFlight

**When RetailGators Data Arrives:**
1. Run migration 004 in Supabase (adds retailer field) - **Ready to execute**
2. Test import script with sample CSV - **Script built: `supabase/import_retailer_data.ts`**
3. Import full dataset (3k SKUs × 3 retailers = 9k products)
4. Add retailer badges to product picker UI
5. Test sync in app
6. Update status messaging ("Pricing data provided by RetailGators" disclaimer)

**Phase 1 - Auth & Cloud Sync (Next 1-2 Weeks):**
1. Login/signup screens
2. Supabase auth integration
3. Tier checking in app (Free/Pro/Premium)
4. Auto-migration (local → cloud for Pro/Premium users)
5. Basic cloud sync with conflict resolution

**Phase 2 - Monetization (2-4 Weeks):**
1. Landing page (quotecat.app) with pricing and founder urgency
2. Stripe payment integration
3. Spots remaining counter (100 Premium, 500 Pro)
4. Email automation (welcome, credentials, tier unlock)
5. Founder pricing launch

**Phase 3 - Public Launch (1-2 Months):**
1. Retailer data integration complete (RetailGators OR official APIs)
2. Daily price update automation
3. Quote Wizard (Premium feature)
4. Public launch with App Store listing

---

## ⚠️ Critical Gotchas

### Apple In-App Purchase
- **DO NOT** add pricing to the app in Phase 1
- All payment must flow through website → Stripe
- App can only check tier and unlock features
- See "Business Model" section above

### Supplier API Tables
- `products` and `categories` tables in Supabase are for supplier API data
- DO NOT delete these tables
- Currently seeded with 368 AI-estimated products
- Will be replaced/augmented by retailer data (RetailGators) or official APIs

### Data Migration
- Free users stay 100% local (no forced cloud)
- Pro/Premium users auto-migrate on first login
- Always keep local cache for offline access
- Supabase is backup + sync, not replacement

### Pricing Strategy
- Founder pricing ($29/$79) for first 100/500 customers
- Price locked forever for early adopters
- Raise prices at customer milestones, not time-based
- Grandfathering creates loyalty and urgency

### RetailGators Data Strategy (Nov 2024)

**Context:** Need real retailer pricing quickly. Official APIs slow to respond. Found RetailGators (web scraping service).

**Balanced Approach:**
- Use RetailGators for 30-day pilot to bootstrap with real data
- Label clearly in UI: "Pricing data provided by RetailGators - verify at retailer checkout"
- Continue pursuing official API partnerships in parallel (Menards, 1Build, Lowe's, HD)
- Internal development/testing use initially
- Evaluate legal stance, data quality, reliability during pilot
- Transition to official APIs when available

**Guardrails:**
- Request sample data (10-20 SKUs) before committing
- Confirm legal indemnity stance in writing
- Start with 30-day pilot (not annual commitment)
- Pull only construction categories (not full catalog)
- Document data source and dates for audit trail
- Keep "verify at checkout" disclaimers in UI
- Monitor for any retailer pushback

**Key Questions Sent to RetailGators:**
1. Legal posture - indemnity or "as-is"?
2. Sample CSV with all required fields
3. Daily update delivery method (API vs file)
4. 30-day pilot option
5. Category filtering (construction only)

**Philosophy:** Scrappy founder bootstrap (speed) + protective guardrails (don't blow a hole in the hull). Not shady, filling a gap retailers left.

---

## 📊 Success Metrics (Future)

When launched, track:
- Downloads
- Free → Pro conversion rate
- Spots remaining (founder pricing)
- Monthly recurring revenue (MRR)
- User retention
- Feature usage (exports, assemblies, etc.)
- Quote volume created

---

## 🎬 Vision

QuoteCat aims to be the **fastest, simplest construction quoting app** for contractors and builders:

- **Speed:** Create professional quotes in minutes, not hours
- **Accuracy:** Real-time supplier pricing (Lowe's, HD, Menards)
- **Offline-first:** Works without internet
- **Mobile-optimized:** Built for on-site use
- **Fair pricing:** No Apple tax, founder pricing rewards early believers
- **Pro-focused:** Premium tier for serious contractors doing high volume

**Long-term:** Build a sustainable, profitable business helping contractors run better businesses.
