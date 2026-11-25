-- Additive schema ownership migration. Report templates and reports are not created or changed.
CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  template_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  sections JSONB NOT NULL,
  default_format TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'Confidential',
  version TEXT NOT NULL DEFAULT '1.0',
  author_name TEXT NOT NULL DEFAULT 'GRC Platform',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, template_key)
);

CREATE TABLE IF NOT EXISTS generated_reports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_key TEXT NOT NULL,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  classification TEXT NOT NULL,
  version TEXT NOT NULL,
  author_name TEXT NOT NULL,
  format TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_value TEXT NOT NULL,
  status TEXT NOT NULL,
  generated_by_user_id TEXT,
  generated_by_name TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_key TEXT NOT NULL,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  recipients JSONB NOT NULL,
  delivery_methods JSONB NOT NULL,
  scope_type TEXT NOT NULL,
  scope_value TEXT NOT NULL,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_distributions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_value TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  secure_link_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_attestations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  approver_user_id TEXT,
  approver_name TEXT NOT NULL,
  decision TEXT NOT NULL,
  comments TEXT,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_workspace
  ON report_templates (workspace_id, category);
CREATE INDEX IF NOT EXISTS idx_generated_reports_workspace
  ON generated_reports (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_schedules_workspace
  ON report_schedules (workspace_id, next_run_at);
CREATE INDEX IF NOT EXISTS idx_report_distributions_workspace
  ON report_distributions (workspace_id, report_id);
CREATE INDEX IF NOT EXISTS idx_report_attestations_workspace
  ON report_attestations (workspace_id, report_id);
