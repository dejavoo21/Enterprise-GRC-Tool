import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Risk Actions and Risk Library schemas are migration-owned', () => {
  const actionsRepository = readFileSync(resolve(process.cwd(), 'src/repositories/riskActionsRepo.ts'), 'utf8');
  const libraryRepository = readFileSync(resolve(process.cwd(), 'src/repositories/riskLibraryRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const actionsMigration = readFileSync(resolve(process.cwd(), 'sql/migrations/20260927-risk-actions.sql'), 'utf8');
  const libraryMigration = readFileSync(resolve(process.cwd(), 'sql/migrations/20260927-risk-library.sql'), 'utf8');

  assert.doesNotMatch(actionsRepository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(libraryRepository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureRiskLibrarySchema/);
  assert.match(actionsMigration, /CREATE TABLE IF NOT EXISTS risk_actions/);
  assert.match(actionsMigration, /treatment_progress INTEGER/);
  assert.match(libraryMigration, /CREATE TABLE IF NOT EXISTS risk_library_templates/);
  assert.match(libraryMigration, /ALTER TABLE risks ADD COLUMN IF NOT EXISTS library_risk_id/);
});
