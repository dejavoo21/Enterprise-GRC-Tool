import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('asset routes apply action-specific permissions', () => {
  const routes = read('src/routes/assets.ts');
  const index = read('src/index.ts');
  assert.match(routes, /router\.use\(requirePermission\('Controls', 'view'\)\)/);
  assert.match(routes, /router\.post\('\/', requirePermission\('Controls', 'create'\)/);
  assert.match(routes, /router\.patch\('\/:id', requirePermission\('Controls', 'edit'\)/);
  assert.match(routes, /router\.post\('\/:id\/reviews', requirePermission\('Controls', 'approve'\)/);
  assert.match(routes, /router\.post\('\/:id\/verify', requirePermission\('Controls', 'approve'\)/);
  assert.doesNotMatch(index, /assets'.*requireModulePermissions\('Controls'\)/);
});

test('asset relationships derive target labels from workspace-scoped records', () => {
  const repository = read('src/repositories/assetsRepo.ts');
  const routes = read('src/routes/assets.ts');
  assert.match(repository, /target\.workspace_id = \$2 AND target\.id::text = \$5/);
  assert.match(repository, /target\.\$\{target\.label\}/);
  assert.doesNotMatch(routes, /targetName are required/);
  assert.doesNotMatch(routes, /targetName\s*}\s*=\s*req\.body/);
});

test('asset risk linking uses a reviewed accessible dialog', () => {
  const page = read('../frontend/src/pages/Assets.tsx');
  assert.doesNotMatch(page, /window\.(prompt|alert|confirm)/);
  assert.match(page, /function LinkRiskModal/);
  assert.match(page, /<Modal accessibleDialog/);
  assert.match(page, /No risk record will be created/);
  assert.match(page, /role="alert"/);
});
