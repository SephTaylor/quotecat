# FOLLOWUPS

Tracked follow-ups deliberately deferred from the subscription/Manage Account refactor PR. Each one is small enough to do later, but big enough to deserve being tracked rather than living in chat history.

Update this file when work is completed (move to "Done" section) or when new follow-ups are identified.

---

## Open

### Phase 2 cleanup of `profiles` Stripe columns

After the new `subscriptions`-based flow is verified in production for a few weeks:

- Drop `profiles.stripe_customer_id` (currently still dual-written)
- Drop `profiles.stripe_subscription_id` (currently still dual-written)
- Update `supabase/functions/delete-account/index.ts:81` to read `stripe_customer_id` from the `subscriptions` table instead of `profiles`
- Decide whether `profiles.tier` becomes a generated column derived from active subscription, or stays dual-written. Recommended: stays dual-written (simpler; mobile app still reads `userState.tier` from AsyncStorage cached from `profiles.tier`).

### `presentPaywallAndSync` race window

`lib/revenuecat.ts:73-74` waits a fixed 2 seconds after a successful purchase, then reads `profiles.tier` once. If the RevenueCat webhook is slower than 2s end-to-end, the read sees stale tier and the UI shows free briefly.

Fix: convert from `await sleep(2000); fetch()` to a poll-with-timeout: poll `profiles.tier` every 500ms for up to 10 seconds, return as soon as it shows the new tier. Bail out gracefully if it never arrives (user can refresh manually).

Defer until: we observe the race firing during verification or in production. If verification passes cleanly with the current 2s wait, leave it.

### Optional: `webhook_events` audit table

Not built in this PR. Add later if we ever need event-level debugging beyond what RC and Stripe dashboards provide.

If we add it: `id` (event_id from provider, unique), `source`, `payload` (JSONB), `received_at`, `processed_at`, `error` (nullable). Webhook handlers insert at start, update with result.

### Stripe secret key rotation (post-PR)

The current live Stripe secret key (`sk_live_...0J00JmrGyvUO`) was pasted into the Claude chat transcript on 2026-04-28 during the audit. Roll it once more so the secret captured in chat history is invalidated.

Procedure: Stripe → Developers → API keys → "Roll key" on the active secret → 12-hour grace → update Supabase Edge Function secrets via Management API → verify production via `create-checkout` smoke test → let old key expire.

### Delete the orphaned `sk_live_...NZXG` Stripe secret key

`sk_live_...NZXG` (created Nov 10, 2025) hasn't been used since Jan 17. Recommend deleting from Stripe → Developers → API keys.

### `STRIPE_*_PRICE_ID` Supabase Edge Function secrets

There are four Supabase secrets that aren't referenced anywhere in current edge function code:
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `STRIPE_PREMIUM_MONTHLY_PRICE_ID`
- `STRIPE_PREMIUM_YEARLY_PRICE_ID`

The actual prices used in the code are hardcoded in `supabase/functions/create-checkout/index.ts` and `supabase/functions/stripe-webhook/index.ts`. Verify these env vars aren't used by something I missed; if confirmed unused, delete from Supabase secrets.

### `.env`-in-git-history credential rotation

`.env` was historically committed to git (commits `b6b6e35`, `8303582`). Anyone who has ever cloned the repo could have those values in their local git history.

Roll all of these:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_ACCESS_TOKEN`
- (Stripe key already being rolled per the item above)

After rotation, optionally scrub history with `git filter-repo` and force-push. (More invasive; only do if you're confident about who has clones.)

### Stripe `incomplete` status mapping

`stripe-webhook` currently maps Stripe's `incomplete` status to our `'active'` enum (initial card-setup state). If the user's card is declined right after checkout, Stripe will eventually fire a `customer.subscription.updated` event with status `incomplete_expired` (terminal) — the webhook downgrades to `'expired'` correctly.

**Verify post-launch:** with a real declined-card test, confirm the chain of events results in the user losing access. If the chain doesn't fire as expected, either flip `incomplete` to `'expired'` immediately (safer) or add an explicit grace-period state.

### Stripe `paused` status mapping

`stripe-webhook` maps Stripe's `paused` status to our `'active'` enum because we don't currently use Stripe's [Pause Collection](https://stripe.com/docs/billing/subscriptions/pause-payment) feature. If/when QuoteCat starts pausing subscriptions (e.g., for seasonal contractor pause-and-resume), revisit this mapping — paused users probably shouldn't have full access.

### Alert on `rc_webhook_orphan_user` logs (post-launch)

The RC webhook's orphan-user grace handling acknowledges and skips events whose `app_user_id` doesn't exist in `profiles`. Pre-launch this is fine — the orphans we've seen (e.g., `65082a64-d6ea-4158-a5a0-3fbe38b7d0d0`) are leftovers from anonymous-purchase users who got cleaned up.

Post-launch, if a real customer's `auth.users` row gets deleted but their RC subscription persists, we want to know fast and have a recovery process. Specifically:

- Set up an alert (Supabase log drain → PagerDuty/email/Slack) on `console.warn` lines containing `rc_webhook_orphan_user`
- Document the recovery procedure: usually involves matching the original_app_user_id in RC to a current Supabase user (if they re-signed up) and using RC's customer migration API to relink

The alert is the trigger. Without it, orphan events log silently and we'd only notice via support tickets ("I paid but the app says I'm free").

### `1modernrelic@gmail.com` — undiscovered 9th paid user (resolved)

The 2026-04-28 audit identified 8 users with `tier IN ('pro','premium')`. Webhook verification on 2026-04-29 surfaced a 9th: `1modernrelic@gmail.com` (`65082a64-d6ea-4158-a5a0-3fbe38b7d0d0`), created 2026-04-20. They had a real Play Store Pro Monthly purchase that died with `BILLING_ERROR` and now sit at `tier='free'` — which is correct.

Not currently a problem. Noting because the audit underestimated total active testers by one. If you do another audit pass before public launch, expect the count to be 23 users / 2 real paid IAP / 6 dropped-to-free / Drew + Wyatt at premium / 13 free testers. The arithmetic was off-by-one because expired-billing-error users sit at `tier='free'` so they didn't appear in the paid-users query.

### GoTrue admin DELETE bug for some legacy users

During Step 9 cleanup (2026-04-29), `joseph@quotecat.ai` returned 500 `Database error deleting user` from `DELETE /auth/v1/admin/users/{id}` even after we patched the row's NULL `is_super_admin` column. A direct SQL `DELETE FROM auth.users WHERE id = ...` succeeded immediately and CASCADE-deleted all dependent rows correctly.

GoTrue must have some preflight or post-step that fails for legacy rows, independent of the column-NULL issues we already fixed. The other 5 users in the same batch deleted cleanly via the admin API; joseph was the only one that needed the SQL fallback.

**Practical impact:** if `delete-account` (which uses `auth.admin.deleteUser` per `delete-account/index.ts:233`) ever fires for a similarly-affected legacy user, it'll fail. New users created after the GoTrue fix that introduced this issue won't be affected.

**Recovery:** if a `delete-account` call fails, fall back to direct SQL via Management API (`DELETE FROM auth.users WHERE id = '<uuid>'`). Postgres CASCADEs handle the rest.

Worth investigating once we have time: Supabase support ticket with the `error_id` from a future failure should clarify what GoTrue's choking on.

### Apple grace period (`in_grace_period` status)

Apple gives users a 16-day grace period when an IAP renewal fails. Currently the new `subscription_status` enum is `active | canceled | expired` only. RC reports a separate `BILLING_ISSUE` event during grace period.

If users start losing access prematurely or keeping access too long during failed renewals, add an `in_grace_period` enum value and handle the `BILLING_ISSUE` event explicitly. `ALTER TYPE … ADD VALUE` is cheap.

---

## Done

(none yet)
