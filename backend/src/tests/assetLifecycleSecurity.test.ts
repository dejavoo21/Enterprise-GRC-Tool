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
  assert.match(page, /const requestClose = \(\) => \{ if \(!submitting && !submitLock\.current\) onClose\(\); \};/);
  assert.match(page, /onClose=\{requestClose\} title="Link existing risk"/);
  assert.match(page, /Existing Risk ID<input[\s\S]*disabled=\{submitting\}/);
});

test('asset mutation workflows use labelled accessible dialogs', () => {
  const page = read('../frontend/src/pages/Assets.tsx');
  assert.match(page, /title="Add Enterprise Asset"/);
  assert.match(page, /title="Bulk Update Assets"/);
  assert.match(page, /title="Complete Asset Review"/);
  assert.equal((page.match(/<Modal accessibleDialog/g) || []).length, 4);
  assert.match(page, />Asset name<input/);
  assert.match(page, />Platform owner<input/);
  assert.match(page, />Lifecycle status<select/);
  assert.match(page, />Reviewer<input/);
  assert.doesNotMatch(page, /position: 'fixed', inset: 0/);
});

test('asset mutations synchronously lock captured values during persistence', () => {
  const page = read('../frontend/src/pages/Assets.tsx');
  assert.equal((page.match(/const submitLock = useRef\(false\);/g) || []).length, 4);
  assert.equal((page.match(/if \(submitLock\.current\) return;/g) || []).length, 4);
  assert.equal((page.match(/submitLock\.current = true;/g) || []).length, 4);
  assert.equal((page.match(/submitLock\.current = false;/g) || []).length, 4);
  assert.equal((page.match(/!submitting && !submitLock\.current/g) || []).length, 4);
  assert.equal((page.match(/aria-busy=\{submitting\}/g) || []).length, 3);
  assert.equal((page.match(/<fieldset disabled=\{submitting\} style=\{\{ display: 'contents' \}\}>/g) || []).length, 3);
  assert.match(page, /\{submitting \? 'Creating\.\.\.' : 'Create Asset'\}/);
  assert.match(page, /\{submitting \? 'Updating\.\.\.' : 'Apply Changes'\}/);
  assert.match(page, /\{submitting \? 'Saving\.\.\.' : 'Complete Review'\}/);
});

test('asset register refresh uses stable selection identity and restores route search', () => {
  const page = read('../frontend/src/pages/Assets.tsx');
  assert.match(page, /const selectedAssetId = selectedAsset\?\.asset\.id;/);
  assert.match(page, /else if \(selectedAssetId\) \{\s*const detail = await apiCall<ApiResponse<AssetDetailResponse>>\(`\$\{API_BASE\}\/\$\{selectedAssetId\}`\)/);
  assert.match(page, /\[search, statusFilter, typeFilter, selectedAssetId\]/);
  assert.doesNotMatch(page, /\[search, statusFilter, typeFilter, selectedAsset\]/);
  assert.match(page, /if \(routeSearch !== routeSearchRef\.current\) \{\s*routeSearchRef\.current = routeSearch;\s*setSearch\(routeSearch\)/);
});
