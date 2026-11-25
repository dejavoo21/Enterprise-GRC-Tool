import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const index = read('src/index.ts');
const routes = read('src/routes/activityLedger.ts');

test('activity ledger export maps POST to Users export permission', () => {
  assert.match(index, /app\.use\('\/api\/v1\/activity-ledger', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions\('Users', \{ POST: 'export' \}\), activityLedgerRouter\)/);
  assert.match(routes, /router\.post\('\/export'/);
});

test('activity ledger has no other POST mutation routes', () => {
  assert.equal((routes.match(/router\.post\(/g) || []).length, 1);
});
