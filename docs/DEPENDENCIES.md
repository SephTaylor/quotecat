# QuoteCat External Dependencies

Last Updated: Feb 23, 2026

---

## Hosting & Infrastructure

| Service | Purpose | Used By | Dashboard |
|---------|---------|---------|-----------|
| **Netlify** | Hosting, functions, scheduled jobs | Marketing site, Portal | netlify.com |
| **Supabase** | Database, Auth, Edge Functions, Storage | All | supabase.com/dashboard |
| **Apple App Store** | iOS app distribution | Mobile app | appstoreconnect.apple.com |
| **Google Play Store** | Android app distribution | Mobile app | play.google.com/console |
| **Expo / EAS** | Build service, OTA updates | Mobile app | expo.dev |

## Payments & Billing

| Service | Purpose | Used By | Dashboard |
|---------|---------|---------|-----------|
| **Stripe** | Subscriptions, Connect (user payments) | Marketing site, Portal | dashboard.stripe.com |

## Email & SMS

| Service | Purpose | Used By | Dashboard |
|---------|---------|---------|-----------|
| **Resend** | Transactional email delivery | Portal, Supabase SMTP | resend.com |
| **Twilio** | SMS notifications to workers | Portal | twilio.com/console |
| **GoDaddy** | Email hosting (@quotecat.ai inboxes) | Team | email.godaddy.com |

## AI / APIs

| Service | Purpose | Used By | Dashboard |
|---------|---------|---------|-----------|
| **Anthropic (Claude)** | Drew AI assistant | Edge functions | console.anthropic.com |
| **OpenAI** | Embeddings for tradecraft search | Edge functions | platform.openai.com |

## Data / Integrations

| Service | Purpose | Used By | Dashboard |
|---------|---------|---------|-----------|
| **xByte** | Supplier pricing (Lowe's, HD, Menards) | Edge functions | (API only) |
| **QuickBooks (Intuit)** | Accounting sync | Portal | developer.intuit.com |

## Analytics

| Service | Purpose | Used By | Dashboard |
|---------|---------|---------|-----------|
| **PostHog** | Product analytics | Mobile app | app.posthog.com |

## CDNs & Fonts

| Service | Purpose | Used By | Dashboard |
|---------|---------|---------|-----------|
| **Google Fonts** | Geist font family | Portal (via next/font) | fonts.google.com |
| **jsdelivr** | JS library CDN | Marketing site | jsdelivr.com |
| **esm.sh** | ES module CDN | Edge functions | esm.sh |

## Domain & DNS

| Service | Purpose | Used By | Dashboard |
|---------|---------|---------|-----------|
| **GoDaddy** | Domain registration | quotecat.ai | godaddy.com |
| **Netlify DNS** | DNS management | quotecat.ai | netlify.com |

---

## API Keys & Secrets

Environment variables across the ecosystem:

### Mobile App (.env)
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_POSTHOG_API_KEY
```

### Portal (Netlify env vars)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
CRON_SECRET
QUICKBOOKS_CLIENT_ID
QUICKBOOKS_CLIENT_SECRET
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

### Supabase Edge Functions (Supabase secrets)
```
ANTHROPIC_API_KEY
OPENAI_API_KEY
RESEND_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
INGEST_API_KEY (for xByte sync)
```

### Marketing Site (Netlify env vars)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
```

---

## Billing Summary

| Service | Plan | Cost | Billing Cycle |
|---------|------|------|---------------|
| Netlify | Free | $0 | - |
| Supabase | Free | $0 | - |
| Resend | Free | $0 (3K emails/mo) | - |
| Stripe | Pay-as-you-go | 2.9% + $0.30/txn | Per transaction |
| Anthropic | Pay-as-you-go | ~$0.18/Drew session | Per API call |
| OpenAI | Pay-as-you-go | ~$0.0001/embedding | Per API call |
| PostHog | Free | $0 (1M events/mo) | - |
| Apple Developer | Annual | $99/year | Annual |
| Google Play | One-time | $25 | One-time |
| GoDaddy Email | Monthly | ~$6/mo | Monthly |
| GoDaddy Domain | Annual | ~$20/year | Annual |
| Twilio | Pay-as-you-go | ~$0.0079/SMS | Per message |
| xByte | Contract | TBD | TBD |
| QuickBooks | Free (dev) | $0 | - |

---

## Health Check Endpoints

For future monitoring:

| Service | Health Check |
|---------|--------------|
| Supabase | `SELECT 1` or `/rest/v1/` |
| Resend | `GET /domains` (check quota headers) |
| Stripe | `GET /v1/balance` |
| Anthropic | `POST /v1/messages` (small test) |
| OpenAI | `GET /v1/models` |
| Twilio | `GET /2010-04-01/Accounts/{SID}` |
| xByte | `GET /api/products?page=1&limit=1` |

---

## Contacts / Support

| Service | Support |
|---------|---------|
| Netlify | support@netlify.com |
| Supabase | support@supabase.io |
| Stripe | support.stripe.com |
| Resend | support@resend.com |
| Anthropic | support@anthropic.com |
| Apple | developer.apple.com/contact |
