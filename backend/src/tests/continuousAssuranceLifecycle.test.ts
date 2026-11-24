import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('continuous assurance lifecycle is persisted and workspace scoped', async () => {
  const [migration, repository] = await Promise.all([
    read('backend/sql/migrations/20261124-continuous-assurance-lifecycle.sql'),
    read('backend/src/repositories/continuousAssuranceRepo.ts'),
  ]);
  for (const table of ['ccm_control_monitors', 'ccm_automated_tests', 'ccm_test_runs', 'ccm_assurance_exceptions', 'ccm_remediation_tasks']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(repository, /workspace_id=\$1/);
  assert.match(repository, /BEGIN/);
  assert.match(repository, /ROLLBACK/);
});

test('reviewed results create exceptions without fabricated evidence', async () => {
  const [service, repository] = await Promise.all([
    read('backend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('backend/src/repositories/continuousAssuranceRepo.ts'),
  ]);
  assert.match(service, /A reviewed result, summary and details are required/);
  assert.match(repository, /input\.status === 'failed' \|\| input\.status === 'warning'/);
  assert.match(repository, /input\.evidenceIds/);
  assert.doesNotMatch(service, /createSeedState|stateStore|EVID-AUTO/);
});

test('terminal exception resolution requires evidence and rationale', async () => {
  const repository = await read('backend/src/repositories/continuousAssuranceRepo.ts');
  assert.match(repository, /Resolution requires an authenticated reviewer, rationale and evidence references/);
});

test('external assurance providers remain explicitly unavailable', async () => {
  const [service, frontend] = await Promise.all([
    read('backend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('frontend/src/pages/ContinuousAssurancePages.tsx'),
  ]);
  assert.match(service, /errorWithStatus\(`\$\{capability\} is unavailable until an approved provider is configured`, 501\)/);
  assert.match(frontend, /Provider integration unavailable/);
  assert.match(frontend, /LAFLO will not simulate connector health/);
  assert.doesNotMatch(frontend, /api\.example\.com|Mock-safe/);
});

test('frontend does not silently replace API failures with seeded state', async () => {
  const frontendService = await read('frontend/src/services/continuousAssurance/continuousAssurance.ts');
  assert.doesNotMatch(frontendService, /function seedState/);
  assert.match(frontendService, /return fetchStateFromApi\(workspaceId\)/);
  assert.match(frontendService, /return operation\(\)/);
});
