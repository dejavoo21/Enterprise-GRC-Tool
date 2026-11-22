CREATE TABLE IF NOT EXISTS risk_schema_migration_attestations (
  migration_id TEXT NOT NULL,
  expected_repository_checksum TEXT NOT NULL CHECK (length(expected_repository_checksum) = 64),
  database_fingerprint TEXT NOT NULL CHECK (length(database_fingerprint) = 64),
  catalog_fingerprint TEXT NOT NULL CHECK (length(catalog_fingerprint) = 64),
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
