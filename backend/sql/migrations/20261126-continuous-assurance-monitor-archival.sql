BEGIN;

ALTER TABLE ccm_control_monitors
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

ALTER TABLE ccm_control_monitors DROP CONSTRAINT IF EXISTS ccm_control_monitors_status_check;
ALTER TABLE ccm_control_monitors
  ADD CONSTRAINT ccm_control_monitors_status_check
  CHECK (status IN ('active','warning','disabled','failed','archived'));

ALTER TABLE ccm_control_monitors DROP CONSTRAINT IF EXISTS ccm_control_monitors_archive_integrity_check;
ALTER TABLE ccm_control_monitors
  ADD CONSTRAINT ccm_control_monitors_archive_integrity_check CHECK (
    (status = 'archived' AND archived_at IS NOT NULL AND archived_by_user_id IS NOT NULL AND length(trim(archive_reason)) BETWEEN 10 AND 1000)
    OR
    (status <> 'archived' AND archived_at IS NULL AND archived_by_user_id IS NULL AND archive_reason IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_ccm_monitors_workspace_status
  ON ccm_control_monitors(workspace_id, status, updated_at DESC);

COMMIT;
