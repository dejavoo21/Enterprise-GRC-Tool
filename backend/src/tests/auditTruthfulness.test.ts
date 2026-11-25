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

test('audit blocker drill-down filters persisted open findings and linked actions', () => {
  const page = read('../frontend/src/pages/AuditReadiness.tsx');
  const landing = read('../frontend/src/pages/RiskWorkspaceLanding.tsx');
  assert.match(page, /blockerMode = typeFilter === 'audit-blocker'/);
  assert.match(page, /item\.status !== 'closed'/);
  assert.match(page, /blockerFindingIds\.has\(item\.findingRecordId\)/);
  assert.doesNotMatch(page, /Audit readiness does not yet expose a blocker-level record filter/);
  assert.match(landing, /Open findings requiring remediation/);
  assert.doesNotMatch(landing, /blocker filter unavailable/);
});

test('audit workspace uses responsive grids and keyboard-operable action selection', () => {
  const page = read('../frontend/src/pages/AuditReadiness.tsx');
  assert.match(page, /repeat\(auto-fit, minmax\(min\(100%, 420px\), 1fr\)\)/);
  assert.match(page, /aria-label="Search audits"/);
  assert.match(page, /role="button" tabIndex=\{0\}/);
  assert.match(page, /event\.key==='Enter'\|\|event\.key===' '/);
  assert.doesNotMatch(page, /gridTemplateColumns: 'repeat\(4, minmax\(0, 1fr\)\)'/);
});

test('audit entry blocks dismissal while saving and reflows narrow forms', () => {
  const modal = read('../frontend/src/components/AuditEntryModal.tsx');
  assert.match(modal, /const requestClose=\(\)=>\{if\(!saving\)onClose\(\);\};/);
  assert.match(modal, /<Modal[\s\S]*onClose=\{requestClose\}[\s\S]*accessibleDialog/);
  assert.match(modal, /onClick=\{requestClose\} disabled=\{saving\}/);
  assert.match(modal, /if\(saving\)return;/);
  assert.match(modal, /aria-busy=\{saving\}/);
  assert.match(modal, /<fieldset disabled=\{saving\}/);
  assert.match(modal, /repeat\(auto-fit,minmax\(220px,1fr\)\)/);
});

test('audit entry retains rejected writes with an announced error', () => {
  const modal = read('../frontend/src/components/AuditEntryModal.tsx');
  assert.match(modal, /catch\(reason\)\{setError\(/);
  assert.match(modal, /role="alert"/);
  assert.match(modal, /onClick=\{\(\)=>void submit\(\)\}/);
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
