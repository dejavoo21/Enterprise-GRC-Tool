CREATE TABLE IF NOT EXISTS risk_actions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action_ref TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  source_status TEXT,
  domain TEXT,
  linked_library_risk_id TEXT,
  linked_risk_id TEXT,
  linked_risk_ref TEXT,
  linked_treatment_plan_id TEXT,
  linked_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_review_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_training_assignment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  cia_impacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT NOT NULL,
  description TEXT,
  owner TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  blocker_reason TEXT,
  evidence_required TEXT,
  completion_date TIMESTAMPTZ,
  notes TEXT,
  outside_appetite BOOLEAN,
  treatment_progress INTEGER,
  target_risk_score NUMERIC(8,2),
  target_risk_rating TEXT,
  expected_residual_score NUMERIC(8,2),
  expected_residual_rating TEXT,
  source_managed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, action_ref),
  UNIQUE (workspace_id, source_type, source_reference)
);

CREATE INDEX IF NOT EXISTS idx_risk_actions_workspace_status ON risk_actions (workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_actions_workspace_due ON risk_actions (workspace_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_actions_linked_risk ON risk_actions (workspace_id, linked_risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_actions_linked_treatment ON risk_actions (workspace_id, linked_treatment_plan_id);
