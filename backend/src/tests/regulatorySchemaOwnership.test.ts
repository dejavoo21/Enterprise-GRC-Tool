import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Regulatory schema is migration-owned while data seeding remains explicit', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/regulatoryRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-regulatory-schema.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureRegulatorySchema/);
  assert.match(repository, /export async function seedRegulatoryData/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 8);
  assert.doesNotMatch(migration, /INSERT INTO|UPDATE regulatory_|DELETE FROM/);
  assert.match(migration, /are not created or changed/);
});
