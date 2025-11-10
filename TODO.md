# QuoteCat TODO List

## Website - Beta Signup Removal

### Remove Beta Signup Section After Product Data Testing
**Priority:** Medium
**Status:** Pending (wait for Xbyte data testing)
**Location:** `website/index.html` - Beta signup section

**When to do this:**
After Xbyte product data is imported, tested, and verified in production.

**What to remove:**
- The entire "Join the Beta" CTA section (lines ~1373-1420 in index.html)
- Potentially replace with "Download Now" or "Get Started" CTA pointing directly to app stores

**Considerations:**
- Keep Premium notification modal (new users can still sign up for Premium launch)
- Update main CTA to point to app download or sign up
- Ensure checkout flow still works for Pro tier

---

## Website - Checkout Modal

### Make Modal Subtitle Dynamic with Spot Tracking
**Priority:** Medium
**Status:** Not Started
**Location:** `website/index.html` - Checkout modal subtitle

Currently shows: "Choose your plan" (generic)

**Future Enhancement:**
Make the subtitle dynamic based on remaining founder pricing spots:

**When spots available:**
- "Only 47 Pro spots left at founder pricing!"
- "Only 12 Premium spots left at founder pricing!"

**When spots full:**
- "Choose your plan" (current generic text)

**Implementation:**
1. Add API endpoint to check spots remaining (query Supabase profiles table)
2. Count users with `pricing_tier = 'founder'` and `tier = 'pro'` (limit: 500)
3. Count users with `pricing_tier = 'founder'` and `tier = 'premium'` (limit: 100)
4. Update modal subtitle dynamically when opened
5. Add urgency styling (orange badge with remaining count)

**Example:**
```javascript
// Fetch spots remaining
const response = await fetch('https://eouikzjzsartaabvlbee.supabase.co/functions/v1/get-spots-remaining');
const { proSpots, premiumSpots } = await response.json();

// Update subtitle
if (tier === 'pro' && proSpots > 0) {
    subtitle.innerHTML = `Only ${proSpots} spots left at founder pricing!`;
} else if (tier === 'premium' && premiumSpots > 0) {
    subtitle.innerHTML = `Only ${premiumSpots} spots left at founder pricing!`;
} else {
    subtitle.textContent = 'Choose your plan';
}
```

**Benefits:**
- Creates urgency
- Shows scarcity
- Increases conversions
- Keeps founder pricing momentum visible

---

## Other TODOs

(Add more tasks here as they come up)
