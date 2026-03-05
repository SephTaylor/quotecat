# GPS Worker Tracking (Future Feature)

## Summary

Add GPS-enabled worker tracking to the existing QuoteCat app using role-based UI routing. Workers log into the same app but see a simplified "Worker Mode" screen instead of the full quoting dashboard.

**Status**: Planning (not yet implemented)

---

## The Idea

Instead of building a separate "QuoteCat Worker" app:
- Workers download the same QuoteCat app
- On login, the app checks their role
- Workers see a simple GPS tracking screen (clock in/out)
- Owners/Techs see the full dashboard

**Benefits**:
- One app to maintain
- One App Store submission
- Shared bug fixes across all users
- Easy upgrade path: Worker → Tech
- Simpler onboarding ("everyone downloads QuoteCat")

---

## Worker Types (Side by Side)

| Type | Invitation | App Required | GPS Tracked | Can Quote |
|------|------------|--------------|-------------|-----------|
| SMS Worker | SMS | No | No | No |
| GPS Worker | Email | Yes | Yes | No |
| Tech | Email | Yes | Optional | Yes |
| Owner | Self-signup | Yes | No | Yes |

SMS Workers and GPS Workers coexist. Some contractors just need to text "show up at 123 Main at 8am" - they don't need GPS. Others want accountability and timesheet automation.

---

## App Flow

```
App Launch
    ↓
Previously logged in?
    ├─ No → "Get Started" screen
    │       ├─ "Start Free" (current flow, local quotes, no login)
    │       └─ "Sign In" (existing accounts)
    │
    └─ Yes → Check profile.role
            ├─ owner → Full Dashboard
            ├─ tech → Dashboard (with permissions)
            └─ worker → GPS Worker Screen
```

---

## Worker Screen (v1 - Simple)

```
┌─────────────────────────────────┐
│  QuoteCat                   ≡   │
├─────────────────────────────────┤
│                                 │
│      Good morning, Mike         │
│      ABC Electric               │
│                                 │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │    🕐 CLOCK IN          │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  Today's Jobs                   │
│  ┌─────────────────────────┐   │
│  │ 📍 Kitchen Remodel      │   │
│  │    123 Main St          │   │
│  │    8:00 AM - 12:00 PM   │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ 📍 Panel Upgrade        │   │
│  │    456 Oak Ave          │   │
│  │    1:00 PM - 4:00 PM    │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

When clocked in:
```
┌─────────────────────────────────┐
│  QuoteCat              📍 Live  │
├─────────────────────────────────┤
│                                 │
│      Clocked in                 │
│      2h 34m                     │
│                                 │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │    🛑 CLOCK OUT         │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  Current Job                    │
│  ┌─────────────────────────┐   │
│  │ 📍 Kitchen Remodel      │   │
│  │    123 Main St          │   │
│  │    Started 8:02 AM      │   │
│  │                         │   │
│  │    [Mark Complete]      │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

## Portal Dashboard (Owner View)

### Live Map
- See all GPS workers' current locations
- Color coded: green (on site), yellow (traveling), gray (clocked out)
- Click worker pin → see details

### Worker Timeline
- "Where was John last Tuesday?"
- Visual timeline of clock in/out, job sites visited
- Exportable for payroll

### Alerts (v2)
- "Mike clocked in 2 miles from job site"
- "Sarah hasn't clocked in today (scheduled for 8 AM)"

---

## Questions to Answer

### Privacy & Legal
- [ ] What consent language do workers agree to during onboarding?
- [ ] Do we show "You are being tracked" indicator while clocked in?
- [ ] Auto clock-out after X hours to prevent accidental overnight tracking?
- [ ] Which states have specific GPS tracking disclosure requirements?

### Data & Storage
- [ ] How long to retain GPS data? (30 days? 90 days? Configurable?)
- [ ] How often to ping location? (Every 5 min? 15 min? Only clock in/out?)
- [ ] Where to store? (Supabase? Separate time-series DB for scale?)
- [ ] Estimated storage cost at scale?

### Features (v1 vs Later)
- [ ] v1: Manual clock in/out only, or include geofencing?
- [ ] v1: Track travel time between jobs?
- [ ] v1: Allow workers to see their own history?
- [ ] Later: Auto-generate timesheets from GPS data?
- [ ] Later: Integration with payroll systems?

### Job Site Geofencing
- [ ] What radius counts as "on site"? (100ft? 500ft? Configurable per job?)
- [ ] How to handle indoor GPS drift (30-50ft accuracy)?
- [ ] Alert owner if worker clocks in far from job site?

### Technical
- [ ] Background location permission wording for iOS (must justify continuous tracking)
- [ ] Battery optimization - only track when clocked in
- [ ] Offline handling - queue GPS data locally, sync when back online?
- [ ] Android background location restrictions (different from iOS)

### Pricing
- [ ] Include GPS workers in Premium seat count?
- [ ] Or separate GPS add-on pricing?
- [ ] Different seat price for GPS workers vs techs?

### Invitation Flow
- [ ] New invitation type? (SMS worker vs GPS worker vs Tech)
- [ ] Or add "Enable GPS tracking" toggle to existing worker invite?
- [ ] Can SMS workers be "upgraded" to GPS workers?

---

## V1 Recommendations

Start simple, expand based on demand:

| Feature | V1 | Later |
|---------|-----|-------|
| Clock in/out | Manual button | + Geofencing auto |
| Location frequency | Every 15 min while clocked in | Configurable |
| Data retention | 90 days | Configurable |
| Portal view | Simple map + timeline | Alerts, anomaly detection |
| Timesheets | View only | Export, payroll integration |
| Geofencing | No | Yes |
| Pricing | Included in Premium | Evaluate after usage data |

---

## Database Changes (Draft)

```sql
-- Add role to distinguish GPS workers
-- Existing: team_members (SMS workers), team_tech_accounts (techs)
-- New: Add 'gps_enabled' flag to team_members, or create new table

-- Option A: Extend team_members
ALTER TABLE team_members ADD COLUMN gps_enabled BOOLEAN DEFAULT false;
ALTER TABLE team_members ADD COLUMN app_auth_id UUID REFERENCES auth.users(id);

-- Option B: New table for GPS workers (cleaner separation)
CREATE TABLE team_gps_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  worker_auth_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'pending', -- pending, active, suspended, removed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ
);

-- GPS tracking data
CREATE TABLE gps_clock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL, -- References team_gps_workers or team_members
  event_type TEXT NOT NULL, -- 'clock_in', 'clock_out', 'location_ping'
  job_id UUID, -- Optional: which job they're working on
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy_meters DECIMAL(6, 2),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ -- When uploaded from device (for offline support)
);

-- Index for querying worker's recent locations
CREATE INDEX idx_gps_events_worker_time ON gps_clock_events (worker_id, recorded_at DESC);

-- Index for querying by owner (via join)
CREATE INDEX idx_gps_events_recorded ON gps_clock_events (recorded_at DESC);
```

---

## Mobile App Changes (Draft)

### New Files
- `app/(worker)/` - Worker-mode screens (separate from main tabs)
- `app/(worker)/index.tsx` - Clock in/out screen
- `app/(worker)/jobs.tsx` - Today's job list
- `app/(worker)/history.tsx` - Personal clock history
- `lib/gpsTracking.ts` - Background location service
- `lib/clockEvents.ts` - Clock in/out logic + sync

### Modified Files
- `app/_layout.tsx` - Route to worker mode based on role
- `lib/auth.ts` - Add role detection after login

### Permissions Required
- `NSLocationWhenInUseUsageDescription` - Already have
- `NSLocationAlwaysAndWhenInUseUsageDescription` - NEW (background tracking)
- `UIBackgroundModes: location` - NEW (background updates)

---

## Competitive Reference

| Feature | Jobber | Housecall Pro | QuoteCat (Planned) |
|---------|--------|---------------|-------------------|
| GPS tracking | Yes ($) | Yes (Max plan) | Yes (Premium) |
| Geofencing | Yes | Yes | Later |
| Live map | Yes | Yes | Yes (v1) |
| Timesheet from GPS | Yes | Yes | Later |
| Separate worker app | No | No | No |
| AI features | No | No | Drew |

---

## Open Items

- [ ] Finalize database schema (Option A vs B)
- [ ] Design portal map UI mockups
- [ ] Research iOS/Android background location best practices
- [ ] Determine v1 feature cutoff
- [ ] Legal review of consent language
- [ ] Estimate development time

---

*Created: March 5, 2026*
*Last Updated: March 5, 2026*
