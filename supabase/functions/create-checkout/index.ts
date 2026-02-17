// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout session for Pro/Premium subscriptions

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

    // Validate price ID is one of our known prices (LIVE MODE)
    const validPriceIds = [
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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      customer_email: customerId ? undefined : email,
      currency: "usd", // Force USD only, no local currency conversion
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: "https://quotecat.ai/payment-success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://quotecat.ai/#pricing",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        email: email,
      },
    });

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
