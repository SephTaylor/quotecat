-- Add materials_checklist JSONB column to tradecraft_docs
-- Created: 2026-01-11
-- Description: Structured checklist of materials for each job type

-- =============================================================================
-- ADD MATERIALS_CHECKLIST COLUMN
-- =============================================================================
ALTER TABLE tradecraft_docs
ADD COLUMN IF NOT EXISTS materials_checklist JSONB;

-- =============================================================================
-- UPDATE SEARCH FUNCTION TO RETURN CHECKLIST
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
  materials_checklist JSONB,
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
    td.materials_checklist,
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
-- ADD FUNCTION TO GET CHECKLIST BY JOB TYPE
-- =============================================================================
CREATE OR REPLACE FUNCTION get_materials_checklist(
  p_job_type TEXT
)
RETURNS JSONB AS $$
  SELECT materials_checklist
  FROM tradecraft_docs
  WHERE job_type = p_job_type
    AND is_active = true
    AND materials_checklist IS NOT NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION get_materials_checklist TO anon, authenticated, service_role;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON COLUMN tradecraft_docs.materials_checklist IS 'Structured JSON checklist of materials for this job type. Format: { items: [{ category, name, searchTerms[], defaultQty, unit, required, notes? }] }';
COMMENT ON FUNCTION get_materials_checklist IS 'Get the materials checklist for a specific job type';
