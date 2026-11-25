import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Workspace Identity schema is migration-owned while identity synchronization remains at startup', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/workspacesRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-workspace-identity-schema.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureWorkspaceIdentitySchema/);
  assert.match(repository, /export async function syncWorkspaceIdentities/);
  assert.match(startup, /syncWorkspaceIdentities/);
  assert.match(repository, /INSERT INTO tenants/);
  assert.match(repository, /INSERT INTO organizations/);
  assert.match(repository, /INSERT INTO workspace_user_memberships/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS tenants/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS organizations/);
  assert.match(migration, /ALTER TABLE workspaces/);
});
