import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Reporting Center schema is migration-owned while templates remain synchronized explicitly', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/reportingCenterRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-reporting-center-schema.sql'), 'utf8');

  assert.doesNotMatch(repository, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureReportingCenterSchema/);
  assert.match(repository, /export async function seedReportingTemplates/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS report_/g) || []).length, 4);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS generated_reports/);
  assert.match(migration, /Report templates and reports are not created or changed/);
});
