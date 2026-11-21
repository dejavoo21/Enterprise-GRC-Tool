import path from 'node:path';
import { migrationManifest } from './migrationManifest.js';
import { validateMigrationManifest } from './migrationValidation.js';

const migrationDirectory = path.resolve(__dirname, '../../sql/migrations');

async function main() {
  const result = await validateMigrationManifest(migrationManifest, migrationDirectory);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`Migration validation error: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${migrationManifest.length} ordered migrations and checksums.`);
  }
}

void main();
