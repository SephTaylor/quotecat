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

  // Process webhook event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

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
          try {
            // Get customer email from Stripe
            const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
            const email = customer.email;
            const tier = subscription.metadata?.tier || 'pro';

            if (email) {
              await createUserAccount(email, tier, customerId, subscription.id);
            } else {
              console.error('No email found for customer:', customerId);
            }
          } catch (createError: any) {
            // If user already exists (race condition with checkout.session.completed), that's ok
            if (createError.message?.includes('already') || createError.message?.includes('exists')) {
              // User already created by checkout.session.completed event - ignore
            } else {
              // Re-throw other errors
              throw createError;
            }
          }
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

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
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

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
        }

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

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
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        // Notify customer to update payment method
        const customerId = invoice.customer as string;

        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw userError;

        const user = users.users.find(
          (u) => u.user_metadata?.stripe_customer_id === customerId
        );

        if (user) {
          // Send email notification to update payment method
          const resendApiKey = Deno.env.get('RESEND_API_KEY');

          if (resendApiKey && user.email) {
            try {
              const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      line-height: 1.6;
                      color: #1f2937;
                      max-width: 600px;
                      margin: 0 auto;
                      padding: 20px;
                    }
                    .header {
                      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                      padding: 40px 20px;
                      text-align: center;
                      border-radius: 12px 12px 0 0;
                    }
                    .header h1 {
                      color: white;
                      margin: 0;
                      font-size: 24px;
                    }
                    .content {
                      background: white;
                      padding: 40px 30px;
                      border: 1px solid #e5e7eb;
                      border-top: none;
                    }
                    .alert-box {
                      background: #fef3c7;
                      border-left: 4px solid #f59e0b;
                      border-radius: 8px;
                      padding: 20px;
                      margin: 24px 0;
                    }
                    .alert-box h3 {
                      margin-top: 0;
                      color: #92400e;
                      font-size: 16px;
                    }
                    .cta-button {
                      display: inline-block;
                      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                      color: white !important;
                      text-decoration: none;
                      padding: 14px 32px;
                      border-radius: 8px;
                      font-weight: 600;
                      margin: 10px 0;
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
                  </style>
                </head>
                <body>
                  <div class="header">
                    <h1>⚠️ Payment Failed - Action Required</h1>
                  </div>

                  <div class="content">
                    <p>Hi there,</p>

                    <p>We tried to process your QuoteCat subscription payment, but it didn't go through. This can happen for several reasons:</p>

                    <ul>
                      <li>Insufficient funds</li>
                      <li>Expired card</li>
                      <li>Card declined by your bank</li>
                      <li>Incorrect card details</li>
                    </ul>

                    <div class="alert-box">
                      <h3>Your Subscription Will Be Cancelled Soon</h3>
                      <p style="color: #78350f; margin: 0;">To keep your QuoteCat Pro/Premium access, please update your payment method within the next few days.</p>
                    </div>

                    <p><strong>To update your payment method:</strong></p>

                    <ol>
                      <li>Sign in to the QuoteCat app</li>
                      <li>Go to Settings → Subscription</li>
                      <li>Tap "Manage Billing"</li>
                      <li>Update your payment information</li>
                    </ol>

                    <p>If you have any questions or need help, just reply to this email.</p>

                    <p style="margin-top: 32px;">Thanks,<br><strong>- The QuoteCat Team</strong></p>
                  </div>

                  <div class="footer">
                    <p style="margin: 0;">© 2024 QuoteCat. All rights reserved.</p>
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
                  from: 'QuoteCat <hello@quotecat.ai>',
                  to: user.email,
                  subject: '⚠️ QuoteCat Payment Failed - Please Update Payment Method',
                  html: emailHtml,
                }),
              });

              if (!emailResponse.ok) {
                const errorText = await emailResponse.text();
                console.error('Failed to send payment failure email:', errorText);
              }
            } catch (emailError) {
              console.error('Error sending payment failure email:', emailError);
              // Don't throw - webhook should still succeed
            }
          }
        }

        break;
      }

      default:
        // Unhandled event type - no action needed
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

// No longer needed - using secure links instead
// function generatePassword() removed

// Create user account (shared function for checkout and subscription events)
async function createUserAccount(
  email: string,
  tier: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<void> {
  // Create user in Supabase Auth with auto-confirm
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: email,
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

  // Generate a secure password setup link (valid for 7 days)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: {
      redirectTo: 'https://quotecat.ai/callback', // Web redirect, then deep links to app
    },
  });

  if (linkError) {
    console.error('Error generating password setup link:', linkError);
    throw linkError;
  }

  const setupLink = linkData.properties.action_link;

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
              background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
              padding: 40px 20px;
              text-align: center;
              border-radius: 12px 12px 0 0;
            }
            .header img {
              max-width: 200px;
              height: auto;
              margin-bottom: 16px;
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
              font-size: 18px;
              color: #1f2937;
              font-family: 'Courier New', monospace;
              background: white;
              padding: 12px 16px;
              border-radius: 4px;
              display: inline-block;
              margin-top: 4px;
              border: 2px solid #f97316;
              user-select: all;
              -webkit-user-select: all;
              -moz-user-select: all;
              cursor: text;
              letter-spacing: 1px;
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
            <img src="https://quotecat.ai/images/logo.png" alt="QuoteCat Logo" />
            <h1>${tierEmoji} Welcome to QuoteCat ${tierName}!</h1>
          </div>

          <div class="content">
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
              <p style="color: #92400e; font-weight: 600; margin: 0 0 8px 0;">📬 Found this email in spam?</p>
              <p style="color: #78350f; font-size: 14px; margin: 0;">Please mark it as "Not Spam" so you don't miss important updates about your account!</p>
            </div>

            <p>Congratulations! Your QuoteCat ${tierName} account is ready to go.</p>

            <div class="credentials-box">
              <h3>🔐 Set Up Your Account</h3>
              <p style="color: #6b7280; margin-bottom: 16px;">Your email address: <strong style="color: #1f2937;">${email}</strong></p>
              <p style="color: #6b7280; margin-bottom: 20px;">Click the button below to create your password and activate your account. This link is secure and expires in 7 days.</p>
              <a href="${setupLink}" class="cta-button" style="display: block; text-align: center; text-decoration: none; margin: 0 auto;">
                🔐 Set Your Password
              </a>
            </div>

            <div class="security-note">
              <strong>⚠️ Security:</strong> This link can only be used once and expires in 7 days. Choose a strong password you'll remember!
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
          from: 'QuoteCat <hello@quotecat.ai>',
          to: email,
          subject: `Welcome to QuoteCat ${tierName}! ${tierEmoji} Your account is ready`,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Failed to send welcome email:', errorText);
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't throw - we still want to create the user even if email fails
    }
  } else {
    console.warn('RESEND_API_KEY not set - skipping welcome email');
  }
}
