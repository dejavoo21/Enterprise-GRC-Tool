BEGIN;

ALTER TABLE security_incidents
  ADD COLUMN IF NOT EXISTS case_category TEXT NOT NULL DEFAULT 'security_incident',
  ADD COLUMN IF NOT EXISTS subject_user_id UUID,
  ADD COLUMN IF NOT EXISTS risk_group_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS indicator_summary TEXT,
  ADD COLUMN IF NOT EXISTS handling_basis TEXT,
  ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE security_incidents ADD CONSTRAINT security_incidents_case_category_check
    CHECK (case_category IN ('security_incident', 'insider_risk'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE security_incidents ADD CONSTRAINT security_incidents_subject_user_fk
    FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_security_incidents_workspace_category
  ON security_incidents (workspace_id, case_category, status, detected_at DESC);

COMMIT;
