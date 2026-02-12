-- Migration: Create user_feedback table for Drew support channel
-- This stores FAQ questions that Drew couldn't answer, feature requests, and bug reports

-- Create the table
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feedback_type TEXT CHECK (feedback_type IN ('feature', 'bug', 'question', 'other')) NOT NULL,
  message TEXT NOT NULL,
  drew_conversation_context TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'planned', 'done')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own feedback (or anonymous feedback with null user_id)
CREATE POLICY "Users can submit feedback" ON user_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON user_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for admin access)
CREATE POLICY "Service role has full access" ON user_feedback
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for efficient queries
CREATE INDEX idx_user_feedback_status ON user_feedback(status);
CREATE INDEX idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX idx_user_feedback_created ON user_feedback(created_at DESC);
