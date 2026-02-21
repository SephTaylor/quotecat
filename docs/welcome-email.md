# Welcome Email Template

Send after user confirms their email address.

---

**Subject:** Welcome to QuoteCat

---

Hey {first_name},

You're in. QuoteCat is ready to help you create professional quotes faster than ever.

**What you can do right now (Free):**
- Unlimited quotes (stored locally)
- Unlimited clients
- 5 PDF exports per month
- 5 invoices per month (with QuoteCat branding)
- 5 CSV exports per month

---

**Want to unlock more?**

**Pro — $29/mo** (Founder pricing, locked forever)
- Unlimited exports, no branding
- Custom assemblies (one-tap material bundles)
- Cloud sync across all your devices
- Portal links for client approvals

**Premium — $79/mo** (Founder pricing, locked forever)
- Everything in Pro
- Digital contracts with e-signatures
- Drew AI quote assistant
- Full client portal with payments
- Priority support

Get started: https://quotecat.ai

*Only {spots_remaining} founder spots left at these prices.*

---

Questions? Just reply to this email.

– The QuoteCat Team

---

## Variables

- `{first_name}` - User's first name from profile
- `{spots_remaining}` - Calculate from `get_spots_remaining()` function in Supabase

## Implementation Notes

- Trigger: After email confirmation (Supabase Auth hook or custom function)
- Can include pricing/upgrade links since email is outside Apple's jurisdiction
- Consider using Resend, SendGrid, or Supabase's built-in email for delivery
