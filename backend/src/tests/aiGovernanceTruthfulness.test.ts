import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('AI Governance state reads do not seed tenant records', () => {
  const service = read('src/services/aiGovernanceService.ts');
  const repository = read('src/repositories/aiGovernanceRepo.ts');
  const stateSource = service.slice(service.indexOf('export async function getAiGovernanceState'), service.indexOf('export async function createAiSystem'));
  assert.doesNotMatch(stateSource, /seedAiGovernanceDefaults|createAiSystem|INSERT INTO/);
  assert.doesNotMatch(repository, /seedAiGovernanceDefaults/);
});

test('AI Governance page does not expose sample-data write actions', () => {
  const page = read('../frontend/src/pages/AiGovernance.tsx');
  assert.doesNotMatch(page, /addSample|AI Due Diligence Copilot|Prompt injection attempt/);
  assert.match(page, /No record was created/);
});

test('AI Governance mutations retain explicit module permissions and workspace link validation', () => {
  const routes = read('src/routes/aiGovernance.ts');
  const service = read('src/services/aiGovernanceService.ts');
  assert.match(routes, /requirePermission\('AI', 'create'\)/);
  assert.match(routes, /requirePermission\('AI', 'approve'\)/);
  assert.match(routes, /requirePermission\('AI', 'export'\)/);
  assert.match(service, /assertWorkspaceLinks\(workspaceId/);
});
