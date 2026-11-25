import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const index = read('src/index.ts');
const routes = read('src/routes/frameworkAssessmentScopes.ts');

test('framework assessment scope routes enforce business-action permissions', () => {
  assert.match(routes, /router\.get\('\/', requirePermission\('Controls', 'view'\)/);
  assert.match(routes, /router\.post\('\/', requirePermission\('Controls', 'create'\)/);
  assert.match(routes, /router\.get\('\/:id', requirePermission\('Controls', 'view'\)/);
  assert.match(routes, /router\.patch\('\/:id\/controls\/:controlId', requirePermission\('Controls', 'edit'\)/);
  assert.match(routes, /router\.post\('\/:id\/include-all', requirePermission\('Controls', 'edit'\)/);
  assert.match(routes, /router\.post\('\/:id\/approve', requirePermission\('Controls', 'approve'\)/);
});

test('framework assessment router does not inherit method-derived permission actions', () => {
  assert.match(index, /app\.use\('\/api\/v1\/framework-assessment-scopes', requireAuth, requireAuthenticatedWorkspace, frameworkAssessmentScopesRouter\)/);
  assert.doesNotMatch(index, /framework-assessment-scopes'.*requireModulePermissions\('Controls'\)/);
});
