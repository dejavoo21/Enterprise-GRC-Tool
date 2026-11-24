BEGIN;

CREATE TABLE IF NOT EXISTS ccm_control_monitors (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  control_id TEXT NOT NULL,
  control_name TEXT NOT NULL,
  framework TEXT NOT NULL,
  framework_id TEXT,
  control_objective TEXT NOT NULL,
  test_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','warning','disabled','failed')),
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  result TEXT NOT NULL DEFAULT 'not_run' CHECK (result IN ('passed','failed','warning','not_run','not_applicable')),
  evidence_output TEXT NOT NULL DEFAULT 'No evidence generated',
  evidence_requirement_id TEXT,
  created_by_user_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, control_id, name)
);

CREATE TABLE IF NOT EXISTS ccm_automated_tests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  monitor_id TEXT NOT NULL REFERENCES ccm_control_monitors(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  schedule TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  owner TEXT NOT NULL,
  last_run TIMESTAMPTZ,
  last_result TEXT NOT NULL DEFAULT 'not_run' CHECK (last_result IN ('passed','failed','warning','not_run','not_applicable')),
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, monitor_id)
);

CREATE TABLE IF NOT EXISTS ccm_test_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  automated_test_id TEXT NOT NULL REFERENCES ccm_automated_tests(id) ON DELETE RESTRICT,
  monitor_id TEXT NOT NULL REFERENCES ccm_control_monitors(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('passed','failed','warning','not_run','not_applicable')),
  summary TEXT NOT NULL,
  details TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  executed_by_user_id TEXT NOT NULL,
  executed_by_name TEXT NOT NULL,
  execution_mode TEXT NOT NULL DEFAULT 'manual' CHECK (execution_mode IN ('manual','connector')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ccm_assurance_exceptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  source TEXT NOT NULL,
  source_run_id TEXT REFERENCES ccm_test_runs(id) ON DELETE SET NULL,
  linked_control_id TEXT,
  linked_framework TEXT,
  linked_risk_id TEXT,
  owner TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','accepted')),
  remediation_action TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolution_rationale TEXT,
  resolved_by_user_id TEXT,
  resolved_by_name TEXT,
  resolved_at TIMESTAMPTZ,
  created_by_user_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ccm_remediation_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('failed_test','drift_alert','exception','missing_evidence')),
  source_id TEXT NOT NULL,
  linked_object_label TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  owner TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','resolved','closed')),
  linked_object_type TEXT NOT NULL CHECK (linked_object_type IN ('test','drift','exception','evidence-job')),
  linked_object_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ccm_settings (
  workspace_id TEXT PRIMARY KEY,
  default_test_frequency TEXT NOT NULL DEFAULT 'Weekly',
  evidence_freshness_period_days INTEGER NOT NULL DEFAULT 30 CHECK (evidence_freshness_period_days > 0),
  drift_severity_threshold TEXT NOT NULL DEFAULT 'medium' CHECK (drift_severity_threshold IN ('low','medium','high','critical')),
  exception_sla_days INTEGER NOT NULL DEFAULT 14 CHECK (exception_sla_days > 0),
  connector_sync_frequency TEXT NOT NULL DEFAULT 'Disabled',
  auto_create_remediation_task BOOLEAN NOT NULL DEFAULT FALSE,
  auto_link_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccm_monitors_workspace_control ON ccm_control_monitors(workspace_id, control_id);
CREATE INDEX IF NOT EXISTS idx_ccm_tests_workspace_monitor ON ccm_automated_tests(workspace_id, monitor_id);
CREATE INDEX IF NOT EXISTS idx_ccm_runs_workspace_test ON ccm_test_runs(workspace_id, automated_test_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ccm_exceptions_workspace_status ON ccm_assurance_exceptions(workspace_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_ccm_tasks_workspace_status ON ccm_remediation_tasks(workspace_id, status, due_date);

COMMIT;
