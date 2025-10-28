# QuoteCat Product Overview

**Version:** 1.1.0
**Status:** Beta (TestFlight)
**Platform:** iOS (Android planned)
**Last Updated:** January 2025

---

## Table of Contents

1. [Product Summary](#product-summary)
2. [Core Features](#core-features)
3. [User Flows](#user-flows)
4. [Technical Architecture](#technical-architecture)
5. [Current State](#current-state)
6. [Screen-by-Screen Guide](#screen-by-screen-guide)
7. [Known Limitations](#known-limitations)

---

## Product Summary

**QuoteCat** is a mobile-first construction quoting application built for small residential contractors. It enables contractors to create professional, accurate construction quotes in minutes—even without internet connectivity—directly from job sites.

### Key Differentiators

- **Offline-First:** Full functionality without internet (quotes, materials, calculations)
- **Mobile-Native:** Built for on-site use, not adapted from desktop
- **Fast:** Create quotes in 5-10 minutes vs. 30-60 minutes with spreadsheets
- **Affordable:** $15-30/month vs. $99+ for competitors
- **Simple:** Focused on quoting, not bloated project management

### Target User

**"Budget-Conscious Bob"** - Small residential contractor, 1-5 person crew, $100k-$500k annual revenue, needs professional quotes without expensive software.

---

## Core Features

### 1. Quote Management

**What it does:** Create, edit, duplicate, and delete construction quotes with full cost tracking.

**Key capabilities:**
- **Quote fields:**
  - Project name and client name (required)
  - Status: Draft → Sent → Approved → Completed → Archived
  - Line items (products with quantities and prices)
  - Labor costs
  - Quick material estimate (flat dollar amount)
  - Markup percentage
  - Notes (multi-line text)

- **Automatic calculations:**
  - Materials subtotal from line items
  - Labor + materials + overhead = Subtotal
  - Markup applied to subtotal
  - Grand total (always accurate, never stale)

- **Quote actions:**
  - Pin/unpin for quick Dashboard access
  - Duplicate (creates copy with new ID)
  - Delete with 3-second undo
  - Status progression workflow
  - Auto-save on navigation

- **Organization:**
  - Filter by status (All, Draft, Sent, Approved, etc.)
  - Search by project or client name
  - Sort by most recent (updatedAt)
  - Pin favorites to top

**Who can use it:** All tiers (Free has 25 quote limit)

---

### 2. Materials Selection

**What it does:** Browse and select from 100+ construction products across 8 categories.

**Product catalog:**
- **Framing:** 2x4 studs, joists, plates, sheathing
- **Drywall:** Sheets (4x8, 4x12), screws, tape, mud
- **Electrical:** Wire, boxes, breakers, outlets, switches
- **Plumbing:** Pipes (PVC, copper), fittings, fixtures
- **Flooring:** Vinyl, laminate, underlayment
- **Roofing:** Shingles, underlayment, nails
- **Paint:** Primer, paint, brushes, rollers
- **Hardware:** Fasteners, adhesives, caulk

**User experience:**
- Browse by category
- Product cards show name, unit (ea, sheet, box), and unit price
- Stepper controls (+/- buttons) to set quantities
- Quantity badges on selected products
- "Accumulate mode" - add items without clearing previous selection
- Current quote totals visible at top (X items, $Y total)
- "Edit" button to review/remove existing items
- Bottom bar: "Add X items" button

**Who can use it:** All tiers

---

### 3. Assemblies (Pro Feature)

**What it does:** Pre-built material templates that auto-calculate quantities based on project variables (room dimensions, etc.).

**Example:** "Frame a 10x12 Room" automatically calculates:
- Top/bottom plates based on perimeter
- Studs based on length and spacing (16" OC)
- Drywall sheets based on wall area
- Screws/fasteners based on quantities

**Built-in assemblies (seed data):**
- Frame a Wall
- Drywall a Room
- Wire a Room
- Install Flooring
- Paint a Room
- Plumb a Bathroom

**Custom assemblies:**
- Create your own templates
- Add products from catalog
- Set fixed or computed quantities
- Save for future reuse
- Marked with "📌 CUSTOM" badge

**Assembly Manager:**
- Browse all assemblies (built-in + custom)
- Search/filter assemblies
- Duplicate existing assemblies
- Edit custom assemblies
- Delete custom assemblies (swipe right)
- Validation warnings for unavailable products

**Assembly Editor:**
- Set assembly name
- Define variables (length, width, height, spacing)
- Add products from catalog
- Configure quantity formulas (qtyFn)
- Preview calculated quantities
- Add to quote or save as template

**Assembly Calculator:**
- Select assembly from library
- Enter project-specific values (e.g., "Room: 12' x 15'")
- Preview all materials and pricing
- One-tap add to quote

**Who can use it:** Pro and Premium tiers only

---

### 4. PDF Export

**What it does:** Generate professional PDF quotes for clients.

**PDF contents:**
- Company header (if company details configured)
- Quote title (project name)
- Client name
- Date
- Line items table (if items exist)
- **Simplified total only** (no detailed breakdown in PDF)
- QuoteCat branding footer (Free tier only)

**Export process:**
1. User taps "Export PDF" on Review screen
2. Confirmation dialog shows quota remaining (Free tier: X/5 this month)
3. PDF generated using `expo-print` (native APIs)
4. Native share sheet opens (save, email, AirDrop, etc.)
5. Usage counter incremented

**Quotas:**
- **Free:** 5 PDFs per month
- **Pro/Premium:** Unlimited

**Branding:**
- **Free:** Includes "Generated with QuoteCat" footer
- **Pro/Premium:** Company details with custom branding, no QuoteCat footer

**Who can use it:** All tiers (with limits)

---

### 5. CSV Export

**What it does:** Export quote data to spreadsheet format (Excel, Google Sheets, Numbers, accounting software).

**CSV format:**
```csv
Item,Quantity,Unit Price,Total
2x4x8 Stud,50,3.48,174.00
Drywall 4x8,20,12.98,259.60
Labor,1,500.00,500.00
Total,,,933.60
```

**Export process:**
1. User taps "CSV" button on Review screen
2. Confirmation dialog shows quota remaining (Free tier: X/2 this month)
3. CSV file generated
4. Native share sheet opens
5. Compatible with Excel, Sheets, QuickBooks, FreshBooks, Wave

**Quotas:**
- **Free:** 2 CSVs per month
- **Pro/Premium:** Unlimited

**Who can use it:** All tiers (with limits)

---

### 6. Dashboard & Analytics

**What it does:** Business overview with quick stats and value tracking.

**Quick Stats:**
- All Quotes (total count)
- Pinned (starred quotes)
- Draft, Sent, Approved, Completed (counts by status)
- Tap any stat to filter quotes by that status

**Value Tracking:**
- **Pending:** Total dollar value of Draft + Sent quotes
- **Approved:** Value of quotes approved but not completed
- **To Invoice:** Value of completed quotes (ready to bill)

**Pinned Quotes Section:**
- Shows all starred/pinned quotes
- Quick access to frequent projects
- Swipeable cards (duplicate, delete)

**Recent Quotes Section:**
- Configurable count (3, 5, 10, or all)
- Most recently updated quotes
- Swipeable cards

**Customization:**
- Toggle sections on/off (Stats, Value Tracking, Pinned, Recent)
- Set recent quotes count
- "Reset to Default" button

**Who can use it:** All tiers

---

### 7. Settings & Configuration

**What it does:** App configuration, account management, company details.

**Profile Section:**
- Sign In/Sign Out
- Email display (when logged in)
- Tier badge (Free, Pro, Premium)

**Usage & Limits (Free tier only):**
- Progress bars for:
  - Quotes created (X/25)
  - PDF exports this month (X/5)
  - CSV exports this month (X/2)
- Resets monthly (first of month)

**Appearance:**
- Dark mode toggle
- Light/dark gradients
- Orange accent color (#FF8C00)

**Dashboard Settings:**
- Show/hide sections
- Recent quotes count
- "Reset to Default" button

**Company Details:**
- Company Name
- Email
- Phone
- Website
- Address (multi-line)
- Preview card showing formatted details
- Used on PDFs (Pro tier only)

**Privacy & Data:**
- Anonymous usage tracking toggle
- Opt-in analytics (PostHog)
- Product usage data (no PII)

**Coming Soon:**
- Good/Better/Best pricing preview
- Founder pricing explanation

**Tester Tools (Beta only):**
- Toggle Free/Pro tier (debug mode)
- Reset assemblies to seed data
- Reset products to seed data

**About:**
- App version
- Terms of Service link
- Privacy Policy link
- Support email link

**Who can use it:** All tiers

---

### 8. Offline Mode

**What it does:** Full app functionality without internet connection.

**How it works:**
- All quotes stored in AsyncStorage (local device storage)
- Product catalog pre-loaded from seed data
- Assemblies cached locally
- Create, edit, delete quotes offline
- Calculations happen locally (no server calls)
- PDFs generated on-device (`expo-print` uses native APIs)

**What doesn't work offline:**
- Sign in/sign out (requires Supabase auth)
- Cloud sync (future feature)
- Real-time pricing updates (future 1Build API integration)

**Migration strategy:**
- Free users: 100% local, never syncs to cloud
- Pro/Premium users: Local cache + cloud backup (planned)
- Auto-migration on first Pro login (local → cloud)

**Who can use it:** All tiers (core value prop)

---

## User Flows

### Flow 1: Create a Basic Quote (5-10 minutes)

**Goal:** Contractor on job site creates professional quote for client.

**Steps:**

1. **Open app** → Dashboard loads with recent quotes
2. **Tap "+" button** → Navigate to new quote editor
3. **Enter quote details:**
   - Project name: "Kitchen Remodel - Smith Residence"
   - Client name: "John Smith"
   - Status: Draft (default)
4. **Tap "Add materials" button** → Materials picker opens
5. **Browse categories:**
   - Tap "Drywall" category
   - Tap "+" on "Drywall 4x8 Sheet" → Quantity set to 20
   - Tap "+" on "Drywall Screws (Box of 1000)" → Quantity set to 2
6. **Switch to Framing category:**
   - Tap "+" on "2x4x8 Stud" → Quantity set to 30
7. **Review selection:**
   - Top bar shows "23 items, $450.00"
   - Tap "Add 23 items" button
8. **Return to quote editor:**
   - Items list now shows 3 products
   - Materials subtotal: $450.00
9. **Add labor:**
   - Tap "Labor" field
   - Enter "$1,200.00"
10. **Apply markup:**
    - Tap "Markup" field
    - Enter "15%"
11. **Review totals:**
    - Materials: $450.00
    - Labor: $1,200.00
    - Subtotal: $1,650.00
    - Markup (15%): $247.50
    - **Grand Total: $1,897.50**
12. **Tap "Review & Export" button** → Navigate to review screen
13. **Review details:**
    - Company details card (if configured)
    - Quote header (project, client, date)
    - Line items
    - Cost breakdown
14. **Export PDF:**
    - Tap "Export PDF" button
    - Confirm: "4/5 PDF exports remaining this month"
    - PDF generates
    - Share sheet opens
    - Select "Email" → Send to client
15. **Tap "Done"** → Return to quotes list

**Result:** Professional quote created in ~7 minutes, sent to client before leaving job site.

**Competitive advantage:** Traditional method (Excel) takes 30-60 minutes at home office.

---

### Flow 2: Use an Assembly (Pro Users)

**Goal:** Quote a common job (e.g., frame a room) in 2-3 minutes using pre-built template.

**Steps:**

1. **Open quote editor** (existing or new quote)
2. **Tap "Add from Assembly" button** → Assembly library opens
3. **Browse assemblies:**
   - See built-in: "Frame a Wall", "Drywall a Room", etc.
   - See custom: "📌 Master Bedroom Package" (user-created)
4. **Select "Frame a Wall"** → Assembly calculator opens
5. **Enter variables:**
   - Length: 12 feet
   - Height: 8 feet
   - Stud spacing: 16" OC
6. **Preview calculated materials:**
   - Top/bottom plates: 2 (based on length)
   - Studs: 10 (based on length and spacing)
   - Drywall sheets: 6 (based on area)
   - Screws: 2 boxes (based on quantities)
   - **Total: $287.50**
7. **Tap "Add to Quote"** → Return to quote editor
8. **Items automatically added:**
   - All 4 products with correct quantities
   - Subtotal updated
9. **Continue editing or export**

**Result:** Common job quoted in 2 minutes vs. 10-15 minutes manual selection.

**Value prop:** Assemblies eliminate repetitive work, reduce errors, ensure nothing is forgotten.

---

### Flow 3: Create a Custom Assembly (Pro Users)

**Goal:** Save a custom material package for future reuse.

**Steps:**

1. **Navigate to Pro Tools tab** → Tap "Assembly Manager"
2. **Tap "+ New" button** → Assembly Editor opens
3. **Set assembly name:**
   - "Master Bathroom Plumbing Package"
4. **Tap "Add Products" button** → Product catalog opens
5. **Select products:**
   - 1/2" PVC pipe (10' sections) → Qty: 8
   - 1/2" PVC elbows → Qty: 12
   - Toilet flange → Qty: 1
   - Shower valve → Qty: 1
6. **Tap "Save" button** → Assembly saved to library
7. **Future use:**
   - Open any quote
   - Tap "Add from Assembly"
   - Select "📌 Master Bathroom Plumbing Package"
   - One-tap add all items

**Result:** Common material package saved for reuse, eliminates repetitive selection.

**ROI:** If used 5 times, saves 50+ minutes of material selection time.

---

### Flow 4: Duplicate and Modify a Quote

**Goal:** Create a new quote based on a previous similar job.

**Steps:**

1. **Navigate to Quotes tab**
2. **Find quote:** "Kitchen Remodel - Smith Residence"
3. **Swipe left** on quote card
4. **Tap "Duplicate" button** → New quote created: "Kitchen Remodel - Smith Residence (Copy)"
5. **Auto-navigate to edit screen**
6. **Modify details:**
   - Change client name: "Jane Doe"
   - Update project name: "Kitchen Remodel - Doe Residence"
   - Adjust quantities (fewer cabinets, more tile)
7. **Update labor:** $1,400 (vs. $1,200 on original)
8. **Review and export**

**Result:** Similar quote created in 2-3 minutes vs. 10+ minutes starting from scratch.

**Use case:** Contractor quotes 5 similar kitchens, duplicates and tweaks each time.

---

### Flow 5: Manage Quote Status (Track Pipeline)

**Goal:** Move quotes through workflow to track business pipeline.

**Steps:**

1. **Create quote** → Status: Draft
2. **Send to client** → Change status: Sent
3. **Client approves** → Change status: Approved
4. **Job completed** → Change status: Completed
5. **Invoice paid** → Change status: Archived (optional)

**Workflow visualization:**

```
Draft → Sent → Approved → Completed → Archived
  ↓       ↓        ↓          ↓           ↓
(Working) (Pending) (Won) (Done) (Paid/Closed)
```

**Dashboard impact:**
- **Pending value:** Sum of Draft + Sent quotes
- **Approved value:** Sum of Approved quotes (work to do)
- **To Invoice value:** Sum of Completed quotes (ready to bill)

**Filtering:**
- Tap status chip on Quotes tab to filter by status
- Tap Dashboard quick stats to jump to filtered view

**Result:** Visual pipeline tracking without complex project management tools.

---

## Technical Architecture

### Platform & Framework

**React Native + Expo SDK 54**
- Cross-platform: iOS, Android, Web (future)
- Expo Router v6 (file-based routing)
- TypeScript (strict mode)
- JSX for UI components

**Key libraries:**
- `@react-native-async-storage/async-storage` - Local persistence
- `react-native-reanimated` - Smooth animations
- `react-native-gesture-handler` - Swipeable components
- `expo-print` - PDF generation (native APIs)
- `@supabase/supabase-js` - Backend (configured, not connected)
- `posthog-react-native` - Analytics (opt-in)

**Navigation:**
- Expo Router (file-based routing)
- Drawer navigation (4 main tabs)
- Stack navigation for forms and editors

---

### Data Storage

**Local-First (AsyncStorage)**

All data stored on-device first:

**Storage keys:**
- `@quotecat/quotes` - All quotes (primary key)
- `quotes` - Legacy key (migration support)
- `qc:quotes:v1` - Legacy key (migration support)
- `assemblies:cache` - Custom assemblies
- `@quotecat:preferences` - User settings
- `@quotecat:user-state` - Tier, usage tracking

**Data normalization:**
- `normalizeQuote()` ensures data integrity
- `normalizeItem()` validates line items
- Forward-compatible: Extra fields allowed on types
- Computed totals: Never trust stored totals, always recalculate

**Legacy migration:**
- Reads from multiple keys (backwards compatible)
- De-duplicates by ID (prefers latest timestamp)
- Always writes to primary key
- Seamless migration for users upgrading from old versions

---

### Cloud Backend (Supabase)

**Status:** Configured but not connected (planned for v1.1)

**Database tables (9 total):**

1. **profiles** - User accounts, tier, company details, preferences
2. **quotes** - Cloud-synced quotes (Pro/Premium only)
3. **assemblies** - Custom templates (Pro/Premium only)
4. **subscriptions** - Payment history, tier management
5. **usage_events** - Analytics, feature tracking
6. **suppliers** - Supplier integrations (1Build, Lowe's, HD)
7. **categories** - Product categories
8. **products** - Full catalog with real-time pricing (future)
9. **product_prices** - Price history tracking

**Security:**
- Row-Level Security (RLS) on all tables
- Users can only see their own data
- Product catalog is public read
- Service role only for supplier writes

**Helper functions:**
- `user_has_tier(required_tier)` - Check tier permissions
- `get_spots_remaining(tier, pricing)` - Founder pricing slots
- `reset_monthly_usage()` - Reset PDF/CSV counters

**Migration strategy:**
- Free users: Stay 100% local (no cloud sync)
- Pro/Premium users: Auto-migrate on first sign-in
- Local cache remains (fast, offline access)
- Supabase = backup + multi-device sync

---

### Analytics (PostHog)

**Status:** Implemented but opt-in (privacy-friendly)

**What's tracked:**
- App opened
- Quote created/updated/deleted/duplicated
- Review screen opened
- PDF generated/shared
- CSV generated/shared
- Errors occurred

**What's NOT tracked:**
- Personal information (PII)
- Quote content or amounts
- Client names or details
- Location data

**Configuration:**
- Requires `EXPO_PUBLIC_POSTHOG_API_KEY` in `.env`
- Defaults to `https://app.posthog.com`
- Fails gracefully if not configured
- User opt-in toggle in Settings

**Purpose:**
- Improve catalog (surface popular products)
- Feature usage (inform roadmap)
- Error tracking (improve stability)

---

### Website (Landing Page)

**Status:** Production-ready, deployed to quotecat.ai

**Technology:** Single-file HTML + inline CSS (no dependencies)

**Pages:**
1. **index.html** - Landing page (hero, features, tiers, CTA)
2. **faq.html** - Frequently Asked Questions
3. **privacy.html** - Privacy Policy
4. **terms.html** - Terms of Service
5. **signin.html** - Sign In/Sign Up form (Supabase auth)

**Design:**
- Dark theme with orange accent (#f97316)
- Gradient backgrounds
- Mobile-responsive
- Fast loading (no frameworks)
- Professional contractor-focused copy

**Landing page sections:**
- **Hero:** "Stop Losing Jobs to Slow Quotes"
- **Problem:** Traditional quoting pain points
- **Features:** 6 key capabilities (5min quotes, catalog, PDFs, etc.)
- **Tiers:** Free, Pro, Premium comparison
- **FAQ:** Common questions
- **CTA:** "Join the Waitlist" → Email hello@quotecat.ai

**Deployment:**
- Hosted on GoDaddy
- Upload via File Manager or FTP
- Update by editing HTML and re-uploading

**Future enhancements:**
- Contact form integration
- Stripe payment integration (avoid Apple tax)
- Blog/resources section
- Analytics (Google Analytics or Plausible)

---

### Export Formats

**PDF Export (`expo-print`)**

Uses native platform APIs:
- iOS: UIPrintPageRenderer → PDF
- Android: PrintManager → PDF
- Web: Browser print → PDF (future)

**Layout:**
- Company header (if configured)
- Quote title, client, date
- Line items table
- Simplified total (no breakdown)
- Footer (QuoteCat branding for Free tier)

**Sharing:** Native share sheet (Save to Files, Email, AirDrop, Messages, etc.)

**CSV Export (Custom Generator)**

Plain text CSV format:
```
Item,Quantity,Unit Price,Total
Product 1,10,5.00,50.00
Product 2,5,12.00,60.00
Labor,1,500.00,500.00
Total,,,610.00
```

**Compatible with:** Excel, Google Sheets, Numbers, QuickBooks, FreshBooks, Wave

**Sharing:** Native share sheet (same as PDF)

---

### Product Catalog

**Current:** 100+ products from seed data (`modules/catalog/seed.ts`)

**Categories (8):**
1. Framing (studs, plates, joists, sheathing)
2. Drywall (sheets, screws, tape, mud)
3. Electrical (wire, boxes, breakers, outlets)
4. Plumbing (pipes, fittings, fixtures)
5. Flooring (vinyl, laminate, underlayment)
6. Roofing (shingles, underlayment, nails)
7. Paint (primer, paint, supplies)
8. Hardware (fasteners, adhesives, caulk)

**Product structure:**
```typescript
{
  id: "2x4x8-stud",
  name: "2x4x8 Stud",
  unit: "ea",
  unitPrice: 3.48,
  categoryId: "framing"
}
```

**Future (1Build API Integration):**
- Real-time pricing from Lowe's, Home Depot, Menards
- Product images and descriptions
- Stock availability
- SKU and supplier info
- Daily price sync (background job)

---

## Current State

### ✅ Fully Implemented and Working

**Quote Management:**
- Create, read, update, delete quotes
- Duplicate quotes with one tap
- Pin/unpin favorites
- Status workflow (6 statuses)
- Undo deleted quotes (3-second snackbar)
- Search and filter by status
- Auto-save on navigation
- Forward-compatible data models

**Materials & Products:**
- 100+ product catalog (seed data)
- 8 categories
- Material selection with stepper controls
- Accumulate mode (add items without clearing)
- Current quote totals
- Edit existing items

**Assemblies (Pro):**
- Built-in assembly templates (seed data)
- Custom assembly creation
- Assembly library browser
- Assembly editor with dynamic quantities
- Assembly calculator with variable inputs
- Assembly Manager (browse, edit, duplicate, delete)
- Validation warnings for unavailable products

**Export & Sharing:**
- PDF generation with expo-print
- CSV export
- Native share sheet (email, AirDrop, save)
- Usage quota tracking (Free tier)
- Company branding on PDFs (Pro tier)

**UI & UX:**
- Dark/light mode with gradients
- Orange accent color throughout
- Swipeable quote cards
- Pull-to-refresh
- Bottom bars for actions
- Empty states with helpful prompts
- Smooth animations (Reanimated)
- Drawer navigation (4 tabs)

**Dashboard:**
- Quick stats (All, Pinned, Draft, Sent, Approved, Completed)
- Value tracking (Pending, Approved, To Invoice)
- Pinned quotes section
- Recent quotes section
- Customization options
- Tap-to-filter

**Settings:**
- Company details editor
- Usage limits display (Free tier)
- Dark mode toggle
- Dashboard customization
- Privacy controls (analytics opt-in)
- About section (version, terms, privacy, support)
- Tester tools (toggle tier, reset data)

**Offline Support:**
- Full app functionality without internet
- AsyncStorage for local persistence
- Product catalog pre-loaded
- PDF generation on-device
- No network dependency for core features

**Analytics:**
- PostHog integration (opt-in)
- Event tracking (quotes, exports, errors)
- Privacy-friendly (no PII)

---

### 🚧 Partially Implemented

**Authentication:**
- Sign In/Sign Out UI (redirects to quotecat.ai/signin.html)
- Placeholder user state
- Not yet functional (Supabase auth pending)

**Supabase Integration:**
- Client configured (`lib/supabase.ts`)
- Database schema designed (9 tables)
- Migrations written
- RLS policies defined
- Not yet connected to app

**Tier System:**
- Free/Pro/Premium logic implemented
- Usage tracking working
- Export quotas enforced
- Assembly feature gating working
- Debug toggle for testing (Tester Tools)
- **Payment flow not implemented** (Stripe pending)

**Website:**
- Landing page complete and deployed
- Sign In page created but not functional
- Payment integration pending (Stripe)

---

### 📅 Planned (Not Yet Built)

**Authentication & Cloud Sync:**
- Supabase authentication (email/password)
- Auto-migration (local → cloud on first Pro sign-in)
- Bi-directional sync (local cache + cloud backup)
- Multi-device support
- Conflict resolution (last-write-wins)

**Supplier Integration:**
- 1Build API connection
- Real-time pricing from Lowe's, Home Depot, Menards
- Product images and descriptions
- Daily price sync (background job)
- Stock availability

**Payment & Monetization:**
- Stripe integration (website, not in-app)
- Founder pricing countdown (500 Pro, 100 Premium)
- Price increase triggers
- Payment confirmation emails
- Subscription management

**Quote Wizard (Premium Feature):**
- Room dimension calculator
- Guided quoting workflow
- Material recommendations
- AI-assisted estimation (future)

**Advanced Features:**
- Recent products section (most-used)
- Custom branding (company logo on PDFs)
- Team collaboration (Premium)
- Advanced analytics dashboard
- Export to QuickBooks/FreshBooks (direct API)

**Platform Expansion:**
- Android app (Expo supports out-of-box)
- Web app (Expo web, responsive)
- Desktop app (Electron, future)

**Marketing & Growth:**
- Referral program
- Testimonial collection
- In-app upgrade flow
- Onboarding wizard
- Feature tutorials

---

## Screen-by-Screen Guide

### 1. Dashboard Tab (Home)

**Purpose:** Business overview and quick access to quotes.

**What you see:**
- Welcome header: "Welcome back!" + business summary
- **Quick Stats Grid (6 cards):**
  - All Quotes: Total count
  - Pinned: Count of starred quotes
  - Draft, Sent, Approved, Completed: Counts by status
  - Tap any card → Filter quotes by that status

- **Value Tracking (3 cards):**
  - Pending: $X,XXX (Draft + Sent total value)
  - Approved: $X,XXX (Approved total value)
  - To Invoice: $X,XXX (Completed total value)

- **Pinned Quotes Section:**
  - Header: "Pinned Quotes"
  - Shows all starred quotes
  - Swipeable cards (left: duplicate, right: delete)
  - Tap card → Navigate to edit screen

- **Recent Quotes Section:**
  - Header: "Recent Quotes" (3, 5, 10, or all)
  - Most recently updated
  - Swipeable cards
  - Tap card → Navigate to edit screen

**Actions:**
- Tap "+" button (top right) → Create new quote
- Tap any quick stat → Filter quotes
- Swipe quote card → Duplicate or delete
- Tap quote card → Edit quote
- Pull down → Refresh

**Customization:**
- Settings → Dashboard → Toggle sections on/off
- Settings → Dashboard → Recent quotes count

---

### 2. Quotes Tab

**Purpose:** Full quote list with filtering and search.

**What you see:**
- Search bar at top (filter by project/client name)
- Horizontal filter chips: All, Pinned, Draft, Sent, Approved, Completed, Archived
- Quote cards (scrollable list):
  - Project name (bold)
  - Client name
  - Status chip (color-coded)
  - Total amount (large, orange)
  - Date (last updated)
  - Star icon (pin/unpin)

**Actions:**
- Tap "+" button → Create new quote
- Tap filter chip → Show only that status
- Search bar → Filter by name
- Tap quote card → Edit quote
- Swipe left → Duplicate
- Swipe right → Delete (with 3s undo)
- Tap star → Pin/unpin
- Pull down → Refresh

**Empty state:**
- "No quotes yet"
- "Tap + to create your first quote"

**Filtered empty state:**
- "No quotes with status: Sent"
- "Create or edit a quote to get started"

---

### 3. Pro Tools Tab

**Purpose:** Access premium features (assemblies, templates, etc.)

**Free users see:**
- Header: "Pro Tools"
- **Locked features with benefits:**
  - Assembly Library (locked)
  - Custom Assemblies (locked)
  - Cloud Backup (coming soon)
  - Quote Wizard (coming soon)
  - Advanced Analytics (coming soon)
- "Learn More" button → Opens upgrade info modal
- Modal shows Pro benefits + pricing

**Pro users see:**
- Header: "Pro Tools"
- **Assembly Library** → Navigate to assemblies screen
- **Assembly Manager** → Navigate to assembly manager
- **Coming Soon:**
  - Cloud Backup (shows sync status when implemented)
  - Quote Wizard
  - Advanced Analytics

---

### 4. Settings Tab

**Purpose:** App configuration, account, and company details.

**Sections:**

**Profile:**
- Email (when signed in) or "Not signed in"
- Tier badge (Free, Pro, Premium)
- "Sign In" or "Sign Out" button

**Usage & Limits (Free tier only):**
- Progress bars:
  - Quotes: X / 25
  - PDF exports this month: X / 5
  - CSV exports this month: X / 2
- Note: "Resets monthly on the 1st"

**Appearance:**
- "Dark Mode" toggle

**Dashboard:**
- "Customize Dashboard" button → Modal with toggles
- Toggles: Quick Stats, Value Tracking, Pinned Quotes, Recent Quotes, Quick Actions
- Recent Quotes Count dropdown (3, 5, 10, All)
- "Reset to Default" button

**Quote Defaults:**
- "Company Details" button → Navigate to company details editor

**Privacy & Data:**
- "Anonymous Usage Tracking" toggle
- Description: "Help improve QuoteCat (no personal info shared)"

**Coming Soon:**
- "Pricing Tiers" button → Shows Good/Better/Best modal
- Modal explains Free, Pro, Premium with feature comparison

**Tester Tools (Beta only):**
- "Toggle Free/Pro Tier" switch (debug mode)
- "Reset Assemblies" button
- "Reset Products" button

**About:**
- App version: "1.1.0"
- "Terms of Service" button
- "Privacy Policy" button
- "Email Support" button → Opens hello@quotecat.ai

---

### 5. Quote Editor Screen

**Purpose:** Create or edit a quote.

**Header:**
- Title: "New Quote" or quote name
- Pin button (star icon)
- "Review & Export" button (validates required fields)

**Quote Details:**
- **Status chips:** Draft, Sent, Approved, Completed, Archived (tap to change)
- **Project Name** (required): Text input
- **Client Name** (required): Text input

**Materials Section:**
- Header: "Materials"
- **Items list:**
  - Shows all line items with name, qty, unit price, total
  - Stepper controls (+/-) to adjust qty
  - Auto-removes item when qty reaches 0
  - Swipe to delete
- **Empty state:** "No materials added yet"
- **"Add materials" button** → Navigate to materials picker
- **"Add from Assembly" button** → Navigate to assembly library (Pro only)

**Costs Section:**
- **Labor:** Dollar input (formatted to 2 decimals)
- **Materials (Quick Estimate):** Dollar input (for flat estimates without line items)
- **Notes:** Multi-line text input

**Markup Section:**
- **Markup Percentage:** Number input with % suffix

**Quote Totals Card:**
- Materials (from items): $X,XXX.XX
- Materials (quick estimate): $X,XXX.XX (if used)
- Labor: $X,XXX.XX
- **Subtotal:** $X,XXX.XX
- Markup (X%): $X,XXX.XX
- **Grand Total:** $X,XXX.XX (orange, bold, large)

**Actions:**
- Auto-save on navigation
- "Review & Export" button validates:
  - Project name (required)
  - Client name (required)
  - At least 1 item OR labor OR material estimate
- If validation fails, shows error toast

---

### 6. Materials Picker Screen

**Purpose:** Browse and select products from catalog.

**Header:**
- Title: "Select Materials"
- Current quote totals: "X items, $Y,YYY"
- "Edit" button → Edit existing items screen

**Category Tabs:**
- Horizontal scrollable tabs: Framing, Drywall, Electrical, Plumbing, Flooring, Roofing, Paint, Hardware

**Product Cards:**
- Product name (bold)
- Unit (ea, sheet, box) + Unit price ($X.XX)
- Stepper controls (+/-)
- Quantity badge (when qty > 0)

**Bottom Bar:**
- "Add X items ($Y,YYY)" button → Adds selected items to quote
- "Done" button → Returns without adding (if no selection)

**Empty state:**
- "No products in this category yet"

**Actions:**
- Tap + → Increment quantity
- Tap - → Decrement quantity
- Tap "Assemblies" → Quick access to assembly library (Pro only)
- Tap "Add X items" → Add to quote and return
- Tap "Done" → Return without adding

---

### 7. Quote Review Screen

**Purpose:** Review quote and export as PDF or CSV.

**Header:**
- Title: "Review Quote"
- Back button

**Content:**
- **Company Details Card** (if configured):
  - Company name
  - Email, phone, website
  - Address
  - Orange accent border

- **Quote Header:**
  - Project name (large, bold)
  - Client name
  - Date (current date)

- **Materials Section:**
  - Header: "Materials"
  - Line items table:
    - Item name | Qty | Unit Price | Total
  - Empty state: "No materials added"

- **Cost Breakdown Card:**
  - Materials: $X,XXX.XX
  - Labor: $X,XXX.XX
  - Overhead: $X,XXX.XX (if any)
  - Subtotal: $X,XXX.XX
  - Markup (X%): $X,XXX.XX
  - **Grand Total:** $X,XXX.XX (orange, bold, large)

- **Note (Free tier):**
  - "Detailed breakdown shown here. PDF export shows simplified total only."

- **Free Tier Banner (if Free):**
  - "PDF Exports: X/5 remaining this month"
  - "CSV Exports: X/2 remaining this month"
  - "Learn About Pro" button → Upgrade modal

**Actions:**
- **"Export PDF" button:**
  - Shows confirmation: "X/5 remaining this month" (Free tier)
  - Generates PDF
  - Opens native share sheet
  - Increments usage counter

- **"CSV" button:**
  - Shows confirmation: "X/2 remaining this month" (Free tier)
  - Generates CSV
  - Opens native share sheet
  - Increments usage counter

- **"Done" button:**
  - Returns to quotes list

---

### 8. Assembly Library Screen (Pro Only)

**Purpose:** Browse and select pre-built or custom assemblies.

**Free users:**
- Shows upgrade teaser:
  - "Upgrade to Pro to unlock Assemblies"
  - Benefits list:
    - Pre-built material calculators
    - Save custom assemblies
    - Build personal template library
    - Always-current pricing
  - "Upgrade to Pro" button → Upgrade modal

**Pro users:**
- Search bar at top
- **Built-in Assemblies:**
  - "Frame a Wall"
  - "Drywall a Room"
  - "Wire a Room"
  - "Install Flooring"
  - Cards show name and icon

- **Custom Assemblies:**
  - Header: "Custom Assemblies"
  - User-created assemblies with "📌 CUSTOM" badge
  - Shows item count and product count
  - Long-press to delete

**Actions:**
- Tap assembly → Assembly calculator (enter variables)
- Long-press custom assembly → Delete confirmation
- Tap "Assembly Manager" → Navigate to manager

---

### 9. Assembly Manager Screen (Pro Only)

**Purpose:** Create and manage custom assemblies.

**Header:**
- Title: "Assembly Manager"
- "+ New" button → Create new assembly

**Content:**
- Search bar at top
- **Custom Assemblies Section:**
  - Header: "Your Custom Assemblies"
  - Assembly cards:
    - Assembly name (bold)
    - "CUSTOM" badge
    - Item count: "X products"
    - Product count: "Y items total"
    - Validation warnings (if any):
      - "⚠️ 2 products unavailable"
  - Swipeable cards:
    - Swipe left → Duplicate
    - Swipe right → Delete
  - Tap card → Navigate to assembly editor

- **Built-in Assemblies:**
  - Link button: "Browse Built-in Assemblies"
  - Opens assembly library

**Empty state:**
- "No custom assemblies yet"
- "Tap + New to create your first template"

**Actions:**
- Tap "+ New" → Create new assembly
- Swipe left → Duplicate assembly
- Swipe right → Delete assembly
- Tap assembly → Edit in assembly editor
- Search → Filter assemblies by name

---

### 10. Assembly Editor Screen (Pro Only)

**Purpose:** Create or edit a custom assembly.

**Header:**
- Title: "Edit Assembly" or "New Assembly"
- "Save" button
- "Add to Quote" button (if opened from quote context)

**Content:**
- **Assembly Name:** Text input (required)
- **Variables Section:**
  - Dynamic inputs based on assembly type
  - Examples: Length, Width, Height, Stud Spacing
  - Number inputs with labels

- **Products Section:**
  - Header: "Products"
  - Product list:
    - Product name
    - Quantity (fixed or formula)
    - Unit price
    - Total
  - "Add Products" button → Product catalog

- **Preview Section:**
  - Shows calculated quantities based on current variables
  - Total materials cost
  - "Preview looks correct" or "Adjust quantities"

**Actions:**
- Enter assembly name
- Add/remove products
- Set quantities (fixed or formula)
- Tap "Save" → Save assembly to library
- Tap "Add to Quote" → Add to quote and return (if in quote context)

---

### 11. Company Details Editor Screen

**Purpose:** Configure company information for PDFs.

**Header:**
- Title: "Company Details"
- "Save" button

**Content:**
- **Company Name:** Text input
- **Email:** Email input
- **Phone:** Phone input
- **Website:** URL input
- **Address:** Multi-line text input

- **Preview Card:**
  - Shows formatted company details
  - Orange accent border
  - Same style as appears on PDFs

- **Note:**
  - "These details appear on your PDF quotes (Pro tier only)"

**Actions:**
- Edit fields
- Tap "Save" → Save to preferences
- Used on Review screen and PDF exports

---

### 12. Edit Items Screen

**Purpose:** Review and edit existing quote items.

**Header:**
- Title: "Edit Items"
- "Done" button

**Content:**
- List of all quote items:
  - Product name
  - Quantity stepper (+/-)
  - Unit price (read-only)
  - Total (calculated)
- Remove button (trash icon)

**Actions:**
- Tap +/- → Adjust quantity
- Tap trash → Remove item
- Tap "Done" → Return to quote editor

---

## Known Limitations

### Data Accuracy

**Problem:** Product prices are static seed data, not real-time.

**Impact:**
- Prices will drift from actual supplier costs
- Contractors may underbid or overbid jobs
- Loss of trust if pricing is consistently inaccurate

**Mitigation:**
- Disclaimer: "Prices are estimates. Verify with supplier."
- Manual price updates (quarterly?)
- Encourage contractors to adjust prices in app

**Future solution:** 1Build API integration for real-time pricing

---

### Cloud Sync Not Available Yet

**Problem:** No multi-device sync, no cloud backup.

**Impact:**
- Lose phone → lose all quotes (unless local backup)
- Can't switch between phone and tablet
- No team collaboration

**Mitigation:**
- Local backups (iCloud, Google Drive via export?)
- CSV export as manual backup

**Future solution:** Supabase sync with auto-migration

---

### Free Tier Limits Too Restrictive?

**Problem:** 25 quotes total (not per month) may be too limiting.

**Impact:**
- Users hit limit quickly
- Must delete old quotes to create new ones
- Friction to upgrade (or churn if pricing is barrier)

**Validation needed:** Beta testers will reveal if this is a blocker.

**Potential adjustment:** Change to 25 quotes/month (not total)?

---

### No Android App Yet

**Problem:** iOS-only during beta phase.

**Impact:**
- 40%+ of contractors use Android
- Regional skew (Android more popular in rural areas)
- Missing large addressable market

**Mitigation:**
- Focus on iOS for beta (faster iteration)
- Android is easy with Expo (same codebase)

**Timeline:** Android launch planned for v1.2 (1-2 months post-iOS)

---

### No Recurring Subscription Management

**Problem:** No in-app way to upgrade, downgrade, or cancel subscription.

**Impact:**
- Users must email support to change plans
- Friction to upgrade (good for Apple tax avoidance, bad for UX)
- No self-service

**Mitigation:**
- Website handles all payments (Stripe portal)
- App checks tier via Supabase (read-only)

**Apple compliance:** This is intentional to avoid 30% commission.

---

### Assembly Formulas Are Code

**Problem:** Quantity formulas (`qtyFn`) are JavaScript functions, not user-editable.

**Impact:**
- Users can't easily create dynamic assemblies
- Must understand code or use fixed quantities only
- Power feature requires technical knowledge

**Mitigation:**
- Provide pre-built assemblies with formulas
- Future: Visual formula builder (drag-and-drop)

**Example:**
- Current: `qtyFn: (vars) => Math.ceil(vars.length / 8)`
- Future: "Quantity = Length ÷ 8 (rounded up)"

---

### Offline Mode Prevents Real-Time Pricing

**Problem:** Can't fetch live prices without internet.

**Impact:**
- Offline quotes use cached/stale prices
- Contractor might quote wrong price on-site

**Mitigation:**
- Cache prices daily (when online)
- Show last sync time: "Prices updated 2 hours ago"
- Allow manual refresh

**Trade-off:** Offline capability is core value prop, more important than real-time pricing.

---

### No Team Collaboration (Yet)

**Problem:** Each user's data is isolated, no sharing.

**Impact:**
- Crews of 2+ people can't collaborate on quotes
- Owner can't review quotes created by employees
- No approval workflows

**Mitigation:**
- Premium feature (planned for v2.0)
- Most target users are solo or very small crews (less critical for MVP)

**Future solution:** Team workspaces with role-based permissions.

---

### PDF Export Is Simplified

**Problem:** PDF shows simplified total only, not detailed cost breakdown.

**Impact:**
- Clients see total price but not itemized costs
- Less transparency than full spreadsheet
- Some clients may request detailed breakdown

**Mitigation:**
- CSV export provides full breakdown
- PDF designed for client-facing simplicity
- Pro tier can customize PDF layout (future)

**Rationale:** Most contractors prefer not to show detailed margins to clients.

---

### No Import from Existing Quotes (Excel, etc.)

**Problem:** Contractors with existing spreadsheets must manually recreate quotes.

**Impact:**
- High friction to onboard
- Time-consuming data entry
- Barrier to adoption for users with large quote libraries

**Mitigation:**
- Start with new quotes (less friction)
- Duplicate feature reduces manual entry
- Assemblies speed up common jobs

**Future solution:** CSV import, Excel import (v2.0)

---

## Git Repository & Development Workflow

### Repository Structure

**Location:** Private GitHub repository
**Current Branch:** `integration/all-features`
**Main Branch:** `main`

**Branch Strategy:**
- `main` - Production-ready code, stable releases
- `integration/*` - Feature integration branches
- `feature/*` - Individual feature development
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Recent Commits

```
ee0c78b - fix: prevent double-counting materials in assembly editor
06687da - Revert "feat: add web app support with cross-platform compatibility"
f0bb0d2 - Revert "fix: remove incompatible html2pdf.js, use expo-print for all platforms"
a4c3f36 - feat: add quote duplication and analytics tracking
6a76492 - fix: remove incompatible html2pdf.js, use expo-print for all platforms
```

### Development Tools

**Version Control:**
- Git + GitHub
- Feature branches with descriptive names
- Conventional commit messages (feat:, fix:, docs:, etc.)
- Pull requests for main branch (when team expands)

**Code Quality:**
- ESLint (expo lint) - 0 warnings/errors
- TypeScript strict mode
- Prettier formatting
- Pre-commit hooks (future)

**Build & Deploy:**
- EAS Build (Expo Application Services)
- TestFlight for iOS beta distribution
- Automated builds on push (future)
- Semantic versioning (v1.1.0)

### File Structure

```
quotecat/
├── app/                    # Expo Router screens (file-based routing)
│   ├── (main)/            # Main tab navigation
│   │   ├── (tabs)/        # Drawer tabs (Dashboard, Quotes, Pro Tools, Settings)
│   │   ├── assembly-manager.tsx
│   │   ├── assembly-editor/
│   │   ├── settings.tsx
│   ├── (forms)/           # Form screens
│   │   └── quote/[id]/    # Quote editing, materials, review
│   └── _layout.tsx        # Root layout
├── modules/               # Domain-specific modules
│   ├── quotes/            # Quote logic, storage, CSV export
│   ├── catalog/           # Product catalog, seed data
│   ├── assemblies/        # Assembly templates, expansion
│   ├── materials/         # Material selection UI
│   ├── core/ui/           # Shared components
│   ├── settings/          # App settings, preferences
│   └── review/            # Quote review, export logic
├── lib/                   # Cross-cutting utilities
│   ├── supabase.ts        # Supabase client
│   ├── app-analytics.ts   # PostHog analytics
│   ├── types.ts           # Canonical TypeScript types
│   └── preferences.ts     # User preferences storage
├── website/               # Landing page (deployed to quotecat.ai)
│   ├── index.html         # Landing page
│   ├── faq.html           # FAQ page
│   ├── privacy.html       # Privacy policy
│   ├── terms.html         # Terms of service
│   └── signin.html        # Sign in page
├── supabase/              # Database schema and migrations
│   ├── migrations/        # SQL migration files
│   └── README.md          # Setup instructions
├── docs/                  # Documentation
│   ├── PRODUCT-OVERVIEW.md
│   ├── STRATEGIC-BRIEF.md
│   ├── SESSION-SUMMARY.md
│   └── WHERE-WE-LEFT-OFF.md
├── .env                   # Environment variables (not in Git)
├── app.json               # Expo configuration
├── package.json           # Dependencies
└── tsconfig.json          # TypeScript configuration
```

### Key Configuration Files

**app.json (Expo Config):**
- App name: QuoteCat
- Bundle ID: com.krtcotmo2.quotecat
- Version: 1.1.0
- Expo SDK: 54
- Platforms: iOS, Android, Web
- Splash screen, icon, colors

**package.json (Dependencies):**
- expo: ^54.0.0
- react-native: 0.78.13
- @react-native-async-storage/async-storage
- @supabase/supabase-js
- expo-print, expo-sharing
- posthog-react-native

**tsconfig.json (TypeScript):**
- Strict mode enabled
- Path aliases: `@/*` → project root
- Excludes: node_modules, _old directories

**babel.config.js:**
- Expo preset
- Path alias plugin
- react-native-reanimated plugin (MUST BE LAST)

### Environment Variables

**Required for development:**
```bash
# .env file (not in Git)
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=ey...
EXPO_PUBLIC_POSTHOG_API_KEY=phc_... (optional)
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com (optional)
```

**Setup:**
1. Copy `.env.example` to `.env` (if exists)
2. Get Supabase credentials from dashboard
3. Get PostHog key from posthog.com (optional)
4. Restart Metro: `npx expo start -c`

### Development Workflow

**Local Development:**
```bash
# Install dependencies
npm install

# Start Metro bundler
npx expo start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web browser
npm run web

# Clear cache if needed
npx expo start -c
```

**Code Quality:**
```bash
# Run ESLint
npm run lint

# Format with Prettier
npx prettier --write .

# TypeScript type checking
npx tsc --noEmit
```

**Testing:**
- Manual testing in TestFlight (iOS)
- Beta tester feedback
- Future: Jest unit tests, Detox E2E tests

**Deployment:**
```bash
# Build iOS app with EAS
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios

# Build Android app (future)
eas build --platform android --profile production
```

### Git Workflow

**Feature Development:**
1. Create feature branch: `git checkout -b feature/quote-wizard`
2. Make changes, commit frequently
3. Test locally
4. Push to GitHub: `git push origin feature/quote-wizard`
5. Merge to integration branch for testing
6. Merge to main when stable

**Bug Fixes:**
1. Create fix branch: `git checkout -b fix/pdf-export-crash`
2. Fix bug, add test if possible
3. Commit with descriptive message: `fix: resolve PDF crash on empty quote`
4. Push and merge to main (or integration first)

**Documentation:**
1. Create docs branch: `git checkout -b docs/update-readme`
2. Update documentation
3. Commit: `docs: update README with new features`
4. Merge to main

**Commit Message Convention:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring (no behavior change)
- `test:` - Adding tests
- `chore:` - Maintenance (dependencies, config, etc.)

**Example Commits:**
```
feat: add quote duplication feature
fix: prevent double-counting materials in assembly editor
docs: update PRODUCT-OVERVIEW with Git workflow
refactor: extract quote totals calculation to separate function
chore: upgrade Expo SDK to 54
```

### Collaboration

**Current:** Solo developer (krtcotmo2)

**Future (when team expands):**
- Pull requests for all changes to main
- Code reviews before merge
- CI/CD pipeline (GitHub Actions)
- Automated testing on PR
- Semantic versioning with changelogs

---

## Conclusion

QuoteCat is a **feature-rich, production-ready construction quoting app** with a clear value proposition: **Quote faster, look more professional, win more jobs.**

**Key strengths:**
- Offline-first (works anywhere)
- Mobile-native (built for on-site use)
- Fast (5-10 minute quotes vs. 30-60 minutes)
- Affordable ($15-30/month vs. $99+)
- Simple (focused on quoting, not bloated)

**Current status:**
- Beta-ready with 100+ products, assemblies, exports
- In TestFlight testing phase
- 3 active testers (Master Builder, Master Electrician)
- Preparing for v1.0 public launch

**Next milestones:**
1. Beta feedback and iteration
2. Public App Store launch
3. Supabase authentication and cloud sync
4. 1Build API integration (real-time pricing)
5. Android app
6. Premium features (Quote Wizard, team collaboration)

**Long-term vision:** The fastest, simplest construction quoting app for small contractors, with fair pricing and contractor-first design.

---

**Questions? Feedback?**
- Email: hello@quotecat.ai
- Website: https://quotecat.ai
- GitHub: https://github.com/krtcotmo2/quotecat (private)

**Version:** 1.1.0
**Last Updated:** January 2025
