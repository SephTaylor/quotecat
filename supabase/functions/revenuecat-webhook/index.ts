// supabase/functions/revenuecat-webhook/index.new.ts
//
// NEW VERSION — sibling file for diff before swap. After the diff is approved,
// this file replaces `index.ts`.
//
// Handles RevenueCat webhook events for App Store and Play Store IAP. Writes
// to the `subscriptions` table and syncs `profiles.tier` atomically via the
// `upsert_subscription_event` Postgres function (see migration 025).
//
// SANDBOX vs PRODUCTION:
//   RC sends `event.environment = "SANDBOX" | "PRODUCTION"`. We process BOTH
//   the same way and write to the same database. Rationale: pre-launch
//   verification depends on sandbox purchases reaching the database so we can
//   validate end-to-end. The environment is logged on every event for
//   visibility. If we ever need to filter sandbox out of production data,
//   this is the place to add the gate.
//
// ENTITLEMENT_DRIFT:
//   The shared `resolveTier` helper returns the entitlement-based tier
//   (authoritative after the 2026-04-28 RC dashboard cleanup) plus drift
//   metadata. This webhook logs `entitlement_drift` if the entitlement and
//   the product_id disagree, but uses the entitlement value as the tier.
//
// IDEMPOTENCY:
//   Handled inside the RPC. We pass `event.id` and `event.event_timestamp_ms`;
//   the function skips duplicates and out-of-order events.
//
// REFERENCES:
//   - docs/ENTITLEMENT_AUDIT.md — canonical product/entitlement map
//   - docs/COMP_CODES.md — comp-code workflow (replaces manual VIP grants)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveTier,
  mapStoreToSource,
  type Tier,
  type SubscriptionSource,
} from "../_shared/product_tier_map.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const REVENUECAT_WEBHOOK_AUTH = Deno.env.get("REVENUECAT_WEBHOOK_AUTH") || "";

// =============================================================================
// Event payload type
// =============================================================================

type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "SUBSCRIBER_ALIAS"
  | "NON_RENEWING_PURCHASE";

interface RevenueCatEvent {
  api_version: string;
  event: {
    // Identity
    id: string;                       // unique per event — idempotency key
    type: RevenueCatEventType;
    app_user_id: string;              // Supabase user.id (set via Purchases.logIn)
    original_app_user_id: string;
    aliases?: string[];

    // Transaction identity
    transaction_id?: string;
    original_transaction_id?: string; // stable across renewals — our external_id

    // Product / entitlement
    product_id: string;
    entitlement_ids: string[];
    period_type: "NORMAL" | "TRIAL" | "INTRO";

    // Timing
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    event_timestamp_ms: number;       // out-of-order key

    // Source
    store: "APP_STORE" | "PLAY_STORE" | "STRIPE" | "PROMOTIONAL";
    environment: "SANDBOX" | "PRODUCTION";

    is_family_share?: boolean;
    subscriber_attributes?: Record<string, { value: string }>;
  };
}

// =============================================================================
// Identity resolution
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * When `event.app_user_id` is anonymous, RC includes the merged real identity
 * in `original_app_user_id` and/or the `aliases[]` array. Find the first
 * candidate that looks like a real Supabase user UUID and return it; otherwise
 * return null and the caller acks-and-drops the event.
 */
function resolveAliasedUserId(event: RevenueCatEvent["event"]): string | null {
  const candidates = [
    event.original_app_user_id,
    ...(event.aliases || []),
  ];
  for (const candidate of candidates) {
    if (
      candidate &&
      !candidate.startsWith("$RCAnonymousID:") &&
      UUID_REGEX.test(candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

// =============================================================================
// Server
// =============================================================================

serve(async (req) => {
  // Fail-closed auth check. The RC dashboard webhook config must include
  // `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH>` on every delivery.
  // - Secret not configured server-side → 500 (operator misconfiguration; we
  //   never want to silently accept unauthenticated events)
  // - Header missing or doesn't match → 401
  if (!REVENUECAT_WEBHOOK_AUTH) {
    console.error("rc_webhook_secret_not_configured");
    return new Response("Webhook auth not configured", { status: 500 });
  }
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${REVENUECAT_WEBHOOK_AUTH}`) {
    console.error("rc_webhook_auth_failed", { provided: !!authHeader });
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: RevenueCatEvent;
  try {
    payload = (await req.json()) as RevenueCatEvent;
  } catch (err) {
    console.error("rc_webhook_bad_json", { error: String(err) });
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // Defensive shape check. Without this, an empty/malformed body crashes
  // the function at `event.id` with a generic Deno 500. Real RC events
  // always have these fields; missing them indicates spoofing or test noise.
  const event = payload?.event;
  if (!event || typeof event !== "object" || !event.id || !event.type) {
    console.error("rc_webhook_bad_payload", {
      has_payload: !!payload,
      has_event: !!event,
      has_id: !!event?.id,
      has_type: !!event?.type,
    });
    return jsonResponse({ error: "Invalid payload: missing event fields" }, 400);
  }

  // Always log every event for traceability. Environment + store visible up front.
  console.log("rc_webhook_received", {
    event_id: event.id,
    type: event.type,
    app_user_id: event.app_user_id,
    environment: event.environment,
    store: event.store,
    product_id: event.product_id,
    entitlement_ids: event.entitlement_ids,
  });

  // If RC fires an event under an anonymous ID, fall back to original_app_user_id
  // and aliases to find the real Supabase user. This happens when a purchase
  // completes before RC has been logged in to the real account — the receipt
  // gets attributed to the anonymous user, and even after logIn aliases the two,
  // some events continue firing under the anonymous ID. RC includes the merged
  // identities on the event payload for exactly this case.
  //
  // Previous behavior was to reject anonymous events with 400, which dropped
  // every event for the affected user on the floor. profiles.tier never updated.
  if (event.app_user_id?.startsWith("$RCAnonymousID:")) {
    const resolved = resolveAliasedUserId(event);
    if (resolved) {
      console.log("rc_webhook_resolved_from_alias", {
        event_id: event.id,
        anonymous_id: event.app_user_id,
        resolved_user_id: resolved,
      });
      event.app_user_id = resolved;
    } else {
      // No real user in aliases. RC retrying won't help — there's no identity
      // to attribute this event to. Log and 200 so RC stops retrying.
      console.error("rc_webhook_unresolvable_anonymous_user", {
        event_id: event.id,
        type: event.type,
        product_id: event.product_id,
        original_app_user_id: event.original_app_user_id,
        aliases: event.aliases,
      });
      return jsonResponse({ received: true, note: "anonymous-only event" }, 200);
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "PRODUCT_CHANGE":
        await handleActiveEvent(supabase, event, "active");
        break;

      case "CANCELLATION":
        // User cancelled but still has access until expiration. Set canceled_at,
        // keep status='active' so entitlements continue.
        await handleActiveEvent(supabase, event, "active", true);
        break;

      case "EXPIRATION":
        await handleExpirationEvent(supabase, event);
        break;

      case "BILLING_ISSUE":
        // Apple/Google grace period. We don't currently differentiate access;
        // tier persists until EXPIRATION fires. See FOLLOWUPS.md if we ever
        // need explicit grace-period UX.
        console.log("rc_webhook_billing_issue", {
          event_id: event.id,
          app_user_id: event.app_user_id,
          expiration_at_ms: event.expiration_at_ms,
        });
        break;

      case "SUBSCRIBER_ALIAS":
        // RC merged two subscriber identities (typically anonymous → real after
        // logIn). We don't need to reconcile any rows because purchase events
        // for anonymous IDs are already routed to the real user via
        // resolveAliasedUserId before we write to the subscriptions table — so
        // there's nothing tied to the anonymous side to migrate. Logged for
        // traceability.
        console.log("rc_webhook_subscriber_alias_received", {
          event_id: event.id,
          app_user_id: event.app_user_id,
          original_app_user_id: event.original_app_user_id,
          aliases: event.aliases,
        });
        break;

      case "NON_RENEWING_PURCHASE":
        // We don't sell non-renewing IAP products.
        console.log("rc_webhook_non_renewing_ignored", {
          event_id: event.id,
          product_id: event.product_id,
        });
        break;

      default:
        console.log("rc_webhook_unhandled_type", {
          event_id: event.id,
          type: event.type,
        });
    }

    return jsonResponse({ received: true }, 200);
  } catch (err) {
    // Returning 5xx triggers RC to retry. Log structured for correlation.
    const message = err instanceof Error ? err.message : String(err);
    console.error("rc_webhook_processing_error", {
      event_id: event.id,
      type: event.type,
      app_user_id: event.app_user_id,
      error: message,
    });
    return jsonResponse({ error: message }, 500);
  }
});

// =============================================================================
// Handlers
// =============================================================================

async function handleActiveEvent(
  supabase: ReturnType<typeof createClient>,
  event: RevenueCatEvent["event"],
  status: "active",
  isCancellation = false,
) {
  if (await isOrphanUser(supabase, event.app_user_id)) {
    logOrphanEvent(event);
    return; // ack with 200 (caller); the orphan log is the audit trail
  }

  const tier = resolveTierWithDriftLogging(event);
  if (!tier) {
    throw new Error(
      `Unresolvable tier for product=${event.product_id}, ` +
      `entitlements=${event.entitlement_ids.join(",")}`,
    );
  }

  if (!event.original_transaction_id) {
    throw new Error(
      `Missing original_transaction_id on RC event id=${event.id} type=${event.type}`,
    );
  }
  if (!event.expiration_at_ms) {
    throw new Error(
      `Missing expiration_at_ms on RC event id=${event.id} type=${event.type}`,
    );
  }

  const source = mapStoreToSource(event.store); // throws on PROMOTIONAL

  const result = await callUpsert(supabase, {
    p_user_id:             event.app_user_id,
    p_source:              source,
    p_tier:                tier,
    p_status:              status,
    p_product_id:          event.product_id,
    p_external_id:         event.original_transaction_id,
    p_stripe_customer_id:  null,
    p_started_at:          new Date(event.purchased_at_ms).toISOString(),
    p_current_period_end:  new Date(event.expiration_at_ms).toISOString(),
    p_canceled_at:         isCancellation
                             ? new Date(event.event_timestamp_ms).toISOString()
                             : null,
    p_event_id:            event.id,
    p_event_timestamp_ms:  event.event_timestamp_ms,
  });

  console.log("rc_webhook_processed", {
    event_id: event.id,
    type: event.type,
    app_user_id: event.app_user_id,
    action: result.action,
    subscription_id: result.subscription_id,
    new_profile_tier: result.profile_tier,
  });
}

async function handleExpirationEvent(
  supabase: ReturnType<typeof createClient>,
  event: RevenueCatEvent["event"],
) {
  if (await isOrphanUser(supabase, event.app_user_id)) {
    logOrphanEvent(event);
    return;
  }

  // EXPIRATION events still come with a tier (the tier the subscription HAD).
  // We need it because subscriptions.tier is NOT NULL — it's a historical record.
  const tier = resolveTierWithDriftLogging(event);
  if (!tier) {
    throw new Error(
      `EXPIRATION event with unresolvable tier: product=${event.product_id}`,
    );
  }
  if (!event.original_transaction_id || !event.expiration_at_ms) {
    throw new Error(
      `Missing original_transaction_id or expiration_at_ms on EXPIRATION event id=${event.id}`,
    );
  }

  const source = mapStoreToSource(event.store);

  const result = await callUpsert(supabase, {
    p_user_id:             event.app_user_id,
    p_source:              source,
    p_tier:                tier,
    p_status:              "expired",
    p_product_id:          event.product_id,
    p_external_id:         event.original_transaction_id,
    p_stripe_customer_id:  null,
    p_started_at:          new Date(event.purchased_at_ms).toISOString(),
    p_current_period_end:  new Date(event.expiration_at_ms).toISOString(),
    p_canceled_at:         null,
    p_event_id:            event.id,
    p_event_timestamp_ms:  event.event_timestamp_ms,
  });

  console.log("rc_webhook_expiration_processed", {
    event_id: event.id,
    app_user_id: event.app_user_id,
    action: result.action,
    new_profile_tier: result.profile_tier,
  });
}

// =============================================================================
// Orphan-user grace handling
// =============================================================================
//
// RC retains subscribers indefinitely; our auth.users may delete users (account
// deletion, dev cleanup, migration churn). Real RC events still arrive for
// app_user_ids that no longer exist in our database. The OLD webhook silently
// no-op'd these (UPDATE WHERE id=missing affects 0 rows); the new code's
// upsert RPC would FK-violate and 500, causing RC to retry forever.
//
// Behavior: if the app_user_id has no matching profiles row, we acknowledge
// with 200 and emit a structured rc_webhook_orphan_user log. Logs are the
// audit trail — see FOLLOWUPS.md re: alerting on this signal post-launch.

async function isOrphanUser(
  supabase: ReturnType<typeof createClient>,
  app_user_id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", app_user_id)
    .maybeSingle();
  if (error) {
    // Lookup failure is NOT the same as orphan. Surface as processing error
    // so RC retries. Returning false here would risk processing a row whose
    // user we can't confirm exists.
    throw new Error(`profiles lookup failed for ${app_user_id}: ${error.message}`);
  }
  return !data;
}

function logOrphanEvent(event: RevenueCatEvent["event"]): void {
  console.warn("rc_webhook_orphan_user", {
    event_id: event.id,
    app_user_id: event.app_user_id,
    original_app_user_id: event.original_app_user_id,
    product_id: event.product_id,
    type: event.type,
    store: event.store,
    environment: event.environment,
  });
}

// =============================================================================
// Tier resolution + drift logging
// =============================================================================

function resolveTierWithDriftLogging(event: RevenueCatEvent["event"]): Tier | null {
  const { tier, drift } = resolveTier({
    entitlement_ids: event.entitlement_ids,
    product_id: event.product_id,
  });

  if (drift.hasDrift) {
    const level = drift.reason === "mismatch" ? "error" : "warn";
    const msg = {
      event_id: event.id,
      product_id: event.product_id,
      entitlement_ids: event.entitlement_ids,
      tier_from_entitlement: drift.entitlementTier,
      tier_from_product: drift.productTier,
      reason: drift.reason,
      decision: tier,
    };
    if (level === "error") {
      console.error("entitlement_drift", msg);
    } else {
      console.warn("entitlement_drift", msg);
    }
  }

  return tier;
}

// =============================================================================
// RPC wrapper
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
// Helpers
// =============================================================================

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
