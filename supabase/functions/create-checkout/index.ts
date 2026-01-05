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

    // Validate price ID is one of our known prices
    const validPriceIds = [
      "price_1SRYudEJ6nOeXQImORnpOn57", // Pro Monthly
      "price_1SRYxvEJ6nOeXQImgcguc1Tb", // Pro Yearly
      "price_1SRYzJEJ6nOeXQImUR9ZE9dg", // Premium Monthly
      "price_1SRYzpEJ6nOeXQImLJcob9DI", // Premium Yearly
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
