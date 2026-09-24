BEGIN;
CREATE TABLE IF NOT EXISTS risk_methodologies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Retired')),
  config JSONB NOT NULL CHECK (jsonb_typeof(config) = 'object'),
  created_by TEXT,
  effective_from TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, version),
  UNIQUE (id, workspace_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS risk_methodologies_one_active
  ON risk_methodologies(workspace_id) WHERE status = 'Active';
CREATE TABLE IF NOT EXISTS risk_methodology_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  methodology_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (methodology_id, workspace_id) REFERENCES risk_methodologies(id, workspace_id)
);
-- Deliberately no UPDATE of risks, inferred axis values, or score recalculation.
COMMIT;
