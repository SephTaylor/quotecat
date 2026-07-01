-- 032_plan_reviewers.sql
-- Which reviewers are assigned to which plans. Used by the reviewer home
-- page (/plan?r=<token>) to show a reviewer only the plans they're on,
-- and by the feedback dashboard to know who's expected to weigh in.
--
-- Design keeps parity with plan_feedback: no formal auth, the reviewer
-- token IS the secret. This table just tracks the assignment so we don't
-- have to hardcode reviewer→plan mappings in TS files that need PRs to change.

CREATE TABLE IF NOT EXISTS plan_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  plan_slug TEXT NOT NULL,
  reviewer_token TEXT NOT NULL,
  reviewer_display_name TEXT,

  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (plan_slug, reviewer_token)
);

CREATE INDEX idx_plan_reviewers_token ON plan_reviewers(reviewer_token);
CREATE INDEX idx_plan_reviewers_slug ON plan_reviewers(plan_slug);

ALTER TABLE plan_reviewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages plan reviewers"
  ON plan_reviewers FOR ALL
  USING (auth.role() = 'service_role');

GRANT ALL ON plan_reviewers TO service_role;

-- Seed the initial assignments: Mike Kane on all three v1.2.15+ plans,
-- Seph's internal preview token also on all three. Add more via INSERT
-- as new reviewers are onboarded.
INSERT INTO plan_reviewers (plan_slug, reviewer_token, reviewer_display_name)
VALUES
  ('change-orders',        'mike-kane-2026', 'Mike Kane'),
  ('progressive-billing',  'mike-kane-2026', 'Mike Kane'),
  ('job-costing',          'mike-kane-2026', 'Mike Kane'),
  ('change-orders',        'internal-seph',  'Seph (preview)'),
  ('progressive-billing',  'internal-seph',  'Seph (preview)'),
  ('job-costing',          'internal-seph',  'Seph (preview)')
ON CONFLICT (plan_slug, reviewer_token) DO NOTHING;
