const DISPOSABLE_DATABASE_MARKERS = ['test', 'validation', 'disposable'];

export function requireDisposableTestDatabaseUrl(): string {
  const value = process.env.FRAMEWORK_SCOPE_TEST_DATABASE_URL || process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error('FRAMEWORK_SCOPE_TEST_DATABASE_URL or TEST_DATABASE_URL is required for PostgreSQL integration tests.');
  }

  const parsed = new URL(value);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase();
  if (!databaseName || !DISPOSABLE_DATABASE_MARKERS.some((marker) => databaseName.includes(marker))) {
    throw new Error(`Refusing destructive integration-test setup for non-disposable database "${databaseName || '(missing)'}".`);
  }

  return value;
}

export const integrationSchemaSql = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE controls (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    owner TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('not_implemented','in_progress','implemented','not_applicable')),
    domain TEXT,
    primary_framework TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE control_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    framework TEXT NOT NULL,
    reference TEXT NOT NULL,
    type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

export const dropIntegrationTablesSql = `
  DROP TABLE IF EXISTS framework_scope_controls;
  DROP TABLE IF EXISTS framework_assessment_scopes;
  DROP TABLE IF EXISTS control_mappings;
  DROP TABLE IF EXISTS controls;
`;
