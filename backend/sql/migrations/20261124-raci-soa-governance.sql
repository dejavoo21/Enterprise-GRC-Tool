BEGIN;

CREATE TABLE IF NOT EXISTS governance_scopes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  business_unit TEXT,
  location TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_raci_assignments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  control_id TEXT NOT NULL REFERENCES controls(id),
  scope_id TEXT REFERENCES governance_scopes(id),
  framework_code TEXT,
  framework_version TEXT,
  business_unit TEXT,
  location TEXT,
  responsible JSONB NOT NULL DEFAULT '[]'::jsonb,
  accountable TEXT,
  consulted JSONB NOT NULL DEFAULT '[]'::jsonb,
  informed JSONB NOT NULL DEFAULT '[]'::jsonb,
  control_owner TEXT,
  review_frequency TEXT NOT NULL DEFAULT 'annual',
  last_review DATE,
  next_review DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','archived')),
  approval_status TEXT NOT NULL DEFAULT 'not_submitted' CHECK (approval_status IN ('not_submitted','pending','approved','rejected')),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_raci_history (
  id BIGSERIAL PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES control_raci_assignments(id),
  workspace_id TEXT NOT NULL,
  action TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soa_documents (
  id TEXT PRIMARY KEY,
  soa_ref TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  document_version INTEGER NOT NULL DEFAULT 1,
  framework_code TEXT NOT NULL,
  framework_version TEXT NOT NULL,
  scope_id TEXT REFERENCES governance_scopes(id),
  scope_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','superseded','archived')),
  change_justification TEXT,
  baseline_document_id TEXT REFERENCES soa_documents(id),
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  publication_status TEXT NOT NULL DEFAULT 'not_approved' CHECK (publication_status IN ('not_approved','pending','approved','withdrawn')),
  publication_approved_by TEXT,
  publication_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, soa_ref, document_version)
);

CREATE TABLE IF NOT EXISTS soa_control_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  soa_document_id TEXT NOT NULL REFERENCES soa_documents(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL REFERENCES controls(id),
  applicable BOOLEAN NOT NULL,
  justification TEXT NOT NULL,
  implementation_description TEXT,
  implementation_status TEXT NOT NULL CHECK (implementation_status IN ('implemented','partially_implemented','not_implemented','not_applicable')),
  control_owner TEXT,
  risk_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_review DATE,
  next_review DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (soa_document_id, control_id)
);

CREATE TABLE IF NOT EXISTS soa_history (
  id BIGSERIAL PRIMARY KEY,
  soa_document_id TEXT NOT NULL REFERENCES soa_documents(id),
  workspace_id TEXT NOT NULL,
  action TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raci_workspace_scope ON control_raci_assignments(workspace_id, scope_id, status);
CREATE INDEX IF NOT EXISTS idx_raci_review ON control_raci_assignments(workspace_id, next_review);
CREATE UNIQUE INDEX IF NOT EXISTS uq_governance_scope_identity ON governance_scopes(workspace_id, name, COALESCE(business_unit,''), COALESCE(location,''));
CREATE UNIQUE INDEX IF NOT EXISTS uq_raci_control_scope_location ON control_raci_assignments(workspace_id, control_id, COALESCE(scope_id,''), COALESCE(location,''));
CREATE INDEX IF NOT EXISTS idx_soa_workspace_framework ON soa_documents(workspace_id, framework_code, framework_version, status);
CREATE INDEX IF NOT EXISTS idx_soa_controls_document ON soa_control_records(workspace_id, soa_document_id, implementation_status);

COMMIT;
