import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const index = read('src/index.ts');
const routes = read('src/routes/riskMethodologies.ts');

test('risk methodology routes use business-action permissions', () => {
  assert.match(routes, /router\.get\('\/', requirePermission\('Risks', 'view'\)/);
  assert.match(routes, /router\.post\('\/', requirePermission\('Risks', 'create'\), requireMethodologyAdministrator, save\)/);
  assert.match(routes, /router\.patch\('\/:id', requirePermission\('Risks', 'edit'\), requireMethodologyAdministrator, save\)/);
  assert.match(routes, /router\.post\('\/preview', requirePermission\('Risks', 'view'\)/);
  assert.match(routes, /router\.post\('\/:id\/activate', requirePermission\('Risks', 'approve'\), requireMethodologyAdministrator/);
});

test('methodology router keeps authentication and workspace scope without method-derived permissions', () => {
  assert.match(index, /app\.use\('\/api\/v1\/risk-methodologies', requireAuth, requireAuthenticatedWorkspace, riskMethodologiesRouter\)/);
  assert.doesNotMatch(index, /risk-methodologies'.*requireModulePermissions\('Risks'\)/);
  assert.match(routes, /getWorkspaceId\(req\) !== req\.authUser\.workspaceId/);
});
