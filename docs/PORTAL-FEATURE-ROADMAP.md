# Portal Feature Roadmap

## Last Updated: Feb 23, 2026

---

## Priority Summary

Prioritized based on [COMPETITOR-ANALYSIS.md](./COMPETITOR-ANALYSIS.md) gap analysis.

| Feature | Priority | Status | Competitor Gap |
|---------|----------|--------|----------------|
| **Two-Way SMS** | Critical | Planned | Yes - all competitors have this |
| **Online Booking** | High | Planned | Yes - customer self-scheduling |
| **Time Tracking** | High | Planned | Yes - employee hours |
| **Job Costing** | Medium | Planned | Yes - profitability tracking |
| **Review Requests** | Medium | Planned | Yes - Google review automation |
| **Service Plans** | Medium | Planned | Yes - recurring maintenance |
| **Price Data Integration** | Medium | Planned | No - unique differentiator |
| **Change Orders Sync** | Low | Planned | No - operational feature |
| **Client Portal** | Low | Backlog | Partial - we have individual links |
| **Recurring Invoices** | Low | Backlog | Related to Service Plans |

---

## Recently Completed (Feb 2026)

### Enhanced Job Scheduling
- Time-of-day scheduling (start/end times)
- Job types (estimate, install, inspection, follow-up, maintenance)
- Priority levels (low, medium, high, urgent)
- Enhanced calendar view with times and type icons
- **Closes competitor gap: Scheduling & Dispatching**

### Client Email Notifications
- Appointment confirmation emails
- Automated 24-hour reminders
- Resend integration
- **Closes competitor gap: Appointment Reminders**

### QuickBooks Sync
- Two-way sync for invoices, payments, clients
- OAuth 2.0 with token encryption
- **Closes competitor gap: QuickBooks Integration**

---

## Critical Priority (Close Competitor Gaps)

### 1. Two-Way SMS Communication

**Gap:** No in-app communication with customers. All competitors offer this.

**Why It Matters:**
- Contractors need to send updates ("On my way", "Running late")
- Customers expect text communication
- Reduces phone call interruptions
- Keeps business/personal separate

**Solution:**
- Twilio integration for SMS/MMS
- Dedicated business phone number per account
- Two-way messaging in portal and mobile app
- "On My Way" quick action from job detail
- Message history per client

**Competitor Benchmark:**
- Jobber Grow ($199): Two-way texting
- Housecall Pro ($149): Full communication suite
- Workiz ($225): Built-in phone system + SMS

**Tier:** Premium

**Effort:** ~2 weeks

---

## High Priority

### 2. Online Booking

**Gap:** Customers can't self-schedule appointments.

**Why It Matters:**
- 24/7 booking increases lead capture
- Reduces phone tag
- Professional image
- Customers expect this

**Solution:**
- Public booking page per business
- Available time slots from calendar
- Service type selection
- Automatic job creation
- Confirmation email to customer

**Competitor Benchmark:**
- Jobber Core ($39): Online booking included
- Housecall Pro Basic ($59): Online booking included

**Tier:** Premium

**Effort:** ~1.5 weeks

---

### 3. Time Tracking

**Gap:** No employee hour tracking.

**Why It Matters:**
- Required for payroll
- Track labor costs per job
- Compliance (wage laws)
- Foundation for job costing

**Solution:**
- Clock in/out on mobile app
- Associate time with specific jobs
- Timesheet view in portal
- Export for payroll
- GPS stamp on clock events (ties into GPS feature)

**Competitor Benchmark:**
- Jobber Connect ($119): Time tracking included
- Most competitors: Standard feature

**Tier:** Pro

**Effort:** ~1 week

---

## Medium Priority

### 4. Job Costing (Profitability Tracking)

**Gap:** No way to track actual costs vs quoted amounts.

**Why It Matters:**
- Know which jobs are profitable
- Improve future estimates
- Identify problem areas

**Solution:**
- "Edit Actuals" on completed jobs
- Enter actual materials, labor, expenses
- Show profit/loss per job
- Analytics: profitability by job type, client, time period

**Competitor Benchmark:**
- Jobber Grow ($199): Job costing
- Service Fusion Plus ($186): Job costing

**Tier:** Premium

**Effort:** ~1 week

---

### 5. Review Request Automation

**Gap:** No automated Google review requests.

**Why It Matters:**
- Google reviews drive new business
- Automation increases response rate 3-5x
- Competitors charge $29-39/mo extra for this

**Solution:**
- Auto-send review request after job completion or invoice paid
- Configurable delay (1 day, 3 days)
- Track who has reviewed (don't ask twice)
- Dashboard showing review stats
- Direct link to Google Business Profile

**Competitor Benchmark:**
- Housecall Pro: Included in Essentials ($149)
- Workiz: Included in Standard ($225)
- Jobber: Separate product

**Tier:** Premium

**Effort:** ~3 days

---

### 6. Service Plans / Memberships

**Gap:** No recurring maintenance agreement management.

**Why It Matters:**
- Predictable recurring revenue
- Customer retention
- Reduces seasonality
- Higher lifetime value

**Solution:**
- Create service plan templates (annual HVAC maintenance, etc.)
- Assign plans to clients
- Auto-schedule recurring jobs
- Auto-generate invoices
- Track plan status and renewals

**Competitor Benchmark:**
- ServiceTitan: Membership management
- Housecall Pro: Service agreements
- Workiz Ultimate: Service plans

**Tier:** Premium

**Effort:** ~2 weeks

---

### 7. Price Data Integration

**Problem:** Pricebook is disconnected from real-time supplier pricing.

**Solution:**
- Let users browse supplier catalog and add items to their pricebook
- When added, item links to catalog (source_product_id)
- User controls their price (can differ from market)
- Show market comparison: "Your price: $4.25 | Market: $3.49 (22% above)"

**Not a competitor gap** - this is a unique differentiator (real-time supplier pricing).

**Depends on:** xByte data pipeline (completed Feb 12, 2026)

**Tier:** Pro

**Effort:** ~1 week

---

## Low Priority (Backlog)

### 9. Change Orders Sync

**Problem:** Change orders exist in mobile app but don't sync to portal.

**Solution:** Full sync implementation - see `CHANGE-ORDERS-SYNC-PLAN.md`

**Requires:**
- Supabase migration (change_orders table)
- Mobile: SQLite storage + sync service
- Portal: API routes + UI components
- New TestFlight build

**Effort:** ~825 lines of code across 10 files

---

### 10. Client Portal

**Problem:** Clients get individual links but can't see full history.

**Solution:**
- Magic link per client (no password)
- Dashboard showing all their quotes, contracts, invoices
- Pay outstanding invoices
- Reduces "resend the link" support requests

---

### 11. Recurring Invoices

**Problem:** Maintenance contracts require manual invoice creation each month.

**Solution:**
- Create recurring invoice schedule
- Set frequency (monthly, quarterly, etc.)
- Auto-generate invoices
- Optional auto-email

**Note:** This overlaps with Service Plans feature - implement together.

---

## Current Portal Features (Implemented)

- Quotes management with tier groups
- Contracts with e-signatures
- Invoices with Stripe payments
- Team management (workers + techs)
- Job tracking with magic links
- Job scheduling with times, types, priorities
- Calendar view with enhanced UI
- Client email notifications + reminders
- Pricebook with CSV import/export
- QuickBooks sync
- Analytics dashboard
- Business settings with Stripe Connect

---

## Implementation Order (Recommended)

Based on impact vs effort:

| Order | Feature | Effort | Impact | Notes |
|-------|---------|--------|--------|-------|
| 1 | Two-Way SMS | 2 weeks | Critical | Twilio, includes "On My Way" button |
| 2 | Time Tracking | 1 week | High | Web-based via worker portal |
| 3 | Review Requests | 3 days | Medium | Quick win |
| 4 | Online Booking | 1.5 weeks | High | Lead capture |
| 5 | Job Costing | 1 week | Medium | Uses time tracking data |
| 6 | Service Plans | 2 weeks | Medium | Complex, recurring billing |
| 7 | Price Data | 1 week | Medium | Unique differentiator |

**Total to close major competitor gaps:** ~9 weeks

---

## Future (Post-Launch)

### QuoteCat Crew App

**Deferred:** Build after main app is live on App Store.

A lightweight companion app for workers/technicians:
- View assigned jobs
- Clock in/out with GPS stamp
- "On My Way" with real location
- Add notes/photos
- Push notifications for new assignments

This unlocks full GPS tracking without requiring workers to use the main QuoteCat app.

**Effort:** ~3 weeks + App Store approval process

---

## Infrastructure / Ops (Internal)

### Service Health Monitoring

**Problem:** Multiple service providers (Netlify, Supabase, Resend, Stripe, PostHog) - if any hits rate limits or has billing issues, app could break for users.

**Solution:**
- Health check endpoint (`/api/health`) that verifies all services
- UptimeRobot or Better Stack to monitor the endpoint
- Single dashboard showing status of all dependencies
- Alerts before users notice problems

**Services to monitor:**
- Supabase (database, auth, edge functions)
- Resend (email delivery, quota)
- Stripe (payments, webhooks)
- Netlify (deploys, functions)
- PostHog (analytics)
- xByte (supplier pricing API)

**Status:** Planned (not urgent, do before scaling)

---

## Competitive Position After Roadmap

Once complete, QuoteCat Premium will match or exceed:
- Jobber Connect ($119) - all features covered
- Housecall Pro Essentials ($149) - most features covered
- Workiz Standard ($225) - most features covered

At $79/mo (founder) or $199/mo (regular), this represents strong value.

**Remaining gaps vs enterprise competitors (ServiceTitan, etc.):**
- Multi-location management
- Advanced dispatch AI
- Inventory management
- Built-in phone system (vs SMS only)

These are intentionally out of scope - QuoteCat targets small contractors, not enterprise.
