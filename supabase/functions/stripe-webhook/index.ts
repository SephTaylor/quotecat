// supabase/functions/stripe-webhook/index.ts
// Handles Stripe webhook events and creates Supabase accounts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Create crypto provider for Deno
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
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
    // Use constructEventAsync with crypto provider for Deno
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
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

        await createUserAccount(email, tier, session.customer as string, session.subscription as string);

        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Processing customer.subscription.created:', subscription.id);

        // This is a backup - if checkout.session.completed somehow didn't fire
        // Only create account if user doesn't exist yet
        const customerId = subscription.customer as string;

        // Check if user already exists
        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw userError;

        const existingUser = users.users.find(
          (u) => u.user_metadata?.stripe_customer_id === customerId
        );

        if (!existingUser) {
          console.log('User not found, creating from subscription event');

          // Get customer email from Stripe
          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          const email = customer.email;
          const tier = subscription.metadata?.tier || 'pro';

          if (email) {
            await createUserAccount(email, tier, customerId, subscription.id);
          } else {
            console.error('No email found for customer:', customerId);
          }
        } else {
          console.log('User already exists, skipping account creation');
        }

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

// Create user account (shared function for checkout and subscription events)
async function createUserAccount(
  email: string,
  tier: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<void> {
  // Generate a random password for the user
  const password = generatePassword();

  // Create user in Supabase Auth
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      tier: tier,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
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

  // Send welcome email with credentials via Resend
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (resendApiKey) {
    try {
      const tierName = tier === 'premium' ? 'Premium' : 'Pro';
      const tierEmoji = tier === 'premium' ? '💎' : '⭐';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              padding: 40px 20px;
              text-align: center;
              border-radius: 12px 12px 0 0;
            }
            .header h1 {
              color: white;
              margin: 0;
              font-size: 28px;
            }
            .content {
              background: white;
              padding: 40px 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .credentials-box {
              background: #f9fafb;
              border: 2px solid #f97316;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
            }
            .credentials-box h3 {
              margin-top: 0;
              color: #f97316;
              font-size: 16px;
            }
            .credential-row {
              margin: 12px 0;
            }
            .credential-label {
              font-weight: 600;
              color: #6b7280;
              font-size: 14px;
            }
            .credential-value {
              font-size: 16px;
              color: #1f2937;
              font-family: 'Courier New', monospace;
              background: white;
              padding: 8px 12px;
              border-radius: 4px;
              display: inline-block;
              margin-top: 4px;
            }
            .features {
              background: rgba(249, 115, 22, 0.1);
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
            }
            .features h3 {
              color: #f97316;
              margin-top: 0;
              font-size: 16px;
            }
            .features ul {
              margin: 12px 0;
              padding-left: 20px;
            }
            .features li {
              margin: 8px 0;
              color: #1f2937;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
              color: white !important;
              text-decoration: none;
              padding: 14px 32px;
              border-radius: 8px;
              font-weight: 600;
              margin: 10px 5px;
              text-align: center;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #6b7280;
              font-size: 14px;
              border: 1px solid #e5e7eb;
              border-top: none;
              border-radius: 0 0 12px 12px;
              background: #f9fafb;
            }
            .security-note {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px 16px;
              margin: 24px 0;
              border-radius: 4px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${tierEmoji} Welcome to QuoteCat ${tierName}!</h1>
          </div>

          <div class="content">
            <p>Congratulations! Your QuoteCat ${tierName} account is ready to go.</p>

            <div class="credentials-box">
              <h3>🔐 Your Login Credentials</h3>
              <div class="credential-row">
                <div class="credential-label">Email Address</div>
                <div class="credential-value">${email}</div>
              </div>
              <div class="credential-row">
                <div class="credential-label">Temporary Password</div>
                <div class="credential-value">${password}</div>
              </div>
            </div>

            <div class="security-note">
              <strong>⚠️ Security Reminder:</strong> Change your password after your first login in the app Settings.
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <p style="font-weight: 600; margin-bottom: 16px;">Download the app and sign in:</p>
              <a href="https://apps.apple.com/app/quotecat" class="cta-button">📱 Download for iOS</a>
              <a href="https://play.google.com/store/apps/details?id=ai.quotecat.app" class="cta-button">📱 Download for Android</a>
            </div>

            <div class="features">
              <h3>✨ What You Get with ${tierName}</h3>
              <ul>
                <li><strong>Unlimited quotes & exports</strong> - Create as many quotes as you need</li>
                <li><strong>Cloud backup & sync</strong> - Access your data from any device</li>
                <li><strong>Multi-device access</strong> - iOS, Android, and web</li>
                <li><strong>Company branding</strong> - Add your logo and details to quotes</li>
                <li><strong>Custom job templates</strong> - Build reusable assemblies</li>
                <li><strong>Priority email support</strong> - Get help when you need it</li>
                ${tier === 'premium' ? '<li><strong>Quote Wizard (AI-assisted)</strong> - Coming soon!</li>' : ''}
                ${tier === 'premium' ? '<li><strong>Advanced analytics</strong> - Track your business metrics</li>' : ''}
              </ul>
            </div>

            <p style="margin-top: 32px;">Questions? Reply to this email or visit our support page.</p>

            <p style="margin-top: 24px;">Thanks for choosing QuoteCat!<br><strong>- The QuoteCat Team</strong></p>
          </div>

          <div class="footer">
            <p style="margin: 0;">You're receiving this email because you subscribed to QuoteCat ${tierName}.</p>
            <p style="margin: 8px 0 0 0;">© 2024 QuoteCat. All rights reserved.</p>
          </div>
        </body>
        </html>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'QuoteCat <welcome@quotecat.ai>',
          to: email,
          subject: `Welcome to QuoteCat ${tierName}! ${tierEmoji} Your account is ready`,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Failed to send welcome email:', errorText);
      } else {
        const emailData = await emailResponse.json();
        console.log('Welcome email sent successfully:', emailData);
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't throw - we still want to create the user even if email fails
    }
  } else {
    console.warn('RESEND_API_KEY not set - skipping welcome email');
  }

  // Log credentials for debugging (can remove after email is confirmed working)
  console.log('=== NEW USER CREATED ===');
  console.log('Email:', email);
  console.log('Tier:', tier);
  console.log('========================');
}
