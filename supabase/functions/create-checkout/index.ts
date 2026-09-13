// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout session for subscriptions and one-time purchases

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Premium price IDs get a free trial; Pro deliberately does not.
//
// This mirrors the stores exactly. On the App Store all four products share one
// subscription group and Apple grants ONE introductory offer per customer for
// life, so spending it on Pro would make Premium untrialable forever. The web
// path has no such constraint, but the offer must match what the app promises
// or the same visitor sees two different deals.
const PREMIUM_PRICE_IDS = new Set([
  "price_1T1uYzCz2LFZfwAIgnNYeAi4", // Founder Premium Monthly - $79/mo
  "price_1T1uYzCz2LFZfwAIWloEKf1W", // Founder Premium Yearly  - $790/yr
  "price_1T1uZ1Cz2LFZfwAIQ94BNZ02", // Premium Monthly         - $99/mo
  "price_1T1uZ1Cz2LFZfwAIuqAtNru0", // Premium Yearly          - $948/yr
]);

const TRIAL_DAYS = 30;

// One-time purchase products (mode: "payment")
const ONE_TIME_PRODUCTS: Record<string, { successUrl: string }> = {
  // Pricing Guide - $29
  "price_1TAbNKCz2LFZfwAIUmDthbeb": {
    successUrl: "https://quotecat.ai/resources/pricing-guide-thanks"
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { priceId, email } = await req.json();

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "Price ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is a one-time purchase
    const isOneTime = priceId in ONE_TIME_PRODUCTS;

    // Validate price ID is one of our known prices (LIVE MODE)
    const validSubscriptionPriceIds = [
      // === FOUNDER PRICES (limited: 100 Pro, 50 Premium) ===
      "price_1T1uXbCz2LFZfwAIva1Pfr7y", // Founder Pro Monthly - $29/mo
      "price_1T1uYyCz2LFZfwAIPyDQTA28", // Founder Pro Yearly - $290/yr
      "price_1T1uYzCz2LFZfwAIgnNYeAi4", // Founder Premium Monthly - $79/mo
      "price_1T1uYzCz2LFZfwAIWloEKf1W", // Founder Premium Yearly - $790/yr

      // === REGULAR PRICES ===
      "price_1T1uZ0Cz2LFZfwAI552310fx", // Pro Monthly - $39/mo
      "price_1T1uZ0Cz2LFZfwAInEPGan4F", // Pro Yearly - $372/yr
      "price_1T1uZ1Cz2LFZfwAIQ94BNZ02", // Premium Monthly - $99/mo
      "price_1T1uZ1Cz2LFZfwAIuqAtNru0", // Premium Yearly - $948/yr
    ];

    const validPriceIds = [...validSubscriptionPriceIds, ...Object.keys(ONE_TIME_PRODUCTS)];

    if (!validPriceIds.includes(priceId)) {
      return new Response(
        JSON.stringify({ error: "Invalid price ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    let customerId: string | undefined;
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    }

    // Decide whether this checkout gets the free month.
    //
    // Stripe, unlike Apple, will happily hand the same person a trial every time
    // they resubscribe. Apple allows one introductory offer per customer for
    // life, so without this check a web customer could cancel and re-trial
    // indefinitely while an App Store customer gets exactly one. Anyone who has
    // ever had a subscription with us is charged immediately.
    let grantTrial = !isOneTime && PREMIUM_PRICE_IDS.has(priceId);
    if (grantTrial && customerId) {
      try {
        const priorSubs = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 1,
        });
        if (priorSubs.data.length > 0) {
          grantTrial = false;
        }
      } catch (e) {
        // If we cannot confirm they are new, do not give away a free month.
        console.error("Prior-subscription check failed, withholding trial:", e);
        grantTrial = false;
      }
    }

    // Create checkout session - different config for subscriptions vs one-time
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: isOneTime ? "payment" : "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      customer_email: customerId ? undefined : email,
      currency: "usd",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: isOneTime
        ? ONE_TIME_PRODUCTS[priceId].successUrl + "?session_id={CHECKOUT_SESSION_ID}"
        : "https://quotecat.ai/payment-success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: isOneTime
        ? "https://quotecat.ai/resources/pricing-guide"
        : "https://quotecat.ai/#pricing",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        email: email,
        product_type: isOneTime ? "one_time" : "subscription",
        trial_granted: grantTrial ? "true" : "false",
      },
    };

    if (grantTrial) {
      sessionConfig.subscription_data = {
        trial_period_days: TRIAL_DAYS,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to create checkout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
