import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Access Governance schema is migration-owned while safe defaults remain synchronized', () => {
  const bootstrap = readFileSync(resolve(process.cwd(), 'src/services/accessGovernanceBootstrap.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-access-governance-schema.sql'), 'utf8');
  assert.doesNotMatch(bootstrap, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureAccessGovernanceSchema/);
  assert.match(startup, /syncAccessGovernanceDefaults/);
  assert.match(bootstrap, /export async function syncAccessGovernanceDefaults/);
  assert.match(bootstrap, /await seedGovernancePermissions\(\)/);
  assert.match(bootstrap, /await syncGovernanceUserRoles\(\)/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS governance_/g) || []).length, 12);
  assert.match(migration, /Additive only; default role synchronization remains in application startup/);
});
