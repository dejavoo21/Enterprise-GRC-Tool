import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { migrationManifest } from '../scripts/migrationManifest.js';

test('Authentication Security schema is migration-owned before Access Governance', () => {
  const bootstrap = readFileSync(resolve(process.cwd(), 'src/services/authBootstrap.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-authentication-security-schema.sql'), 'utf8');
  const authIndex = migrationManifest.findIndex(item => item.id === '20261125-authentication-security-schema');
  const accessIndex = migrationManifest.findIndex(item => item.id === '20261125-access-governance-schema');

  assert.doesNotMatch(bootstrap, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureAuthSecuritySchema/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_sessions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_passkeys/);
  assert.ok(authIndex >= 0 && accessIndex > authIndex);
  assert.deepEqual(migrationManifest[accessIndex].dependsOn, ['20261125-authentication-security-schema']);
});
