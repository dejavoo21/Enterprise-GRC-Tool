import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('AI Governance schema is migration-owned without creating AI records', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/aiGovernanceRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-ai-governance-schema.sql'), 'utf8');
  const provenanceMigration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-ai-inventory-coverage-provenance.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureAiGovernanceSchema/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 9);
  assert.equal((migration.match(/CREATE INDEX IF NOT EXISTS/g) || []).length, 6);
  assert.doesNotMatch(migration, /INSERT INTO|UPDATE ai_|DELETE FROM/);
  assert.match(migration, /records are not created or changed/);
  assert.match(provenanceMigration, /ADD COLUMN IF NOT EXISTS inventory_coverage_recorded BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.doesNotMatch(provenanceMigration, /INSERT INTO|UPDATE ai_|DELETE FROM|DROP TABLE|DROP COLUMN|TRUNCATE/i);
});
