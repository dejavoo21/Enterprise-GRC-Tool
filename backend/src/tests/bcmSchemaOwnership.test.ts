import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('BCM schema is migration-owned without a fictional tenant-data seeder', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/bcmRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-bcm-schema.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureBcmSchema/);
  assert.doesNotMatch(repository, /seedBcmDefaults|Customer Payment Processing|Quarterly ransomware tabletop/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 9);
  assert.equal((migration.match(/CREATE INDEX IF NOT EXISTS/g) || []).length, 7);
  assert.match(migration, /ALTER TABLE bcm_bia_processes[\s\S]*ADD COLUMN IF NOT EXISTS bia_process_ids JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.doesNotMatch(migration, /INSERT INTO|UPDATE bcm_|DELETE FROM/);
  assert.match(migration, /records are not created or changed/);
});
