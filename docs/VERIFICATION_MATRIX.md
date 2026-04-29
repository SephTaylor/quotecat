# Manage Account / Subscription Refactor — Verification Matrix

Use this as a runbook while verifying the new subscription flow on real devices. Each scenario is a row; each cell has the steps to run, what to expect, and how to verify the result. Mark pass/fail as you go.

> Reference commit: `9535c1f feat: rebuild subscription / Manage Account architecture`

---

## Pre-flight — once before starting

- [ ] New mobile app build is live in TestFlight + Internal Test track
- [ ] You have your test phones in hand (iOS + Android)
- [ ] You can hit https://supabase.com/dashboard/project/eouikzjzsartaabvlbee/functions for live Edge Function logs
- [ ] You're signed in to App Store Connect and Play Console for sandbox setup
- [ ] You're signed out of QuoteCat on both phones (we want fresh sign-up flows)

### Quick status checks (run from terminal anytime)

**Database state:**
```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/eouikzjzsartaabvlbee/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-raw '{"query":"SELECT email, tier FROM profiles WHERE tier != '\''free'\'' ORDER BY email;"}'
```

**Subscriptions table:**
```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/eouikzjzsartaabvlbee/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-raw '{"query":"SELECT user_id, source, tier, status, product_id, current_period_end FROM subscriptions ORDER BY created_at DESC;"}'
```

**RC webhook last 30 events:**
- https://supabase.com/dashboard/project/eouikzjzsartaabvlbee/functions/revenuecat-webhook/logs

**Stripe webhook last 30 events:**
- https://supabase.com/dashboard/project/eouikzjzsartaabvlbee/functions/stripe-webhook/logs

**create-portal-session logs:**
- https://supabase.com/dashboard/project/eouikzjzsartaabvlbee/functions/create-portal-session/logs

---

## Verification matrix

### 1. iOS PAY — App Store sandbox purchase grants access within seconds

**Setup:**
- iOS device with TestFlight build installed
- App Store Connect → Users and Access → Sandbox → Test Accounts → confirm a sandbox tester exists (or create one)
- On the iOS device: Settings → App Store → Sandbox Account → sign in with that test account

**Steps:**
1. Open QuoteCat (TestFlight build)
2. Sign up fresh with a brand-new email (e.g., `verify-ios-pay@<your-domain>`)
3. Tap any feature that triggers the paywall (or Settings → Upgrade)
4. Choose **Pro Monthly** and complete the sandbox purchase
5. Watch the UI — within ~5 seconds the locked features should unlock

**Expected:**
- Paywall closes with "purchased" / "restored"
- Tier badge in Settings shows "PRO"
- Pro features unlocked

**Verify:**
- [ ] Run the Database state query → new email appears with `tier=pro`
- [ ] Run the Subscriptions query → new row with `source='app_store'`, `tier='pro'`, `status='active'`, `product_id='ai.quotecat.app.pro.monthly'`, real `external_id` (not `test-otxn-*`)
- [ ] Edge Function logs show `rc_webhook_received` then `rc_webhook_processed` with `action: 'inserted'`
- [ ] No `entitlement_drift` warnings in logs
- [ ] No `rc_webhook_orphan_user` warnings

**Pass / fail:** ⬜

---

### 2. Android PAY — Play Store internal test purchase grants access

**Setup:**
- Android device with internal test track build installed
- Play Console → Testing → Internal testing → confirm tester is added
- License testers configured: Play Console → Settings → License testing → add your Google account

**Steps:**
1. Open QuoteCat (Play internal test build)
2. Sign up fresh with a brand-new email (e.g., `verify-android-pay@<your-domain>`)
3. Trigger paywall, choose **Premium Monthly**, complete the test purchase

**Expected:**
- Paywall closes
- Tier badge shows "PREMIUM"
- Premium features unlocked within ~5s

**Verify:**
- [ ] `profiles.tier='premium'` for the new email
- [ ] Subscriptions row with `source='play_store'`, `tier='premium'`, `product_id='ai.quotecat.app.premium.monthly'` (note: webhook event delivers the colon form `ai.quotecat.app.premium.monthly:premium-monthly-base`, but the `_shared/product_tier_map.ts` normalizer strips it before lookup)
- [ ] Edge Function logs show `rc_webhook_processed` with no drift warnings

**Pass / fail:** ⬜

---

### 3. Stripe PAY — Marketing-site purchase grants access

**Setup:**
- Browser, signed out of QuoteCat everywhere
- A Stripe test mode coupon (or use a 100%-off promo code in live mode if you have one set up)

**Steps:**
1. Go to https://quotecat.ai
2. Click Buy on the pricing section (Founder Pro Monthly)
3. Complete Stripe Checkout (test card or coupon)
4. Wait for the welcome email at the address you used
5. Open the email, click "set password," set one
6. Sign in to the app on either phone with that email

**Expected:**
- Welcome email arrives with the pricing guide download link
- Sign-in succeeds, tier badge shows "PRO" immediately

**Verify:**
- [ ] `profiles.tier='pro'`, `profiles.stripe_customer_id` is set
- [ ] Subscriptions row with `source='stripe'`, `external_id` matches Stripe subscription ID, `stripe_customer_id` populated
- [ ] Stripe webhook logs show `stripe_webhook_received` then `stripe_webhook_checkout_processed`
- [ ] `stripe_webhook_user_invited` log entry (since this was a new user)
- [ ] No `stripe_webhook_invite_failed` errors

**Pass / fail:** ⬜

---

### 4. iOS ACCESS — Sign out, sign back in, tier persists

**Steps:** (using the user from Test 1)
1. In the app, Settings → Sign Out
2. Confirm tier badge shows "FREE" or sign-in screen appears
3. Sign back in with the same email + password (or magic link)

**Expected:**
- After sign-in, tier badge returns to "PRO"
- Pro features remain unlocked
- No paywall prompts

**Verify:**
- [ ] No new subscription row was created (still just one)
- [ ] No webhook events fired during sign-in (no relevant log entries)

**Pass / fail:** ⬜

### 5. Android ACCESS — Same as #4 but on Android device

**Pass / fail:** ⬜

### 6. Stripe ACCESS — Same as #4 but for the Stripe-paid user

**Pass / fail:** ⬜

---

### 7. iOS MANAGE — Manage Account opens Apple subscriptions page

**Steps:** (using the user from Test 1)
1. Settings → Manage Account
2. Confirm what opens

**Expected:**
- App Store app opens directly to your subscriptions page
- QuoteCat Pro Monthly subscription is listed
- You can cancel / change it from there

**Verify:**
- [ ] Edge Function logs show `portal_route_app_store` with your user_id
- [ ] Response was `{ "url": "https://apps.apple.com/account/subscriptions", "provider": "app_store" }`

**Pass / fail:** ⬜

### 8. Android MANAGE — Opens Play Store subscriptions page

**Steps:** (using the user from Test 2)
1. Settings → Manage Account

**Expected:**
- Play Store app opens to the QuoteCat subscriptions page
- Premium Monthly is shown

**Verify:**
- [ ] Edge Function logs show `portal_route_play_store` with the constructed URL containing `package=ai.quotecat.app&sku=ai.quotecat.app.premium.monthly`
- [ ] URL was returned cleanly (sku is the bare product_id, no colon-form)

**Pass / fail:** ⬜

### 9. Stripe MANAGE — Opens Stripe billing portal

**Steps:** (using the Stripe-paid user from Test 3)
1. Sign in on either phone if not already
2. Settings → Manage Account

**Expected:**
- Browser opens to Stripe's hosted billing portal
- You can update payment method, cancel, etc.

**Verify:**
- [ ] Edge Function logs show `portal_route_stripe` with `portal_session_id`
- [ ] Response was `{ "url": "https://billing.stripe.com/...", "provider": "stripe" }`
- [ ] No extra Stripe API call beyond `billingPortal.sessions.create` (saved by storing `stripe_customer_id` on the subscription row)

**Pass / fail:** ⬜

---

### 10. Free user MANAGE — Returns "no active subscription" cleanly

**Steps:**
1. Sign up fresh with another new email (don't purchase anything)
2. Settings → Manage Account

**Expected:**
- Friendly "No Subscription" alert
- No app crash, no infinite loading

**Verify:**
- [ ] HTTP 404 response from create-portal-session
- [ ] Mobile alert says "No active subscription found for this account."
- [ ] No errors in logs (this is a known/expected response)

**Pass / fail:** ⬜

---

### 11. Negative auth — Unauthenticated curl returns 401

```bash
curl -sS -X POST "https://eouikzjzsartaabvlbee.supabase.co/functions/v1/create-portal-session" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTP %{http_code}\n"
```

**Expected:** HTTP 401, no body crash. (Already verified during Step 8 deploy — re-run for completeness.)

**Pass / fail:** ⬜

---

### 12. RC webhook end-to-end — Real RENEWAL event flows correctly

This will happen automatically on whichever sandbox sub renews first. Sandbox subs renew faster than production (e.g., monthly = 5 minutes in sandbox).

**Verify (when it fires):**
- [ ] Webhook log shows `rc_webhook_received` for `RENEWAL` event
- [ ] `rc_webhook_processed` with `action: 'updated'` (not 'inserted' — same external_id)
- [ ] `subscriptions.current_period_end` is updated to a later date
- [ ] `last_event_id` and `last_event_at` are updated
- [ ] `profiles.tier` unchanged (still pro/premium)

**Pass / fail:** ⬜

---

### 13. Cancellation flow — User-initiated cancel from MANAGE flow

**Steps:** (use one of the IAP test users)
1. Tap Manage Account → opens Apple/Play subscriptions page
2. Cancel the subscription on the platform
3. Wait for the cancel webhook (sandbox is fast — ~30s; production may be longer)
4. Refresh app

**Expected:**
- Tier remains pro/premium until period end (Apple/Google standard behavior)
- After period end, sandbox sends EXPIRATION → tier drops to free

**Verify:**
- [ ] CANCELLATION event logs show `rc_webhook_processed` with `action: 'updated'`
- [ ] Subscription row's `canceled_at` is set, but `status='active'`
- [ ] `profiles.tier` unchanged at this point
- [ ] After EXPIRATION fires (later): `subscription.status='expired'`, `profiles.tier='free'`

**Pass / fail:** ⬜

---

### 14. Drew / Wyatt MANAGE — Returns "no subscription" (acceptable per plan)

**Steps:** (only if you can sign in as Drew or Wyatt — skip if not)
1. Sign in as `foxrider12@icloud.com` or `wyattstephan@stephanelectric.com`
2. Note their tier shows premium (manually set)
3. Tap Manage Account

**Expected:**
- "No Subscription" alert (because they have no `subscriptions` row)
- This is the documented expected behavior — they have lifetime grants, not subscriptions

**Verify:**
- [ ] HTTP 404 response
- [ ] Tier stays at premium after dismissing the alert

**Pass / fail:** ⬜

---

## What to do if something fails

| Failure mode | Investigation path |
|---|---|
| Webhook 500s | Edge Function logs → look for `rc_webhook_processing_error` or `stripe_webhook_processing_error`. Check `subscriptions` table for partial state. |
| `rc_webhook_orphan_user` fires for a real customer | They're authenticated client-side but no profiles row exists. Likely a sign-up flow issue. |
| `entitlement_drift` warnings | Either RC dashboard config drifted (re-run audit) or `PRODUCT_TIER_MAP` is out of date. Both should be in sync per `docs/ENTITLEMENT_AUDIT.md`. |
| Tier doesn't update after purchase | Check the 2-second wait in `lib/revenuecat.ts:73` — see `FOLLOWUPS.md` re: poll-with-timeout. |
| 500 from create-portal-session | Logs will show structured error. Most likely missing `stripe_customer_id` for a stripe-source row, or some other data integrity issue. |
| `inviteUserByEmail` failures (Stripe checkouts not creating users) | Same root cause as Drew's NULL row — patched 2026-04-28. If it recurs, the row pattern from `joseph@quotecat.ai` is documented in `FOLLOWUPS.md`. |

## After verification

When all green, you can:
- Promote internal test track → closed/open beta → production on Google
- Promote TestFlight → App Store on Apple
- Mark this doc as superseded; only keep open items in `FOLLOWUPS.md`
