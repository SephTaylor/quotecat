// supabase/functions/stripe-webhook/index.new.ts
//
// NEW VERSION — sibling file for diff before swap. After the diff is approved,
// this file replaces `index.ts`.
//
// Handles Stripe webhook events for marketing-site subscription purchases.
// Writes to the `subscriptions` table and syncs `profiles.tier` atomically
// via the `upsert_subscription_event` Postgres function (see migration 025).
//
// EVENTS HANDLED:
//   - checkout.session.completed     — initial purchase (invites new user, writes initial subscription row, sends welcome email)
//   - customer.subscription.updated  — ongoing changes (plan changes, renewals, cancellation-at-period-end, status transitions)
//   - customer.subscription.deleted  — terminal cancellation (period over)
//
// USER CREATION FAILURE:
//   The `auth.admin.inviteUserByEmail` call goes through the same admin code
//   path that broke earlier this session (Drew's NULL row). If it fails, we
//   log a structured error and return 500 so Stripe retries. The webhook
//   intentionally does NOT swallow invite failures.
//
// IDEMPOTENCY:
//   Handled inside the RPC. We pass `event.id` (Stripe-generated) and
//   `event.created * 1000` (Stripe timestamps are seconds, our RPC takes ms).
//
// REFERENCES:
//   - docs/ENTITLEMENT_AUDIT.md — canonical price→tier map
//   - supabase/functions/_shared/product_tier_map.ts — runtime mapping

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import {
  resolveTierFromProduct,
  type Tier,
  type SubscriptionSource,
} from "../_shared/product_tier_map.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

// =============================================================================
// Server
// =============================================================================

serve(async (req) => {
  // Fail-closed: webhook secret must be configured server-side. Stripe's own
  // signature verification would also fail without it, but we want a distinct
  // 500 for operator misconfiguration so it's visible in dashboards as
  // "we broke this" rather than "Stripe sent something bad."
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("stripe_webhook_secret_not_configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("stripe_webhook_no_signature");
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("stripe_webhook_signature_failed", { error: String(err) });
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("stripe_webhook_received", {
    event_id: event.id,
    type: event.type,
    livemode: event.livemode,
  });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, event);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(supabase, event);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(supabase, event);
        break;

      default:
        console.log("stripe_webhook_unhandled_type", { event_id: event.id, type: event.type });
    }

    return jsonResponse({ received: true }, 200);
  } catch (err) {
    // 5xx triggers Stripe to retry (default retry window ~3 days).
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe_webhook_processing_error", {
      event_id: event.id,
      type: event.type,
      error: message,
    });
    return jsonResponse({ error: message }, 500);
  }
});

// =============================================================================
// Handlers
// =============================================================================

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  event: Stripe.Event,
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const customerEmail = session.customer_email || session.customer_details?.email;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string | null;

  if (!customerEmail) {
    throw new Error(
      `checkout.session.completed missing customer email (event_id=${event.id})`,
    );
  }
  if (!subscriptionId) {
    // One-time purchases (e.g., the pricing guide) hit this path with no
    // subscription. Log and move on — they don't belong in `subscriptions`.
    console.log("stripe_webhook_one_time_purchase_ignored", {
      event_id: event.id,
      email: customerEmail,
    });
    return;
  }

  // Pull the full subscription so we have price.id, current_period_end, etc.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    throw new Error(
      `Subscription ${subscriptionId} has no price (event_id=${event.id})`,
    );
  }

  const tier = resolveTierFromProduct(priceId);
  if (!tier) {
    // Unknown price ID. We refuse to write a guess — the webhook should fail
    // loudly so we update PRODUCT_TIER_MAP to include the new price.
    throw new Error(
      `Unknown Stripe price_id ${priceId} (event_id=${event.id}). ` +
      `Add to docs/ENTITLEMENT_AUDIT.md and supabase/functions/_shared/product_tier_map.ts.`,
    );
  }

  // Make sure the user exists. inviteUserByEmail is idempotent — if a user with
  // this email already exists, it returns the existing record without sending
  // a new invite email. Only failures throw.
  const userId = await ensureUserExists(supabase, customerEmail, customerId, tier, event.id);

  const result = await callUpsert(supabase, {
    p_user_id:             userId,
    p_source:              "stripe" as SubscriptionSource,
    p_tier:                tier,
    p_status:              "active",
    p_product_id:          priceId,
    p_external_id:         subscriptionId,
    p_stripe_customer_id:  customerId,
    p_started_at:          new Date(subscription.start_date * 1000).toISOString(),
    p_current_period_end:  new Date(subscription.current_period_end * 1000).toISOString(),
    p_canceled_at:         null,
    p_event_id:            event.id,
    p_event_timestamp_ms:  event.created * 1000,
  });

  console.log("stripe_webhook_checkout_processed", {
    event_id: event.id,
    user_id: userId,
    action: result.action,
    new_profile_tier: result.profile_tier,
  });

  // Welcome email is best-effort; failure is logged but does not 500 the
  // webhook (Stripe shouldn't retry a successful subscription write just
  // because email delivery had a hiccup).
  if (result.action === "inserted") {
    await sendWelcomeEmail(customerEmail, tier).catch((err) => {
      console.error("stripe_webhook_welcome_email_failed", {
        event_id: event.id,
        email: customerEmail,
        error: String(err),
      });
    });
  }
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  event: Stripe.Event,
) {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;

  if (!priceId) {
    throw new Error(
      `Subscription ${subscription.id} has no price (event_id=${event.id})`,
    );
  }

  const tier = resolveTierFromProduct(priceId);
  if (!tier) {
    throw new Error(
      `Unknown Stripe price_id ${priceId} on subscription update (event_id=${event.id})`,
    );
  }

  // Look up user_id via the subscription row we wrote earlier (or via profiles
  // for transitional safety — profiles.stripe_customer_id is still populated
  // during Phase 1).
  const userId = await findUserByStripeCustomer(supabase, customerId);
  if (!userId) {
    // Subscription update arrived before checkout.session.completed wrote the row.
    // Stripe will retry — return 500.
    throw new Error(
      `No user found for stripe_customer_id=${customerId} on subscription update (event_id=${event.id})`,
    );
  }

  const status = mapStripeStatus(subscription);
  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : (subscription.cancel_at_period_end
        ? new Date(event.created * 1000).toISOString()
        : null);

  const result = await callUpsert(supabase, {
    p_user_id:             userId,
    p_source:              "stripe" as SubscriptionSource,
    p_tier:                tier,
    p_status:              status,
    p_product_id:          priceId,
    p_external_id:         subscription.id,
    p_stripe_customer_id:  customerId,
    p_started_at:          new Date(subscription.start_date * 1000).toISOString(),
    p_current_period_end:  new Date(subscription.current_period_end * 1000).toISOString(),
    p_canceled_at:         canceledAt,
    p_event_id:            event.id,
    p_event_timestamp_ms:  event.created * 1000,
  });

  console.log("stripe_webhook_update_processed", {
    event_id: event.id,
    user_id: userId,
    status,
    action: result.action,
    new_profile_tier: result.profile_tier,
  });
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  event: Stripe.Event,
) {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;

  // For terminal deletion we still need a tier (subscriptions.tier is NOT NULL
  // — historical record). Try to resolve; fall back to a sentinel if needed.
  const tier = priceId ? resolveTierFromProduct(priceId) : null;
  if (!tier) {
    throw new Error(
      `Cannot resolve tier on subscription deletion (event_id=${event.id}, price=${priceId})`,
    );
  }

  const userId = await findUserByStripeCustomer(supabase, customerId);
  if (!userId) {
    throw new Error(
      `No user for stripe_customer_id=${customerId} on subscription deletion (event_id=${event.id})`,
    );
  }

  const result = await callUpsert(supabase, {
    p_user_id:             userId,
    p_source:              "stripe" as SubscriptionSource,
    p_tier:                tier,
    p_status:              "expired",
    p_product_id:          priceId!,
    p_external_id:         subscription.id,
    p_stripe_customer_id:  customerId,
    p_started_at:          new Date(subscription.start_date * 1000).toISOString(),
    p_current_period_end:  new Date(subscription.current_period_end * 1000).toISOString(),
    p_canceled_at:         subscription.canceled_at
                             ? new Date(subscription.canceled_at * 1000).toISOString()
                             : new Date(event.created * 1000).toISOString(),
    p_event_id:            event.id,
    p_event_timestamp_ms:  event.created * 1000,
  });

  console.log("stripe_webhook_delete_processed", {
    event_id: event.id,
    user_id: userId,
    action: result.action,
    new_profile_tier: result.profile_tier,
  });
}

// =============================================================================
// User creation (idempotent)
// =============================================================================

/**
 * Ensure an auth user exists for the given email. If one doesn't, invite via
 * Supabase admin API. Returns the user.id either way.
 *
 * On invite failure: logs structured error and throws — caller returns 500
 * so Stripe retries. We do NOT swallow invite failures (they were silent for
 * weeks before the Drew incident on 2026-04-28).
 */
async function ensureUserExists(
  supabase: ReturnType<typeof createClient>,
  email: string,
  stripeCustomerId: string,
  tier: Tier,
  eventId: string,
): Promise<string> {
  const { data: existing, error: lookupErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (lookupErr) {
    throw new Error(`profiles lookup failed for email=${email}: ${lookupErr.message}`);
  }
  if (existing?.id) {
    return existing.id;
  }

  // Need to invite. This calls auth.admin which depends on GoTrue's admin
  // path being healthy (broke earlier this session via Drew's NULL row).
  const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
    email,
    {
      data: { stripe_customer_id: stripeCustomerId, tier },
      redirectTo: "https://quotecat.ai/callback.html",
    },
  );

  if (inviteErr || !inviteData?.user) {
    console.error("stripe_webhook_invite_failed", {
      event_id: eventId,
      email,
      error: inviteErr?.message ?? "no user returned",
    });
    throw new Error(
      `inviteUserByEmail failed for ${email}: ${inviteErr?.message ?? "no user returned"}`,
    );
  }

  // The `on_auth_user_created` trigger (handle_new_user) has already inserted
  // a profiles row with id + email and tier='free' (the column default).
  // We UPSERT just to set stripe_customer_id for Phase 1 dual-write
  // compatibility with delete-account (which reads profiles.stripe_customer_id).
  // We deliberately do NOT set `tier` here — the upsert_subscription_event
  // RPC will compute and write it after the subscription row is written.
  // That ordering ensures profiles.tier is never set without a backing
  // subscription row (no phantom paid users if the webhook errors mid-flight).
  const { error: upsertErr } = await supabase.from("profiles").upsert(
    {
      id: inviteData.user.id,
      email,
      stripe_customer_id: stripeCustomerId, // Phase 1 dual-write; cleanup in FOLLOWUPS.md
    },
    { onConflict: "id" },
  );
  if (upsertErr) {
    // The invite + trigger created auth + profiles rows already; setting the
    // Stripe customer ID failed. Log loudly — delete-account in Phase 1 won't
    // be able to find this customer to cancel their subscription.
    console.error("stripe_webhook_profile_upsert_failed", {
      event_id: eventId,
      user_id: inviteData.user.id,
      email,
      error: upsertErr.message,
    });
    throw new Error(`profiles upsert failed for new user: ${upsertErr.message}`);
  }

  console.log("stripe_webhook_user_invited", {
    event_id: eventId,
    user_id: inviteData.user.id,
    email,
  });

  return inviteData.user.id;
}

async function findUserByStripeCustomer(
  supabase: ReturnType<typeof createClient>,
  stripeCustomerId: string,
): Promise<string | null> {
  // Prefer the new subscriptions table (post-rollout source of truth).
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("source", "stripe")
    .eq("stripe_customer_id", stripeCustomerId)
    .limit(1)
    .maybeSingle();

  if (sub?.user_id) return sub.user_id;

  // Fall back to profiles for transitional safety. profiles.stripe_customer_id
  // is still dual-written during Phase 1; remove this branch in Phase 2.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  return profile?.id ?? null;
}

// =============================================================================
// Status mapping
// =============================================================================

function mapStripeStatus(sub: Stripe.Subscription): "active" | "canceled" | "expired" {
  // Stripe statuses we care about:
  //   active, trialing                -> active
  //   active + cancel_at_period_end   -> active (canceled_at set separately)
  //   past_due, unpaid, paused        -> active (per-decision, FOLLOWUPS for grace UX)
  //   incomplete                      -> active (initial setup)
  //   canceled, incomplete_expired    -> expired (terminal)
  switch (sub.status) {
    case "active":
    case "trialing":
    case "past_due":
    case "unpaid":
    case "paused":
    case "incomplete":
      return "active";
    case "canceled":
    case "incomplete_expired":
      return "expired";
    default:
      return "active";
  }
}

// =============================================================================
// RPC wrapper (mirrors revenuecat-webhook for consistency)
// =============================================================================

interface UpsertParams {
  p_user_id:            string;
  p_source:             SubscriptionSource;
  p_tier:               Tier;
  p_status:             "active" | "canceled" | "expired";
  p_product_id:         string;
  p_external_id:        string;
  p_stripe_customer_id: string | null;
  p_started_at:         string;
  p_current_period_end: string;
  p_canceled_at:        string | null;
  p_event_id:           string;
  p_event_timestamp_ms: number;
}

interface UpsertResult {
  action: "inserted" | "updated" | "skipped_duplicate" | "skipped_out_of_order";
  subscription_id: string | null;
  profile_tier: string | null;
}

async function callUpsert(
  supabase: ReturnType<typeof createClient>,
  params: UpsertParams,
): Promise<UpsertResult> {
  const { data, error } = await supabase.rpc("upsert_subscription_event", params);
  if (error) {
    throw new Error(`upsert_subscription_event failed: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row as UpsertResult;
}

// =============================================================================
// Welcome email (preserved verbatim from previous version)
// =============================================================================

async function sendWelcomeEmail(email: string, tier: Tier): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured, skipping welcome email");
    return;
  }

  const tierName = tier === "premium" ? "Premium" : "Pro";

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #111111; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111111; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1a1a1a; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto 16px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 12px; padding: 0 16px 0 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td><img src="https://quotecat.ai/qc-splash.png" alt="QuoteCat" width="50" height="50" style="display: block;"></td>
                        <td style="color: #ffffff; font-size: 22px; font-weight: 700; padding-left: 4px;">QuoteCat</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">Welcome to ${tierName}!</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; color: #ffffff; font-size: 16px; line-height: 1.6;">
                Thank you for subscribing! You now have access to all ${tierName} features.
              </p>

              <!-- Pricing Guide Section -->
              <div style="background-color: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h2 style="margin: 0 0 12px; color: #f97316; font-size: 18px; font-weight: 700;">Your Free Bonus: The Contractor Pricing Guide</h2>
                <p style="margin: 0 0 16px; color: #d1d5db; font-size: 14px; line-height: 1.5;">
                  As a thank you for subscribing, here's your free copy of The Contractor Pricing Guide — a $29 value.
                </p>
                <a href="https://quotecat.ai/downloads/The-Contractor-Pricing-Guide.pdf" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #000000; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 14px;">
                  Download Your Guide (PDF)
                </a>
              </div>

              <p style="margin: 0 0 12px; color: #9ca3af; font-size: 14px; font-weight: 600;">This guide covers:</p>
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #d1d5db; font-size: 14px; line-height: 1.8;">
                <li>How to calculate your true overhead</li>
                <li>Markup vs margin (and why it matters)</li>
                <li>The Good/Better/Best pricing strategy</li>
                <li>Scripts for handling price objections</li>
              </ul>

              <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                Questions? Just reply to this email — we're here to help.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                © 2026 QuoteCat. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "QuoteCat <hello@quotecat.ai>",
      to: [email],
      subject: `Welcome to QuoteCat ${tierName} + Your Free Pricing Guide`,
      html: emailHtml,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error: ${errorText}`);
  }
  const result = await response.json();
  console.log("stripe_webhook_welcome_email_sent", { email, resend_id: result.id });
}

// =============================================================================
// Helpers
// =============================================================================

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
