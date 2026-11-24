import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { migrationManifest } from '../scripts/migrationManifest.js';
import { assertAppliedPrefix, sha256, validateMigrationManifest } from '../scripts/migrationValidation.js';

const migrationDirectory = path.resolve(__dirname, '../../sql/migrations');

test('repository migration manifest is complete, ordered, and checksum stable', async () => {
  const result = await validateMigrationManifest(migrationManifest, migrationDirectory);
  assert.deepEqual(result.errors, []);
  assert.equal(result.checksums.size, migrationManifest.length);
});

test('manifest validation rejects changed history and unmanifested SQL', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'laflo-migrations-'));
  await writeFile(path.join(directory, '001.sql'), 'SELECT 1;');
  await writeFile(path.join(directory, 'unexpected.sql'), 'SELECT 2;');
  const result = await validateMigrationManifest([
    { id: '001', file: '001.sql', sha256: sha256('different'), dependsOn: [], purpose: 'test', destructive: false },
  ], directory);
  assert.ok(result.errors.includes('Checksum mismatch for 001'));
  assert.ok(result.errors.includes('Unmanifested SQL migration: unexpected.sql'));
});

test('applied migration history must be a contiguous manifest prefix', () => {
  assert.doesNotThrow(() => assertAppliedPrefix(migrationManifest.slice(0, 3).map(item => item.id), migrationManifest));
  assert.throws(
    () => assertAppliedPrefix([migrationManifest[0].id, migrationManifest[2].id], migrationManifest),
    /not a contiguous manifest prefix/,
  );
});

test('enterprise lifecycle migrations preserve canonical key types and transactional execution', async () => {
  const supplier = await readFile(path.join(migrationDirectory, '20261123-supplier-contract-lifecycle.sql'), 'utf8');
  const ai = await readFile(path.join(migrationDirectory, '20261124-ai-model-review-lifecycle.sql'), 'utf8');
  const privacy = await readFile(path.join(migrationDirectory, '20261124-privacy-dpia-lifecycle.sql'), 'utf8');
  const assurance = await readFile(path.join(migrationDirectory, '20261124-control-evidence-assurance.sql'), 'utf8');
  const runner = await readFile(path.resolve(__dirname, '../scripts/migrate-risk.ts'), 'utf8');

  assert.match(supplier, /supplier_id\s+UUID\s+NOT NULL REFERENCES vendors\(id\)/i);
  assert.match(supplier, /contract_id\s+UUID\s+NOT NULL REFERENCES vendor_contracts\(id\)/i);
  assert.match(supplier, /assessment_id\s+UUID\s+NOT NULL REFERENCES vendor_risk_assessments\(id\)/i);
  assert.match(ai, /model_id\s+TEXT\s+NOT NULL REFERENCES ai_models\(id\)/i);
  assert.match(privacy, /dpia_id\s+TEXT\s+NOT NULL REFERENCES privacy_dpias\(id\)/i);
  assert.match(assurance, /evidence_id\s+UUID\s+NOT NULL REFERENCES evidence\(id\)/i);
  assert.match(assurance, /control_id\s+TEXT\s+NOT NULL REFERENCES controls\(id\)/i);

  assert.match(runner, /const body = sql\.replace\(\/\^BEGIN;/);
  assert.match(runner, /await client\.query\('BEGIN'\)/);
  assert.match(runner, /SET LOCAL statement_timeout/);
  assert.match(runner, /SET LOCAL lock_timeout/);
  assert.match(runner, /await client\.query\('COMMIT'\)/);
  assert.match(runner, /await client\.query\('ROLLBACK'\)/);
});
