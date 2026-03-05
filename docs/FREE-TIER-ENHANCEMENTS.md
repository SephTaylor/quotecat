# Free Tier Enhancements Spec

Two features to make the free tier more compelling for new contractors.

---

## Feature 1: Quote Templates

### Problem
New contractors don't know what to include in a quote. They stare at a blank screen and give up, or underquote because they forget line items.

### Solution
Pre-built quote templates for common job types. User selects a template, it pre-fills line items, they adjust quantities and prices.

### Templates to Include

#### 1. Deck Build (Basic 12x12)
```
- Pressure-treated lumber (2x6x12) - qty: 24
- Deck boards (5/4x6x12) - qty: 32
- Concrete deck blocks - qty: 9
- Joist hangers - qty: 20
- Deck screws (5lb box) - qty: 3
- Railing kit (6ft sections) - qty: 4
- Post caps - qty: 6
- Labor - qty: 24 hrs
```

#### 2. Bathroom Remodel (Basic)
```
- Demo & haul-off - flat rate
- Vanity with sink - qty: 1
- Toilet - qty: 1
- Bathroom faucet - qty: 1
- Shower/tub surround - qty: 1
- Tile flooring (sq ft) - qty: 40
- Tile adhesive & grout - qty: 1
- Light fixture - qty: 1
- Exhaust fan - qty: 1
- Paint (bathroom) - qty: 1 gal
- Labor - qty: 32 hrs
```

#### 3. Electrical Panel Upgrade (100A to 200A)
```
- 200A main panel - qty: 1
- 200A main breaker - qty: 1
- Breakers (assorted) - qty: 20
- Copper wire (various gauges) - qty: 1 lot
- Conduit & fittings - qty: 1 lot
- Grounding rod & clamp - qty: 1
- Permit fee - qty: 1
- Inspection coordination - qty: 1
- Labor - qty: 8 hrs
```

#### 4. Fence Install (Wood, 100 linear ft)
```
- 4x4 posts (8ft) - qty: 17
- 2x4 rails (8ft) - qty: 51
- Fence pickets (6ft) - qty: 200
- Concrete (bags) - qty: 17
- Post caps - qty: 17
- Gate hardware - qty: 1 set
- Screws/nails - qty: 2 boxes
- Labor - qty: 16 hrs
```

#### 5. Interior Paint (Per Room)
```
- Paint (premium, gallons) - qty: 2
- Primer (if needed) - qty: 1
- Painter's tape (rolls) - qty: 3
- Drop cloths - qty: 2
- Brushes/rollers - qty: 1 set
- Caulk (tubes) - qty: 2
- Spackle/patch compound - qty: 1
- Labor - qty: 6 hrs
```

#### 6. Water Heater Replacement
```
- Water heater (50 gal) - qty: 1
- Flex connectors - qty: 2
- T&P valve & drain - qty: 1
- Expansion tank - qty: 1
- Gas flex line (if gas) - qty: 1
- Venting materials - qty: 1 lot
- Haul away old unit - qty: 1
- Permit (if required) - qty: 1
- Labor - qty: 4 hrs
```

#### 7. HVAC Service Call
```
- Diagnostic fee - flat rate
- Filter replacement - qty: 1
- Refrigerant (lb) - qty: 0
- Capacitor (if needed) - qty: 0
- Contactor (if needed) - qty: 0
- Labor - qty: 1 hr
```

#### 8. Drywall Repair (Per Hole/Patch)
```
- Drywall patch/piece - qty: 1
- Joint compound - qty: 1
- Drywall tape - qty: 1
- Sandpaper - qty: 1
- Primer - qty: 1
- Paint (quart, match existing) - qty: 1
- Labor - qty: 2 hrs
```

#### 9. Gutter Install (Per 100 linear ft)
```
- Seamless gutters (100 ft) - qty: 100
- Downspouts (10ft) - qty: 4
- Elbows - qty: 8
- Hangers/brackets - qty: 50
- End caps - qty: 4
- Splash blocks - qty: 4
- Gutter sealant - qty: 2
- Labor - qty: 6 hrs
```

#### 10. Handyman Half-Day
```
- Miscellaneous materials - allowance
- Labor (4 hr minimum) - qty: 4 hrs
```

### UX Flow

1. User taps "New Quote"
2. Modal appears: "Start from scratch" or "Use a template"
3. If template: show grid/list of template categories with icons
4. User selects template (e.g., "Deck Build")
5. Quote created with pre-filled items
6. User adjusts quantities, prices, adds/removes items
7. All items editable — template is just a starting point

### Data Storage

Templates stored in app bundle (no API needed):
```typescript
// lib/quoteTemplates.ts
export type QuoteTemplate = {
  id: string;
  name: string;
  category: 'carpentry' | 'electrical' | 'plumbing' | 'painting' | 'hvac' | 'general';
  icon: string; // Ionicon name
  items: {
    name: string;
    unit: 'each' | 'hour' | 'sqft' | 'linear_ft' | 'flat';
    defaultQty: number;
    defaultPrice?: number; // Optional — user sets their price
  }[];
};
```

### Files to Create/Modify

- `lib/quoteTemplates.ts` — Template definitions
- `components/TemplatePickerModal.tsx` — Template selection UI
- `app/(forms)/quote/new.tsx` — Add template option to new quote flow
- `modules/quotes/storage.ts` — Create quote from template

### Tier Availability

- **Free**: 10 templates (the ones above)
- **Pro/Premium**: Same templates + ability to create custom templates from existing quotes

---

## Feature 2: Payment Links on Invoices

### Problem
Free tier users can't accept card payments (no Stripe Connect). They use Venmo, Zelle, Cash App, PayPal — but have to tell clients separately.

### Solution
Let users add their payment handles to invoices. Shows as clickable links/buttons on the invoice PDF and web view.

### Supported Payment Methods

| Method | Link Format | Display |
|--------|-------------|---------|
| Venmo | `venmo://paycharge?txn=pay&recipients={handle}&amount={amount}` | @username |
| Zelle | Email or phone (no deep link) | Email/phone display |
| Cash App | `https://cash.app/$cashtag/{amount}` | $cashtag |
| PayPal | `https://paypal.me/{username}/{amount}` | paypal.me/username |
| Check | N/A | "Make checks payable to: {name}" |
| Other | Custom text | Custom display |

### UX Flow

**Setup (one-time in Settings):**
1. User goes to Settings → Payment Methods
2. Toggles on methods they accept
3. Enters their handle/email for each:
   - Venmo: @username
   - Zelle: email or phone
   - Cash App: $cashtag
   - PayPal: username
4. Saved to business settings (synced if Pro+)

**On Invoice:**
1. Invoice PDF/web view shows "Payment Options" section
2. Lists enabled methods with handles
3. Mobile: tappable links that open apps
4. Desktop: displays info to copy

### Invoice Display

```
┌─────────────────────────────────────────────┐
│ PAYMENT OPTIONS                              │
├─────────────────────────────────────────────┤
│ 💳 Venmo      @mikethecontractor            │
│ 🏦 Zelle      mike@contractor.com           │
│ 💵 Cash App   $mikebuilds                   │
│ 📧 PayPal     paypal.me/mikebuilds          │
│ 📝 Check      Make payable to: Mike's LLC   │
└─────────────────────────────────────────────┘
```

### Data Model

```typescript
// In UserState or BusinessSettings
type PaymentMethods = {
  venmo?: { enabled: boolean; handle: string };
  zelle?: { enabled: boolean; handle: string }; // email or phone
  cashapp?: { enabled: boolean; handle: string };
  paypal?: { enabled: boolean; handle: string };
  check?: { enabled: boolean; payableTo: string };
  other?: { enabled: boolean; instructions: string };
};
```

### Files to Create/Modify

**Mobile App:**
- `lib/preferences.ts` — Add `paymentMethods` to business settings
- `app/(main)/business-settings.tsx` — Payment methods configuration UI
- `lib/pdf.ts` — Add payment methods section to invoice PDF
- `lib/invoices.ts` — Include payment methods in invoice data

**Portal:**
- `src/app/dashboard/settings/page.tsx` — Payment methods section
- Invoice PDF generation — Add payment section
- `/pay/[id]` page — Show alternative payment options

### Tier Availability

- **Free**: All payment link methods
- **Pro**: Same + can hide QuoteCat branding
- **Premium**: Same + Stripe card payments

---

## Implementation Priority

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Payment links on invoices | 1-2 days | High | **P0** |
| Quote templates | 2-3 days | High | **P1** |

**Recommendation:** Ship payment links first (quick win), then templates.

---

## Marketing Angle

**Free tier messaging:**
> "Everything you need to start quoting — for free. Pre-built templates for common jobs. Accept Venmo, Zelle, Cash App right on your invoices. Real-time material pricing from Lowe's and Home Depot. No credit card required."

This positions Free as genuinely useful, not a crippled trial.
