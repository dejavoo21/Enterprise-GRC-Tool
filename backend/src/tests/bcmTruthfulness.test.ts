import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('business continuity state reads do not seed tenant records', () => {
  const service = read('src/services/bcmService.ts');
  const repository = read('src/repositories/bcmRepo.ts');
  const stateSource = service.slice(service.indexOf('export async function getBusinessContinuityState'), service.indexOf('export async function createBiaProcess'));
  assert.doesNotMatch(stateSource, /seedBcmDefaults|createBiaProcess|INSERT INTO/);
  assert.doesNotMatch(repository, /seedBcmDefaults|Customer Payment Processing|Quarterly ransomware tabletop/);
});

test('business continuity page uses reviewed entry forms instead of sample writes', () => {
  const page = read('../frontend/src/pages/BusinessContinuity.tsx');
  const modal = read('../frontend/src/components/BcmEntryModal.tsx');
  assert.doesNotMatch(page, /createSample|RSK-003|CTR-016|EVD-018|proc-manual|Date\.now/);
  assert.match(page, /BcmEntryModal/);
  assert.match(modal, /No placeholder relationship will be created/);
});

test('business continuity dialogs remain open when persisted mutations fail', () => {
  const page = read('../frontend/src/pages/BusinessContinuity.tsx');
  const entryModal = read('../frontend/src/components/BcmEntryModal.tsx');
  const closureModal = read('../frontend/src/components/BcmCorrectiveActionClosureModal.tsx');
  assert.match(page, /propagateError = false/);
  assert.match(page, /if \(propagateError\) throw err/);
  assert.match(page, /createBcmResilienceScenario\(payload\);\s*\}, true\)/);
  assert.match(page, /closeBcmCorrectiveAction\(closureTarget\.id, evidenceIds, closureNotes\); \}, true\)/);
  assert.match(entryModal, /catch \(cause\) \{ setError/);
  assert.match(closureModal, /catch \(cause\) \{ setError/);
});

test('business continuity mutations retain explicit permissions and workspace validation', () => {
  const routes = read('src/routes/businessContinuity.ts');
  const service = read('src/services/bcmService.ts');
  assert.match(routes, /requirePermission\('Resilience', 'create'\)/);
  assert.match(routes, /recovery-plans\/:id\/approve', requirePermission\('Resilience', 'approve'\)/);
  assert.match(routes, /requirePermission\('Resilience', 'export'\)/);
  assert.match(routes, /corrective-actions\/:id\/close', requirePermission\('Resilience', 'approve'\)/);
  assert.match(service, /assertWorkspaceLinks\(workspaceId/);
});

test('BCM scores remain unavailable without recorded source evidence', () => {
  const repository = read('src/repositories/bcmRepo.ts');
  const service = read('src/services/bcmService.ts');
  const types = read('src/types/resilience.ts');
  const page = read('../frontend/src/pages/BusinessContinuity.tsx');
  const dashboard = read('../frontend/src/pages/Dashboard.tsx');

  assert.match(types, /recoveryReadiness: number \| null/);
  assert.match(types, /resilienceScore: number \| null/);
  assert.match(repository, /plans\.length[\s\S]*: null/);
  assert.match(repository, /resilienceComponents[\s\S]*filter\(\(value\): value is number => value !== null\)/);
  assert.match(service, /Operational resilience has not been assessed/);
  assert.match(page, /Not assessed/);
  assert.doesNotMatch(dashboard, /buildFlatTrend\(resilienceScore/);
  assert.match(dashboard, /No recorded resilience assessment/);
});

test('completed recovery exercises require explicit dated performance evidence', () => {
  const routes = read('src/routes/businessContinuity.ts');
  const service = read('src/services/bcmService.ts');
  const modal = read('../frontend/src/components/BcmEntryModal.tsx');

  assert.match(routes, /performanceScore must be an explicitly recorded number from 0 to 100/);
  assert.match(service, /Exercise performance score must be explicitly recorded from 0 to 100/);
  assert.match(service, /createExercise\(workspaceId, \{ \.\.\.input, status: 'completed' \}\)/);
  assert.doesNotMatch(modal, /exerciseDate: form\.exerciseDate \? new Date\(form\.exerciseDate\)\.toISOString\(\) : new Date\(\)\.toISOString\(\)/);
  assert.match(modal, /Record the exercise date, scenario and a performance score from 0 to 100/);
});

test('BCM corrective actions are workspace scoped and migration governed', () => {
  const repository = read('src/repositories/bcmRepo.ts');
  const migration = read('sql/migrations/20261124-bcm-corrective-actions.sql');
  assert.match(repository, /bcm_corrective_actions WHERE workspace_id=\$1/);
  assert.match(repository, /WHERE workspace_id=\$1 AND id=\$2 AND status='awaiting_review'/);
  assert.match(migration, /jsonb_array_length\(evidence_ids\) > 0/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});

test('BCM mutation dialogs block dismissal while saving and entry fields reflow', () => {
  const entryModal = read('../frontend/src/components/BcmEntryModal.tsx');
  const closureModal = read('../frontend/src/components/BcmCorrectiveActionClosureModal.tsx');
  for (const modal of [entryModal, closureModal]) {
    assert.match(modal, /const requestClose = \(\) => \{ if \(!busy\) onClose\(\); \}/);
    assert.match(modal, /<Modal accessibleDialog[\s\S]*onClose=\{requestClose\}/);
    assert.match(modal, /onClick=\{requestClose\} disabled=\{busy\}/);
  }
  assert.match(entryModal, /repeat\(auto-fit, minmax\(220px, 1fr\)\)/);
});

test('BCM mutations reject duplicate requests and lock reviewed values', () => {
  const page = read('../frontend/src/pages/BusinessContinuity.tsx');
  const entryModal = read('../frontend/src/components/BcmEntryModal.tsx');
  const closureModal = read('../frontend/src/components/BcmCorrectiveActionClosureModal.tsx');
  for (const modal of [entryModal, closureModal]) {
    assert.match(modal, /if \(busy\) return;/);
    assert.match(modal, /<fieldset disabled=\{busy\} aria-busy=\{busy\}/);
  }
  assert.match(page, /const actionLock = useRef\(false\)/);
  assert.match(page, /if \(actionLock\.current\) return;/);
  assert.match(page, /actionLock\.current = true/);
  assert.match(page, /actionLock\.current = false/);
});
