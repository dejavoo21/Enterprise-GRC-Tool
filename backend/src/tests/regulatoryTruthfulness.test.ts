import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('regulatory state reads do not seed workspace data', () => {
  const service = read('src/services/regulatoryChangeService.ts');
  const repository = read('src/repositories/regulatoryRepo.ts');
  assert.doesNotMatch(service, /seedRegulatoryData\(workspaceId\)/);
  assert.doesNotMatch(repository, /seedRegulatoryData|EU AI Act update pending review|CTRL-001|EVID-001/);
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
  const repository = read('src/repositories/regulatoryRepo.ts');
  const page = read('../frontend/src/pages/RegulatoryChangeManagement.tsx');
  assert.match(service, /requiredActions: change\.requiredActions/);
  assert.doesNotMatch(service, /Review impacted controls|Notify accountable stakeholders/);
  assert.doesNotMatch(repository, /change: 5 \+ index \* 3|highSeverityRiskStatements/);
  assert.match(repository, /newRisks: \[\],[\s\S]*modifiedRisks: \[\]/);
  assert.match(repository, /residualRiskChanges: \[\]/);
  assert.doesNotMatch(service, /25 \+[\s\S]*controlWeight/);
  assert.match(page, /Modelled Impact Index/);
  assert.match(page, /not an observed risk score/);
});

test('unassessed regulatory ratings and exposure remain explicitly unavailable', () => {
  const repository = read('src/repositories/regulatoryRepo.ts');
  const types = read('src/types/regulatory.ts');
  const modal = read('../frontend/src/components/RegulatoryEntryModal.tsx');
  const page = read('../frontend/src/pages/RegulatoryChangeManagement.tsx');
  assert.match(types, /complianceRating: number \| null/);
  assert.match(types, /complianceExposure: number \| null/);
  assert.match(repository, /payload\.complianceRating \?\? null/);
  assert.match(repository, /obligations\.length[\s\S]*: null/);
  assert.match(modal, /complianceRating: null, riskRating: null/);
  assert.match(page, /Not assessed/);
});

test('regulatory entry blocks dismissal while saving and reflows narrow forms', () => {
  const modal = read('../frontend/src/components/RegulatoryEntryModal.tsx');
  assert.match(modal, /const submitLock = useRef\(false\)/);
  assert.match(modal, /const requestClose = \(\) => \{ if \(!saving && !submitLock\.current\) onClose\(\); \}/);
  assert.match(modal, /<Modal[\s\S]*onClose=\{requestClose\}[\s\S]*accessibleDialog/);
  assert.match(modal, /onClick=\{requestClose\} disabled=\{saving\}/);
  assert.match(modal, /repeat\(auto-fit, minmax\(220px, 1fr\)\)/);
});

test('regulatory mutations reject concurrent requests and lock reviewed values', () => {
  const modal = read('../frontend/src/components/RegulatoryEntryModal.tsx');
  assert.match(modal, /if \(submitLock\.current\) return/);
  assert.match(modal, /submitLock\.current = false/);
  const page = read('../frontend/src/pages/RegulatoryChangeManagement.tsx');
  assert.match(modal, /<fieldset disabled=\{saving\} aria-busy=\{saving\}/);
  assert.match(page, /const actionLock = useRef\(false\)/);
  assert.match(page, /Another regulatory action is already in progress/);
  assert.match(page, /const transitionTask = async/);
  assert.match(page, /<fieldset disabled=\{Boolean\(busyAction\)\} aria-busy=\{Boolean\(busyAction\)\}/);
});
