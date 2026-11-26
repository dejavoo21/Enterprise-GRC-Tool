BEGIN;

CREATE TABLE IF NOT EXISTS ccm_assurance_reports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
  report_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  generated_by_user_id TEXT NOT NULL,
  generated_by_name TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccm_assurance_reports_workspace_generated
  ON ccm_assurance_reports(workspace_id, generated_at DESC);

COMMIT;
