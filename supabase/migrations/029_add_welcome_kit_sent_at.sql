-- ============================================================================
-- CONTEXT (notes only — Postgres ignores comment lines, safe to skip past)
-- ============================================================================
-- Adds welcome_kit_sent_at column to profiles for the send-startup-kit edge
-- function. Idempotency guard so the welcome email fires once per user.
--
-- The TRIGGER that invokes the edge function is NOT in this migration — it's
-- configured via Supabase Dashboard → Database → Webhooks. See the function
-- header at supabase/functions/send-startup-kit/index.ts for the full deploy
-- procedure (env vars, webhook config, smoke test).


-- ============================================================================
-- MIGRATION SQL — copy from the line below this banner through end of file
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_kit_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.welcome_kit_sent_at IS
  'Set by the send-startup-kit edge function when the welcome email is sent. NULL = not sent yet. Idempotency guard against double-sends from the Database Webhook that fires on email_confirmed_at transition.';
