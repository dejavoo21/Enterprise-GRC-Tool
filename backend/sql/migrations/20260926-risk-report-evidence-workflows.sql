BEGIN;
CREATE TABLE IF NOT EXISTS risk_report_snapshots (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  report_type TEXT NOT NULL, title TEXT NOT NULL, pack JSONB NOT NULL,
  prepared_by TEXT NOT NULL, prepared_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','reviewed','approved','rejected')),
  revision INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT, approved_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS risk_reports_workspace_created ON risk_report_snapshots(workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS risk_report_events (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, report_id TEXT NOT NULL,
  action TEXT NOT NULL, actor_id TEXT NOT NULL, actor_email TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(workspace_id,report_id) REFERENCES risk_report_snapshots(workspace_id,id)
);
CREATE OR REPLACE FUNCTION protect_risk_report_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pack IS DISTINCT FROM OLD.pack OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.report_type IS DISTINCT FROM OLD.report_type OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by
    OR NEW.prepared_email IS DISTINCT FROM OLD.prepared_email OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.title IS DISTINCT FROM OLD.title OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Report snapshot content is immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS risk_report_snapshot_immutable ON risk_report_snapshots;
CREATE TRIGGER risk_report_snapshot_immutable BEFORE UPDATE ON risk_report_snapshots
FOR EACH ROW EXECUTE FUNCTION protect_risk_report_snapshot();
CREATE UNIQUE INDEX IF NOT EXISTS risk_treatment_workspace_id_unique ON risk_treatment_plans(workspace_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS evidence_workspace_id_unique ON evidence(workspace_id,id);
CREATE TABLE IF NOT EXISTS risk_treatment_evidence_links (
  workspace_id TEXT NOT NULL, treatment_id TEXT NOT NULL, evidence_id UUID NOT NULL,
  linked_by TEXT NOT NULL, linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(workspace_id,treatment_id,evidence_id),
  FOREIGN KEY(workspace_id,treatment_id) REFERENCES risk_treatment_plans(workspace_id,id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,evidence_id) REFERENCES evidence(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS risk_treatment_evidence_events (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, treatment_id TEXT NOT NULL,
  evidence_id UUID NOT NULL, action TEXT NOT NULL CHECK(action IN ('linked','unlinked')),
  actor_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
