import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const output = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/adminWorkspace.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' });
const { filterAdminRequests, filterAdminUsers, summarizeAdminEvents } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);
const requestFilters = { search: '', status: '', role: '', workspace: '', from: '', to: '' };
const requests = [
  { id: 'a', requesterName: 'Test Owner', requesterEmail: 'owner@example.test', requestedRoleId: 'tenant_admin', requestedRoleName: 'Tenant Admin', requestedWorkspace: 'Isolated QA', requestDate: '2026-09-26T23:59:59.999Z', status: 'pending' },
  { id: 'b', requesterName: 'Test Auditor', requesterEmail: 'audit@example.test', requestedRoleId: 'auditor', requestedRoleName: 'Auditor', requestedWorkspace: 'Other QA', requestDate: '2026-09-25T12:00:00Z', status: 'approved' },
];
test('request filters combine scope, role, status and normalized search without mutation', () => {
  const original = structuredClone(requests);
  assert.deepEqual(filterAdminRequests(requests, { ...requestFilters, search: ' OWNER ', status: 'pending', role: 'tenant_admin', workspace: 'Isolated QA' }).map(row => row.id), ['a']);
  assert.deepEqual(filterAdminRequests(requests, { ...requestFilters, status: 'rejected' }), []);
  assert.deepEqual(requests, original);
});
test('request date filter includes end of day and excludes invalid or outside dates', () => {
  const rows = [...requests, { ...requests[0], id: 'bad', requestDate: 'not-a-date' }];
  assert.deepEqual(filterAdminRequests(rows, { ...requestFilters, from: '2026-09-26', to: '2026-09-26' }).map(row => row.id), ['a']);
  assert.deepEqual(filterAdminRequests(rows, { ...requestFilters, from: '2026-09-27', to: '2026-09-26' }), []);
});
test('user filters preserve exact scope and never infer roles or access', () => {
  const rows = [{ id: 'a', fullName: 'Test Admin', email: 'a@example.test', assignedRoleId: 'tenant_admin', assignedRoleName: 'Tenant Admin', workspaceName: 'QA', accessScope: 'Finance', status: 'active' }];
  assert.equal(filterAdminUsers(rows, { search: ' TEST ', status: 'active', role: 'tenant_admin', scope: 'Finance' }).length, 1);
  assert.equal(filterAdminUsers(rows, { search: '', status: '', role: '', scope: 'Legal' }).length, 0);
});
test('permission denials are not conflated with general authentication failures', () => {
  const rows = [
    { timestamp: '2026-09-26T10:00:00Z', action: 'permission.denied', category: 'rbac', severity: 'high' },
    { timestamp: '2026-09-25T10:00:00Z', action: 'auth.invalid_token', category: 'auth', severity: 'medium' },
    { timestamp: '2026-09-26T11:00:00Z', action: 'access_denied', category: 'user', severity: 'critical' },
  ];
  assert.deepEqual(summarizeAdminEvents(rows, new Date('2026-09-26T12:00:00Z')), { today: 2, permissionDenials: 2, accessChanges: 0, highPriority: 2 });
  assert.equal(summarizeAdminEvents([{ timestamp: '2026-09-26T12:00:00Z', action: 'role_assigned', category: 'rbac', severity: 'info' }], new Date('2026-09-26')).accessChanges, 1);
  assert.deepEqual(summarizeAdminEvents([], new Date('2026-09-26')), { today: 0, permissionDenials: 0, accessChanges: 0, highPriority: 0 });
});
