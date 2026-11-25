-- Additive schema ownership migration. No assessment records are created or changed.
CREATE TABLE IF NOT EXISTS framework_assessment_scopes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  framework_code TEXT NOT NULL,
  framework_name TEXT NOT NULL,
  framework_version TEXT,
  name TEXT NOT NULL,
  description TEXT,
  organisation_unit TEXT,
  period_start DATE,
  period_end DATE,
  approval_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft','pending_review','approved','rejected','expired')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  review_date DATE,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS framework_scope_controls (
  scope_id TEXT NOT NULL REFERENCES framework_assessment_scopes(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE RESTRICT,
  control_title TEXT NOT NULL,
  framework_reference TEXT,
  inclusion_status TEXT NOT NULL DEFAULT 'included'
    CHECK (inclusion_status IN ('included','excluded','not_applicable','inherited','deferred','out_of_scope')),
  exclusion_reason TEXT,
  justification TEXT,
  evidence_reference TEXT,
  review_date DATE,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope_id, control_id)
);

CREATE INDEX IF NOT EXISTS idx_framework_scopes_workspace
  ON framework_assessment_scopes(workspace_id, framework_code);

CREATE INDEX IF NOT EXISTS idx_framework_scope_controls_status
  ON framework_scope_controls(scope_id, inclusion_status);
