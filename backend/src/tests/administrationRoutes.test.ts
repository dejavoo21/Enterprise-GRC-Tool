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

  assert.match(indexSource, /\/api\/v1\/activity-ledger', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions\('Users', \{ POST: 'export' \}\)/);
  assert.match(indexSource, /\/api\/v1\/admin', requireAuth, requireAuthenticatedWorkspace/);
  assert.match(governanceRoutes, /requirePermission\('Users', 'view'\)/);
  assert.match(governanceRoutes, /requirePermission\('Users', 'approve'\)/);
  assert.match(governanceRoutes, /requirePermission\('Users', 'export'\)/);
  assert.match(governanceRoutes, /req\.authUser!\.workspaceId/);
});

test('security settings use labelled responsive controls and announced feedback', async () => {
  const page = await read('../frontend/src/pages/AdminSecuritySettings.tsx');

  assert.match(page, /Current password<input type="password" autoComplete="current-password"/);
  assert.match(page, /One-time verification code<input inputMode="numeric" autoComplete="one-time-code"/);
  assert.match(page, /Passkey label<input/);
  assert.match(page, /repeat\(auto-fit, minmax\(min\(100%, 360px\), 1fr\)\)/);
  assert.match(page, /role="status" aria-live="polite"/);
  assert.match(page, /role="alert"/);
  assert.match(page, /<label style=\{\{ display: 'flex'.*requireMfaForLogin/s);
  assert.match(page, /type SecurityConfirmation/);
  assert.match(page, /accessibleDialog[\s\S]*title=\{confirmationContent\.title\}/);
  assert.match(page, /Generating a new set immediately invalidates every existing recovery code/);
  assert.match(page, /This revokes every active session for this account/);
  assert.match(page, /if \(succeeded && confirmation\.kind !== 'logout-all'\) setConfirmation\(null\)/);
  assert.match(page, /const mutationLock = useRef\(false\)/);
  assert.match(page, /if \(mutationLock\.current\) return false/);
  assert.equal((page.match(/finishMutation\(\);/g) || []).length, 8);
  assert.match(page, /disabled=\{busyKey === 'password'\}/);
  assert.match(page, /disabled=\{busyKey === 'totp-enable'\}/);
  assert.match(page, /Passkey label<input disabled=\{busyKey === 'passkey'\}/);
  assert.doesNotMatch(page, /onClick=\{regenerateRecoveryCodes\}/);
  assert.doesNotMatch(page, /onClick=\{logoutAllSessions\}/);
});

test('step-up verification uses the accessible reviewed dialog contract', async () => {
  const modal = await read('../frontend/src/components/StepUpVerificationModal.tsx');

  assert.match(modal, /<Modal[\s\S]*accessibleDialog/);
  assert.match(modal, /const requestClose = \(\) => \{ if \(!busy && !requestLock\.current\) onClose\(\); \};/);
  assert.match(modal, /onClose=\{requestClose\}/);
  assert.match(modal, /onClick=\{requestClose\} disabled=\{busy\}/);
  assert.match(modal, /const requestLock = useRef\(false\)/);
  assert.equal((modal.match(/if \(requestLock\.current\) return;/g) || []).length, 2);
  assert.equal((modal.match(/requestLock\.current = false;/g) || []).length, 2);
  assert.match(modal, /<fieldset disabled=\{busy\} aria-busy=\{busy\}/);
  assert.match(modal, /Confirm password/);
  assert.match(modal, /autoComplete=\{method === 'password' \? 'current-password' : 'one-time-code'\}/);
  assert.match(modal, /aria-pressed=\{method === 'passkey'\}/);
  assert.match(modal, /role="status" aria-live="polite"/);
  assert.match(modal, /role="alert"/);
  assert.doesNotMatch(modal, /position: 'fixed', inset: 0/);
});
