import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Privacy and Data Governance schema is migration-owned without creating records', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/privacyRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-privacy-data-governance-schema.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(repository, /ensurePrivacySchema|createTable\(/);
  assert.doesNotMatch(startup, /ensurePrivacySchema/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 19);
  assert.doesNotMatch(migration, /INSERT INTO|UPDATE privacy_|DELETE FROM/);
  assert.match(migration, /records are not created or changed/);
});
