import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('operations federation includes native audit, regulatory and workflow sources', async () => {
  const repository = await read('backend/src/repositories/issuesRepo.ts');
  assert.match(repository, /getAuditActions\(workspaceId\)/);
  assert.match(repository, /getRegulatoryTasks\(workspaceId\)/);
  assert.match(repository, /getWorkflowAssignments\(workspaceId\)/);
  assert.match(repository, /sourceType: 'Audit Readiness'/);
  assert.match(repository, /sourceType: 'Regulatory'/);
  assert.match(repository, /sourceType: 'Workflow'/);
  assert.match(repository, /sourceManaged: true/);
});

test('native source references drive synchronization identity', async () => {
  const repository = await read('backend/src/repositories/riskActionsRepo.ts');
  assert.match(repository, /const sourceReference = item\.sourceReference \|\| item\.id/);
  assert.match(repository, /existing\.get\(`\$\{item\.sourceType\}:\\0\$\{sourceReference\}`\)/);
  assert.match(repository, /sourceType:item\.sourceType, sourceReference/);
  assert.match(repository, /existing\.sourceManaged\?\{blockerReason:/);
  assert.doesNotMatch(repository, /sets\.push\('source_managed=FALSE'/);
});

test('new sources are filterable in the API and action tracker', async () => {
  const route = await read('backend/src/routes/issues.ts');
  const page = await read('frontend/src/pages/Issues.tsx');
  for (const source of ['Regulatory', 'Workflow']) {
    assert.match(route, new RegExp(`'${source}'`));
    assert.match(page, new RegExp(`'${source}'`));
  }
});
