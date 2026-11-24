import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFile(resolve(process.cwd(), path), 'utf8');

test('administration routes use persisted governance and security workflows', async () => {
  const [usersPage, authenticationPage, loginPage, ledgerPage] = await Promise.all([
    read('../frontend/src/pages/AdminUsers.tsx'),
    read('../frontend/src/pages/AdminAuthentication.tsx'),
    read('../frontend/src/pages/AdminLoginActivity.tsx'),
    read('../frontend/src/pages/ActivityLedger.tsx'),
  ]);

  assert.match(usersPage, /TeamAccessGovernancePage/);
  assert.doesNotMatch(usersPage, /AccessSecurityModule/);
  assert.match(authenticationPage, /AdminSecuritySettings/);
  assert.doesNotMatch(authenticationPage, /AccessSecurityModule/);
  assert.match(loginPage, /initialCategory="auth"/);
  assert.match(ledgerPage, /requireRemote: true/);
  await assert.rejects(
    () => read('../frontend/src/pages/admin/AccessSecurityModule.tsx'),
    /ENOENT/,
    'the retired fixture-backed administration module must not be restored',
  );
});

test('administration APIs enforce authenticated workspace and Users permissions', async () => {
  const [indexSource, governanceRoutes] = await Promise.all([
    read('src/index.ts'),
    read('src/routes/adminAccessGovernance.ts'),
  ]);

  assert.match(indexSource, /\/api\/v1\/activity-ledger', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions\('Users'\)/);
  assert.match(indexSource, /\/api\/v1\/admin', requireAuth, requireAuthenticatedWorkspace/);
  assert.match(governanceRoutes, /requireModulePermissions\('Users'/);
  assert.match(governanceRoutes, /req\.authUser!\.workspaceId/);
});
