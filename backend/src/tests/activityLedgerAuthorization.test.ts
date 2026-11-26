import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const index = read('src/index.ts');
const routes = read('src/routes/activityLedger.ts');
const page = read('../frontend/src/pages/ActivityLedger.tsx');

test('activity ledger export maps POST to Users export permission', () => {
  assert.match(index, /app\.use\('\/api\/v1\/activity-ledger', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions\('Users', \{ POST: 'export' \}\), activityLedgerRouter\)/);
  assert.match(routes, /router\.post\('\/export'/);
});

test('activity ledger has no other POST mutation routes', () => {
  assert.equal((routes.match(/router\.post\(/g) || []).length, 1);
});

test('activity ledger export rejects duplicate requests and snapshots applied filters', () => {
  assert.match(page, /const exportLock = useRef\(false\)/);
  assert.match(page, /if \(exportLock\.current\) return/);
  assert.match(page, /exportLock\.current = true/);
  assert.match(page, /const exportFilters = \{ \.\.\.filters \}/);
  assert.match(page, /exportActivities\(exportFilters, \{ requireRemote: true \}\)/);
  assert.match(page, /const requestedWorkspaceId = currentWorkspaceIdRef\.current/);
  assert.match(page, /!mountedRef\.current \|\| sequence !== exportRequestSequence\.current \|\| requestedWorkspaceId !== currentWorkspaceIdRef\.current/);
  assert.match(page, /mountedRef\.current && sequence === exportRequestSequence\.current && requestedWorkspaceId === currentWorkspaceIdRef\.current/);
  assert.match(page, /mountedRef\.current && sequence === exportRequestSequence\.current[\s\S]*exportLock\.current = false;[\s\S]*setExporting\(false\)/);
});

test('activity ledger invalidates pending exports when its workspace view unmounts', () => {
  assert.match(page, /key=\{`\$\{workspaceId\}-\$\{initialCategory\}`\}/);
  assert.match(page, /const exportRequestSequence = useRef\(0\)/);
  assert.match(page, /const mountedRef = useRef\(true\)/);
  assert.match(page, /const requestSequenceRef = exportRequestSequence[\s\S]*mountedRef\.current = false;[\s\S]*requestSequenceRef\.current\+\+/);
});
