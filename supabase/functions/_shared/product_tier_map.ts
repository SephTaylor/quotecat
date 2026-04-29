// supabase/functions/_shared/product_tier_map.ts
//
// Single source of truth for product → tier and entitlement → tier mappings.
// Imported by `revenuecat-webhook` and `stripe-webhook` so both share the
// same canonical reference. Must match `docs/ENTITLEMENT_AUDIT.md` byte-for-byte.
//
// When you add a new product or price ID anywhere (App Store, Play Store,
// Stripe), update this file in the same change as the audit doc, and re-deploy
// both webhook functions.

// =============================================================================
// Types
// =============================================================================

export type Tier = "pro" | "premium";

export type SubscriptionSource = "app_store" | "play_store" | "stripe";

// =============================================================================
// Entitlement → tier (RevenueCat dashboard)
// =============================================================================
// What entitlements RC dashboard grants and how we map them to our tiers.
// Verified clean in audit (2026-04-28): each iOS/Android product grants
// exactly one of these entitlements.
export const ENTITLEMENT_TO_TIER: Record<string, Tier> = {
  pro: "pro",
  premium: "premium",
};

// =============================================================================
// Product / price → intended tier (defensive cross-check)
// =============================================================================
// Used as a defensive cross-check in webhook handlers. If a webhook event
// arrives where the entitlement-based tier and the product-based tier
// disagree, the webhook logs an ENTITLEMENT_DRIFT warning and uses the
// entitlement value as authoritative (since the RC dashboard is the cleaned
// source of truth as of 2026-04-28).
//
// IAP product IDs are the same string for iOS and Android — Apple uses the
// productID, Google uses the product_id portion of `productId:basePlanId`.
// Both webhooks receive just the product_id portion in their event payloads.
//
// Stripe price IDs include both founder and regular pricing; both should
// resolve to the same tier (founder pricing is just a discount on the same tier).
export const PRODUCT_TIER_MAP: Record<string, Tier> = {
  // -------- IAP (App Store + Play Store share these product IDs) --------
  "ai.quotecat.app.pro.monthly":     "pro",
  "ai.quotecat.app.pro.yearly":      "pro",
  "ai.quotecat.app.premium.monthly": "premium",
  "ai.quotecat.app.premium.yearly":  "premium",

  // -------- Stripe — Founder pricing (limited-quantity discount tier) --------
  "price_1T1uXbCz2LFZfwAIva1Pfr7y": "pro",     // Founder Pro Monthly $29
  "price_1T1uYyCz2LFZfwAIPyDQTA28": "pro",     // Founder Pro Yearly $290
  "price_1T1uYzCz2LFZfwAIgnNYeAi4": "premium", // Founder Premium Monthly $79
  "price_1T1uYzCz2LFZfwAIWloEKf1W": "premium", // Founder Premium Yearly $790

  // -------- Stripe — Regular pricing --------
  "price_1T1uZ0Cz2LFZfwAI552310fx": "pro",     // Pro Monthly $39
  "price_1T1uZ0Cz2LFZfwAInEPGan4F": "pro",     // Pro Yearly $372
  "price_1T1uZ1Cz2LFZfwAIQ94BNZ02": "premium", // Premium Monthly $99
  "price_1T1uZ1Cz2LFZfwAIuqAtNru0": "premium", // Premium Yearly $948
};

// =============================================================================
// Resolution helpers
// =============================================================================

/**
 * Pick the highest tier from a list of RC entitlement IDs.
 * Premium beats Pro. Returns null if no entitlement matches.
 */
export function resolveTierFromEntitlements(
  entitlement_ids: readonly string[],
): Tier | null {
  let result: Tier | null = null;
  for (const eid of entitlement_ids) {
    const t = ENTITLEMENT_TO_TIER[eid];
    if (t === "premium") return "premium"; // highest possible, short-circuit
    if (t === "pro" && result !== "premium") result = "pro";
  }
  return result;
}

/**
 * Look up tier by product_id (IAP) or price_id (Stripe). Returns null if
 * the ID is not in PRODUCT_TIER_MAP — caller is responsible for handling
 * that case (typically by logging ENTITLEMENT_DRIFT and using the
 * entitlement-based tier).
 *
 * Normalization: Google Play webhook events arrive with product_id in the
 * form `<product_id>:<base_plan_id>` (e.g. `ai.quotecat.app.pro.monthly:pro-monthly-base`).
 * iOS sends the bare form; Stripe price IDs don't have colons. We strip
 * everything from the first colon onward before lookup, which is a no-op
 * for iOS and Stripe and handles Play Store correctly.
 */
export function resolveTierFromProduct(product_id: string): Tier | null {
  const normalized = product_id.split(":")[0];
  return PRODUCT_TIER_MAP[normalized] ?? null;
}

/**
 * Drift metadata returned alongside the resolved tier so callers can decide
 * whether to log ENTITLEMENT_DRIFT (the shared module stays pure — logging
 * happens in the webhook).
 */
export interface TierDrift {
  hasDrift: boolean;
  productTier: Tier | null;
  entitlementTier: Tier | null;
  reason: "unknown_product" | "mismatch" | "unknown_entitlement" | null;
}

export interface TierResolution {
  /**
   * The tier we should write to the database. This is the entitlement-based
   * tier when one is resolvable, otherwise the product-based tier as a
   * fallback. May still be null if neither resolves — caller must handle.
   */
  tier: Tier | null;
  drift: TierDrift;
}

/**
 * Combined resolution with drift detection.
 *
 * Behavior:
 *   - If entitlement and product both resolve and agree → tier = either, no drift.
 *   - If entitlement resolves but product doesn't → tier = entitlement, drift=unknown_product.
 *   - If product resolves but entitlement doesn't → tier = product (fallback), drift=unknown_entitlement.
 *   - If both resolve but disagree → tier = entitlement (authoritative), drift=mismatch.
 *   - If neither resolves → tier = null, drift=unknown_product.
 */
export function resolveTier(args: {
  entitlement_ids: readonly string[];
  product_id: string;
}): TierResolution {
  const entitlementTier = resolveTierFromEntitlements(args.entitlement_ids);
  const productTier = resolveTierFromProduct(args.product_id);

  let tier: Tier | null;
  let hasDrift = false;
  let reason: TierDrift["reason"] = null;

  if (entitlementTier !== null && productTier !== null) {
    tier = entitlementTier; // entitlement authoritative
    if (entitlementTier !== productTier) {
      hasDrift = true;
      reason = "mismatch";
    }
  } else if (entitlementTier !== null && productTier === null) {
    tier = entitlementTier;
    hasDrift = true;
    reason = "unknown_product";
  } else if (entitlementTier === null && productTier !== null) {
    tier = productTier; // fallback
    hasDrift = true;
    reason = "unknown_entitlement";
  } else {
    tier = null;
    hasDrift = true;
    reason = "unknown_product";
  }

  return {
    tier,
    drift: { hasDrift, productTier, entitlementTier, reason },
  };
}

// =============================================================================
// Source mapping
// =============================================================================

/**
 * Map a RevenueCat `event.store` value to our `subscription_source` enum.
 *
 * Throws on `PROMOTIONAL` (we no longer accept that path — comp users redeem
 * codes through the real platforms; see `docs/COMP_CODES.md`) and on any
 * unrecognized store.
 */
export function mapStoreToSource(store: string): SubscriptionSource {
  switch (store) {
    case "APP_STORE":   return "app_store";
    case "PLAY_STORE":  return "play_store";
    case "STRIPE":      return "stripe";
    case "PROMOTIONAL":
      throw new Error(
        "RC PROMOTIONAL store events are not accepted. Comp users redeem " +
        "codes through real platforms (Apple offer codes, Google Play promo " +
        "codes, Stripe coupons). See docs/COMP_CODES.md."
      );
    default:
      throw new Error(`Unknown RC store value: ${store}`);
  }
}
