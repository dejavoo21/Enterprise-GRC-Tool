-- Add governed corrective actions for business continuity exercises.
ALTER TABLE bcm_critical_services
  ADD COLUMN IF NOT EXISTS bia_process_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE bcm_recovery_plans
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT;

CREATE INDEX IF NOT EXISTS idx_bcm_critical_services_bia_links
  ON bcm_critical_services USING GIN (bia_process_ids);

CREATE TABLE IF NOT EXISTS bcm_corrective_actions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  owner TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  due_date TIMESTAMPTZ,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  closure_notes TEXT,
  created_by TEXT,
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bcm_corrective_actions_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT bcm_corrective_actions_status_check CHECK (status IN ('open', 'in_progress', 'blocked', 'awaiting_review', 'closed')),
  CONSTRAINT bcm_corrective_actions_closure_check CHECK (
    status <> 'closed' OR (closed_by IS NOT NULL AND closed_at IS NOT NULL AND closure_notes IS NOT NULL AND jsonb_array_length(evidence_ids) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_bcm_corrective_actions_workspace
  ON bcm_corrective_actions (workspace_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_bcm_corrective_actions_exercise
  ON bcm_corrective_actions (workspace_id, exercise_id);
