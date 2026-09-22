BEGIN;
CREATE TABLE IF NOT EXISTS risk_treatment_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  risk_id TEXT NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  strategy TEXT NOT NULL CHECK (strategy IN ('mitigate','accept','transfer','avoid','monitor')),
  owner TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','in_progress','awaiting_evidence','under_review','completed','accepted','deferred','cancelled')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  expected_residual_score NUMERIC(8,2), effectiveness_rating NUMERIC(8,2), evidence_summary TEXT,
  approval_status TEXT NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required','pending_approval','approved','rejected')),
  created_by TEXT, completed_at TIMESTAMPTZ, review_date TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_plans_workspace ON risk_treatment_plans (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_plans_risk ON risk_treatment_plans (workspace_id, risk_id);
COMMIT;
