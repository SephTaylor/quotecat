// supabase/functions/revenuecat-webhook/index.ts
// Handles RevenueCat webhook events to sync subscription status with Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// RevenueCat webhook authorization header (set in RevenueCat dashboard)
const REVENUECAT_WEBHOOK_AUTH = Deno.env.get("REVENUECAT_WEBHOOK_AUTH") || "";

// Map RevenueCat entitlement IDs to tiers
const ENTITLEMENT_TO_TIER: Record<string, "pro" | "premium"> = {
  "pro": "pro",
  "premium": "premium",
};

// RevenueCat event types we care about
type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "SUBSCRIBER_ALIAS";

interface RevenueCatEvent {
  event: {
    type: RevenueCatEventType;
    app_user_id: string; // This is the Supabase user ID we pass to RevenueCat
    original_app_user_id: string;
    product_id: string;
    entitlement_ids: string[];
    period_type: "NORMAL" | "TRIAL" | "INTRO";
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    store: "APP_STORE" | "PLAY_STORE" | "STRIPE" | "PROMOTIONAL";
    environment: "SANDBOX" | "PRODUCTION";
    is_family_share: boolean;
    subscriber_attributes?: Record<string, { value: string }>;
  };
  api_version: string;
}

serve(async (req) => {
  // Verify authorization header
  const authHeader = req.headers.get("Authorization");
  if (REVENUECAT_WEBHOOK_AUTH && authHeader !== `Bearer ${REVENUECAT_WEBHOOK_AUTH}`) {
    console.error("Invalid authorization header");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload: RevenueCatEvent = await req.json();
    const event = payload.event;

    console.log(`Received RevenueCat event: ${event.type} for user: ${event.app_user_id}`);
    console.log(`Environment: ${event.environment}, Store: ${event.store}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the Supabase user ID (we set this when calling Purchases.logIn())
    const userId = event.app_user_id;

    // Skip anonymous IDs (start with $RCAnonymousID:)
    if (userId.startsWith("$RCAnonymousID:")) {
      console.log("Skipping anonymous user event");
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
        await handlePurchase(supabase, userId, event.entitlement_ids);
        break;

      case "PRODUCT_CHANGE":
        // User upgraded or downgraded
        await handlePurchase(supabase, userId, event.entitlement_ids);
        break;

      case "CANCELLATION":
        // User cancelled but may still have access until expiration
        console.log(`User ${userId} cancelled subscription, will expire at ${event.expiration_at_ms}`);
        break;

      case "EXPIRATION":
        // Subscription expired - downgrade to free
        await handleExpiration(supabase, userId);
        break;

      case "BILLING_ISSUE":
        // Payment failed - could notify user or downgrade
        console.log(`Billing issue for user ${userId}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 400 }
    );
  }
});

/**
 * Handle purchase/renewal - update user tier based on entitlements
 */
async function handlePurchase(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  entitlementIds: string[]
) {
  // Determine the highest tier from entitlements
  let tier: "free" | "pro" | "premium" = "free";

  for (const entitlementId of entitlementIds) {
    const mappedTier = ENTITLEMENT_TO_TIER[entitlementId];
    if (mappedTier === "premium") {
      tier = "premium";
      break; // Premium is highest, no need to check more
    } else if (mappedTier === "pro" && tier !== "premium") {
      tier = "pro";
    }
  }

  console.log(`Setting user ${userId} to tier: ${tier} (entitlements: ${entitlementIds.join(", ")})`);

  const { error } = await supabase
    .from("profiles")
    .update({
      tier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("Error updating profile:", error);
    throw error;
  }

  console.log(`Successfully updated user ${userId} to tier: ${tier}`);
}

/**
 * Handle subscription expiration - downgrade to free tier
 */
async function handleExpiration(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  console.log(`Subscription expired for user ${userId}, downgrading to free`);

  const { error } = await supabase
    .from("profiles")
    .update({
      tier: "free",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("Error downgrading user:", error);
    throw error;
  }

  console.log(`Successfully downgraded user ${userId} to free tier`);
}
