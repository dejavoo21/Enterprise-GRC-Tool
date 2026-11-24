import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { updateContinuousAssuranceSettings } from '../services/continuousAssurance/continuousAssurance.js';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('continuous assurance lifecycle is persisted and workspace scoped', async () => {
  const [migration, repository] = await Promise.all([
    read('backend/sql/migrations/20261124-continuous-assurance-lifecycle.sql'),
    read('backend/src/repositories/continuousAssuranceRepo.ts'),
  ]);
  for (const table of ['ccm_control_monitors', 'ccm_automated_tests', 'ccm_test_runs', 'ccm_assurance_exceptions', 'ccm_remediation_tasks']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(repository, /workspace_id=\$1/);
  assert.match(repository, /BEGIN/);
  assert.match(repository, /ROLLBACK/);
});

test('reviewed results create exceptions without fabricated evidence', async () => {
  const [service, repository] = await Promise.all([
    read('backend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('backend/src/repositories/continuousAssuranceRepo.ts'),
  ]);
  assert.match(service, /A reviewed result, summary and details are required/);
  assert.match(repository, /input\.status === 'failed' \|\| input\.status === 'warning'/);
  assert.match(repository, /input\.evidenceIds/);
  assert.doesNotMatch(service, /createSeedState|stateStore|EVID-AUTO/);
});

test('terminal exception resolution requires evidence and rationale', async () => {
  const repository = await read('backend/src/repositories/continuousAssuranceRepo.ts');
  assert.match(repository, /Resolution requires an authenticated reviewer, rationale and evidence references/);
});

test('external assurance providers remain explicitly unavailable', async () => {
  const [service, frontend] = await Promise.all([
    read('backend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('frontend/src/pages/ContinuousAssurancePages.tsx'),
  ]);
  assert.match(service, /errorWithStatus\(`\$\{capability\} is unavailable until an approved provider is configured`, 501\)/);
  assert.match(frontend, /Provider integration unavailable/);
  assert.match(frontend, /LAFLO will not simulate connector health/);
  assert.match(frontend, /Automation unavailable until an approved provider is configured/);
  assert.match(frontend, /No compliance drift provider configured/);
  assert.match(frontend, /will not fabricate drift events, owners, controls, evidence links, or remediation outcomes/);
  assert.doesNotMatch(frontend, /Toggle Remediation Automation/);
  assert.doesNotMatch(frontend, /EVID-LINKED-001|CTRL-NEW|Assigned Assurance Owner/);
  assert.doesNotMatch(frontend, /api\.example\.com|Mock-safe/);
});

test('assurance settings reject unsupported automation and invalid thresholds before persistence', async () => {
  await assert.rejects(
    updateContinuousAssuranceSettings('workspace-a', 'owner', { autoCreateRemediationTask: true }),
    /unavailable until an approved provider is configured/,
  );
  await assert.rejects(
    updateContinuousAssuranceSettings('workspace-a', 'owner', { evidenceFreshnessPeriodDays: 0 }),
    /between 1 and 3650 days/,
  );
  await assert.rejects(
    updateContinuousAssuranceSettings('workspace-a', 'owner', {}),
    /At least one assurance setting is required/,
  );
});

test('frontend does not silently replace API failures with seeded state', async () => {
  const [frontendService, frontendPage] = await Promise.all([
    read('frontend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('frontend/src/pages/ContinuousAssurancePages.tsx'),
  ]);
  assert.doesNotMatch(frontendService, /function seedState/);
  assert.match(frontendService, /return fetchStateFromApi\(workspaceId\)/);
  assert.match(frontendService, /return operation\(\)/);
  assert.doesNotMatch(frontendService, /deleteControlMonitor/);
  assert.doesNotMatch(frontendPage, />Delete<\/Button>/);
  assert.match(frontendPage, /monitor\.status === 'disabled' \? 'Enable' : 'Disable'/);
});

test('risk assurance decisions persist through the governed risk lifecycle', async () => {
  const [frontendService, riskRoute, server] = await Promise.all([
    read('frontend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('backend/src/routes/risks.ts'),
    read('backend/src/index.ts'),
  ]);
  assert.match(frontendService, /`\/api\/v1\/risks\/\$\{encodeURIComponent\(riskId\)\}`/);
  assert.match(frontendService, /acceptanceRationale: rationale/);
  assert.match(frontendService, /Transfer owner and due date are required/);
  assert.doesNotMatch(frontendService, /Risk Treated' : action === 'escalated'/);
  const riskPage = await read('frontend/src/pages/Risks.tsx');
  assert.match(riskPage, /const canEscalateRisk = \['identified', 'assessed', 'open'\]\.includes\(selectedRisk\.status\)/);
  assert.match(riskPage, /const canAcceptRisk = \['assessed', 'open', 'under_review'\]\.includes\(selectedRisk\.status\)/);
  assert.match(riskPage, /const canTransferRisk = \['assessed', 'under_review'\]\.includes\(selectedRisk\.status\)/);
  assert.match(riskRoute, /Invalid lifecycle transition from \$\{existingRisk\.status\} to \$\{updates\.status\}/);
  assert.match(server, /app\.use\('\/api\/v1\/risks', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions\('Risks'\), risksRouter\)/);
  assert.match(riskRoute, /action: isStatusChange \? 'status_change' : 'update'/);
});

test('cross-module assurance summaries remain truthful before cache hydration', async () => {
  const [frontendService, riskPage, riskWorkspace] = await Promise.all([
    read('frontend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('frontend/src/pages/Risks.tsx'),
    read('frontend/src/pages/RiskWorkspaceViews.tsx'),
  ]);
  assert.match(frontendService, /if \(!state\) return \{\s+available: false,\s+assuranceImpact: null,/);
  assert.match(frontendService, /const overview = cache\.get\(workspaceId\)\?\.overview;\s+if \(!overview\) return \[\];/);
  assert.match(frontendService, /export function mapControlsToSuggestedMonitors[\s\S]*?if \(!state\) return \[\];/);
  assert.match(riskPage, /Unavailable until assurance data loads/);
  assert.match(riskWorkspace, /assuranceImpact == null \? 'Unavailable'/);
});
