# Team Features for Premium Users

## Overview

Add team/tech management to compete with FieldPulse ($100/month + $100/tech). Key differentiator: affordable flat-rate pricing instead of scary per-seat costs.

**Tester feedback:**
- Team scheduling for 5-20 techs
- Add techs with adjustable permissions
- Techs can price jobs via pricebook
- Timesheet capabilities (later)

---

## Current State

### What Exists

**Single-User Architecture:**
- All data tables have `user_id` FK with RLS: `auth.uid() = user_id`
- Tiers: free, pro, premium (premium = teams)
- Cloud sync for Pro/Premium users only

**Workers (Portal - Unauthenticated):**
- `team_members` table: name, phone, email, role, is_active
- `jobs` table with `job_assignments`
- SMS magic links - workers view job details, post updates
- No app login required

### What's Missing

- Authenticated team members (techs who log into mobile app)
- Shared data access (quotes, invoices, clients)
- Permission system
- Team billing

---

## Team Members (Unified)

Workers and techs are the same concept. Team members can:
- Log into the mobile app with their own account
- Access shared quotes, invoices, clients (based on permissions)
- Be assigned to jobs
- Post job updates

The existing `team_members` table in portal will be upgraded to support authenticated users.

---

## Phase 1: MVP (Post-Launch Priority)

### Goal
Premium users can invite techs who log into the mobile app and access shared quotes.

### Database Schema

```sql
-- New table: teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  seats_included INT DEFAULT 5,        -- Base Premium seats
  seats_purchased INT DEFAULT 0,       -- Additional seat packs
  UNIQUE(owner_id)  -- One team per Premium user
);

-- New table: team_memberships (authenticated techs)
CREATE TABLE team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'tech',   -- 'owner', 'admin', 'tech'
  permissions JSONB DEFAULT '{}',       -- Granular permissions
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  UNIQUE(team_id, user_id)
);

-- New table: team_invitations
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'tech',
  permissions JSONB DEFAULT '{}',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

### Permission Model

```typescript
interface TechPermissions {
  canCreateQuotes: boolean;      // Create new quotes
  canEditQuotes: boolean;        // Edit any team quote
  canViewPricing: boolean;       // See costs/markup in pricebook
  canManageClients: boolean;     // Add/edit clients
  canSendToPortal: boolean;      // Push quotes to client portal
  canRecordPayments: boolean;    // Record invoice payments
}

// Preset roles
const ROLE_PRESETS = {
  admin: { canCreateQuotes: true, canEditQuotes: true, canViewPricing: true, canManageClients: true, canSendToPortal: true, canRecordPayments: true },
  tech: { canCreateQuotes: true, canEditQuotes: false, canViewPricing: false, canManageClients: false, canSendToPortal: false, canRecordPayments: false },
  viewer: { canCreateQuotes: false, canEditQuotes: false, canViewPricing: false, canManageClients: false, canSendToPortal: false, canRecordPayments: false }
};
```

### RLS Policy Updates

Add team-aware policies to quotes, invoices, clients, assemblies:

```sql
-- Example: quotes table
-- Keep existing single-user policy
CREATE POLICY "Users can access own quotes"
  ON quotes FOR ALL
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Add team access policy
CREATE POLICY "Team members can access team quotes"
  ON quotes FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM team_memberships tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = auth.uid()
      AND t.owner_id = quotes.user_id
    )
  );

-- Team members with edit permission
CREATE POLICY "Team members can edit team quotes"
  ON quotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_memberships tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = auth.uid()
      AND t.owner_id = quotes.user_id
      AND (tm.permissions->>'canEditQuotes')::boolean = true
    )
  );
```

### Billing Model

```
Premium Tier:
- Base: $79/month (founder) or $199/month (standard)
- Includes: 5 team seats (owner + 4 techs)
- Additional seats: Same Premium price per 5-pack
  - Founder: +$79/month for 5 more seats
  - Standard: +$199/month for 5 more seats

Compare to FieldPulse:
- FieldPulse: $100/month + $100/tech = $600/month for 5 techs
- QuoteCat Premium (founder): $79/month for 5, $158/month for 10
- Savings: 74-87% cheaper
```

### Migration: Solo User → Team Owner

When Premium user enables teams:
1. Auto-create `teams` row with user as owner
2. Create `team_memberships` row (role: 'owner')
3. Existing quotes stay under `user_id` (owner)
4. Team members access via RLS policies

No data migration needed - owner's `user_id` becomes the team identifier.

---

## Implementation Order

### Step 1: Database (Migration)
- Create `teams`, `team_memberships`, `team_invitations` tables
- Add team-aware RLS policies (keep existing + add new)
- Add `seats_purchased` to track additional seats

### Step 2: Portal - Team Management
- Enhance existing `/dashboard/team` page
- Add "Invite Tech" flow (separate from workers)
- Show seat usage: "3 of 5 seats used"
- Manage permissions per tech

### Step 3: API - Invitation Flow
- `POST /api/team/invite` - Send email invitation
- `GET /api/team/accept?token=xxx` - Accept invitation
- Edge function for invite emails

### Step 4: Mobile App - Team Context
- `TeamContext` provider with current team + role
- Load team membership on auth
- Filter data based on permissions
- Show "Team: [Name]" in settings

### Step 5: Mobile App - Sync Updates
- `quotesSync.ts` - Include team quotes in download
- Add `created_by` field to track who created what
- Permission checks before actions

### Step 6: Stripe - Seat Packs
- New product: "QuoteCat Team Seat Pack (5)"
- Update webhook to increment `teams.seats_purchased`
- Block invites when seats full

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/018_teams.sql` | New tables + RLS policies |
| `quotecat-portal/src/app/dashboard/team/page.tsx` | Add tech invite section |
| `quotecat-portal/src/app/api/team/invite/route.ts` | NEW: Invite API |
| `quotecat/lib/auth.ts` | Load team membership on login |
| `quotecat/lib/team.ts` | NEW: Team context + helpers |
| `quotecat/lib/quotesSync.ts` | Include team quotes in sync |
| `supabase/functions/stripe-webhook/index.ts` | Handle seat pack purchases |

---

## Phase 2: Job Assignment (Later)

Connect authenticated techs to jobs (bridge workers + techs):

- Assign quotes/jobs to specific techs
- Tech sees "My Jobs" in mobile app
- Owner sees "Assigned to: [Tech Name]" on quotes
- Push notifications when assigned

---

## Competitive Research: FieldPulse (Jan 2026)

### How FieldPulse Handles Teams

FieldPulse uses a **unified model** - one type of team member that does everything:

| Aspect | FieldPulse Approach |
|--------|---------------------|
| Team members | All authenticated, all use mobile app |
| Scheduling | Drag-drop calendar, assign jobs to techs |
| Quoting | Techs create estimates on-site using company pricebook |
| Job flow | Job assigned → Tech does work → Creates estimate → Converts to invoice |
| Permissions | Role-based (what each tech can see/do) |

**Their workflow:**
1. Office dispatches tech to job via calendar
2. Tech sees job in mobile app with customer details
3. Tech goes on-site, diagnoses, creates estimate using pricebook
4. Customer approves (can sign on device)
5. Tech does work, converts estimate to invoice

**Key insight:** In FieldPulse, the same person who gets dispatched to a job creates the quote. Not separate "field crew" vs "estimators" - the tech does both.

### What Full FieldPulse Parity Would Require

The mobile app currently has: Quotes, Invoices, Clients, Drew wizard, Cloud sync.

To match FieldPulse we'd need to add:
- Jobs list / "My Jobs" screen
- Job details view
- Job status updates
- Photo uploads for jobs
- Schedule/calendar view
- Push notifications for assignments
- Link quotes to jobs
- Maybe GPS tracking

**Conclusion:** That's basically building a whole new section of the app - significant undertaking.

### QuoteCat's Approach: Intentionally Different

**Keep workers and techs separate - this is a feature, not a limitation.**

| Workers | Techs |
|---------|-------|
| SMS magic links | App login |
| View job details | Create quotes |
| Post updates | Use pricebook |
| No app needed | Full quoting power |

### Why Magic Links for Workers is Actually Better

**The FieldPulse approach (everyone uses app):**
- Worker has to download app
- Create account, remember password
- Learn the app
- Keep it updated
- Another thing on their phone

**QuoteCat approach (magic links for workers):**
- Get text: "You've been assigned to a job"
- Click link
- See everything: address, scope, materials, hours, notes
- Post update if needed
- Done

**Where magic links win:**

1. **High turnover** - Trades have constant worker churn. "Download our app" vs "I'll text you the job" - huge onboarding difference.

2. **Subcontractors** - A sub working for 3-4 contractors isn't installing 4 apps. But clicking 4 different links? No problem.

3. **The "just tell me where to go" worker** - Not everyone wants to be a power user. Some guys just want the address and scope.

4. **Device issues** - Old phones, no storage, Android/iPhone mix. Web link works everywhere.

**Competitive positioning:** "No app required for your field workers" - genuine selling point for 5-20 person shops.

### Portal as Worker Dashboard (If Needed)

If workers want more than magic links (job history, dashboard, etc.), they don't need a separate app. The portal can serve them:

| User | Portal Access | What they see |
|------|---------------|---------------|
| Owner | Full dashboard | Everything |
| Tech | Blocked (use mobile app) | "Please use mobile app" message |
| Worker (with account) | Worker dashboard | Their jobs, history, updates |
| Worker (no account) | Magic link only | Single job details |

**Why portal > worker app:**
- Portal already exists and is mobile-responsive
- Same codebase to maintain
- No app store approvals
- Progressive enhancement: magic links → portal account if they want more

**Architecture principle:** Mobile app = quoting tool (techs). Portal = everything else.

### Scope Clarification

**In scope:**
- Scheduling workers for jobs
- Assigning workers via portal
- Job details via magic links
- Worker updates and photos
- "Create Job from Quote/Contract" flow

**Out of scope (intentionally):**
- Time tracking / timekeeping - many small businesses already have solutions
- GPS tracking
- Full dispatch/routing optimization

Focus on scheduling and job assignment. Avoid scope creep into time management.

### Phased Implementation

**Phase 1 (current):** Techs do quoting only - what we built in Jan 2026
**Phase 2 (next):** "Create Job from Quote/Contract" - auto-populate job details, assign workers
**Phase 3 (later):** Worker portal accounts for those who want dashboards
**Phase 4 (future):** If demand exists, evaluate additional features

This competes on the quoting side (techs using pricebook, Drew AI, etc.) without rebuilding the whole app.

**Sources:**
- [FieldPulse Estimates - Mobile App](https://help.fieldpulse.com/en/articles/6167941-estimates-mobile-app)
- [FieldPulse Estimate and Invoice Software](https://www.fieldpulse.com/features/estimates-and-invoices)
- [FieldPulse Work Order Management](https://www.fieldpulse.com/features/work-order-management)

---

## Phase 3: Timesheets (Later)

Track time at jobs:

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES auth.users(id),  -- Tech who logged time
  job_id UUID REFERENCES jobs(id),
  quote_id UUID REFERENCES quotes(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- Clock in/out on mobile
- Admin sees timesheet reports
- Export to payroll

---

## Phase 4: Full Scheduling (Future)

Calendar-based job scheduling:

- Drag-drop jobs to techs
- See availability
- Route optimization
- Customer notifications

This competes directly with FieldPulse's core features.

---

## Competitive Positioning

| Feature | FieldPulse | QuoteCat Premium (Founder) |
|---------|------------|----------------------------|
| Base price | $100/month | $79/month |
| Per tech | $100/month | $0 (5 included) |
| 5 techs total | $600/month | $79/month |
| 10 techs total | $1,100/month | $158/month |
| Quoting | Basic | AI-powered (Drew) |
| Pricebook | Yes | Yes + catalog |

**Messaging:** "All the team features of FieldPulse, 85% less cost, plus AI quoting."

---

## Competitive Analysis: Why QuoteCat's Approach Wins (Jan 2026)

### Target Market: 5-20 Person Shops

**Typical structure:**
- 1 owner/boss
- 1-2 office/estimator people
- 5-15 field workers (mix of employees + subs)

**Their reality:**
- Field workers have varying tech skills
- High turnover (especially in trades)
- Mix of old phones, Android, iPhone
- Subs come and go on different jobs
- Owner is busy, hates "managing software"

---

### Advantage #1: Zero Friction Onboarding

| Scenario | FieldPulse | QuoteCat |
|----------|------------|----------|
| New hire starts Monday | Download app, create account, training | Add phone number, they get texts |
| Sub needed for one job | "Can you download our app?" (awkward) | Send them the job link |
| Worker loses phone | Reset account, re-download, re-login | New phone? Still gets texts |
| Worker quits | Deactivate account, license wasted | Remove from list, done |

For a shop with turnover, this is huge. No "software onboarding" for field workers.

---

### Advantage #2: No Per-Seat Anxiety

**FieldPulse: $100/month + $100/tech**

This creates behavior problems:
- Owner avoids adding people to "save money"
- Shares logins (security issue)
- Subs never get added (work blind)
- "Do we really need them in the system?"

**QuoteCat: $79/month flat (5 techs included)**

- Add all your estimators, no guilt
- Workers don't count against seats (they use magic links)
- Subs get job links freely
- No "license management" headache

---

### Advantage #3: Right Tool for Right Role

FieldPulse forces everyone into the same app. But different roles have different needs:

| Role | What they actually need |
|------|------------------------|
| Owner | Full dashboard, reports, billing |
| Estimator | Quoting power, pricebook, Drew AI |
| Field worker | Address, scope, materials list |

QuoteCat matches tool to need:
- **Estimators** → Full mobile app (they need it)
- **Field workers** → Magic link (that's all they need)
- **Owner** → Portal (where business management belongs)

Not under-serving field workers - right-sizing the solution.

---

### Advantage #4: Subcontractor Friendly

Small shops use subs constantly. This is underrated.

**FieldPulse with a sub:**
- "Hey, can you download our app?"
- "Uh... I already have 3 other apps from other contractors"
- Sub doesn't download, works blind, problems happen

**QuoteCat with a sub:**
- "I'll text you the job details"
- Sub clicks link, sees everything
- Done

**You become the contractor that's easy to work for.** Subs prefer you.

---

### Advantage #5: Drew AI for Quoting

None of the competitors have this. FieldPulse, Jobber, ServiceTitan - no AI quoting.

For the estimator role (tech users), this is the killer feature:
- Build quotes faster
- Consistent pricing
- Pricebook + assemblies + AI assistance

Field workers don't need Drew. Estimators do. The architecture puts Drew where it matters.

---

### Summary Assessment

| Advantage | Strength | Notes |
|-----------|----------|-------|
| Zero friction for workers | Strong | Genuine operational win |
| No per-seat anxiety | Strong | Psychological + financial |
| Right tool for role | Medium | Some might want "one app for everyone" |
| Subcontractor friendly | Strong | Underrated differentiator |
| Drew AI | Strong | Unique, no competitor has it |
| Price | Very Strong | 74-87% cheaper than FieldPulse |

**Where QuoteCat might lose:**
- Large companies (50+ people) who want enterprise features
- Companies that want GPS tracking / route optimization
- Companies that want integrated time tracking

**But those aren't the target market.** For 5-20 person shops, this approach is genuinely better, not just cheaper.

---

## UI Mockups

### Portal: Team Page (Enhanced)

```
┌─────────────────────────────────────────────────────────────┐
│  Team                                                        │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  [Workers]  [Techs]  ← Tab switch                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Seats: 3 of 5 used          [+ Invite Tech] [Buy Seats] ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 👤 John Smith                              Admin    [⚙️] ││
│  │    john@email.com • Joined Jan 10                       ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ 👤 Mike Johnson                            Tech     [⚙️] ││
│  │    mike@email.com • Joined Jan 12                       ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ ✉️ sarah@email.com                         Pending  [x] ││
│  │    Invited Jan 14 • Expires in 6 days                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Mobile: Settings with Team

```
┌─────────────────────────────────────────┐
│ Settings                                │
├─────────────────────────────────────────┤
│ Account                                 │
│   Email: tech@email.com                 │
│   Team: ABC Electric                    │
│   Role: Tech                            │
├─────────────────────────────────────────┤
│ Your Permissions                        │
│   ✓ Create quotes                       │
│   ✗ Edit others' quotes                 │
│   ✗ View pricing/markup                 │
│   ✗ Manage clients                      │
└─────────────────────────────────────────┘
```

---

## Questions Resolved

1. **Workers vs Techs?** → Same thing, unified concept
2. **Billing model?** → 5 seats included, Premium price ($79/$199) per additional 5-pack
3. **Data ownership?** → Owner's user_id, team access via RLS
4. **When?** → Post-launch priority, explore now

---

## Implementation Progress (Jan 2026)

### Completed

**Database Foundation:**
- Created `team_tech_accounts` table (simpler than original plan - no separate teams table)
- Created `team_invitations` table
- Helper functions: `get_effective_owner_id()`, `get_tech_permissions()`, `is_owner()`, `get_tech_owner_id()`
- Added `created_by_tech_id` column to quotes, invoices, clients
- RLS policies for quotes, clients, invoices, assemblies, pricebook_items
- Premium tier check trigger
- Seat limit trigger (5 default, configurable via `profiles.preferences.max_team_seats`)

**Portal Invitation Flow:**
- `POST /api/team/techs/invite` - Create invitation
- `GET /api/team/techs/invite` - List techs
- `PUT /api/team/techs/invite` - Update permissions
- `DELETE /api/team/techs/invite` - Remove tech
- `GET /api/team/techs/join/[token]` - Validate token
- `POST /api/team/techs/join/[token]` - Accept invitation
- `/join/[token]` page - Public acceptance page

**Portal Tech Management UI:**
- `TeamPageTabs.tsx` - Tab switcher (Workers / Techs)
- `TechList.tsx` - Tech list with invite modal, permissions editing
- Role presets (Admin = all permissions, Tech = limited)
- Premium upgrade banner for non-Premium users

**Create Job from Quote/Contract (Jan 17, 2026):**
- "Create Job" button on quote detail page (in Next Steps section, when approved/completed)
- "Create Job" button on contract detail page (in Actions section, when signed/completed)
- Pre-fills job data from quote/contract (title, address, description, scope)
- Modal for scheduling: scheduled date, due date, notes for workers
- Links job to source via `quote_id` or `contract_id` field
- Redirects to jobs page after creation for worker assignment

### Key Schema Change from Original Plan

Original plan used `teams` + `team_memberships`. Actual implementation uses simpler `team_tech_accounts`:

```sql
CREATE TABLE team_tech_accounts (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),  -- Premium user
  tech_auth_id UUID REFERENCES auth.users(id),       -- Tech's login (NULL until accepted)
  role TEXT NOT NULL DEFAULT 'tech',
  status TEXT NOT NULL DEFAULT 'pending',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{...}',
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  UNIQUE(owner_id, email),
  UNIQUE(tech_auth_id)  -- Tech can only be on ONE team
);
```

**Side Work Prevention:** All data created by techs has `user_id = get_effective_owner_id()` which returns the owner's ID, not the tech's. Tech cannot use account for side work.

### Remaining Work

**Mobile App Tech Context (Days 10-12):**
- Detect tech status on login (query `team_tech_accounts`)
- `TechContext` provider with permissions, owner info
- Update quote creation to use `get_effective_owner_id()`
- Hide pricing fields if `!permissions.can_view_pricing`
- Show "Working for [Company Name]" indicator
- Handle removed tech (show error, sign out)

### Potential Gaps to Address

1. **Block Tech Login on Portal** ✅ DONE (Jan 17, 2026)
   - Dashboard layout checks if user is a tech (has active team_tech_accounts record)
   - Shows branded "Use the Mobile App" page with App Store link
   - Displays team name: "As a tech for [Company Name]..."
   - Sign out button to switch accounts

2. **Email Sending for Invitations** (Priority: Medium)
   - Issue: Invite endpoint returns URL but doesn't send email automatically
   - Solution: Integrate Resend, SendGrid, or Supabase email

3. **Resend Invitation** (Priority: Low)
   - Issue: No UI to resend expired invitations (7 day expiry)
   - Solution: Add "Resend" button next to pending invitations

4. **Seat Counter Display** ✅ DONE (Jan 17, 2026)
   - Shows "X of Y seats used" at top of Techs tab
   - Color coded: gray (ok), yellow (1 left), red (full)
   - Disables invite button when at limit

5. **Expired Invitation Visibility** (Priority: Low)
   - Issue: No easy way to see which invitations expired
   - Solution: Show expired invitations with badge and resend option

---

## Original Next Steps (Superseded)

~~1. Finalize permission list with user~~
~~2. Design invite email template~~
~~3. Create migration file~~
~~4. Build portal invite flow~~
~~5. Add mobile team context~~
