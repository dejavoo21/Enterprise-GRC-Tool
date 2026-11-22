CREATE TABLE IF NOT EXISTS data_quality_rules (
  id TEXT NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module TEXT NOT NULL, entity_type TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
  category TEXT NOT NULL, severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')), enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mandatory BOOLEAN NOT NULL DEFAULT FALSE, responsible_owner TEXT, last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS data_quality_issues (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL, rule_id TEXT NOT NULL, module TEXT NOT NULL, entity_type TEXT NOT NULL,
  source_record_id TEXT NOT NULL, source_reference TEXT, source_title TEXT,
  category TEXT NOT NULL, severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')), description TEXT NOT NULL,
  recommended_correction TEXT NOT NULL, assigned_owner TEXT,
  status TEXT NOT NULL CHECK (status IN ('Detected','Under Review','Assigned','Correction Proposed','Approved','Resolved','False Positive','Accepted Exception','Deferred','Reopened')),
  review_decision TEXT, resolution_evidence TEXT, detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_data_quality_issues_queue ON data_quality_issues(workspace_id,status,severity,last_detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_quality_issues_source ON data_quality_issues(workspace_id,entity_type,source_record_id);
CREATE TABLE IF NOT EXISTS data_quality_issue_events (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL REFERENCES data_quality_issues(id) ON DELETE CASCADE,
  action TEXT NOT NULL, actor_id TEXT NOT NULL, previous_status TEXT, new_status TEXT,
  notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_data_quality_events_issue ON data_quality_issue_events(workspace_id,issue_id,created_at DESC);
