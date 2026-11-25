import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routes = readFileSync(resolve(process.cwd(), 'src/routes/adminAccessGovernance.ts'), 'utf8');

test('access governance decisions require Users approval permission', () => {
  assert.match(routes, /access-requests\/:id\/approve', requirePermission\('Users', 'approve'\), requireStepUp\('approve_access_request'\)/);
  assert.match(routes, /access-requests\/:id\/reject', requirePermission\('Users', 'approve'\)/);
  assert.match(routes, /access-requests\/:id\/request-info', requirePermission\('Users', 'approve'\)/);
  assert.match(routes, /access-reviews\/:id\/items\/:itemId', requirePermission\('Users', 'approve'\)/);
});

test('access review evidence export requires only the export action plus step-up', () => {
  assert.match(routes, /access-reviews\/:id\/export-evidence', requirePermission\('Users', 'export'\), requireStepUp\('export_access_review'\)/);
  assert.doesNotMatch(routes, /router\.use\(requireModulePermissions\('Users'/);
});

test('access governance lifecycle routes retain explicit CRUD permissions', () => {
  assert.match(routes, /router\.get\('\/state', requirePermission\('Users', 'view'\)/);
  assert.match(routes, /router\.post\('\/roles', requirePermission\('Users', 'create'\)/);
  assert.match(routes, /router\.patch\('\/roles\/:id', requirePermission\('Users', 'edit'\)/);
  assert.match(routes, /router\.delete\('\/users\/:id\/access', requirePermission\('Users', 'delete'\), requireStepUp\('revoke_access'\)/);
});
