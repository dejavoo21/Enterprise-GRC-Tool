import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('audit state reads do not seed workspace data', () => {
  assert.doesNotMatch(read('src/services/auditManagementService.ts'), /seedAuditManagementData\(workspaceId\)/);
});

test('audit UI does not create fabricated records', () => {
  const page = read('../frontend/src/pages/AuditReadiness.tsx');
  const modal = read('../frontend/src/components/AuditEntryModal.tsx');
  assert.doesNotMatch(page, /Date\.now|EVID-001|request-note\.docx|New Internal Audit|Control evidence not available/);
  assert.doesNotMatch(modal, /Date\.now|EVID-001|request-note\.docx|New Internal Audit|Control evidence not available/);
  assert.match(page, /AuditEntryModal/);
  assert.match(modal, /Review and save/);
});

test('all audit writes and exports enforce explicit permissions', () => {
  const routes = read('src/routes/audit-readiness.ts');
  const mutations = [...routes.matchAll(/router\.post\([^\n]+/g)].map((match) => match[0]);
  mutations.forEach((route) => assert.match(route, /requirePermission\('Audits','(?:create|edit|approve)'\)/));
  assert.match(routes, /reports\/:reportType', requirePermission\('Audits','export'\)/);
});

test('audit entry routes validate required fields, workspace parents, and report types', () => {
  const routes = read('src/routes/audit-readiness.ts');
  assert.match(routes, /requireFields/);
  assert.match(routes, /invalidParent/);
  assert.match(routes, /listAnnualPlan\(workspaceId\)/);
  assert.match(routes, /listEngagements\(workspaceId\)/);
  assert.match(routes, /listFindings\(workspaceId\)/);
  assert.match(routes, /executive-summary.*findings.*corrective-actions.*framework-readiness/s);
  assert.match(routes, /INVALID_REPORT_TYPE/);
});
