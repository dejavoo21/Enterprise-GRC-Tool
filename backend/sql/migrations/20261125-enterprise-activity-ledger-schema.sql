-- Additive schema ownership migration. No activity records are created or changed.
CREATE TABLE IF NOT EXISTS enterprise_activity_ledger (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_user_id TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  previous_value JSONB,
  new_value JSONB,
  outcome TEXT NOT NULL,
  severity TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device TEXT,
  location TEXT,
  correlation_id TEXT,
  source TEXT NOT NULL,
  framework_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_workspace_created
  ON enterprise_activity_ledger (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_target
  ON enterprise_activity_ledger (workspace_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_actor
  ON enterprise_activity_ledger (workspace_id, actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_category
  ON enterprise_activity_ledger (workspace_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_severity
  ON enterprise_activity_ledger (workspace_id, severity, created_at DESC);
