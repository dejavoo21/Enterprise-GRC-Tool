import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
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
