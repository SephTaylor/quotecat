# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## QuoteCat Ecosystem

QuoteCat is a construction quoting platform with three main components:

| Component | Location | Tech Stack | Purpose |
|-----------|----------|------------|---------|
| **Mobile App** | `/Users/sephtaylor/Projects/quotecat` | React Native, Expo, TypeScript, SQLite, Supabase | iOS app for creating quotes, invoices, managing clients |
| **Web Portal** | `/Users/sephtaylor/Projects/quotecat-portal` | Next.js 16, React 19, Tailwind, Supabase | Client-facing quote/contract viewing, e-signatures, payments |
| **Marketing Site** | `/Users/sephtaylor/Projects/quotecat/website` | Static HTML/CSS/JS, Netlify Functions | Landing page at quotecat.ai, Stripe checkout |

### Shared Backend
- **Supabase**: PostgreSQL database, Auth, Edge Functions (Deno)
- **Edge Functions**: `wizard-chat` (AI), `create-checkout`, `stripe-webhook`, `cleanup-deleted`
- **Stripe**: Payment processing for subscriptions

### Launch Target
- **Public Launch**: January 31, 2025
- **Current Status**: TestFlight beta (Build #123)

---

## Project Overview (Mobile App)

QuoteCat is a React Native Expo app for creating and managing construction quotes. It allows users to build quotes from a product catalog, manage materials, calculate labor costs, and generate PDFs. The app uses local SQLite for persistence with Supabase cloud sync for Pro/Premium users.

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

## UI Design Guidelines

### Component Reuse (Critical)

**ALWAYS reuse existing components instead of building new ones.** Before creating any UI element:

1. **Search the codebase** for existing components in `components/` and `modules/*/ui/`
2. **Check for similar patterns** in other screens - if another screen does something similar, use the same approach
3. **Only create new components** if nothing suitable exists

This ensures:
- Consistent styling across the app
- Less code to maintain
- Faster development
- Fewer bugs

**Common reusable components:**
- `HeaderBackButton` - Back buttons in headers
- `BottomBar` / `Button` - Bottom action bars
- `SwipeableQuoteItem` / `SwipeableInvoiceItem` - List items with swipe actions
- `Stepper` - Quantity +/- controls
- `MoneyInput` - Currency input fields

### Back Button Convention

**This is a strict design rule:**

| Button Type | Color | When to Use |
|-------------|-------|-------------|
| **System Back Button** | Black (`theme.colors.text`) | When iOS handles navigation automatically (same route group) |
| **Custom Back Button** | Orange (`theme.colors.accent`) | When we must handle navigation explicitly (cross-group navigation, custom behavior) |

**How to identify:**
- If you don't need to set `headerLeft` and the back button appears automatically → **Black (system)**
- If you must set `headerLeft` because the back button doesn't appear or needs custom behavior → **Orange (custom)**

**Reusable Component:**
Use `<HeaderBackButton onPress={() => router.back()} />` from `@/components/HeaderBackButton` for custom back buttons. This component:
- Shows chevron + "Back" text on iOS
- Shows just chevron on Android
- Uses `theme.colors.accent` (orange)
- Has consistent sizing and spacing

**Example - Custom back button needed (cross-group navigation):**
```tsx
headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
```

### Route Groups

The app has multiple route groups that affect navigation:
- `(main)` - Main app screens (settings, pro tools, etc.)
- `(forms)` - Form screens (quote edit, materials picker, etc.)
- `(tabs)` - Tab bar screens

Navigating between groups (e.g., `(forms)` → `(main)`) requires explicit back buttons since they're separate navigation stacks.

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
- `main` branch: v1.1.0, basic features, **WORKING on TestFlight** (Build #80)
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

## 🚧 Current Work: Drew Quote Wizard (Updated Jan 11, 2026)

### Architecture Overview

Drew is a Premium-only AI assistant that helps contractors build quotes. It runs as a Supabase Edge Function (`drew-agent`) that calls the Anthropic Claude API.

**Current Stack:**
- **Edge Function:** `supabase/functions/drew-agent/index.ts`
- **AI Model:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- **Embeddings:** OpenAI `text-embedding-3-small` (for tradecraft vector search)
- **Prompt Caching:** ✅ Enabled (Jan 11, 2026)

### API Cost Structure

Drew uses two APIs:

| API | Purpose | Cost |
|-----|---------|------|
| **Anthropic Claude** | Conversations, tool use, responses | ~95% of cost |
| **OpenAI Embeddings** | Tradecraft vector search | ~$0.0001/search (negligible) |

**Per-session cost (10-turn conversation):**
- Without caching: ~$0.35
- With caching (current): ~$0.18
- With hybrid state machine (planned): ~$0.05

### Cost Optimization Strategy

#### Phase 1: Prompt Caching ✅ DONE (Jan 11, 2026)

Added `cache_control: { type: 'ephemeral' }` to system prompt. Caching happens on Anthropic's servers - no storage on user devices or Supabase.

```typescript
system: [
  {
    type: 'text',
    text: systemPrompt + settingsContext,
    cache_control: { type: 'ephemeral' }  // 50% savings
  }
],
```

**Result:** ~50% cost reduction on system prompt tokens.

#### Phase 2: Hybrid State Machine (PLANNED)

**Problem:** Drew loses context mid-conversation because LLMs aren't great at state management.

**Solution:** Server-side state machine controls flow, Claude only adds personality.

**What doesn't need Claude (handle with state machine):**
- Job type selection → direct database lookup
- Checklist confirmation → UI interaction
- Product selection → database queries
- Labor/markup entry → form input

**What needs Claude:**
- Understanding natural language job descriptions
- Asking clarifying questions
- Handling unexpected responses

**Expected savings:** Additional 60-70% reduction (total ~85% savings)

**Draft code location:** `docs/state-machine-draft.ts`

**State Machine Phases:**
```
setup (4 questions) → generating_checklist → building (walk through items) → wrapup (labor, markup, name, client) → done
```

#### Phase 3: Model Optimization (FUTURE)

If more savings needed, can switch models:

| Model | Cost/Session | Quality |
|-------|--------------|---------|
| Claude Sonnet 4 (current) | ~$0.18 | Best |
| Claude Haiku 3.5 | ~$0.02 | Good, may drift more |
| GPT-4o-mini | ~$0.01 | Requires API rewrite |

**Recommendation:** Implement hybrid state machine first. If Haiku works well enough for the remaining LLM calls, switch later. One-line change:
```typescript
model: 'claude-haiku-3-5-20241022'
```

### Cost Projections at Scale

| Scenario | Sessions/Mo | Current | With Hybrid |
|----------|-------------|---------|-------------|
| 100 Premium users | 500 | $90 | $25 |
| 500 Premium users | 2,500 | $450 | $125 |
| 1,000 Premium users | 5,000 | $900 | $250 |

### Implementation Plan (State Machine)

1. **Edge function only first** - Update `supabase/functions/drew-agent/index.ts` with state machine logic
2. **Minimal client changes** - Only add state passing to `lib/wizardApi.ts`:
   - Add `WizardState` type
   - Update `sendWizardMessage(message, state)` to accept and return state
3. **Surgical wizard.tsx changes** - Keep ALL existing UI/styling, only change:
   - Add `useState` for `wizardState`
   - Pass state to API calls
   - Update state from responses
4. **Test after each change** - Don't batch changes

### Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/drew-agent/index.ts` | Edge function with Claude API calls |
| `lib/wizardApi.ts` | Client API wrapper |
| `app/(main)/wizard.tsx` | UI (DO NOT touch styling) |
| `docs/state-machine-draft.ts` | Draft state machine code |
| `docs/DREW_ARCHITECTURE.md` | Full architecture docs with testing notes |

### Current Status (Build #123 - Jan 11, 2026)

**What shipped:**
- Material checklist flow with tradecraft-based product selection
- Category filtering (electrical jobs only show electrical products)
- Natural language checklist confirmation ("Looks good", "Just the panel")
- Product limit (2 per category) to avoid overwhelming results
- `remove_quote_items` tool for cleanup
- Fixed quick reply button matching
- Prompt caching enabled (~50% cost savings)

**Known issue to investigate:**
- $0 draft quotes appearing on dashboard after Drew sessions - likely quotes being created during session that don't get cleaned up. Needs investigation to find when/where `save_quote` is being called prematurely.

### What NOT to Do

- Don't remove the intro screen
- Don't change quick reply button styling
- Don't change message bubble styling
- Don't remove any existing functionality
- Don't rewrite the whole wizard.tsx file
- Don't switch to cheaper model before fixing state machine (makes forgetting worse)

---

## 📋 Pending Features (Stashed - Nov 24, 2025)

### Background

During this session, we attempted to add several features but encountered TestFlight installation failures (builds 77/78 wouldn't install). After investigation, we confirmed the issue was in our uncommitted changes, not the committed codebase.

**Stash name:** `session-changes-before-clean-build`

**Working baseline:** Build #80 (version 1.1.0, commit `df370b3`) - confirmed working on TestFlight

### Stashed Changes to Re-add

These changes need to be added back incrementally, testing each batch:

| Priority | File | Changes | Risk |
|----------|------|---------|------|
| 1 | `lib/types.ts` | Added `clientEmail`, `clientPhone`, `clientAddress`, `taxPercent` to Quote/Invoice types | Low |
| 2 | `lib/pdf.ts` | Tax calculation display, client contact info in PDFs | Low |
| 3 | `lib/invoices.ts` | Added `QuickInvoiceData` type, `createQuickInvoice()` function | Medium |
| 4 | `app/(forms)/quote/[id]/edit.tsx` | UI for tax %, client email/phone/address fields | Medium |
| 5 | `app/(main)/(tabs)/invoices.tsx` | Fixed Invoice import (was importing from wrong module), added Quick Invoice button | Medium |
| 6 | `modules/materials/Picker.tsx` | Unknown changes from session | Unknown |
| 7 | `app/(forms)/invoice/` (NEW) | Quick Invoice form screen - entirely new route | High |

### Re-integration Process

1. Restore stash: `git stash pop` or `git stash apply stash@{0}`
2. Add changes one file at a time
3. Test in Xcode simulator with `npx expo run:ios`
4. If works, commit and continue
5. If fails, revert that file and investigate
6. Once all working locally, do EAS build and test on TestFlight

### Known Issues to Watch

- **Require cycles:** There are circular dependency warnings in `quotesSync.ts`. These exist in the committed code and may need fixing.
- **Import path:** `app/(main)/(tabs)/invoices.tsx` was importing `Invoice` type from `@/lib/invoices` but it should come from `@/lib/types`
- **New routes:** Adding new Expo Router routes can cause issues - test the quick invoice route carefully

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

## 📧 TODO: Email Setup (Jan 6, 2026)

Stripe webhook is working - creates auth user + profile with correct tier. But emails come from Supabase's default servers instead of quotecat.ai.

**Steps to complete:**
1. Create `noreply@quotecat.ai` in GoDaddy (Email & Office → Create Email Address)
2. Configure SMTP in Supabase (Authentication → Email → Set up SMTP):
   - Host: `smtpout.secureserver.net`
   - Port: `465` (SSL)
   - Username: `noreply@quotecat.ai`
   - Password: (set in GoDaddy)
   - Sender email: `noreply@quotecat.ai`
   - Sender name: `QuoteCat`
3. Customize "Invite User" email template with QuoteCat branding
4. Test full checkout → email → password setup → app login flow

---

## 🐛 Known Issues / To Investigate

### ✅ FIXED: Sync Crash with Dual Webapp/Mobile Access (Jan 2, 2026)

**Problem:** When triggering cloud sync on the mobile app while also using the webapp, the app slowed down significantly and eventually crashed. Required uninstall/reinstall to recover.

**Root Cause Analysis:**
The core issue was a **SYNC LOOP** caused by `saveQuote()` automatically triggering `uploadQuote()` after every local save. When sync downloaded quotes from cloud and saved them locally, each save triggered an upload back to cloud, creating an infinite loop:

```
Cloud Sync downloads 10 quotes
   ↓ saveQuote() called 10 times
   ↓ Each saveQuote() triggers uploadQuote()
   ↓ Uploads change synced_at in cloud
   ↓ Next sync sees 10 "updated" quotes
   ↓ Loop repeats → memory exhaustion → CRASH
```

**Files that had this bug:**
- `modules/quotes/storage.ts:274-283` - `saveQuote()` always uploaded
- `lib/clients.ts:63-72` - `saveClient()` always uploaded

**Fix Applied (Jan 2, 2026):**

1. **Created local-only save functions:**
   - `saveQuoteLocally()` / `updateQuoteLocally()` in `modules/quotes/storage.ts`
   - `saveClientLocally()` in `lib/clients.ts`
   - These save to AsyncStorage WITHOUT triggering cloud upload

2. **Updated sync to use local saves:**
   - `quotesSync.ts` now uses `saveQuoteLocally()` / `updateQuoteLocally()` during sync
   - `clientsSync.ts` now uses `saveClientLocally()` during sync
   - `invoicesSync.ts` already had correct pattern (`saveInvoiceLocally()`)

3. **Added persistent sync lock:**
   - Sync lock is now stored in AsyncStorage, surviving app crashes
   - Stale locks (>1 min old) are automatically cleared

4. **Added sync cooldown (5 seconds):**
   - Prevents button-mashing but stays responsive
   - Each sync type (quotes/invoices/clients) has independent cooldown

5. **Added error isolation to `initializeAuth()`:**
   - Each sync operation is wrapped in try/catch
   - One sync failure no longer crashes entire app startup

**Remaining:**
- Consider cleaning up orphan cloud data (21 invoices that were deleted locally but still exist in Supabase)

---

## 💡 Future Feature Ideas

Features to consider for future releases (not blockers for launch):

### ⚡ Performance

- **Sync Optimization** - Current sync is sequential (quotes → invoices → clients → assemblies → pricebook → business settings). Consider parallelizing critical data (quotes + invoices) and background syncing the rest. Would improve perceived performance on login and manual sync. (Discussed Jan 8, 2026)

### 🚀 Post-Launch Priority (First Week After App Store)

- **Change Order Management (Portal, Premium)** - Full change order system in the web portal for Premium users. Mobile app creates CO records when approved quotes are modified, syncs to cloud. Portal shows CO detail page under quotes with what changed, client can approve/reject, PDF generation, email notifications. Mobile keeps simple "change tracking" for Pro, Premium gets formal management. (Discussed Jan 7, 2026)

### Contracts
- **Decline/Request Changes** - Allow clients to decline a contract or request changes via the web portal instead of just signing or doing nothing. Would add "declined" and "needs revision" statuses, plus a notes field for client feedback. (Discussed Jan 7, 2026)

### Quotes
- **Quick Custom Items (Free Tier)** - Allow users to quickly add custom line items to quotes without browsing the catalog. Targets contractors who normally scribble on notepads - just type item name + price, done. Stored locally in SQLite `custom_line_items` table with `name`, `price`, `times_used`, `first_added`, `last_used`. Fuzzy deduplication ("Ceiling Fan Install" vs "Install Ceiling Fan"). Creates a "Temp Items" list the user can review later. Natural upsell: "You've added 'Ceiling Fan Install' to 7 quotes. Save to your pricebook?" (Pricebook is Pro feature). Also provides data on what products/services contractors actually quote that aren't in the catalog. (Discussed Jan 18, 2026)

### Invoices
- *(Add ideas here)*

### Communication (Premium)
- **Two-Way SMS Texting** - Real SMS/MMS messaging with clients from within the app, similar to Jobber's Grow plan feature. Each business gets a dedicated phone number. Clients can text that number and replies show up in QuoteCat. Supports images (before/after photos, on-site updates). Requires Twilio integration, 10DLC registration for compliance. Keeps business/personal communication separate. (Discussed Jan 17, 2026)

### Integrations (Premium)
- **QuickBooks Sync** - Two-way sync with QuickBooks Online for invoices, payments, and clients. Push QuoteCat invoices to QuickBooks, sync payment records, map customers. Uses OAuth 2.0 (tokens expire, need refresh handling). Consider unified API like Merge or Apideck to also support Xero/FreshBooks with same integration. ~2 weeks development. (Discussed Jan 17, 2026)

### Automations (Premium)
- **Workflow Automations** - Automated email/SMS delivery for existing notifications. **Recommended: Use Knock.app** (10K messages/mo free, $250/mo for 50K). Knock handles workflow orchestration, delays, batching, and multi-channel delivery. We call Knock API when events happen (quote sent, invoice overdue), Knock handles the timing and delivery via our Twilio/SendGrid. Phase 1: Quote follow-up reminders, Invoice overdue reminders. Phase 2: Review requests, Appointment reminders. Phase 3: Custom automation builder. Cuts dev time from ~2 weeks to ~2-3 days. (Discussed Jan 17, 2026)

### Field Operations (Premium)
- **GPS Tracking & Route Optimization** - Phase 1: GPS waypoints on clock-in/out (useful for timesheets, proves tech was on-site). Phase 2: Live map view showing tech locations (owner can see where crew is). Phase 3: Route optimization - auto-calculate most efficient job order, re-optimize when jobs change. Uses Google Maps SDK + Routes API (~$10/1000 routes) or open-source OSRM/OpenRouteService. Privacy-conscious: only track when clocked in. (Discussed Jan 17, 2026)

### Marketing (Premium Add-on)
- **Google Review Requests** - Auto-request Google reviews after job completion or invoice paid. Send up to 2 follow-up reminders. Track which clients have reviewed (don't ask again). Dashboard showing average rating, total reviews, requests sent. Requires Google Business Profile API integration. Jobber charges $39/mo for this - could be Premium included or separate add-on. (Discussed Jan 17, 2026)
- **Email/SMS Campaigns** - Marketing campaigns to client list. Re-engagement ("haven't seen you in 6 months"), seasonal promos, announcements. AI-generated campaign content via Drew. Could use Knock.app for delivery (same infrastructure as automations). Jobber charges $29/mo. (Discussed Jan 17, 2026)
- **Referral Program** - Automated referral tracking. Client shares link, new customer signs up, original client gets credit/reward. Track referral sources. Jobber charges $29/mo. (Discussed Jan 17, 2026)

### Drew AI (Premium)
- **Site Visit Mode (Voice-to-Scope)** - Record conversations during on-site walkthroughs with clients. AI transcribes and extracts job details (tasks, locations, measurements, client concerns) so contractors don't have to take notes. Pre-fills quote draft with captured details. Uses Whisper API (~$0.006/min) or Deepgram for transcription, Claude for extraction. Add 🎤 button to Drew chat screen. Requires consent prompt for recording (two-party consent states). Killer differentiator - no competitor has this. (Discussed Jan 17, 2026)

### General
- **Drew Visibility Toggle** - Add a button in the header to show/hide Drew (WizardFAB). Useful for users who want a cleaner screen sometimes or prefer to "summon" Drew only when needed. Could be a small icon that toggles Drew's visibility. (Discussed Jan 7, 2026)

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

---

## 🎁 VIP Testers (Lifetime Premium)

When going live, create these users with `tier: "premium"` directly in the database (no Stripe subscription needed):

| Name | Email |
|------|-------|
| Drew | foxrider12@icloud.com |
| Wyatt | wyattstephan@stephanelectric.com |

These are early beta testers who get lifetime premium access as thanks for their help.
