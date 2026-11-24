import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('audit state reads do not seed workspace data', () => {
  assert.doesNotMatch(read('src/services/auditManagementService.ts'), /seedAuditManagementData\(workspaceId\)/);
});

test('audit UI does not create fabricated records', () => {
  const page = read('../frontend/src/pages/AuditReadiness.tsx');
  assert.doesNotMatch(page, /Date\.now|EVID-001|request-note\.docx|New Internal Audit|Control evidence not available/);
  assert.doesNotMatch(page, /createAudit(?:PlanItem|Engagement|Finding|Recommendation|CorrectiveAction|EvidenceRequest|Workpaper)/);
});

test('all audit writes and exports enforce explicit permissions', () => {
  const routes = read('src/routes/audit-readiness.ts');
  const mutations = [...routes.matchAll(/router\.post\([^\n]+/g)].map((match) => match[0]);
  mutations.forEach((route) => assert.match(route, /requirePermission\('Audits','(?:create|edit|approve)'\)/));
  assert.match(routes, /reports\/:reportType', requirePermission\('Audits','export'\)/);
});
