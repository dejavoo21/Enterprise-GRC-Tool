BEGIN;

ALTER TABLE risks
  ADD COLUMN IF NOT EXISTS treatment_strategy TEXT,
  ADD COLUMN IF NOT EXISTS treatment_owner TEXT,
  ADD COLUMN IF NOT EXISTS treatment_progress INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS treatment_action_summary TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_rationale TEXT,
  ADD COLUMN IF NOT EXISTS accepted_by TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'not_reviewed',
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS review_owner TEXT,
  ADD COLUMN IF NOT EXISTS reassessment_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_treatment_strategy_valid;
ALTER TABLE risks ADD CONSTRAINT risks_treatment_strategy_valid CHECK (
  treatment_strategy IS NULL OR treatment_strategy IN ('mitigate','accept','transfer','avoid','monitor')
);
ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_treatment_status_valid;
ALTER TABLE risks ADD CONSTRAINT risks_treatment_status_valid CHECK (
  treatment_status IS NULL OR treatment_status IN ('not_started','planned','in_progress','awaiting_evidence','under_review','completed','overdue','accepted','deferred','cancelled')
);
ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_review_status_valid;
ALTER TABLE risks ADD CONSTRAINT risks_review_status_valid CHECK (
  review_status IN ('not_reviewed','review_due','in_review','reviewed','overdue','reassessment_required')
);
ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_treatment_progress_valid;
ALTER TABLE risks ADD CONSTRAINT risks_treatment_progress_valid CHECK (treatment_progress BETWEEN 0 AND 100);

COMMIT;
