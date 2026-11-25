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
  assert.match(page, /does not claim live AI app usage, sensitive-data movement, endpoint telemetry, automated blocking/);
});

test('AI inventory unifies only persisted provider, assessment, incident and linked-record context', () => {
  const page = read('../frontend/src/pages/AiGovernance.tsx');
  assert.match(page, /Filter AI inventory by provider/);
  assert.match(page, /selectedAssessments/);
  assert.match(page, /selectedIncidents/);
  assert.match(page, /selectedProviders/);
  assert.match(page, /\/risks\?search=/);
  assert.match(page, /\/controls\?search=/);
  assert.match(page, /\/evidence\?search=/);
  assert.match(page, /RACI and SoA context/);
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

test('AI model rejection requires a governed rationale dialog', () => {
  const page = read('../frontend/src/pages/AiGovernance.tsx');
  assert.doesNotMatch(page, /window\.prompt/);
  assert.match(page, /accessibleDialog/);
  assert.match(page, /Rejection rationale/);
  assert.match(page, /rejectionReason\.trim\(\)\.length < 3/);
  assert.match(page, /decideAiModelRecord\(model\.id, action, action === 'rejected' \? rejectionReason\.trim\(\) : undefined\)/);
});

test('AI vendor and training actions use persisted manual entry without provider claims', () => {
  const page = read('../frontend/src/pages/AiGovernance.tsx');
  const modal = read('../frontend/src/components/AiGovernanceEntryModal.tsx');
  const api = read('../frontend/src/lib/api.ts');
  assert.match(page, /setEntryKind\('vendor'\)/);
  assert.match(page, /setEntryKind\('training'\)/);
  assert.match(page, /createAiVendorRecord\(payload as Partial<AiVendorRecord>\)/);
  assert.match(page, /createAiTrainingProgramRecord\(payload as Partial<AiTrainingProgramRecord>\)/);
  assert.match(modal, /does not create or verify a supplier record, contract, security review, or external integration/);
  assert.match(modal, /planned program with zero completion and no learners assigned/);
  assert.match(api, /ai-governance\/vendors/);
  assert.match(api, /ai-governance\/training-programs/);
});

test('AI reports do not imply approval or distribution', () => {
  const service = read('src/services/aiGovernanceService.ts');
  assert.match(service, /Generation does not imply formal approval or distribution/);
  assert.doesNotMatch(service, /status: reportType === 'board_ai_risk_pack' \? 'approved'/);
});

test('AI inventory coverage and model-risk history are not fabricated', () => {
  const service = read('src/services/aiGovernanceService.ts');
  const repository = read('src/repositories/aiGovernanceRepo.ts');
  const routes = read('src/routes/aiGovernance.ts');
  const page = read('../frontend/src/pages/AiGovernance.tsx');

  assert.doesNotMatch(service, /input\.description && input\.purpose \? 88 : 72/);
  assert.doesNotMatch(service, /baseTrend|month: 'Jan'|month: 'Jun'/);
  assert.match(service, /modelRiskTrend: AiGovernanceState\['modelRiskTrend'\] = \[\]/);
  assert.match(service, /inventoryCoverageRecorded = input\.inventoryCoveragePercent !== undefined/);
  assert.match(repository, /systems\.filter\(\(item\) => item\.inventoryCoverageRecorded\)/);
  assert.match(routes, /inventoryCoveragePercent < 0 \|\| req\.body\.inventoryCoveragePercent > 100/);
  assert.match(page, /Inventory coverage not recorded/);
  assert.match(page, /Current assessments are not converted into synthetic history/);
  assert.match(page, /Not assessed/);
});

test('missing AI score evidence remains unavailable across reports and executive views', () => {
  const repository = read('src/repositories/aiGovernanceRepo.ts');
  const service = read('src/services/aiGovernanceService.ts');
  const backendTypes = read('src/types/aiGovernance.ts');
  const dashboard = read('../frontend/src/pages/Dashboard.tsx');
  const operatingSystem = read('../frontend/src/pages/EnterpriseOperatingSystem.tsx');

  assert.match(backendTypes, /aiComplianceScore: number \| null/);
  assert.match(repository, /values\.length \? Math\.round[\s\S]*: null/);
  assert.match(repository, /filter\(\(value\): value is number => value !== null\)/);
  assert.match(service, /Compliance not assessed|Compliance'\) is not assessed|Compliance.*not assessed/s);
  assert.match(service, /EU AI Act readiness has not been assessed/);
  assert.match(service, /ISO\/IEC 42001 readiness has not been assessed/);
  assert.doesNotMatch(service, /euProgram\?\.score \|\| 0|isoProgram\?\.score \|\| 0/);
  assert.doesNotMatch(dashboard, /buildFlatTrend\(aiGovernanceScore/);
  assert.doesNotMatch(dashboard, /aiForecast|AI Governance Forecast/);
  assert.match(dashboard, /AI governance compliance is not assessed/);
  assert.match(dashboard, /No recorded compliance assessment/);
  assert.match(operatingSystem, /executive\.aiExposure === null \? 'Not assessed'/);
});

test('AI entry cannot be dismissed while a record is being saved', () => {
  const modal = read('../frontend/src/components/AiGovernanceEntryModal.tsx');
  assert.match(modal, /const submitLock = useRef\(false\)/);
  assert.match(modal, /const requestClose = \(\) => \{ if \(!saving && !submitLock\.current\) onClose\(\); \}/);
  assert.match(modal, /<Modal accessibleDialog[\s\S]*onClose=\{requestClose\}/);
  assert.match(modal, /onClick=\{requestClose\} disabled=\{saving\}/);
});

test('AI mutation workflows reject duplicate requests and lock reviewed values', () => {
  const modal = read('../frontend/src/components/AiGovernanceEntryModal.tsx');
  assert.match(modal, /if \(submitLock\.current\) return/);
  assert.match(modal, /submitLock\.current = false/);
  const page = read('../frontend/src/pages/AiGovernance.tsx');
  assert.match(modal, /<fieldset disabled=\{saving\} aria-busy=\{saving\}/);
  assert.match(page, /const actionLock = useRef\(false\)/);
  assert.match(page, /if \(actionLock\.current\) return false;/);
  assert.match(page, /actionLock\.current = true/);
  assert.match(page, /actionLock\.current = false/);
  assert.match(page, /await loadState\(\);[\s\S]*return true;[\s\S]*return false;/);
  assert.match(page, /const saved = await handleAction\(`create-\$\{kind\}`[\s\S]*if \(!saved\) throw new Error\('The AI governance record was not saved/);
  assert.match(page, /if \(working \|\| actionLock\.current \|\| !rejectedModel/);
  assert.match(page, /const rejected = await transitionModel[\s\S]*if \(!rejected\) return;/);
  assert.match(page, /const openModelRejection = [\s\S]*if \(working \|\| actionLock\.current\) return;/);
  assert.match(page, /const closeModelRejection = [\s\S]*if \(working \|\| actionLock\.current\) return;/);
  assert.match(page, /onClose=\{closeModelRejection\}/);
  assert.match(page, /onClick=\{closeModelRejection\} disabled=\{Boolean\(working\)\}/);
  assert.match(page, /disabled=\{Boolean\(working\)\}/);
});
