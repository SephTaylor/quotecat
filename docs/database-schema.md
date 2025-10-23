# QuoteCat Database Schema Design

**Date:** January 23, 2025
**Version:** 1.0
**Purpose:** Supabase PostgreSQL schema for user data, quotes, and subscriptions

---

## Overview

QuoteCat uses Supabase (PostgreSQL) for:
- User authentication
- Cloud quote storage & sync
- Subscription/tier management
- Multi-device support
- Data backup

---

## Tables

### 1. `users` (Managed by Supabase Auth)

Supabase automatically creates this. We'll extend it with a `profiles` table.

### 2. `profiles`

**Purpose:** Extended user profile data

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,

  -- Subscription info
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium')),
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
  company_logo_url TEXT, -- For premium users

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

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_tier ON profiles(tier);

-- Row Level Security
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
```

---

### 3. `quotes`

**Purpose:** Store all user quotes with sync support

```sql
CREATE TABLE quotes (
  -- Identity
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Quote details
  name TEXT NOT NULL,
  client_name TEXT,

  -- Items (stored as JSONB array)
  items JSONB DEFAULT '[]'::jsonb,

  -- Costs
  labor DECIMAL(10,2) DEFAULT 0,
  material_estimate DECIMAL(10,2),
  overhead DECIMAL(10,2),
  markup_percent DECIMAL(5,2),

  -- Metadata
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'CAD', 'EUR', 'CRC')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'completed', 'archived')),
  pinned BOOLEAN DEFAULT FALSE,
  tier TEXT, -- Which tier was this created under (free/pro/premium)

  -- Notes
  notes TEXT,

  -- Sync metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT, -- Which device last modified this

  -- Soft delete support
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_pinned ON quotes(pinned) WHERE pinned = TRUE;
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX idx_quotes_deleted_at ON quotes(deleted_at) WHERE deleted_at IS NULL;

-- Row Level Security
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
```

---

### 4. `assemblies`

**Purpose:** Store custom assemblies (Pro/Premium only)

```sql
CREATE TABLE assemblies (
  -- Identity
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Assembly details
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,

  -- Items (stored as JSONB array)
  items JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ productId: "...", qty: 10 }, ...]

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete support
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_assemblies_user_id ON assemblies(user_id);
CREATE INDEX idx_assemblies_category ON assemblies(category);
CREATE INDEX idx_assemblies_deleted_at ON assemblies(deleted_at) WHERE deleted_at IS NULL;

-- Row Level Security
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
```

---

### 5. `subscriptions`

**Purpose:** Track subscription purchases and history

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Subscription details
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'premium')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'paused')),

  -- Billing
  price_paid DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  billing_period TEXT CHECK (billing_period IN ('monthly', 'yearly', 'lifetime')),

  -- Dates
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  -- Payment provider info (for reference)
  payment_provider TEXT, -- 'stripe', 'paypal', etc.
  payment_id TEXT, -- External payment/subscription ID

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

-- Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update subscriptions (via webhook from Stripe)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');
```

---

### 6. `usage_events` (Optional - for analytics)

**Purpose:** Track feature usage for analytics and limits

```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- 'pdf_export', 'csv_export', 'quote_created', etc.
  metadata JSONB, -- Additional event data

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at DESC);

-- Partitioning by month (optional, for performance)
-- Can be added later if needed

-- Row Level Security
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage events"
  ON usage_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert usage events"
  ON usage_events FOR INSERT
  WITH CHECK (true); -- App can log events
```

---

## Tier Comparison

| Feature | Free | Pro | Premium |
|---------|------|-----|---------|
| **Quotes** | Unlimited | Unlimited | Unlimited |
| **PDF Exports** | 10/month | Unlimited | Unlimited |
| **CSV Exports** | 1/month | Unlimited | Unlimited |
| **Assemblies** | ❌ | ✅ Custom | ✅ Custom + Library |
| **Cloud Sync** | ❌ Local only | ✅ Yes | ✅ Yes |
| **Multi-Device** | ❌ | ✅ Yes | ✅ Yes |
| **Company Branding** | ❌ | ✅ Basic | ✅ Full (logo) |
| **Quote Wizard** | ❌ | ❌ | ✅ Yes |
| **Advanced Analytics** | ❌ | ❌ | ✅ Yes |
| **Team Collaboration** | ❌ | ❌ | ✅ Yes (future) |
| **Priority Support** | ❌ | ❌ | ✅ Yes |
| **Price** | $0 | $10/mo or $99/yr | $99/mo or $999/yr |

---

## Database Functions

### Auto-update `updated_at` timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
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
```

### Reset monthly usage counters

```sql
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
$$ LANGUAGE plpgsql;

-- Schedule this to run monthly (via pg_cron or external cron job)
```

### Check tier access

```sql
CREATE OR REPLACE FUNCTION user_has_tier(required_tier TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  tier_hierarchy TEXT[] := ARRAY['free', 'pro', 'premium'];
  required_level INTEGER;
  user_level INTEGER;
BEGIN
  -- Get user's current tier
  SELECT tier INTO user_tier
  FROM profiles
  WHERE id = auth.uid();

  -- Get tier levels
  required_level := array_position(tier_hierarchy, required_tier);
  user_level := array_position(tier_hierarchy, user_tier);

  -- Check if user meets or exceeds required tier
  RETURN user_level >= required_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Migration Strategy

### Phase 1: Set up tables (Tomorrow)
1. Create all tables in Supabase
2. Set up RLS policies
3. Add triggers and functions

### Phase 2: Local → Cloud migration (Next week)
1. Add auth to app
2. On first login, migrate local AsyncStorage data to Supabase
3. Keep AsyncStorage as cache, Supabase as source of truth

### Phase 3: Sync logic (Future)
1. Implement offline-first sync
2. Conflict resolution (last-write-wins for now)
3. Real-time updates (optional)

---

## Data Flow

**Free User (Local only):**
```
App → AsyncStorage → Local device only
```

**Pro/Premium User (Cloud sync):**
```
App → AsyncStorage (cache) → Supabase (source of truth)
     ↓
  Other devices sync from Supabase
```

---

## Next Steps

1. ✅ Review this schema design
2. 🔜 Create tables in Supabase (5 min)
3. 🔜 Test RLS policies
4. 🔜 Implement auth in app
5. 🔜 Add sync logic

---

## Notes

- All timestamps use `TIMESTAMPTZ` (timezone-aware)
- Soft deletes via `deleted_at` (never truly delete user data)
- JSONB for flexible storage (items, preferences)
- RLS ensures data security
- Free tier stays 100% local (no forced cloud)
- Pro/Premium get automatic cloud backup
