CREATE TABLE IF NOT EXISTS risk_database_identity (
  identity_id UUID PRIMARY KEY,
  registration_reference TEXT NOT NULL,
  registered_for_release_sha TEXT NOT NULL CHECK (length(registered_for_release_sha) = 40),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS risk_database_identity_one_active
  ON risk_database_identity (status) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS risk_schema_migration_attestations (
  migration_id TEXT NOT NULL,
  expected_repository_checksum TEXT NOT NULL CHECK (length(expected_repository_checksum) = 64),
  database_identity_id UUID NOT NULL REFERENCES risk_database_identity(identity_id),
  baseline_catalog_fingerprint TEXT NOT NULL CHECK (length(baseline_catalog_fingerprint) = 64),
  baseline_evidence_version TEXT NOT NULL,
  migration_plan_fingerprint TEXT NOT NULL CHECK (length(migration_plan_fingerprint) = 64),
  observed_schema_evidence JSONB NOT NULL,
  compatibility_assessment TEXT NOT NULL CHECK (compatibility_assessment IN ('compatible','compatible_with_forward_repair')),
  authorising_decision TEXT NOT NULL CHECK (authorising_decision = 'approved'),
  approval_reference TEXT NOT NULL,
  attested_at TIMESTAMPTZ NOT NULL,
  reconciliation_version TEXT NOT NULL,
  release_candidate_sha TEXT NOT NULL CHECK (length(release_candidate_sha) = 40),
  required_repair_migration_id TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (migration_id, reconciliation_version)
);

ALTER TABLE risk_schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE risk_schema_migrations ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE risk_schema_migrations ADD COLUMN IF NOT EXISTS execution_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_migration_attestations_release
  ON risk_schema_migration_attestations (release_candidate_sha, reconciliation_version, attested_at);
