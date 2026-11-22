BEGIN;
ALTER TABLE audit_corrective_actions ADD COLUMN IF NOT EXISTS evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS submitted_by_user_id TEXT, ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE audit_follow_ups ADD COLUMN IF NOT EXISTS corrective_action_id TEXT, ADD COLUMN IF NOT EXISTS verification_reference TEXT, ADD COLUMN IF NOT EXISTS requested_by_user_id TEXT, ADD COLUMN IF NOT EXISTS evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS verification_method TEXT, ADD COLUMN IF NOT EXISTS decision TEXT, ADD COLUMN IF NOT EXISTS comments TEXT, ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS closure_authorised_by TEXT, ADD COLUMN IF NOT EXISTS closure_authorised_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS audit_follow_up_verification_reference_unique ON audit_follow_ups(workspace_id,verification_reference) WHERE verification_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_follow_up_action ON audit_follow_ups(workspace_id,corrective_action_id,updated_at DESC);
COMMIT;
