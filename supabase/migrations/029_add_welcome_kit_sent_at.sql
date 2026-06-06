-- Migration: Add welcome_kit_sent_at to profiles
--
-- Adds an idempotency timestamp for the send-startup-kit edge function.
-- When the function sends the 90-Day Contractor Startup Kit welcome email,
-- it writes the current timestamp here. Subsequent invocations for the same
-- user check this column and skip the send.
--
-- The trigger that invokes the function lives outside this migration — it's
-- configured via Supabase Database Webhooks in the dashboard (Database →
-- Webhooks). See supabase/functions/send-startup-kit/index.ts header for the
-- full deploy procedure.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_kit_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.welcome_kit_sent_at IS
  'Set by the send-startup-kit edge function when the welcome email is sent. NULL = not sent yet. Idempotency guard against double-sends from the Database Webhook that fires on email_confirmed_at transition.';
