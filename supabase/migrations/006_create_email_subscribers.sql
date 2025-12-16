-- Create email_subscribers table for capturing free user emails
CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'app_settings',
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_active ON email_subscribers(is_active) WHERE is_active = true;

-- Allow anonymous inserts (for free users who aren't signed in)
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (insert)
CREATE POLICY "Anyone can subscribe" ON email_subscribers
  FOR INSERT
  WITH CHECK (true);

-- Only service role can read/update/delete (for admin/export purposes)
CREATE POLICY "Service role can manage subscribers" ON email_subscribers
  FOR ALL
  USING (auth.role() = 'service_role');
