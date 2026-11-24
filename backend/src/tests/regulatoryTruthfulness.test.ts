import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('regulatory state reads do not seed workspace data', () => {
  const service = read('src/services/regulatoryChangeService.ts');
  assert.doesNotMatch(service, /seedRegulatoryData\(workspaceId\)/);
});

test('regulatory UI does not create synthetic records', () => {
  const page = read('../frontend/src/pages/RegulatoryChangeManagement.tsx');
  assert.doesNotMatch(page, /Date\.now|CTRL-00|POL-00|RISK-00|VENDOR-00|ASSET-00|AI-00/);
  assert.match(page, /RegulatoryEntryModal/);
});

test('regulatory review uses accessible rationale and preserves mutation errors', () => {
  const page = read('../frontend/src/pages/RegulatoryChangeManagement.tsx');
  const modal = read('../frontend/src/components/RegulatoryEntryModal.tsx');
  assert.doesNotMatch(page, /window\.prompt/);
  assert.match(page, /accessibleDialog/);
  assert.match(page, /decisionNotes\.trim\(\)\.length < 3/);
  assert.match(page, /decideRegulatoryChange\(decisionTarget\.change\.id, decisionTarget\.decision, decisionNotes\.trim\(\)\)/);
  assert.match(page, /setDecisionError\(err instanceof Error/);
  assert.match(modal, /role="alert"/);
  assert.match(modal, /catch \(reason\)/);
});

test('regulatory mutations enforce module permissions', () => {
  const routes = read('src/routes/regulatory.ts');
  const mutations = [...routes.matchAll(/router\.(?:post|patch)\([^\n]+/g)].map((match) => match[0]);
  assert.ok(mutations.length >= 8);
  mutations.forEach((route) => assert.match(route, /requirePermission\('Regulatory', '(?:create|edit|approve)'\)/));
});

test('regulatory approval and task status use dedicated controlled endpoints', () => {
  const routes = read('src/routes/regulatory.ts');
  assert.match(routes, /changes\/:id\/submit/);
  assert.match(routes, /changes\/:id\/decision', requirePermission\('Regulatory', 'approve'\)/);
  assert.match(routes, /tasks\/:id\/status/);
  assert.match(routes, /CONTROLLED_TRANSITION_REQUIRED/);
  assert.match(routes, /sourceExists/);
  assert.match(routes, /requirementExists/);
});

test('impact analysis preserves recorded actions without fabricating defaults', () => {
  const service = read('src/services/regulatoryChangeService.ts');
  assert.match(service, /requiredActions: change\.requiredActions/);
  assert.doesNotMatch(service, /Review impacted controls|Notify accountable stakeholders/);
});
