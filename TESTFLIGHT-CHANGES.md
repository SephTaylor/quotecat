# TestFlight Compliance Changes

## Summary
Modified QuoteCat to comply with Apple TestFlight and App Store review guidelines by removing external payment links and changing default tier to Pro for beta testing.

---

## What We Changed

### 1. App Icon (✅ Complete)
**Files:** `app.json`, `assets/images/icon.png`, `assets/images/android-icon-foreground.png`
- Replaced blue caret icon with orange background + black cat logo
- Updated app display name from "quotecat" to "QuoteCat"
- Added bundle identifiers:
  - iOS: `com.quotecat.app`
  - Android: `com.quotecat.app`

### 2. Default User Tier (✅ Complete)
**File:** `lib/user.ts:63`
- **Changed:** Default tier from `"free"` to `"pro"`
- **Why:** TestFlight testers need full access to test all features
- **Rollback:** Change line 63 back to `tier: "free"`

```typescript
// CURRENT (TestFlight)
tier: "pro", // TestFlight: Start as Pro so testers can test all features

// TO ROLLBACK (Production)
tier: "free",
```

### 3. Removed External Payment Links (✅ Complete - Apple Compliance)
**Why:** Apple prohibits linking to external payment pages for digital goods (30% rule violation)

#### File: `app/(forms)/quote/[id]/review.tsx`
- **Changed:** Removed "Visit Website" button and "Upgrade to Pro" dialogs
- **Now shows:** Simple "Limit Reached" alert when hitting free tier limits
- **Removed:** 2 instances of links to `https://www.quotecat.ai`

```typescript
// BEFORE (Violation)
Alert.alert("Upgrade to Pro", reason, [
  { text: "Learn More", onPress: () => Linking.openURL("https://www.quotecat.ai") }
]);

// AFTER (Compliant)
Alert.alert("Limit Reached", reason, [
  { text: "OK", style: "cancel" }
]);
```

#### File: `app/(main)/settings.tsx`
- **Changed:** Removed "Upgrade" button for Company Logo feature
- **Now shows:** Simple alert: "Company logo upload is available for Pro subscribers."
- **Removed:** Link to `https://quotecat.ai/pricing`

#### File: `app/(main)/(tabs)/pro-tools.tsx`
- **Changed:** Removed "Learn More & Upgrade" button text
- **Changed:** "Ready to upgrade?" → "Pro Features"
- **Changed:** "Visit quotecat.ai to view pricing and plans" → "Sign in to access Pro features"
- **Removed:** Link to `https://quotecat.ai/pricing`

### 4. What We KEPT (Still Works!)
✅ **All debug/testing controls** - Still in Settings > 🧪 Tester Tools
✅ **Free/Pro tier toggle** - Testers can switch between tiers
✅ **All tier checking logic** - `canExportPDF()`, `canCreateQuote()`, etc.
✅ **Free tier limits** - 10 quotes, 3 PDFs/month, 1 spreadsheet/month
✅ **Usage tracking** - Quote counts, PDF counts, etc.
✅ **PDF branding** - Free tier still gets "Created with QuoteCat" watermark
✅ **Pro feature locks** - Assemblies, cloud sync, etc.
✅ **Sign In/Manage Account links** - These are OK (account management, not purchasing)

---

## Debug Controls Available to Testers

### Location: Settings > 🧪 Tester Tools

1. **Toggle Free/Pro Tier**
   - Switch between FREE and PRO to test limits
   - Shows current tier status

2. **Reset Assemblies to Seed**
   - Restores default 8 assemblies
   - Destructive action (warns user)

3. **Reset Products to Seed**
   - Clears product cache
   - Restores default 40 products
   - Requires app restart

### Location: Settings > Usage & Limits
- Shows real-time quota usage
- Quote count: X / 10 (free) or X (Unlimited - pro)
- PDF exports: X / 3 per month (free) or X (Unlimited - pro)
- Spreadsheet exports: X / 1 per month (free) or X (Unlimited - pro)
- Progress bars for free tier

---

## Test Data Available

### Product Catalog: 40 Products
**Categories:**
- Framing (studs, plates, OSB, etc.)
- Drywall (sheets, screws, compound, tape, etc.)
- Electrical (wire, outlets, switches, boxes, etc.)
- Plumbing (PEX, fittings, fixtures, etc.)

### Assemblies: 8 Pre-built Calculators
1. **Interior Wall - 8 ft Ceiling** (Framing)
2. **Room Framing - 12x12** (Framing)
3. **Exterior Wall - 2x6** (Framing)
4. **Bedroom Electrical** (Electrical)
5. **Kitchen Electrical** (Electrical)
6. **Bathroom Electrical** (Electrical)
7. **3-Way Switch Circuit** (Electrical)
8. **Outlet Circuit - 8 Outlets** (Electrical)

**Coverage Assessment:**
- ✅ Framing: Good (3 assemblies covering walls/rooms)
- ✅ Electrical: Excellent (5 assemblies covering common scenarios)
- ❌ Drywall: None (could add "Drywall a Room" calculator)
- ❌ Plumbing: None (could add "Bathroom Rough-In" calculator)

**Recommendation:** Current coverage is good for TestFlight. 8 assemblies is enough to demonstrate the feature. Can add more based on tester feedback.

---

## Post-TestFlight Rollback Plan

### Option 1: Stay Compliant (No Apple Cut) - RECOMMENDED
**What to do:**
1. Keep all the changes we made (no external payment links)
2. Change default tier back to `"free"` in `lib/user.ts:63`
3. Users purchase Pro on your website
4. Users sign in via app to unlock Pro features
5. Keep the simple "Limit Reached" alerts (no upgrade prompts)

**Pros:** No 30% Apple fee, fully compliant
**Cons:** Users must go to website to purchase

### Option 2: Add Apple In-App Purchases (Pay 30%)
**What to do:**
1. Implement `expo-in-app-purchases` or RevenueCat
2. Set up products in App Store Connect
3. Add proper "Upgrade to Pro" buttons that trigger IAP
4. Change default tier back to `"free"` in `lib/user.ts:63`

**Pros:** Can sell directly in app, better conversion
**Cons:** Apple takes 30%, more complex setup

### Option 3: Freemium with Web-Only Purchasing
**What to do:**
1. Change default tier back to `"free"` in `lib/user.ts:63`
2. Keep simplified alerts (no external links)
3. Add subtle "Sign in to unlock Pro features" messaging
4. Website handles all purchasing/subscription management

**Pros:** Compliant, no Apple fee, simple
**Cons:** Lower conversion than IAP

---

## Files Modified (Quick Reference)

```
✏️ app.json                          - Added bundle IDs, changed app name
✏️ lib/user.ts                       - Default tier: free → pro
✏️ app/(forms)/quote/[id]/review.tsx - Removed upgrade links (2 instances)
✏️ app/(main)/settings.tsx           - Removed upgrade link for logo
✏️ app/(main)/(tabs)/pro-tools.tsx   - Removed "Upgrade" button text
🆕 assets/images/icon.png            - New orange cat icon
🆕 assets/images/android-icon-foreground.png - New orange cat icon
```

---

## Apple Review Checklist

### ✅ TestFlight Ready
- [x] No external payment links for digital goods
- [x] No pricing information in the app
- [x] No "Upgrade" CTAs that link outside the app
- [x] App has real functionality (quote creation, PDFs, etc.)
- [x] No special permissions required
- [x] Icons properly configured (iOS + Android)
- [x] Bundle identifiers set
- [x] App name properly capitalized ("QuoteCat")
- [x] Splash screen configured
- [x] No crash-prone code (Supabase errors only in DEV mode)

### ⚠️ Known Limitations
- Supabase not fully integrated (but won't crash in production)
- Some Pro features are placeholders ("Coming Soon")
- Sign In links to website (allowed for account management)

---

## What Testers Should Test

### Core Functionality (All Tiers)
- [ ] Create quotes from scratch
- [ ] Add materials to quotes
- [ ] Calculate totals (materials + labor + markup)
- [ ] Export PDFs
- [ ] Export spreadsheets
- [ ] Edit existing quotes
- [ ] Delete quotes
- [ ] Use assembly calculators

### Tier Testing (Use Tester Tools to Toggle)
**As Free User:**
- [ ] Hit quote limit (10 quotes)
- [ ] Hit PDF limit (3/month)
- [ ] Hit spreadsheet limit (1/month)
- [ ] See QuoteCat branding on PDFs
- [ ] See locked Pro features

**As Pro User:**
- [ ] Unlimited quotes
- [ ] Unlimited PDFs (no branding)
- [ ] Unlimited spreadsheets
- [ ] Access all assemblies

### Assembly Calculators
- [ ] Test interior wall calculator (framing)
- [ ] Test room framing calculator
- [ ] Test electrical circuits
- [ ] Verify calculations are accurate

### Edge Cases
- [ ] Toggle between light/dark mode
- [ ] Create quote with very long name
- [ ] Add 50+ items to a quote
- [ ] Reset assemblies to seed
- [ ] Reset products to seed

---

## Questions for Tester Feedback

1. **Assemblies:** Are 8 assemblies enough? Which trades need more?
2. **Products:** Are 40 products enough for realistic quotes?
3. **Workflow:** Is the quote creation flow intuitive?
4. **Tier Limits:** Are free tier limits reasonable? (10 quotes, 3 PDFs/month)
5. **UI/UX:** Any confusing buttons, labels, or navigation?
6. **Missing Features:** What would make this more useful for contractors?

---

## Notes

- All tier logic is intact and functional
- Testers start as Pro by default
- Debug controls allow easy tier switching
- No functionality was removed, only external payment links
- App is fully compliant with Apple's guidelines
- Ready for TestFlight submission
