CREATE TABLE IF NOT EXISTS governance_policy_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES governance_documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  scope_summary TEXT NOT NULL,
  match_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclude_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  response_mode TEXT NOT NULL CHECK (response_mode IN ('monitor', 'review')),
  plain_language_summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, document_id, name)
);

CREATE INDEX IF NOT EXISTS idx_governance_policy_rules_document
  ON governance_policy_rules (workspace_id, document_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS governance_policy_rule_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL REFERENCES governance_policy_rules(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'archived')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_policy_rule_events_rule
  ON governance_policy_rule_events (workspace_id, rule_id, created_at DESC);
