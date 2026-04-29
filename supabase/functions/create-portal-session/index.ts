// supabase/functions/create-portal-session/index.ts
//
// Backs the "Manage Account" button in the mobile app. Routes the user to the
// correct subscription-management surface based on where they originally paid:
//   - source='stripe'       → Stripe billing portal (we control)
//   - source='app_store'    → Apple's subscription management page
//   - source='play_store'   → Play Store's subscription management page
//   - no active subscription → 404 (mobile shows a friendly "no subscription" alert)
//
// AUTH:
//   Requires user JWT in the Authorization header. Replaces the previous
//   anon-key + email-in-body shape (which had a security hole — anyone with
//   the public anon key could request a portal session for any email that
//   existed in Stripe). The mobile client passes the active session token via
//   `supabase.auth.getSession().data.session.access_token`.
//
// REFERENCES:
//   - docs/ENTITLEMENT_AUDIT.md — payment-source map
//   - supabase/functions/_shared/product_tier_map.ts — runtime mapping (re-used
//     here to normalize the Play Store product_id when building the deep link)
//   - hooks/useSettingsState.ts — mobile caller

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

// Where the Stripe billing portal redirects users back to after they're done.
// quotecat.ai is the marketing site, where they can also see their account.
const STRIPE_PORTAL_RETURN_URL = "https://quotecat.ai/account";

// IAP store deep links. Use https form (not itms-apps://) per Apple's recommendation.
const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";
// Play Store accepts the bare product_id (without :base_plan_id suffix) in the sku param.
const PLAY_STORE_PACKAGE = "ai.quotecat.app";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =============================================================================
// Server
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // -------- 1. Authenticate the caller via JWT --------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization header" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    console.error("portal_auth_failed", { error: userErr?.message ?? "no user" });
    return jsonResponse({ error: "Invalid or expired session" }, 401);
  }

  // -------- 2. Look up active subscription --------
  // Use the service-role client to bypass RLS for the lookup. The user has
  // already been authenticated above; we use their user.id for the filter.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: subscription, error: subErr } = await adminClient
    .from("subscriptions")
    .select("source, product_id, stripe_customer_id, current_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr) {
    console.error("portal_subscription_lookup_failed", {
      user_id: user.id,
      error: subErr.message,
    });
    return jsonResponse({ error: "Failed to look up subscription" }, 500);
  }

  if (!subscription) {
    return jsonResponse(
      { error: "No active subscription found for this account" },
      404,
    );
  }

  // -------- 3. Route based on source --------
  try {
    switch (subscription.source) {
      case "stripe":
        return await handleStripe(subscription, user.id);

      case "app_store":
        console.log("portal_route_app_store", { user_id: user.id });
        return jsonResponse({ url: APPLE_SUBSCRIPTIONS_URL, provider: "app_store" }, 200);

      case "play_store": {
        const url = buildPlayStoreUrl(subscription.product_id);
        console.log("portal_route_play_store", { user_id: user.id, url });
        return jsonResponse({ url, provider: "play_store" }, 200);
      }

      default:
        // Unreachable given the subscription_source enum, but defensive.
        console.error("portal_unknown_source", {
          user_id: user.id,
          source: subscription.source,
        });
        return jsonResponse({ error: "Unknown subscription source" }, 500);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("portal_route_error", {
      user_id: user.id,
      source: subscription.source,
      error: message,
    });
    return jsonResponse({ error: message }, 500);
  }
});

// =============================================================================
// Stripe routing
// =============================================================================

async function handleStripe(
  subscription: {
    source: string;
    product_id: string;
    stripe_customer_id: string | null;
    current_period_end: string;
  },
  userId: string,
): Promise<Response> {
  if (!subscription.stripe_customer_id) {
    // Should never happen — webhook always populates stripe_customer_id when
    // source='stripe'. If it does happen, surface loudly.
    console.error("portal_stripe_no_customer_id", {
      user_id: userId,
      product_id: subscription.product_id,
    });
    return jsonResponse(
      { error: "Stripe subscription is missing customer ID — please contact support" },
      500,
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: STRIPE_PORTAL_RETURN_URL,
  });

  console.log("portal_route_stripe", {
    user_id: userId,
    stripe_customer_id: subscription.stripe_customer_id,
    portal_session_id: session.id,
  });

  return jsonResponse({ url: session.url, provider: "stripe" }, 200);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build the Play Store subscription deep link. The product_id we store may be
 * the colon form (`ai.quotecat.app.pro.monthly:pro-monthly-base`); we strip
 * the base-plan suffix because Play Store's URL expects the bare product_id.
 */
function buildPlayStoreUrl(product_id: string): string {
  const sku = product_id.split(":")[0];
  const params = new URLSearchParams({
    package: PLAY_STORE_PACKAGE,
    sku,
  });
  return `https://play.google.com/store/account/subscriptions?${params.toString()}`;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
