-- Create email_subscribers table for capturing free user emails
CREATE TABLE IF NOT EXISTS email_subscribers (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow anonymous inserts
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe" ON email_subscribers
  FOR INSERT
  WITH CHECK (true);
