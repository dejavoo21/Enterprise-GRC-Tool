import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MigrationDefinition } from './migrationManifest.js';

export interface MigrationValidationResult {
  errors: string[];
  checksums: Map<string, string>;
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function validateMigrationManifest(
  manifest: readonly MigrationDefinition[],
  migrationDirectory: string,
): Promise<MigrationValidationResult> {
  const errors: string[] = [];
  const checksums = new Map<string, string>();
  const ids = new Set<string>();
  const files = new Set<string>();
  const seen = new Set<string>();

  for (const migration of manifest) {
    if (ids.has(migration.id)) errors.push(`Duplicate migration ID: ${migration.id}`);
    if (files.has(migration.file)) errors.push(`Duplicate migration file: ${migration.file}`);
    ids.add(migration.id);
    files.add(migration.file);

    for (const dependency of migration.dependsOn) {
      if (!ids.has(dependency)) errors.push(`${migration.id} depends on missing or later migration ${dependency}`);
      if (!seen.has(dependency)) errors.push(`${migration.id} is ordered before dependency ${dependency}`);
    }

    try {
      const content = await readFile(path.join(migrationDirectory, migration.file));
      const checksum = sha256(content);
      checksums.set(migration.id, checksum);
      if (checksum !== migration.sha256) errors.push(`Checksum mismatch for ${migration.id}`);
      if (/\b(?:DROP\s+(?:TABLE|COLUMN)|TRUNCATE)\b/i.test(content.toString()) && !migration.destructive) {
        errors.push(`${migration.id} contains a destructive statement but is not marked destructive`);
      }
    } catch (error) {
      errors.push(`Cannot read ${migration.file}: ${error instanceof Error ? error.message : String(error)}`);
    }
    seen.add(migration.id);
  }

  const diskFiles = (await readdir(migrationDirectory)).filter(file => file.endsWith('.sql')).sort();
  for (const file of diskFiles) {
    if (!files.has(file)) errors.push(`Unmanifested SQL migration: ${file}`);
  }
  for (const file of files) {
    if (!diskFiles.includes(file)) errors.push(`Manifest references missing SQL migration: ${file}`);
  }

  return { errors, checksums };
}

export function assertAppliedPrefix(appliedIds: readonly string[], manifest: readonly MigrationDefinition[]): void {
  const expected = manifest.slice(0, appliedIds.length).map(item => item.id);
  if (appliedIds.some((id, index) => id !== expected[index])) {
    throw new Error('Applied migration history is not a contiguous manifest prefix; manual reconciliation is required.');
  }
}
