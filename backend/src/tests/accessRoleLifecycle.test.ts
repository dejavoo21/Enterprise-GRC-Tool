import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { isBuiltInPrivilegedRole, validateRoleCreateInput, validateRoleUpdateInput } from '../services/accessRoleRules.js';
import { validateAndFlattenPermissionMatrix } from '../services/accessGovernanceService.js';

test('custom role creation requires explicit reviewed details', () => {
  assert.match(validateRoleCreateInput({ name: '', description: '' }) || '', /name is required/i);
  assert.match(validateRoleCreateInput({ name: 'Reviewer', description: '' }) || '', /description is required/i);
  assert.equal(validateRoleCreateInput({ name: 'Reviewer', description: 'Reviews recorded controls.', inheritedFrom: 'auditor' }), null);
});

test('generic role updates cannot bypass guarded lifecycle transitions', () => {
  assert.equal(validateRoleUpdateInput({ name: ' Reviewer ', description: ' Reviews controls. ' }), null);
  assert.match(validateRoleUpdateInput({}) || '', /at least one role field/i);
  assert.match(validateRoleUpdateInput({ name: '   ' }) || '', /name is required/i);
  assert.match(validateRoleUpdateInput({ status: 'disabled' }) || '', /only the role name and description/i);
  assert.match(validateRoleUpdateInput({ isDefault: false }) || '', /only the role name and description/i);
});

test('only built-in administrative roots are intrinsically privileged', () => {
  assert.equal(isBuiltInPrivilegedRole('super_admin'), true);
  assert.equal(isBuiltInPrivilegedRole('tenant_admin'), true);
  assert.equal(isBuiltInPrivilegedRole('grc_manager'), false);
  assert.equal(isBuiltInPrivilegedRole('custom_reviewer'), false);
});

test('permission matrices accept only workspace roles, canonical keys, and booleans', () => {
  const valid = validateAndFlattenPermissionMatrix('workspace-a', {
    auditor: { Evidence: { view: true, approve: false } },
  }, ['auditor']);
  assert.equal(valid.error, null);
  assert.deepEqual(valid.rows.map(({ roleId, module, action, allowed }) => ({ roleId, module, action, allowed })), [
    { roleId: 'auditor', module: 'Evidence', action: 'view', allowed: true },
    { roleId: 'auditor', module: 'Evidence', action: 'approve', allowed: false },
  ]);
  assert.match(validateAndFlattenPermissionMatrix('workspace-a', { foreign: { Evidence: { view: true } } }, ['auditor']).error || '', /not available in this workspace/i);
  assert.match(validateAndFlattenPermissionMatrix('workspace-a', { auditor: { Unknown: { view: true } } }, ['auditor']).error || '', /module unknown is not supported/i);
  assert.match(validateAndFlattenPermissionMatrix('workspace-a', { auditor: { Evidence: { publish: true } } }, ['auditor']).error || '', /action publish is not supported/i);
  assert.match(validateAndFlattenPermissionMatrix('workspace-a', { auditor: { Evidence: { view: 'false' } } }, ['auditor']).error || '', /must be true or false/i);
  assert.match(validateAndFlattenPermissionMatrix('workspace-a', {}, ['auditor']).error || '', /at least one permission/i);
});

test('role lifecycle preserves RBAC ordering and transactional persistence', () => {
  const route = readFileSync(resolve(process.cwd(), 'src/routes/adminAccessGovernance.ts'), 'utf8');
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/accessGovernanceRepo.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/admin/AccessGovernanceViews.tsx'), 'utf8');
  assert.match(route, /router\.patch\('\/users\/:id\/role', requirePermission\('Users', 'edit'\), requireStepUpForPrivilegedRole/);
  assert.match(route, /await repo\.roleRequiresStepUp/);
  assert.match(route, /router\.post\('\/roles', requirePermission\('Users', 'create'\), requireStepUpForInheritedRole/);
  assert.match(route, /router\.post\('\/roles\/:id\/duplicate', requirePermission\('Users', 'create'\), requireStepUpForDuplicatedRole/);
  assert.match(route, /req\.body\?\.inheritedFrom/);
  assert.match(route, /repo\.roleRequiresStepUp\(req\.authUser!\.workspaceId, req\.params\.id\)/);
  assert.match(route, /validateAndFlattenPermissionMatrix/);
  assert.match(route, /roles\.map\(\(role\) => role\.id\)/);
  assert.match(route, /Default roles cannot be disabled/);
  assert.match(route, /Reassign all users before disabling this role/);
  assert.match(route, /validateRoleUpdateInput\(req\.body\)/);
  assert.match(route, /name: req\.body\.name\.trim\(\)/);
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
  assert.match(page, /const roleMutationLock = useRef\(false\)/);
  assert.match(page, /if \(roleMutationLock\.current\) return/);
  assert.match(page, /const assignmentLock = useRef\(false\)/);
  assert.match(page, /if \(assignmentLock\.current\) return/);
  assert.match(page, /<fieldset disabled=\{Boolean\(busyRoleId\)\} aria-busy=\{busyRoleId === 'new-role'\}/);
  assert.match(page, /const decisionLock = useRef\(false\)/);
  assert.match(page, /if \(!pendingDecision \|\| decisionLock\.current\) return/);
  assert.match(page, /<fieldset disabled=\{decisionBusy\} aria-busy=\{decisionBusy\}/);
  assert.match(page, /const launchLock = useRef\(false\)/);
  assert.match(page, /if \(launchLock\.current\) return/);
  assert.match(page, /<fieldset disabled=\{launchBusy\} aria-busy=\{launchBusy\}/);
  assert.match(page, /\{launchBusy \? 'Launching\.\.\.' : 'Launch Access Review'\}/);
  assert.doesNotMatch(page, /Custom role created for enterprise access governance/);
});
