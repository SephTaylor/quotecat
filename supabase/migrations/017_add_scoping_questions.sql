-- Migration: Add scoping_questions column to tradecraft_docs
-- Part of hybrid state machine implementation for Drew
-- Allows tradecraft docs to define structured scoping questions
-- that the server can ask in order without LLM deciding

ALTER TABLE tradecraft_docs
ADD COLUMN IF NOT EXISTS scoping_questions JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN tradecraft_docs.scoping_questions IS 'Structured scoping questions for state machine. Format: [{ "id": string, "question": string, "quickReplies": string[], "storeAs": string }]';
