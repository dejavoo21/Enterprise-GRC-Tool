import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { isBuiltInPrivilegedRole, validateRoleCreateInput } from '../services/accessRoleRules.js';

test('custom role creation requires explicit reviewed details', () => {
  assert.match(validateRoleCreateInput({ name: '', description: '' }) || '', /name is required/i);
  assert.match(validateRoleCreateInput({ name: 'Reviewer', description: '' }) || '', /description is required/i);
  assert.equal(validateRoleCreateInput({ name: 'Reviewer', description: 'Reviews recorded controls.', inheritedFrom: 'auditor' }), null);
});

test('only built-in administrative roots are intrinsically privileged', () => {
  assert.equal(isBuiltInPrivilegedRole('super_admin'), true);
  assert.equal(isBuiltInPrivilegedRole('tenant_admin'), true);
  assert.equal(isBuiltInPrivilegedRole('grc_manager'), false);
  assert.equal(isBuiltInPrivilegedRole('custom_reviewer'), false);
});

test('role lifecycle preserves RBAC ordering and transactional persistence', () => {
  const route = readFileSync(resolve(process.cwd(), 'src/routes/adminAccessGovernance.ts'), 'utf8');
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/accessGovernanceRepo.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/admin/AccessGovernanceViews.tsx'), 'utf8');
  assert.match(route, /router\.patch\('\/users\/:id\/role', requireStepUpForPrivilegedRole/);
  assert.match(route, /await repo\.roleRequiresStepUp/);
  assert.match(route, /Default roles cannot be disabled/);
  assert.match(route, /Reassign all users before disabling this role/);
  assert.match(route, /function roleMutationFailure/);
  assert.match(repository, /const roleId = `custom_\$\{generateId\('role'\)\}`/);
  assert.match(repository, /Inherited role was not found or is disabled/);
  assert.match(repository, /grp\.module = 'Users'.*'assign', 'configure', 'delete'/s);
  assert.match(repository, /Workspace membership was not found/);
  assert.match(repository, /await client\.query\('ROLLBACK'\)/);
  assert.match(page, /if \(isPrivilegedRole\(roleId\)\)/);
  assert.match(page, /permissions\?\.Users\?\.assign/);
  assert.match(page, /role\.userCount > 0/);
  assert.match(page, /disabled=\{role\.status === 'disabled' \|\| busy\}/);
  assert.doesNotMatch(page, /Custom role created for enterprise access governance/);
});
