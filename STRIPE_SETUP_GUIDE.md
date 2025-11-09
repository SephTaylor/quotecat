# Stripe Setup Guide for QuoteCat

This guide walks through setting up Stripe for QuoteCat's payment processing.

## Overview

**Payment Flow:**
1. User clicks "Get Pro" or "Get Premium" on quotecat.ai
2. Redirects to Stripe Checkout (hosted by Stripe)
3. User enters payment info → Stripe processes payment
4. On success, Stripe sends webhook to our backend
5. Webhook creates Supabase user + profile with tier
6. Email sent to user with login credentials
7. User opens app → Signs in → Pro unlocks

## Step 1: Create Stripe Account

1. Go to https://stripe.com
2. Click "Start now" or "Sign up"
3. Create account with your email
4. Complete business verification (can start in test mode first)

## Step 2: Get Stripe API Keys

1. Go to Stripe Dashboard
2. Click "Developers" → "API keys"
3. Copy **Publishable key** (starts with `pk_test_...` or `pk_live_...`)
4. Copy **Secret key** (starts with `sk_test_...` or `sk_live_...`)
5. Add to `.env` file:

```env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

## Step 3: Create Products in Stripe

### Pro Tier Product

1. Go to Stripe Dashboard → "Products"
2. Click "+ Add product"
3. Fill in:
   - **Name:** QuoteCat Pro
   - **Description:** Unlimited quotes, cloud backup, custom templates
   - **Pricing:**
     - **Monthly:** $29.00 USD (recurring monthly)
     - **Yearly:** $290.00 USD (recurring yearly)
   - **Tax code:** (select appropriate code for your business)
4. Click "Add product"
5. **Copy the Price IDs** (you'll need these):
   - Monthly: `price_xxx...`
   - Yearly: `price_yyy...`

### Premium Tier Product

1. Click "+ Add product"
2. Fill in:
   - **Name:** QuoteCat Premium
   - **Description:** Everything in Pro + logo, AI wizard, analytics
   - **Pricing:**
     - **Monthly:** $79.00 USD (recurring monthly)
     - **Yearly:** $790.00 USD (recurring yearly)
3. Click "Add product"
4. **Copy the Price IDs:**
   - Monthly: `price_zzz...`
   - Yearly: `price_www...`

## Step 4: Add Price IDs to Environment

Update your `.env` file:

```env
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx...
STRIPE_PRO_YEARLY_PRICE_ID=price_yyy...
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_zzz...
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_www...
```

## Step 5: Create Checkout Session Endpoint

We need a serverless function to create Stripe checkout sessions. Options:

### Option A: Supabase Edge Function (Recommended)

**Create:** `supabase/functions/create-checkout/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.3.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  const { priceId, email } = await req.json();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    success_url: `${req.headers.get('origin')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.get('origin')}/#pricing`,
    metadata: {
      tier: priceId.includes('pro') ? 'pro' : 'premium',
    },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Deploy:**
```bash
supabase functions deploy create-checkout --no-verify-jwt
```

### Option B: Netlify Function

**Create:** `netlify/functions/create-checkout.js`

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const { priceId, email } = JSON.parse(event.body);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    success_url: `${event.headers.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${event.headers.origin}/#pricing`,
    metadata: {
      tier: priceId.includes('pro') ? 'pro' : 'premium',
    },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url }),
  };
};
```

## Step 6: Update Website JavaScript

Replace the placeholder functions in `website/index.html`:

```javascript
async function handleGetPro() {
    const priceId = prompt('Monthly or Yearly? (Enter "m" for monthly, "y" for yearly)');
    const selectedPrice = priceId === 'y'
        ? 'STRIPE_PRO_YEARLY_PRICE_ID' // Replace with actual price ID
        : 'STRIPE_PRO_MONTHLY_PRICE_ID'; // Replace with actual price ID

    const email = prompt('Enter your email address:');
    if (!email) return;

    try {
        const response = await fetch('YOUR_EDGE_FUNCTION_URL/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceId: selectedPrice, email }),
        });

        const { url } = await response.json();
        window.location.href = url; // Redirect to Stripe Checkout
    } catch (error) {
        alert('Error creating checkout session. Please try again.');
    }
}

async function handleGetPremium() {
    // Similar to handleGetPro but with Premium price IDs
}
```

## Step 7: Create Webhook Handler

This is the most important part - it creates the Supabase user account after successful payment.

**Create:** `supabase/functions/stripe-webhook/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.3.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  let event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Webhook signature verification failed' }), {
      status: 400,
    });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Create user in Supabase
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: session.customer_email!,
      email_confirm: true,
    });

    if (userError) throw userError;

    // Create profile with tier
    const tier = session.metadata.tier; // 'pro' or 'premium'
    await supabase.from('profiles').insert({
      id: user.user.id,
      email: session.customer_email!,
      tier: tier,
      pricing_tier: 'founder',
      created_at: new Date().toISOString(),
    });

    // TODO: Send welcome email with credentials
    // Use Resend, SendGrid, or Supabase email
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Deploy:**
```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

## Step 8: Configure Stripe Webhook

1. Go to Stripe Dashboard → "Developers" → "Webhooks"
2. Click "+ Add endpoint"
3. **Endpoint URL:** `YOUR_SUPABASE_FUNCTION_URL/stripe-webhook`
4. **Events to send:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click "Add endpoint"
6. **Copy the Signing Secret** (starts with `whsec_...`)
7. Add to `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Step 9: Test the Flow

### Test Mode (Use Stripe Test Cards):

1. Click "Get Pro" on website
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry date
4. Any CVC
5. Complete checkout
6. Check Stripe Dashboard → Payments (should show successful payment)
7. Check Supabase → Authentication (user should be created)
8. Check Supabase → profiles table (profile should exist with tier='pro')
9. Open app → Sign in with email → Should unlock Pro features

## Step 10: Set Up Email Automation

Options for sending credentials:

### Option A: Resend (Recommended - Simple)

1. Sign up at https://resend.com
2. Get API key
3. Add to webhook function:

```typescript
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

await resend.emails.send({
  from: 'QuoteCat <onboarding@quotecat.ai>',
  to: session.customer_email!,
  subject: 'Welcome to QuoteCat Pro!',
  html: `
    <h1>Welcome to QuoteCat Pro!</h1>
    <p>Your account has been created.</p>
    <p><strong>Email:</strong> ${session.customer_email}</p>
    <p>Download the app and sign in to unlock Pro features:</p>
    <ul>
      <li>iOS: [TestFlight link]</li>
      <li>Android: [Play Store link]</li>
    </ul>
  `,
});
```

### Option B: Supabase Built-in Email

Configure in Supabase Dashboard → Authentication → Email Templates

## Step 11: Go Live

When ready to accept real payments:

1. Complete Stripe business verification
2. Switch from test keys to live keys in `.env`
3. Update webhook endpoint to use live mode
4. Test with real card (charge $1, then refund)
5. Launch!

## Environment Variables Summary

```env
# Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_...

# Email (choose one)
RESEND_API_KEY=re_...
# OR
SENDGRID_API_KEY=SG....

# Supabase (already have these)
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Troubleshooting

**Webhook not receiving events:**
- Check webhook URL is correct
- Check endpoint is deployed and accessible
- Check Stripe Dashboard → Webhooks → Event Logs

**User not created:**
- Check Supabase logs
- Check webhook function logs
- Verify service role key is correct

**Email not sending:**
- Check email service API key
- Check spam folder
- Check email service dashboard for errors

## Next Steps

After Stripe is set up:
1. Add monthly/yearly toggle to pricing cards
2. Add "spots remaining" counter (fetch from Supabase)
3. Set up proper email templates
4. Add password reset flow
5. Launch founder pricing campaign!
