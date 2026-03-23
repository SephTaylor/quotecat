-- Migration: Create change_orders table for cloud sync
-- This enables change orders to sync from mobile to cloud for Pro/Premium users

-- Change Orders Table
CREATE TABLE IF NOT EXISTS change_orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id TEXT NOT NULL,
  quote_number TEXT,
  number INTEGER NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  labor_before DECIMAL(10,2) DEFAULT 0,
  labor_after DECIMAL(10,2) DEFAULT 0,
  labor_delta DECIMAL(10,2) DEFAULT 0,
  net_change DECIMAL(10,2) DEFAULT 0,
  quote_total_before DECIMAL(10,2) DEFAULT 0,
  quote_total_after DECIMAL(10,2) DEFAULT 0,
  note TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_change_orders_user_id ON change_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_quote_id ON change_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);
CREATE INDEX IF NOT EXISTS idx_change_orders_updated_at ON change_orders(updated_at DESC);

-- Row Level Security
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

-- Users can only see their own change orders (excluding soft-deleted)
CREATE POLICY "Users can view own change_orders"
  ON change_orders FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can only insert their own change orders
CREATE POLICY "Users can insert own change_orders"
  ON change_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own change orders
CREATE POLICY "Users can update own change_orders"
  ON change_orders FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own change orders
CREATE POLICY "Users can delete own change_orders"
  ON change_orders FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE TRIGGER set_change_orders_updated_at
  BEFORE UPDATE ON change_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
