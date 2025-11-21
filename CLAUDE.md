# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuoteCat is a React Native Expo app for creating and managing construction quotes. It allows users to build quotes from a product catalog, manage materials, calculate labor costs, and generate PDFs. The app uses local AsyncStorage for persistence with plans to migrate to Supabase.

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
7. `categories` - Product categories (Framing, Drywall, etc.)
8. `products` - Full product catalog with real-time pricing
9. `product_prices` - Price history tracking

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
Supplier APIs (Lowe's, HD, Menards, 1Build)
    ↓
Supabase (products & categories tables) ← Central catalog
    ↓
App Cache (AsyncStorage) ← Fast, offline access
    ↓
User creates quotes with real-time pricing
```

### Data Flow

1. **Background Job (daily):** 1Build API → Supabase products table
2. **App startup:** Supabase products → AsyncStorage cache
3. **User creates quote:** Reads from AsyncStorage (fast, offline)
4. **Periodic sync (when online):** Check Supabase for price updates

### Target Suppliers

- **1Build** (Primary - aggregates multiple suppliers)
- **Lowe's** (Direct API)
- **Home Depot** (Direct API)
- **Menards** (Direct API)

### Product Data Structure

- Real-time pricing and availability
- Product images and descriptions
- SKU, category, supplier info
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

## 🚀 Current Status (Jan 2025)

### ✅ Complete

**MVP Features:**
- Quote management (create, edit, delete, duplicate)
- Product catalog (100+ construction products)
- PDF/CSV export with company branding
- Assembly system (Pro feature)
- Dashboard with value tracking
- Light/dark mode with gradients
- Swipe gestures, pin quotes, status workflow

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
- Migration files documented
- Helper functions implemented

### ⏳ In Progress

**Apple Developer:**
- Payment processed ($99/year)
- Account pending activation (24-48 hours)
- Ready for TestFlight build when approved

### 🔜 Next Steps (Priority Order)

**Immediate (This Week):**
1. Apple Developer activation
2. Build iOS app with EAS
3. Submit to TestFlight
4. Add beta testers
5. Gather feedback

**Phase 1 (Next Week):**
1. Login/signup screens
2. Supabase auth integration
3. Tier checking in app
4. Auto-migration (local → cloud)
5. Basic cloud sync

**Phase 2 (2-4 Weeks):**
1. Landing page (quotecat.app)
2. Stripe payment integration
3. Spots remaining counter
4. Email automation
5. Founder pricing launch

**Phase 3 (1-2 Months):**
1. 1Build API integration
2. Supplier product sync
3. Real-time pricing updates
4. Quote Wizard (Premium feature)
5. Public launch

---

## 🔄 Feature Migration Plan (Nov 2025)

### Background

**Problem Solved:** TestFlight builds were crashing because `lib/supabase.ts` used dynamic property access (`process.env[name]`) which Expo's babel transform doesn't replace. Fixed by using static access (`process.env.EXPO_PUBLIC_SUPABASE_URL`).

**Current State:**
- `main` branch: v1.1.0, basic features, **WORKING on TestFlight** (Build #66)
- `integration/all-features` branch: v1.2.6, has auth/biometrics/cloud sync but needs the env var fix
- Tag `v1.1.0-working` marks the last known good state
- Branch `feature/auth-migration` created for incremental migration

### Migration Strategy

Cherry-pick features from `integration/all-features` into `feature/auth-migration`, test each group locally with Xcode Release builds, then merge to main.

### Group A: Stability & Crash Fixes (Start Here)
```
349f60c fix: resolve circular dependencies causing app crashes
b94cc48 fix: optimize invoice system performance and prevent crashes
353e06f fix: implement lazy auth initialization to prevent startup hanging
ab838a6 fix: lazy initialize Supabase client to prevent module-load crashes
8b4b37a fix: remove non-existent incrementQuoteCount/decrementQuoteCount calls
```

### Group B: iOS 18 Compatibility
```
7a566a8 fix: remove iOS 18 white bubble backgrounds on header buttons
a545715 refactor: create reusable header button components for iOS 18 compatibility
ce896ae fix: use TouchableOpacity instead of Pressable for iOS 18 compatibility
cba75f4 revert: restore custom back button (needed for save logic)
```

### Group C: Privacy Descriptions (Required for App Store)
```
57b1c0b fix: add Face ID privacy description required for installation
c73c387 fix: add Photo Library privacy description for logo upload
fcbbe3f fix: add explicit Camera and Microphone privacy descriptions
```

### Group D: Authentication UI
```
9eb5068 feat: implement Apple-compliant authentication flow
d235948 feat: add password recovery to sign-in screen
0e9855d feat: add biometric authentication (Face ID/Touch ID)
3a52ef6 feat: add proper deep link configuration for auth callbacks
b56f898 fix: correct auth callback route structure
```

### Group E: Cloud Sync (Pro Feature)
```
a399811 feat: implement cloud sync for Pro/Premium quotes
e771ed5 feat: add Cloud Sync panel to Settings for Pro/Premium users
```

### Testing Process

For each group:
1. Cherry-pick commits: `git cherry-pick <commit-hash>`
2. Build Release in Xcode: `npx expo run:ios --configuration Release`
3. Test on simulator WITHOUT Metro running
4. If works → continue to next group
5. If breaks → identify problem, fix or skip that commit

### Commits to Skip

- All `test:` commits (debugging noise)
- All `Revert` commits (trial and error)
- All `docs:` commits (CLAUDE.md updates)
- Website/Stripe webhook commits (not in app)

### Final Steps

After all groups pass local testing:
1. Merge `feature/auth-migration` to `main`
2. Push to GitHub
3. Build on EAS: `eas build --platform ios --profile production`
4. Submit to TestFlight

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
- Currently seeded from `modules/catalog/seed.ts` (in-memory)
- Will be populated by 1Build API sync job later

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
