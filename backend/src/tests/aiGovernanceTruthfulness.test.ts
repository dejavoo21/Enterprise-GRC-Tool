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
  assert.match(page, /No record was changed/);
});

test('AI Governance mutations retain explicit module permissions and workspace link validation', () => {
  const routes = read('src/routes/aiGovernance.ts');
  const service = read('src/services/aiGovernanceService.ts');
  assert.match(routes, /requirePermission\('AI', 'create'\)/);
  assert.match(routes, /models\/:id\/decision', requirePermission\('AI', 'approve'\)/);
  assert.match(routes, /inventory\/:id\/decision', requirePermission\('AI', 'approve'\)/);
  assert.match(routes, /assessments\/:id\/decision', requirePermission\('AI', 'approve'\)/);
  assert.match(routes, /controls\/:id\/status', requirePermission\('AI', 'edit'\)/);
  assert.match(routes, /incidents\/:id\/status', requirePermission\('AI', 'edit'\)/);
  assert.match(routes, /requirePermission\('AI', 'export'\)/);
  assert.match(service, /assertWorkspaceLinks\(workspaceId/);
});

test('AI lifecycle updates remain workspace scoped', () => {
  const repository = read('src/repositories/aiGovernanceRepo.ts');
  assert.match(repository, /UPDATE ai_risk_assessments SET status=\$3,updated_at=NOW\(\) WHERE workspace_id=\$1 AND id=\$2/);
  assert.match(repository, /UPDATE ai_controls SET status=\$3,updated_at=NOW\(\) WHERE workspace_id=\$1 AND id=\$2/);
  assert.match(repository, /UPDATE ai_incidents SET status=\$3,updated_at=NOW\(\) WHERE workspace_id=\$1 AND id=\$2/);
});

test('AI model lifecycle is independently approved and workspace scoped', () => {
  const routes = read('src/routes/aiGovernance.ts');
  const repository = read('src/repositories/aiGovernanceRepo.ts');
  const migration = read('sql/migrations/20261124-ai-model-review-lifecycle.sql');
  assert.match(routes, /models\/:id\/submit.*requirePermission\('AI', 'edit'\)/s);
  assert.match(routes, /models\/:id\/decision.*requirePermission\('AI', 'approve'\)/s);
  assert.match(repository, /ai_model_events WHERE workspace_id=\$1 AND model_id=\$2/);
  assert.match(repository, /created_by IS NOT NULL AND created_by<>\$5::uuid/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ai_model_events/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});

test('AI reports do not imply approval or distribution', () => {
  const service = read('src/services/aiGovernanceService.ts');
  assert.match(service, /Generation does not imply formal approval or distribution/);
  assert.doesNotMatch(service, /status: reportType === 'board_ai_risk_pack' \? 'approved'/);
});
