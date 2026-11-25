import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Framework Assessment Scope schema is migration-owned', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/frameworkAssessmentScopeRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-framework-assessment-scope-schema.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureFrameworkAssessmentScopeSchema/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS framework_assessment_scopes/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS framework_scope_controls/);
  assert.match(migration, /No assessment records are created or changed/);
});
