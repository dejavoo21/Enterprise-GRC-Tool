import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Risk Intelligence schema is migration-owned while defaults remain explicit', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/riskIntelligenceRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const seed = readFileSync(resolve(process.cwd(), 'src/scripts/seed-core-grc.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-risk-intelligence-schema.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureRiskIntelligenceSchema/);
  assert.doesNotMatch(seed, /ensureRiskIntelligenceSchema/);
  assert.match(repository, /export async function seedRiskIntelligenceDefaults/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 12);
  assert.equal((migration.match(/CREATE INDEX IF NOT EXISTS/g) || []).length, 11);
  assert.doesNotMatch(migration, /UPDATE risks/);
  assert.match(migration, /Intelligence defaults and business records are not created or changed/);
});
