import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Enterprise Operations schema is migration-owned while defaults remain synchronized', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/enterpriseOpsRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-enterprise-operations-schema.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureEnterpriseOpsSchema/);
  assert.match(repository, /async function seedEnterpriseOpsDefaults/);
  assert.match(repository, /await seedEnterpriseOpsDefaults\(workspaceId\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS enterprise_reference_data/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS enterprise_workflow_templates/);
  assert.match(migration, /Existing reference synchronization remains application-managed/);
});
