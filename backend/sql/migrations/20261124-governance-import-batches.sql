BEGIN;

CREATE TABLE IF NOT EXISTS governance_import_batches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  import_kind TEXT NOT NULL CHECK (import_kind IN ('raci','soa')),
  status TEXT NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','pending_approval','approved','rejected','applied')),
  source_name TEXT,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  submitted_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  applied_by TEXT,
  applied_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_import_history (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES governance_import_batches(id),
  workspace_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_import_workspace_status
  ON governance_import_batches(workspace_id, status, created_at DESC);

COMMIT;
