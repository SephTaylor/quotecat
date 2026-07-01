-- 031_plan_feedback.sql
-- Structured feedback on planning documents (feature plans, workflow flows)
-- from beta testers and stakeholders. First use: Mike Kane reviewing the
-- v1.2.15 Change Orders plan without having to type paragraphs of feedback.
--
-- Model: plans live as markdown files in the portal repo (source of truth,
-- versioned). Feedback lives here, per-reviewer, per-section. A "reviewer
-- token" is just an opaque string in the URL (?r=mike-abc123) — no formal
-- auth needed since the URLs themselves are the secret. Upgrade later if
-- we need real reviewer accounts.

CREATE TABLE IF NOT EXISTS plan_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan identity. plan_slug matches the markdown filename
  -- (e.g. 'change-orders'). Not a foreign key — plans are versioned in git.
  plan_slug TEXT NOT NULL,

  -- Section within the plan. Slugified heading (e.g. 'happy-path',
  -- 'question-1-parallel-change-orders'). Widgets are keyed by this.
  section_key TEXT NOT NULL,

  -- Opaque reviewer identifier — passed as ?r=... in the URL. We don't
  -- validate against a reviewer table; the URL is the secret. Add a
  -- reviewers table later if we want revocation / display names / etc.
  reviewer_token TEXT NOT NULL,

  -- Verdict values by widget type:
  --   agree | disagree | comment  → section widget
  --   option_a | option_b | option_c | ...  → question widget
  verdict TEXT NOT NULL,

  -- Optional freeform note. Present when verdict is 'comment' or accompanies
  -- an option choice.
  comment_text TEXT CHECK (comment_text IS NULL OR char_length(comment_text) <= 4000),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One verdict per (plan, section, reviewer). Subsequent responses upsert.
  UNIQUE (plan_slug, section_key, reviewer_token)
);

CREATE INDEX idx_plan_feedback_plan_slug ON plan_feedback(plan_slug);
CREATE INDEX idx_plan_feedback_reviewer ON plan_feedback(reviewer_token);
CREATE INDEX idx_plan_feedback_updated ON plan_feedback(updated_at DESC);

-- RLS: reviewers can read/write only via server routes (service role).
-- Direct anon access is closed. The portal API endpoint does the write on
-- behalf of the reviewer after checking the token exists in the URL path.
ALTER TABLE plan_feedback ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write. Everything goes through the portal API.
CREATE POLICY "Service role manages plan feedback"
  ON plan_feedback FOR ALL
  USING (auth.role() = 'service_role');

GRANT ALL ON plan_feedback TO service_role;
