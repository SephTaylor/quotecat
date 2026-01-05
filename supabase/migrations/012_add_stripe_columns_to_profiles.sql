-- Add Stripe-related columns to profiles table
-- These are used by the stripe-webhook function to track subscriptions

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add index for looking up users by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
