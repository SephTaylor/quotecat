-- QuoteCat Initial Database Schema
-- Created: 2025-01-23
-- Description: Core tables for user profiles, quotes, assemblies, and subscriptions

-- =============================================================================
-- PROFILES TABLE
-- =============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,

  -- Subscription info
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium')),
  pricing_tier TEXT DEFAULT 'standard' CHECK (pricing_tier IN ('founder', 'early', 'standard')),
  tier_expires_at TIMESTAMPTZ,

  -- Usage tracking (for free tier limits)
  pdfs_this_month INTEGER DEFAULT 0,
  spreadsheets_this_month INTEGER DEFAULT 0,
  last_usage_reset TIMESTAMPTZ DEFAULT NOW(),

  -- Company details (synced across devices)
  company_name TEXT,
  company_email TEXT,
  company_phone TEXT,
  company_website TEXT,
  company_address TEXT,
  company_logo_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Preferences (JSON for flexibility)
  preferences JSONB DEFAULT '{
    "dashboard": {
      "showStats": true,
      "showValueTracking": true,
      "showPinnedQuotes": true,
      "showRecentQuotes": true,
      "recentQuotesCount": 5
    }
  }'::jsonb
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_tier ON profiles(tier);
CREATE INDEX idx_profiles_pricing_tier ON profiles(pricing_tier);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- QUOTES TABLE
-- =============================================================================
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  client_name TEXT,

  items JSONB DEFAULT '[]'::jsonb,

  labor DECIMAL(10,2) DEFAULT 0,
  material_estimate DECIMAL(10,2),
  overhead DECIMAL(10,2),
  markup_percent DECIMAL(5,2),

  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'CAD', 'EUR', 'CRC')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'completed', 'archived')),
  pinned BOOLEAN DEFAULT FALSE,
  tier TEXT,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,

  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_pinned ON quotes(pinned) WHERE pinned = TRUE;
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX idx_quotes_deleted_at ON quotes(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quotes"
  ON quotes FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own quotes"
  ON quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quotes"
  ON quotes FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- ASSEMBLIES TABLE
-- =============================================================================
CREATE TABLE assemblies (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  category TEXT,

  items JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_assemblies_user_id ON assemblies(user_id);
CREATE INDEX idx_assemblies_category ON assemblies(category);
CREATE INDEX idx_assemblies_deleted_at ON assemblies(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE assemblies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assemblies"
  ON assemblies FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own assemblies"
  ON assemblies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assemblies"
  ON assemblies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assemblies"
  ON assemblies FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- SUBSCRIPTIONS TABLE
-- =============================================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'premium')),
  pricing_tier TEXT NOT NULL CHECK (pricing_tier IN ('founder', 'early', 'standard')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'paused')),

  price_paid DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  billing_period TEXT CHECK (billing_period IN ('monthly', 'yearly', 'lifetime')),

  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  payment_provider TEXT,
  payment_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- USAGE EVENTS TABLE
-- =============================================================================
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage events"
  ON usage_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert usage events"
  ON usage_events FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON assemblies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION user_has_tier(required_tier TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  tier_hierarchy TEXT[] := ARRAY['free', 'pro', 'premium'];
  required_level INTEGER;
  user_level INTEGER;
BEGIN
  SELECT tier INTO user_tier
  FROM profiles
  WHERE id = auth.uid();

  required_level := array_position(tier_hierarchy, required_tier);
  user_level := array_position(tier_hierarchy, user_tier);

  RETURN user_level >= required_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_spots_remaining(target_tier TEXT, target_pricing TEXT)
RETURNS INTEGER AS $$
DECLARE
  spot_limit INTEGER;
  current_count INTEGER;
BEGIN
  spot_limit := CASE
    WHEN target_tier = 'pro' AND target_pricing = 'founder' THEN 500
    WHEN target_tier = 'premium' AND target_pricing = 'founder' THEN 100
    ELSE 999999
  END;

  SELECT COUNT(*) INTO current_count
  FROM profiles
  WHERE tier = target_tier
    AND pricing_tier = target_pricing;

  RETURN GREATEST(0, spot_limit - current_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    pdfs_this_month = 0,
    spreadsheets_this_month = 0,
    last_usage_reset = NOW()
  WHERE
    last_usage_reset < DATE_TRUNC('month', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
