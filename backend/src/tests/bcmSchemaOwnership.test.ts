import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('BCM schema is migration-owned while defaults remain explicit', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/bcmRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-bcm-schema.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureBcmSchema/);
  assert.match(repository, /export async function seedBcmDefaults/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 9);
  assert.equal((migration.match(/CREATE INDEX IF NOT EXISTS/g) || []).length, 7);
  assert.doesNotMatch(migration, /INSERT INTO|UPDATE bcm_|DELETE FROM/);
  assert.match(migration, /records are not created or changed/);
});
