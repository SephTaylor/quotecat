// supabase/functions/stripe-webhook/index.ts
// Handles Stripe webhook events and creates Supabase accounts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.3.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  if (!signature || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Missing signature or webhook secret' }),
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(
      JSON.stringify({ error: 'Webhook signature verification failed' }),
      { status: 400 }
    );
  }

  console.log('Received event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Processing checkout.session.completed:', session.id);

        // Get customer email and tier from session
        const email = session.customer_email || session.metadata?.email;
        const tier = session.metadata?.tier || 'pro';

        if (!email) {
          console.error('No email found in session');
          break;
        }

        // Generate a random password for the user
        const password = generatePassword();

        // Create user in Supabase Auth
        const { data: userData, error: userError } = await supabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            tier: tier,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          },
        });

        if (userError) {
          console.error('Error creating user:', userError);
          throw userError;
        }

        console.log('User created:', userData.user.id);

        // Create profile in profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userData.user.id,
            email: email,
            tier: tier,
            pricing_tier: 'founder',
            created_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          throw profileError;
        }

        console.log('Profile created for user:', userData.user.id);

        // TODO: Send welcome email with credentials
        // For now, log the credentials (REMOVE IN PRODUCTION)
        console.log('=== NEW USER CREDENTIALS ===');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('Tier:', tier);
        console.log('============================');

        // You can use Resend, SendGrid, or other email service here
        // Example with Resend (when you set it up):
        /*
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'QuoteCat <onboarding@quotecat.ai>',
              to: email,
              subject: `Welcome to QuoteCat ${tier === 'premium' ? 'Premium' : 'Pro'}!`,
              html: `
                <h1>Welcome to QuoteCat ${tier === 'premium' ? 'Premium' : 'Pro'}!</h1>
                <p>Your account has been created. Here are your credentials:</p>
                <p><strong>Email:</strong> ${email}<br>
                <strong>Password:</strong> ${password}</p>
                <p>Download the app and sign in to unlock your ${tier} features:</p>
                <ul>
                  <li>iOS: [TestFlight link]</li>
                  <li>Android: [Play Store link]</li>
                </ul>
                <p>We recommend changing your password after your first login in the app settings.</p>
              `,
            }),
          });
        }
        */

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', subscription.id);

        // Handle subscription updates (e.g., cancellation, plan changes)
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw userError;

        const user = users.users.find(
          (u) => u.user_metadata?.stripe_customer_id === customerId
        );

        if (user) {
          // Update subscription status in profile
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              tier: subscription.status === 'active' ? user.user_metadata?.tier : 'free',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (updateError) throw updateError;
          console.log('Profile updated for user:', user.id);
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', subscription.id);

        // Downgrade user to free tier
        const customerId = subscription.customer as string;

        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw userError;

        const user = users.users.find(
          (u) => u.user_metadata?.stripe_customer_id === customerId
        );

        if (user) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              tier: 'free',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (updateError) throw updateError;
          console.log('User downgraded to free:', user.id);
        }

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice paid:', invoice.id);

        // Continue to provision subscription - payment successful
        // Update last payment date in profile
        const customerId = invoice.customer as string;

        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw userError;

        const user = users.users.find(
          (u) => u.user_metadata?.stripe_customer_id === customerId
        );

        if (user) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (updateError) throw updateError;
          console.log('Payment recorded for user:', user.id);
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice payment failed:', invoice.id);

        // Notify customer to update payment method
        const customerId = invoice.customer as string;

        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw userError;

        const user = users.users.find(
          (u) => u.user_metadata?.stripe_customer_id === customerId
        );

        if (user) {
          // TODO: Send email notification to update payment method
          console.log('⚠️ Payment failed for user:', user.id);
          console.log('Email:', user.email);

          // You can send them to customer portal to update payment
          // Or send email with link to update payment method
        }

        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Generate a secure random password
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
