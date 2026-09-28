BEGIN;

ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS classification TEXT;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS superseded_by_id TEXT REFERENCES governance_documents(id) ON DELETE SET NULL;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS attestation_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;

ALTER TABLE review_tasks ADD COLUMN IF NOT EXISTS assignee_email TEXT;

COMMIT;
