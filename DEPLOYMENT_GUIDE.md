# QuoteCat Payment System Deployment Guide

This guide walks through deploying the Stripe payment system for QuoteCat.

## Prerequisites

- Stripe account created
- Supabase CLI installed (`npm install -g supabase`)
- Supabase project linked (`supabase link --project-ref eouikzjzsartaabvlbee`)

## Step 1: Set Up Stripe

### 1.1 Create Stripe Account

1. Go to https://stripe.com
2. Sign up and complete verification
3. Start in **Test Mode** first

### 1.2 Create Products

Go to Stripe Dashboard → Products → Add product

**Pro Product:**
- Name: QuoteCat Pro
- Description: Unlimited quotes, cloud backup, custom templates
- Add two prices:
  - Monthly: $29.00 USD recurring monthly
  - Yearly: $290.00 USD recurring yearly
- Copy both **Price IDs** (starts with `price_...`)

**Premium Product:**
- Name: QuoteCat Premium
- Description: Everything in Pro + logo, AI wizard, analytics
- Add two prices:
  - Monthly: $79.00 USD recurring monthly
  - Yearly: $790.00 USD recurring yearly
- Copy both **Price IDs**

### 1.3 Get API Keys

1. Go to Stripe Dashboard → Developers → API keys
2. Copy **Secret key** (starts with `sk_test_...` in test mode)
3. Keep this safe - you'll need it in Step 2

## Step 2: Configure Environment Variables

### 2.1 Create Local .env File

In `supabase/functions/` create a `.env` file:

```bash
# Copy from .env.example
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Add your actual price IDs from Step 1.2
STRIPE_PRO_MONTHLY_PRICE_ID=price_XXX
STRIPE_PRO_YEARLY_PRICE_ID=price_YYY
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_ZZZ
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_WWW

# These are already in your project .env
SUPABASE_URL=https://eouikzjzsartaabvlbee.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.2 Set Supabase Secrets

These secrets will be available to your Edge Functions:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
supabase secrets set STRIPE_PRO_MONTHLY_PRICE_ID=price_XXX
supabase secrets set STRIPE_PRO_YEARLY_PRICE_ID=price_YYY
supabase secrets set STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_ZZZ
supabase secrets set STRIPE_PREMIUM_YEARLY_PRICE_ID=price_WWW
```

Note: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already set automatically.

## Step 3: Deploy Edge Functions

### 3.1 Deploy Checkout Function

```bash
cd supabase/functions
supabase functions deploy create-checkout --no-verify-jwt
```

**Output:** You'll get a URL like:
```
https://eouikzjzsartaabvlbee.supabase.co/functions/v1/create-checkout
```

**Copy this URL** - you'll need it for Step 4.

### 3.2 Deploy Webhook Function

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

**Output:** You'll get a URL like:
```
https://eouikzjzsartaabvlbee.supabase.co/functions/v1/stripe-webhook
```

**Copy this URL** - you'll need it for Step 5.

## Step 4: Update Website

### 4.1 Update Checkout URL

Edit `website/index.html` and replace the placeholder URL:

**Find this line (around line 1346):**
```javascript
const response = await fetch('YOUR_SUPABASE_FUNCTION_URL/create-checkout', {
```

**Replace with your actual URL from Step 3.1:**
```javascript
const response = await fetch('https://eouikzjzsartaabvlbee.supabase.co/functions/v1/create-checkout', {
```

### 4.2 Update Price IDs

**Find these lines (around line 1332-1337):**
```javascript
if (tier === 'pro') {
    priceId = period ? 'STRIPE_PRO_MONTHLY_PRICE_ID' : 'STRIPE_PRO_YEARLY_PRICE_ID';
} else {
    priceId = period ? 'STRIPE_PREMIUM_MONTHLY_PRICE_ID' : 'STRIPE_PREMIUM_YEARLY_PRICE_ID';
}
```

**Replace with your actual price IDs from Step 1.2:**
```javascript
if (tier === 'pro') {
    priceId = period ? 'price_XXX' : 'price_YYY';
} else {
    priceId = period ? 'price_ZZZ' : 'price_WWW';
}
```

### 4.3 Commit and Push

```bash
git add website/index.html
git commit -m "feat: connect website to Stripe checkout"
git push
```

Website will auto-deploy on Netlify in ~15 seconds.

## Step 5: Configure Stripe Webhook

### 5.1 Add Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click **+ Add endpoint**
3. **Endpoint URL:** Paste URL from Step 3.2
   ```
   https://eouikzjzsartaabvlbee.supabase.co/functions/v1/stripe-webhook
   ```
4. **Events to send:** Select these events:
   - `checkout.session.completed` - New subscription created
   - `customer.subscription.updated` - Subscription changed
   - `customer.subscription.deleted` - Subscription cancelled
   - `invoice.paid` - Monthly payment succeeded
   - `invoice.payment_failed` - Payment failed (notify customer)
5. Click **Add endpoint**

### 5.2 Get Webhook Secret

1. Click on the webhook you just created
2. Click **Reveal** under "Signing secret"
3. Copy the secret (starts with `whsec_...`)

### 5.3 Set Webhook Secret

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

## Step 6: Test the Payment Flow

### 6.1 Test Checkout

1. Go to https://quotecat.ai
2. Click "Get Pro Now"
3. Enter your email
4. Choose Monthly or Yearly
5. Should redirect to Stripe Checkout

### 6.2 Test Payment

Use Stripe test card:
- **Card number:** `4242 4242 4242 4242`
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **ZIP:** Any 5 digits

Complete the checkout.

### 6.3 Verify Account Creation

1. Check **Stripe Dashboard → Payments**
   - Should see successful payment

2. Check **Supabase Dashboard → Authentication → Users**
   - Should see new user with your email

3. Check **Supabase Dashboard → Table Editor → profiles**
   - Should see profile with `tier = 'pro'`

4. Check **Supabase Functions Logs**
   ```bash
   supabase functions logs stripe-webhook --tail
   ```
   - Should see logs showing user creation
   - Should see generated password in logs (TEMPORARY - for testing only)

### 6.4 Test App Login

1. Open QuoteCat app
2. Settings → Sign In
3. Use email and password from logs
4. Pro features should unlock ✅

## Step 7: Configure Customer Portal

The customer portal lets users manage their own subscriptions (update payment, cancel, etc.).

### 7.1 Configure Portal Settings

1. Go to Stripe Dashboard → Settings → Customer portal
2. Enable the features you want:
   - ✅ Update payment method (recommended)
   - ✅ Cancel subscription (recommended)
   - ✅ Update subscription (optional - for upgrades)
3. Set the default redirect URL to your website
4. Save settings

### 7.2 Deploy Portal Function (Optional)

If you want users to access the portal from within the app:

```bash
supabase functions deploy create-portal-session
```

This function requires authentication (user must be signed in).

## Step 8: Set Up Email Automation (Optional but Recommended)

Right now, passwords are only logged. Let's send them via email.

### Option A: Resend (Recommended - Simple)

1. Sign up at https://resend.com (free tier: 100 emails/day)
2. Get API key
3. Add to Supabase secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_YOUR_KEY_HERE
   ```
4. Uncomment the Resend email code in `stripe-webhook/index.ts` (around line 90)
5. Redeploy webhook function:
   ```bash
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

### Option B: SendGrid

Similar process, use SendGrid API instead.

## Step 9: Go Live (When Ready)

### 8.1 Switch to Live Mode

1. Stripe Dashboard → Toggle from Test to Live mode
2. Create **Live** products and prices (same as test)
3. Get **Live** API keys (starts with `pk_live_...` and `sk_live_...`)

### 8.2 Update Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
supabase secrets set STRIPE_PRO_MONTHLY_PRICE_ID=price_LIVE_XXX
supabase secrets set STRIPE_PRO_YEARLY_PRICE_ID=price_LIVE_YYY
supabase secrets set STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_LIVE_ZZZ
supabase secrets set STRIPE_PREMIUM_YEARLY_PRICE_ID=price_LIVE_WWW
```

### 8.3 Update Webhook

1. Create new webhook in **Live mode**
2. Use same URL
3. Get new webhook secret
4. Update secret:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_LIVE_SECRET
   ```

### 8.4 Update Website

Update price IDs in `website/index.html` to use **live** price IDs.

## Monitoring

### Check Logs

```bash
# Webhook function logs
supabase functions logs stripe-webhook --tail

# Checkout function logs
supabase functions logs create-checkout --tail
```

### Stripe Dashboard

- Dashboard → Payments (see all payments)
- Dashboard → Customers (see all customers)
- Dashboard → Webhooks → Event log (see webhook events)

### Supabase Dashboard

- Authentication → Users (see all users)
- Table Editor → profiles (see all profiles with tiers)

## Troubleshooting

**Checkout not working:**
- Check browser console for errors
- Verify Edge Function URL is correct in website code
- Check Supabase function logs

**Webhook not creating user:**
- Check Stripe Dashboard → Webhooks → Event log
- Check Supabase function logs
- Verify webhook secret is set correctly
- Make sure RLS policy on profiles table allows insert

**User created but no email sent:**
- Check email service logs
- Verify API key is correct
- Check spam folder
- Make sure email code is uncommented

**App not unlocking Pro:**
- Verify user exists in Supabase Authentication
- Verify profile exists with correct tier
- Check app logs for auth errors

## Security Notes

1. **Never commit `.env` files** - Already in .gitignore
2. **Keep webhook secret secure** - Only in Supabase secrets
3. **Use HTTPS only** - Supabase functions use HTTPS by default
4. **Verify webhook signatures** - Already handled in webhook function
5. **Remove password logging** - After testing, remove console.log of passwords

## Next Steps

After deployment works:
1. Set up proper email templates
2. Add password reset flow
3. Add customer portal (Stripe Customer Portal)
4. Add usage tracking for free tier limits
5. Add "spots remaining" counter
6. Launch founder pricing campaign!
