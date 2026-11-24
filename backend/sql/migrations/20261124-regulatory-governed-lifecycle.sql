ALTER TABLE regulatory_change_logs
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_regulatory_changes_workspace_approval
  ON regulatory_change_logs (workspace_id, approval_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_regulatory_tasks_workspace_status_due
  ON regulatory_tasks (workspace_id, status, due_date);
