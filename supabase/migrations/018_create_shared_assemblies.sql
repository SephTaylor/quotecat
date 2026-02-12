-- 018_create_shared_assemblies.sql
-- Community Assembly Library: shared assemblies, voting, and copy tracking

-- =============================================================================
-- SHARED ASSEMBLIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS shared_assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Creator info (nullable - allows anonymous and deleted users)
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_display_name TEXT,  -- Company name or null for anonymous

  -- Assembly content
  name TEXT NOT NULL,
  description TEXT,
  trade TEXT NOT NULL,  -- electrical, plumbing, hvac, drywall, framing, roofing, flooring, painting, general
  category TEXT,  -- More specific: panel_upgrade, bathroom_rough_in, etc.
  tags TEXT[] DEFAULT '{}',

  -- Items stored WITHOUT prices (privacy protection)
  -- Format: [{ "name": "100A Breaker Panel", "sku": "ABC123", "qty": 1, "unit": "ea" }, ...]
  items JSONB NOT NULL DEFAULT '[]',

  -- Engagement metrics (denormalized for performance)
  copy_count INTEGER DEFAULT 0,
  upvote_count INTEGER DEFAULT 0,
  downvote_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,

  -- Visibility
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  hidden_at TIMESTAMPTZ,  -- Auto-hidden if net votes < -3
  hidden_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_shared_assemblies_trade ON shared_assemblies(trade);
CREATE INDEX idx_shared_assemblies_category ON shared_assemblies(category);
CREATE INDEX idx_shared_assemblies_creator ON shared_assemblies(creator_id);
CREATE INDEX idx_shared_assemblies_created_at ON shared_assemblies(created_at DESC);
CREATE INDEX idx_shared_assemblies_copy_count ON shared_assemblies(copy_count DESC);
CREATE INDEX idx_shared_assemblies_active ON shared_assemblies(is_active) WHERE is_active = true AND hidden_at IS NULL;
CREATE INDEX idx_shared_assemblies_tags ON shared_assemblies USING GIN(tags);

-- Full-text search on name and description
CREATE INDEX idx_shared_assemblies_search ON shared_assemblies
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- =============================================================================
-- ASSEMBLY VOTES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS assembly_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_assembly_id UUID NOT NULL REFERENCES shared_assemblies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(shared_assembly_id, user_id)
);

CREATE INDEX idx_assembly_votes_assembly ON assembly_votes(shared_assembly_id);
CREATE INDEX idx_assembly_votes_user ON assembly_votes(user_id);

-- =============================================================================
-- ASSEMBLY COPIES TABLE (for tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS assembly_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_assembly_id UUID NOT NULL REFERENCES shared_assemblies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_assembly_id TEXT NOT NULL,  -- ID in user's local assemblies
  copied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assembly_copies_shared ON assembly_copies(shared_assembly_id);
CREATE INDEX idx_assembly_copies_user ON assembly_copies(user_id);

-- =============================================================================
-- ASSEMBLY REPORTS TABLE (for moderation)
-- =============================================================================

CREATE TABLE IF NOT EXISTS assembly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_assembly_id UUID NOT NULL REFERENCES shared_assemblies(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('inappropriate', 'spam', 'misleading', 'other')),
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(shared_assembly_id, reporter_id)
);

CREATE INDEX idx_assembly_reports_assembly ON assembly_reports(shared_assembly_id);
CREATE INDEX idx_assembly_reports_status ON assembly_reports(status) WHERE status = 'pending';

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE shared_assemblies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_reports ENABLE ROW LEVEL SECURITY;

-- Shared Assemblies: Public read for active non-hidden, owner can write
CREATE POLICY "Anyone can view active shared assemblies"
  ON shared_assemblies FOR SELECT
  USING (is_active = true AND hidden_at IS NULL);

CREATE POLICY "Authenticated users can create shared assemblies"
  ON shared_assemblies FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own shared assemblies"
  ON shared_assemblies FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete own shared assemblies"
  ON shared_assemblies FOR DELETE
  USING (auth.uid() = creator_id);

-- Votes: Users can manage their own votes
CREATE POLICY "Users can view all votes"
  ON assembly_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own votes"
  ON assembly_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON assembly_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON assembly_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Copies: Users can manage their own copy records
CREATE POLICY "Users can view own copies"
  ON assembly_copies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create copies"
  ON assembly_copies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Reports: Users can create reports, only see own
CREATE POLICY "Users can create reports"
  ON assembly_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
  ON assembly_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- =============================================================================
-- TRIGGERS FOR VOTE COUNT MANAGEMENT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_assembly_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'up' THEN
      UPDATE shared_assemblies SET upvote_count = upvote_count + 1, updated_at = NOW() WHERE id = NEW.shared_assembly_id;
    ELSE
      UPDATE shared_assemblies SET downvote_count = downvote_count + 1, updated_at = NOW() WHERE id = NEW.shared_assembly_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'up' THEN
      UPDATE shared_assemblies SET upvote_count = GREATEST(upvote_count - 1, 0), updated_at = NOW() WHERE id = OLD.shared_assembly_id;
    ELSE
      UPDATE shared_assemblies SET downvote_count = GREATEST(downvote_count - 1, 0), updated_at = NOW() WHERE id = OLD.shared_assembly_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.vote_type != NEW.vote_type THEN
    IF NEW.vote_type = 'up' THEN
      UPDATE shared_assemblies
      SET upvote_count = upvote_count + 1,
          downvote_count = GREATEST(downvote_count - 1, 0),
          updated_at = NOW()
      WHERE id = NEW.shared_assembly_id;
    ELSE
      UPDATE shared_assemblies
      SET upvote_count = GREATEST(upvote_count - 1, 0),
          downvote_count = downvote_count + 1,
          updated_at = NOW()
      WHERE id = NEW.shared_assembly_id;
    END IF;
  END IF;

  -- Auto-hide if net votes < -3
  UPDATE shared_assemblies
  SET hidden_at = NOW(), hidden_reason = 'community_downvoted'
  WHERE id = COALESCE(NEW.shared_assembly_id, OLD.shared_assembly_id)
    AND upvote_count - downvote_count < -3
    AND hidden_at IS NULL;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER assembly_vote_counts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON assembly_votes
  FOR EACH ROW EXECUTE FUNCTION update_assembly_vote_counts();

-- =============================================================================
-- TRIGGER FOR COPY COUNT
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_assembly_copy_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shared_assemblies
  SET copy_count = copy_count + 1, updated_at = NOW()
  WHERE id = NEW.shared_assembly_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER assembly_copy_count_trigger
  AFTER INSERT ON assembly_copies
  FOR EACH ROW EXECUTE FUNCTION increment_assembly_copy_count();

-- =============================================================================
-- TRIGGER FOR REPORT COUNT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_assembly_report_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shared_assemblies
  SET report_count = (
    SELECT COUNT(*) FROM assembly_reports
    WHERE shared_assembly_id = NEW.shared_assembly_id AND status = 'pending'
  )
  WHERE id = NEW.shared_assembly_id;

  -- Auto-flag for review if 3+ pending reports
  IF (SELECT report_count FROM shared_assemblies WHERE id = NEW.shared_assembly_id) >= 3 THEN
    UPDATE shared_assemblies
    SET hidden_at = NOW(), hidden_reason = 'pending_review'
    WHERE id = NEW.shared_assembly_id AND hidden_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER assembly_report_count_trigger
  AFTER INSERT ON assembly_reports
  FOR EACH ROW EXECUTE FUNCTION update_assembly_report_count();

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE TRIGGER set_shared_assemblies_updated_at
  BEFORE UPDATE ON shared_assemblies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_assembly_votes_updated_at
  BEFORE UPDATE ON assembly_votes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
