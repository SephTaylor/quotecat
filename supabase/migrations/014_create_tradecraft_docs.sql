-- Tradecraft Knowledge Base for Drew (Agentic Quote Wizard)
-- Created: 2026-01-11
-- Description: Stores trade-specific quoting knowledge with vector embeddings for RAG

-- =============================================================================
-- ENABLE PGVECTOR EXTENSION
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- TRADECRAFT DOCUMENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS tradecraft_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  trade TEXT NOT NULL,           -- "electrical", "plumbing", "drywall", etc.
  job_type TEXT NOT NULL,        -- "panel_upgrade", "bathroom_remodel", etc.
  title TEXT NOT NULL,           -- Human-readable title

  -- Content
  content TEXT NOT NULL,         -- Full tradecraft document (markdown)

  -- Vector embedding for semantic search
  embedding vector(1536),        -- OpenAI ada-002 / text-embedding-3-small dimension

  -- Metadata
  version INTEGER DEFAULT 1,     -- For tracking document updates
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one doc per trade+job_type combo
  UNIQUE(trade, job_type)
);

-- =============================================================================
-- INDEX FOR VECTOR SIMILARITY SEARCH
-- =============================================================================
-- IVFFlat index for approximate nearest neighbor search
-- Lists = sqrt(rows) is a good starting point, we'll use 10 for now
CREATE INDEX IF NOT EXISTS idx_tradecraft_embedding
ON tradecraft_docs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);

-- Index for filtering by trade
CREATE INDEX IF NOT EXISTS idx_tradecraft_trade ON tradecraft_docs(trade);

-- Index for filtering by job_type
CREATE INDEX IF NOT EXISTS idx_tradecraft_job_type ON tradecraft_docs(job_type);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION update_tradecraft_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tradecraft_updated_at_trigger
  BEFORE UPDATE ON tradecraft_docs
  FOR EACH ROW
  EXECUTE FUNCTION update_tradecraft_updated_at();

-- =============================================================================
-- SEARCH FUNCTION
-- Returns most similar tradecraft docs for a given query embedding
-- =============================================================================
CREATE OR REPLACE FUNCTION search_tradecraft(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3,
  filter_trade TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  trade TEXT,
  job_type TEXT,
  title TEXT,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    td.id,
    td.trade,
    td.job_type,
    td.title,
    td.content,
    1 - (td.embedding <=> query_embedding) AS similarity
  FROM tradecraft_docs td
  WHERE
    td.is_active = true
    AND td.embedding IS NOT NULL
    AND (filter_trade IS NULL OR td.trade = filter_trade)
    AND 1 - (td.embedding <=> query_embedding) > match_threshold
  ORDER BY td.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- Tradecraft docs are readable by all authenticated users (part of the product)
-- Only service role can insert/update/delete
-- =============================================================================
ALTER TABLE tradecraft_docs ENABLE ROW LEVEL SECURITY;

-- Anyone can read active docs
CREATE POLICY "Anyone can read active tradecraft docs"
ON tradecraft_docs FOR SELECT
USING (is_active = true);

-- Only service role can modify (via edge functions/admin)
CREATE POLICY "Service role can manage tradecraft docs"
ON tradecraft_docs FOR ALL
USING (auth.role() = 'service_role');

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT SELECT ON tradecraft_docs TO anon, authenticated;
GRANT ALL ON tradecraft_docs TO service_role;
GRANT EXECUTE ON FUNCTION search_tradecraft TO anon, authenticated, service_role;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE tradecraft_docs IS 'Trade-specific knowledge base for Drew AI assistant';
COMMENT ON COLUMN tradecraft_docs.embedding IS 'Vector embedding for semantic similarity search (1536 dims for OpenAI embeddings)';
COMMENT ON FUNCTION search_tradecraft IS 'Semantic search over tradecraft documents using cosine similarity';
