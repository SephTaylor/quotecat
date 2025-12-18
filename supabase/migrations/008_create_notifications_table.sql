-- 008_create_notifications_table.sql
-- Notifications table for in-app alerts (contract signed, etc.)

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification type and content
  type TEXT NOT NULL, -- 'contract_signed', 'contract_viewed', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Related entity (optional)
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,

  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for fast lookups
  CONSTRAINT valid_type CHECK (type IN ('contract_signed', 'contract_viewed', 'contract_declined'))
);

-- Create indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Only service role can insert (webapp creates notifications)
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Grant access
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;
