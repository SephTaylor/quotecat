// supabase/functions/stripe-webhook/index.ts
// Handles Stripe webhook events to update user tiers after payment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Map Stripe price IDs to tiers
const PRICE_TO_TIER: Record<string, "pro" | "premium"> = {
  // Pro Monthly
  "price_1SRYudEJ6nOeXQImORnpOn57": "pro",
  // Pro Yearly
  "price_1SRYxvEJ6nOeXQImgcguc1Tb": "pro",
  // Premium Monthly
  "price_1SRYzJEJ6nOeXQImUR9ZE9dg": "premium",
  // Premium Yearly
  "price_1SRYzpEJ6nOeXQImLJcob9DI": "premium",
};

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

    // Verify the webhook signature (must use async version in Deno)
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    console.log(`Received Stripe event: ${event.type}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

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
 * Handle successful checkout - create or update user profile with correct tier
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const customerEmail = session.customer_email || session.customer_details?.email;
  const customerId = session.customer as string;

  if (!customerEmail) {
    console.error("No customer email in checkout session");
    return;
  }

  console.log(`Checkout completed for: ${customerEmail}`);

  // Get the subscription to determine the tier
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.error("No subscription ID in checkout session");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = PRICE_TO_TIER[priceId] || "pro";

  console.log(`Setting tier to: ${tier} for price: ${priceId}`);

  // Check if user already exists by email
  const { data: existingUser } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", customerEmail)
    .single();

  if (existingUser) {
    // Update existing user's tier
    const { error } = await supabase
      .from("profiles")
      .update({
        tier,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingUser.id);

    if (error) {
      console.error("Error updating profile:", error);
    } else {
      console.log(`Updated existing user ${customerEmail} to tier: ${tier}`);
    }
  } else {
    // Create new user and send invite email
    console.log(`Creating new user and sending invite to ${customerEmail}`);

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      customerEmail,
      {
        data: {
          stripe_customer_id: customerId,
          tier,
        },
        redirectTo: 'https://quotecat.ai/callback.html',
      }
    );

    if (inviteError) {
      console.error("Error inviting user:", inviteError.message);
      throw new Error(`Failed to invite user: ${inviteError.message}`);
    }

    if (!inviteData?.user) {
      console.error("No user returned from invite");
      throw new Error("No user returned from invite");
    }

    console.log(`Created and invited auth user: ${inviteData.user.id}`);

    // Create their profile with the correct tier
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: inviteData.user.id,
        email: customerEmail,
        tier,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error("Error creating profile:", profileError.message);
    } else {
      console.log(`Created profile for ${customerEmail} with tier: ${tier}`);
    }
  }
}

/**
 * Handle subscription updates (upgrades, downgrades, payment method changes)
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const status = subscription.status;

  console.log(`Subscription updated: ${customerId}, status: ${status}`);

  // Only update tier if subscription is active
  if (status === "active" || status === "trialing") {
    const tier = PRICE_TO_TIER[priceId] || "pro";

    const { error } = await supabase
      .from("profiles")
      .update({
        tier,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customerId);

    if (error) {
      console.error("Error updating subscription:", error);
    } else {
      console.log(`Updated customer ${customerId} to tier: ${tier}`);
    }
  } else if (status === "past_due" || status === "unpaid") {
    // Subscription payment failed - could downgrade or send warning
    console.log(`Subscription ${subscription.id} is ${status} - may need intervention`);
  }
}

/**
 * Handle subscription cancellation - downgrade to free tier
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;

  console.log(`Subscription cancelled for customer: ${customerId}`);

  const { error } = await supabase
    .from("profiles")
    .update({
      tier: "free",
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("Error downgrading user:", error);
  } else {
    console.log(`Downgraded customer ${customerId} to free tier`);
  }
}
