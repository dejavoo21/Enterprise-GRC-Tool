-- Additive schema ownership migration. Existing reference synchronization remains application-managed.
CREATE TABLE IF NOT EXISTS enterprise_reference_data (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, reference_type, code)
);

CREATE TABLE IF NOT EXISTS enterprise_workflow_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  workflow_key TEXT NOT NULL,
  title TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  approvals_required JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, workflow_key)
);
