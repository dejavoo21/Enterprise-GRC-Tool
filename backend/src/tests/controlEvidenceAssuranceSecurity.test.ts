import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

test('evidence and control assurance routes enforce explicit permissions', () => {
  const evidenceRoutes = read('src/routes/evidence.ts');
  const controlRoutes = read('src/routes/controls.ts');
  assert.match(evidenceRoutes, /requirePermission\('Evidence', 'view'\)/);
  assert.match(evidenceRoutes, /requirePermission\('Evidence', 'create'\)/);
  assert.match(evidenceRoutes, /requirePermission\('Evidence', 'edit'\)/);
  assert.match(evidenceRoutes, /requirePermission\('Evidence', 'approve'\)/);
  assert.match(controlRoutes, /requirePermission\('Controls', 'view'\)/);
  assert.match(controlRoutes, /requirePermission\('Controls','approve'\)/);
});

test('assurance, lifecycle, and reuse repositories scope every record lookup to workspace', () => {
  const evidenceRepo = read('src/repositories/evidenceRepo.ts');
  const assuranceRepo = read('src/repositories/controlAssuranceRepo.ts');
  assert.match(evidenceRepo, /evidence_lifecycle_events WHERE workspace_id=\$1 AND evidence_id=\$2/);
  assert.match(evidenceRepo, /evidence_usage_links WHERE workspace_id=\$1 AND evidence_id=\$2/);
  assert.match(evidenceRepo, /controls WHERE workspace_id\s*=\s*\$1 AND id\s*=\s*\$2/);
  assert.match(evidenceRepo, /risks WHERE workspace_id\s*=\s*\$1 AND id\s*=\s*\$2/);
  assert.match(assuranceRepo, /control_effectiveness_assessments WHERE workspace_id=\$1 AND control_id=\$2/);
  assert.match(assuranceRepo, /evidence WHERE workspace_id=\$2/);
});

test('migration defines additive assurance structures and constrained lifecycle values', () => {
  const migration = read('sql/migrations/20261124-control-evidence-assurance.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS evidence_lifecycle_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS evidence_usage_links/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS control_effectiveness_assessments/);
  assert.match(migration, /design_rating IN \('not_tested', 'effective', 'partially_effective', 'ineffective'\)/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});
