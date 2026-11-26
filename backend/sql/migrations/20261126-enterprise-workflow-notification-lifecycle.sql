ALTER TABLE enterprise_workflow_notifications
  ADD COLUMN IF NOT EXISTS inbox_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enterprise_workflow_notifications_inbox_status_check'
      AND conrelid = 'enterprise_workflow_notifications'::regclass
  ) THEN
    ALTER TABLE enterprise_workflow_notifications
      ADD CONSTRAINT enterprise_workflow_notifications_inbox_status_check
      CHECK (inbox_status IN ('active', 'read', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflow_notifications_inbox
  ON enterprise_workflow_notifications (workspace_id, recipient_user_id, inbox_status, created_at DESC);
