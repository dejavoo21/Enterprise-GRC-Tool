-- Move Asset Operations additive schema ownership from application startup to deterministic migrations.
-- Existing asset records are not changed by this migration.

BEGIN;

ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS asset_tag TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS qr_code_value TEXT,
      ADD COLUMN IF NOT EXISTS barcode_value TEXT,
      ADD COLUMN IF NOT EXISTS barcode_type TEXT,
      ADD COLUMN IF NOT EXISTS asset_category TEXT,
      ADD COLUMN IF NOT EXISTS asset_owner TEXT,
      ADD COLUMN IF NOT EXISTS business_owner TEXT,
      ADD COLUMN IF NOT EXISTS technical_owner TEXT,
      ADD COLUMN IF NOT EXISTS custodian TEXT,
      ADD COLUMN IF NOT EXISTS reviewer TEXT,
      ADD COLUMN IF NOT EXISTS approver TEXT,
      ADD COLUMN IF NOT EXISTS department TEXT,
      ADD COLUMN IF NOT EXISTS location TEXT,
      ADD COLUMN IF NOT EXISTS classification TEXT,
      ADD COLUMN IF NOT EXISTS lifecycle_status TEXT,
      ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS warranty_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS end_of_life_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_review_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS vendor_dependency TEXT,
      ADD COLUMN IF NOT EXISTS vulnerabilities INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS risk_rating TEXT,
      ADD COLUMN IF NOT EXISTS open_issues_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS open_findings_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS missing_controls_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS evidence_gap_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS compliance_status TEXT,
      ADD COLUMN IF NOT EXISTS framework_codes TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS linked_risk_ids TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS linked_control_ids TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS linked_evidence_ids TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS linked_policy_ids TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS linked_issue_ids TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS linked_audit_ids TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS last_known_latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS last_known_longitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS last_known_location_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_known_location_address TEXT,
      ADD COLUMN IF NOT EXISTS last_known_building TEXT,
      ADD COLUMN IF NOT EXISTS last_known_floor TEXT,
      ADD COLUMN IF NOT EXISTS last_known_room TEXT,
      ADD COLUMN IF NOT EXISTS last_known_rack TEXT
;

CREATE TABLE IF NOT EXISTS asset_location_history (
      id UUID PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      address TEXT,
      building TEXT,
      floor TEXT,
      room TEXT,
      rack TEXT,
      captured_by_user_id UUID,
      captured_by_email TEXT,
      device TEXT,
      source TEXT,
      notes TEXT
    )
;

CREATE INDEX IF NOT EXISTS idx_asset_location_history_asset
      ON asset_location_history(workspace_id, asset_id, captured_at DESC)
;

CREATE TABLE IF NOT EXISTS asset_lifecycle_events (
      id UUID PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      notes TEXT,
      actor_user_id UUID,
      actor_email TEXT,
      device TEXT,
      ip_address TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      address TEXT,
      building TEXT,
      floor TEXT,
      room TEXT,
      rack TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE INDEX IF NOT EXISTS idx_asset_lifecycle_events_asset
      ON asset_lifecycle_events(workspace_id, asset_id, created_at DESC)
;

CREATE TABLE IF NOT EXISTS asset_relationships (
      id UUID PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE INDEX IF NOT EXISTS idx_asset_relationships_asset
      ON asset_relationships(workspace_id, asset_id, relationship_type, created_at DESC)
;

CREATE TABLE IF NOT EXISTS asset_reviews (
      id UUID PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      review_type TEXT NOT NULL,
      status TEXT NOT NULL,
      owner_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      classification_validated BOOLEAN NOT NULL DEFAULT FALSE,
      risk_validated BOOLEAN NOT NULL DEFAULT FALSE,
      location_validated BOOLEAN NOT NULL DEFAULT FALSE,
      reviewer TEXT NOT NULL,
      completed_at TIMESTAMPTZ,
      due_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE INDEX IF NOT EXISTS idx_asset_reviews_asset
      ON asset_reviews(workspace_id, asset_id, due_at DESC, created_at DESC)
;

COMMIT;
