import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { migrationManifest } from '../scripts/migrationManifest.js';
import {
  extractCreatedTables,
  findTypeScriptDdlOwners,
  knownRuntimeDdlOwners,
  unexpectedRuntimeDdlOwners,
} from '../scripts/schemaOwnershipPolicy.js';

const backendRoot = process.cwd();
const sourceRoot = path.join(backendRoot, 'src');

test('runtime DDL remains confined to the reviewed Phase 0C owner inventory', async () => {
  const owners = await findTypeScriptDdlOwners(sourceRoot);
  assert.deepEqual(unexpectedRuntimeDdlOwners(owners), []);
  assert.deepEqual(
    owners.filter(owner => knownRuntimeDdlOwners.includes(owner as never)).sort(),
    [...knownRuntimeDdlOwners].sort(),
  );
});

test('known duplicate table ownership is detected between migrations and runtime DDL', async () => {
  const migrationTables = new Set<string>();
  for (const migration of migrationManifest) {
    const sql = await readFile(path.join(backendRoot, 'sql/migrations', migration.file), 'utf8');
    for (const table of extractCreatedTables(sql)) migrationTables.add(table);
  }

  const expectedDuplicates: string[] = [];
  const runtimeDuplicates = new Set<string>();
  for (const owner of knownRuntimeDdlOwners) {
    const content = await readFile(path.join(sourceRoot, owner), 'utf8');
    for (const table of extractCreatedTables(content)) {
      if (migrationTables.has(table)) runtimeDuplicates.add(table);
    }
  }
  assert.deepEqual([...runtimeDuplicates].sort(), expectedDuplicates);
});

test('migration manifest remains unique and dependency ordered', () => {
  assert.equal(new Set(migrationManifest.map(item => item.id)).size, migrationManifest.length);
  assert.equal(new Set(migrationManifest.map(item => item.sha256)).size, migrationManifest.length);
  const positions = new Map(migrationManifest.map((item, index) => [item.id, index]));
  for (const [index, migration] of migrationManifest.entries()) {
    for (const dependency of migration.dependsOn) {
      assert.ok((positions.get(dependency) ?? Number.POSITIVE_INFINITY) < index, `${migration.id} must follow ${dependency}`);
    }
  }
});
