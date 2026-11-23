ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS submitted_by UUID,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_review_status_check'
  ) THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_review_status_check
      CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evidence_workspace_review_status
  ON evidence(workspace_id, review_status);

ALTER TABLE controls ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_controls_workspace_active ON controls(workspace_id) WHERE archived_at IS NULL;
