import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('business continuity state reads do not seed tenant records', () => {
  const service = read('src/services/bcmService.ts');
  const stateSource = service.slice(service.indexOf('export async function getBusinessContinuityState'), service.indexOf('export async function createBiaProcess'));
  assert.doesNotMatch(stateSource, /seedBcmDefaults|createBiaProcess|INSERT INTO/);
});

test('business continuity page uses reviewed entry forms instead of sample writes', () => {
  const page = read('../frontend/src/pages/BusinessContinuity.tsx');
  const modal = read('../frontend/src/components/BcmEntryModal.tsx');
  assert.doesNotMatch(page, /createSample|RSK-003|CTR-016|EVD-018|proc-manual|Date\.now/);
  assert.match(page, /BcmEntryModal/);
  assert.match(modal, /No placeholder relationship will be created/);
});

test('business continuity mutations retain explicit permissions and workspace validation', () => {
  const routes = read('src/routes/businessContinuity.ts');
  const service = read('src/services/bcmService.ts');
  assert.match(routes, /requirePermission\('Resilience', 'create'\)/);
  assert.match(routes, /recovery-plans\/:id\/approve', requirePermission\('Resilience', 'approve'\)/);
  assert.match(routes, /requirePermission\('Resilience', 'export'\)/);
  assert.match(service, /assertWorkspaceLinks\(workspaceId/);
});
