CREATE TABLE IF NOT EXISTS enterprise_workflow_definitions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_module TEXT NOT NULL,
  source_record_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  stages JSONB NOT NULL,
  escalation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  notification_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name, version)
);

CREATE TABLE IF NOT EXISTS enterprise_workflows (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES enterprise_workflow_definitions(id),
  template_version INTEGER NOT NULL,
  name TEXT NOT NULL,
  source_module TEXT NOT NULL,
  source_record_type TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_record_reference TEXT,
  owner_user_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  current_stage_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  effective_date DATE,
  review_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, template_id, source_record_type, source_record_id)
);

CREATE TABLE IF NOT EXISTS enterprise_workflow_assignments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES enterprise_workflows(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  sequence_index INTEGER NOT NULL DEFAULT 0,
  assigned_user_id TEXT,
  assigned_role TEXT,
  requested_by_user_id TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  decision TEXT,
  decision_at TIMESTAMPTZ,
  reviewer_comments TEXT,
  supporting_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  delegated_from_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enterprise_workflow_events (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES enterprise_workflows(id) ON DELETE CASCADE,
  assignment_id TEXT, actor_user_id TEXT NOT NULL, event_type TEXT NOT NULL,
  previous_state JSONB, next_state JSONB, rationale TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enterprise_workflow_escalations (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES enterprise_workflows(id) ON DELETE CASCADE,
  assignment_id TEXT, escalation_level INTEGER NOT NULL, trigger_type TEXT NOT NULL,
  target_role TEXT, target_user_id TEXT, escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open', resolved_at TIMESTAMPTZ, resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS enterprise_workflow_notifications (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES enterprise_workflows(id) ON DELETE CASCADE,
  assignment_id TEXT, event_type TEXT NOT NULL, recipient_user_id TEXT, recipient_role TEXT,
  channel TEXT NOT NULL DEFAULT 'in_app', deduplication_key TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending', provider_reference TEXT, attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, deduplication_key)
);

CREATE INDEX IF NOT EXISTS idx_workflows_workspace_status ON enterprise_workflows (workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_assignments_user ON enterprise_workflow_assignments (workspace_id, assigned_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_workflow_assignments_sequence ON enterprise_workflow_assignments (workspace_id, workflow_id, stage_order, sequence_index);
CREATE INDEX IF NOT EXISTS idx_workflow_events_history ON enterprise_workflow_events (workspace_id, workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_escalations_open ON enterprise_workflow_escalations (workspace_id, status, escalated_at DESC);
