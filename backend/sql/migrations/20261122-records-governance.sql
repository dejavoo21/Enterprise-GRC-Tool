CREATE TABLE IF NOT EXISTS records_retention_rules (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, record_type TEXT NOT NULL CHECK(record_type IN ('governance_document','evidence')),
  classification TEXT CHECK(classification IN ('Public','Internal','Confidential','Restricted')),
  trigger_event TEXT NOT NULL CHECK(trigger_event IN ('created_at','updated_at','effective_date','collected_at')),
  duration_months INTEGER NOT NULL CHECK(duration_months > 0), review_lead_days INTEGER NOT NULL DEFAULT 30 CHECK(review_lead_days >= 0),
  disposition_action TEXT NOT NULL CHECK(disposition_action IN ('Review','Archive','Disposal Review')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0), status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Pending Approval','Active','Superseded','Archived')),
  approved_by TEXT, approved_at TIMESTAMPTZ, supersedes_rule_id TEXT REFERENCES records_retention_rules(id),
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id,name,version)
);
CREATE INDEX IF NOT EXISTS idx_retention_rules_scope ON records_retention_rules(workspace_id,record_type,status);

CREATE TABLE IF NOT EXISTS governed_record_index (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK(source_type IN ('governance_document','evidence')), source_id TEXT NOT NULL,
  source_reference TEXT, title TEXT NOT NULL, classification TEXT CHECK(classification IN ('Public','Internal','Confidential','Restricted')),
  record_owner TEXT, custodian TEXT, source_created_at TIMESTAMPTZ, source_updated_at TIMESTAMPTZ,
  trigger_date TIMESTAMPTZ, retention_rule_id TEXT REFERENCES records_retention_rules(id), retention_status TEXT NOT NULL DEFAULT 'Retention Unavailable',
  eligibility_date DATE, review_date DATE, archived_at TIMESTAMPTZ, archive_reason TEXT,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb, last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id,source_type,source_id)
);
CREATE INDEX IF NOT EXISTS idx_governed_records_queue ON governed_record_index(workspace_id,retention_status,review_date);

CREATE TABLE IF NOT EXISTS records_legal_holds (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL, reason TEXT NOT NULL, requesting_authority TEXT NOT NULL, approved_by TEXT,
  effective_date DATE NOT NULL, review_date DATE, status TEXT NOT NULL DEFAULT 'Pending Approval' CHECK(status IN ('Pending Approval','Active','Released','Rejected')),
  released_at TIMESTAMPTZ, release_reason TEXT, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS records_legal_hold_items (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, hold_id TEXT NOT NULL REFERENCES records_legal_holds(id) ON DELETE CASCADE,
  governed_record_id TEXT NOT NULL REFERENCES governed_record_index(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(workspace_id,hold_id,governed_record_id)
);

CREATE TABLE IF NOT EXISTS records_governance_requests (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK(request_type IN ('Archive','Disposal')), governed_record_id TEXT NOT NULL REFERENCES governed_record_index(id) ON DELETE RESTRICT,
  retention_rule_id TEXT REFERENCES records_retention_rules(id), eligibility_date DATE, reason TEXT NOT NULL,
  status TEXT NOT NULL, requested_by TEXT NOT NULL, reviewer TEXT, approver TEXT, decision TEXT, supporting_evidence TEXT,
  execution_status TEXT NOT NULL DEFAULT 'Not Enabled', verification_status TEXT NOT NULL DEFAULT 'Not Verified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_records_requests_queue ON records_governance_requests(workspace_id,request_type,status,created_at DESC);

CREATE TABLE IF NOT EXISTS records_governance_events (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, actor_id TEXT NOT NULL,
  previous_status TEXT, new_status TEXT, notes TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_records_events_entity ON records_governance_events(workspace_id,entity_type,entity_id,created_at DESC);
