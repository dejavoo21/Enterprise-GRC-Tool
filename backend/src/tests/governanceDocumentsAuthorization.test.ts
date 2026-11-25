import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const routes = read('src/routes/governance-documents.ts');
const repository = read('src/repositories/governanceDocumentsRepo.ts');

test('governance document routes enforce action-specific Policies permissions', () => {
  assert.match(routes, /router\.get\('\/', requirePermission\('Policies', 'view'\)/);
  assert.match(routes, /router\.get\('\/summary', requirePermission\('Policies', 'view'\)/);
  assert.match(routes, /router\.get\('\/:id', requirePermission\('Policies', 'view'\)/);
  assert.match(routes, /router\.post\('\/', requirePermission\('Policies', 'create'\)/);
  assert.match(routes, /router\.patch\('\/:id', requirePermission\('Policies', 'edit'\)/);
  assert.match(routes, /router\.delete\('\/:id', requirePermission\('Policies', 'delete'\)/);
  assert.match(routes, /router\.get\('\/:id\/frameworks', requirePermission\('Policies', 'view'\)/);
  assert.match(routes, /router\.put\('\/:id\/frameworks', requirePermission\('Policies', 'edit'\)/);
  assert.match(routes, /router\.post\('\/:id\/frameworks', requirePermission\('Policies', 'edit'\)/);
  assert.match(routes, /router\.delete\('\/:id\/frameworks\/:frameworkCode', requirePermission\('Policies', 'edit'\)/);
});

test('governance document acknowledgement remains a view-scoped action', () => {
  assert.match(routes, /router\.post\('\/:id\/acknowledge', requirePermission\('Policies', 'view'\)/);
});

test('governance document repository operations retain workspace predicates', () => {
  assert.match(repository, /whereClause = 'gd\.workspace_id = \$1'/);
  assert.match(repository, /WHERE id = \$1 AND workspace_id = \$2/);
  assert.match(repository, /WHERE workspace_id=\$1 AND document_id=\$2/);
});
