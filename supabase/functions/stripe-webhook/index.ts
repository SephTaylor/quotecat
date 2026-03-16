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
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

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

    // Send welcome email with pricing guide
    await sendWelcomeEmail(customerEmail, tier);
  }
}

/**
 * Send welcome email with pricing guide to new subscribers
 */
async function sendWelcomeEmail(email: string, tier: "pro" | "premium") {
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

  try {
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
      console.error("Failed to send welcome email:", errorText);
    } else {
      const result = await response.json();
      console.log(`Welcome email sent to ${email}:`, result.id);
    }
  } catch (error) {
    console.error("Error sending welcome email:", error);
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
