import path from 'node:path';
import {
  findTypeScriptDdlOwners,
  knownRuntimeDdlOwners,
  unexpectedRuntimeDdlOwners,
} from './schemaOwnershipPolicy.js';

async function main() {
  const sourceRoot = path.resolve(__dirname, '../../src');
  const owners = await findTypeScriptDdlOwners(sourceRoot);
  const unexpected = unexpectedRuntimeDdlOwners(owners);
  const runtimeOwners = owners.filter(owner => knownRuntimeDdlOwners.includes(owner as never));

  if (unexpected.length > 0) {
    for (const owner of unexpected) console.error(`Unclassified runtime DDL owner: ${owner}`);
    process.exitCode = 1;
    return;
  }
  if (runtimeOwners.length !== knownRuntimeDdlOwners.length) {
    console.error(`Runtime DDL inventory mismatch: expected ${knownRuntimeDdlOwners.length}, found ${runtimeOwners.length}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Validated ${runtimeOwners.length} known runtime DDL owners; no unclassified owners found.`);
}

void main();
