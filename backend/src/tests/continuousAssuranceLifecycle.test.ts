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
  const frontend = await read('frontend/src/pages/ContinuousAssurancePages.tsx');
  assert.match(frontend, /function AssuranceSettingsForm/);
  assert.match(frontend, /saveLock\.current/);
  assert.match(frontend, /updateContinuousAssuranceSettings\(workspaceId, role/);
  assert.match(frontend, /Evidence freshness must be a whole number between 1 and 3650 days/);
  assert.match(frontend, /Exception SLA must be a whole number between 1 and 3650 days/);
  assert.match(frontend, /Provider-dependent settings/);
  assert.match(frontend, /No provider-backed rules configured/);
  assert.match(frontend, /You have read-only access to assurance settings/);
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

test('continuous assurance reads and primary operations reject stale workspace completion', async () => {
  const frontendPage = await read('frontend/src/pages/ContinuousAssurancePages.tsx');
  assert.match(frontendPage, /const requestSequence = useRef\(0\)/);
  assert.match(frontendPage, /if \(requestId !== requestSequence\.current\) return/);
  assert.match(frontendPage, /return \(\) => \{ requestSequence\.current \+= 1; \}/);
  for (const sequence of ['operationSequence', 'actionSequence', 'saveSequence', 'preferenceSequence']) {
    assert.match(frontendPage, new RegExp(`const ${sequence} = useRef\\(0\\)`));
    assert.match(frontendPage, new RegExp(`${sequence}\\.current \\+= 1`));
  }
  assert.match(frontendPage, /if \(operationId === operationSequence\.current\) \{\s+operationLock\.current = false/);
  assert.match(frontendPage, /if \(actionOperation === actionSequence\.current\) \{\s+actionLock\.current = false/);
  assert.match(frontendPage, /if \(saveOperation === saveSequence\.current\) \{\s+saveLock\.current = false/);
  assert.match(frontendPage, /if \(preferenceOperation === preferenceSequence\.current\) \{\s+preferenceLock\.current = false/);
});

test('control monitor archival is non-destructive, governed and excluded from active assurance', async () => {
  const [migration, repository, service, route, frontendService, frontendPage] = await Promise.all([
    read('backend/sql/migrations/20261126-continuous-assurance-monitor-archival.sql'),
    read('backend/src/repositories/continuousAssuranceRepo.ts'),
    read('backend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('backend/src/routes/continuousAssurance.ts'),
    read('frontend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('frontend/src/pages/ContinuousAssurancePages.tsx'),
  ]);
  assert.match(migration, /archived_at TIMESTAMPTZ/);
  assert.match(migration, /archive_reason TEXT/);
  assert.match(migration, /status IN \('active','warning','disabled','failed','archived'\)/);
  assert.match(repository, /Disable the control monitor before archiving it/);
  assert.match(repository, /UPDATE ccm_automated_tests SET enabled=FALSE/);
  assert.doesNotMatch(repository, /DELETE FROM ccm_control_monitors/);
  assert.match(service, /!\['disabled', 'archived'\]\.includes\(item\.status\)/);
  assert.match(service, /currentMonitors = monitors\.filter\(item => item\.status !== 'archived'\)/);
  assert.match(service, /control_monitor_archived/);
  assert.match(route, /requirePermission\('Controls', 'delete'\)/);
  assert.match(frontendService, /archiveControlMonitor/);
  assert.match(frontendPage, /This action cannot be reversed/);
  assert.match(frontendPage, /Archive reason/);
});

test('assurance reports persist truthful workspace snapshots and export only implemented formats', async () => {
  const [migration, repository, service, route, frontendService, frontendPage] = await Promise.all([
    read('backend/sql/migrations/20261126-continuous-assurance-reports.sql'),
    read('backend/src/repositories/continuousAssuranceRepo.ts'),
    read('backend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('backend/src/routes/continuousAssurance.ts'),
    read('frontend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('frontend/src/pages/ContinuousAssurancePages.tsx'),
  ]);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ccm_assurance_reports/);
  assert.match(migration, /snapshot JSONB NOT NULL/);
  assert.match(repository, /WHERE workspace_id=\$1 AND id=\$2/);
  assert.match(repository, /INSERT INTO ccm_assurance_reports/);
  assert.match(service, /assertCcmPermission\(role, 'generate_assurance_reports'\)/);
  assert.match(service, /assertCcmPermission\(role, 'export_assurance_reports'\)/);
  assert.match(service, /assurance_report_generated/);
  assert.match(service, /assurance_report_downloaded/);
  assert.match(service, /\^\[=\+\\-@\\t\\r\]/);
  assert.doesNotMatch(service, /unavailable\('Continuous assurance export'\)/);
  assert.match(route, /reports\/:id\/download', requirePermission\('Reports', 'export'\)/);
  assert.doesNotMatch(frontendService, /state\.reports\.unshift/);
  assert.match(frontendPage, /JSON and CSV only; no external provider is required/);
  assert.match(frontendPage, /canPerformContinuousAssuranceAction\(role, 'export_assurance_reports'\)/);
  assert.match(frontendPage, /repeat\(auto-fit, minmax\(150px, 1fr\)\)/);
  assert.doesNotMatch(frontendPage, /Exports PDF, Excel, and CSV/);
});

test('assurance notifications are persisted, workspace scoped and limited to truthful in-app delivery', async () => {
  const [migration, repository, service, route, frontendPage] = await Promise.all([
    read('backend/sql/migrations/20261126-continuous-assurance-notifications.sql'),
    read('backend/src/repositories/continuousAssuranceRepo.ts'),
    read('backend/src/services/continuousAssurance/continuousAssurance.ts'),
    read('backend/src/routes/continuousAssurance.ts'),
    read('frontend/src/pages/ContinuousAssurancePages.tsx'),
  ]);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ccm_assurance_notifications/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ccm_assurance_notification_preferences/);
  assert.match(migration, /CHECK \(channel = 'in_app'\)/);
  assert.match(repository, /INSERT INTO ccm_assurance_notifications/);
  assert.match(repository, /SELECT \* FROM ccm_assurance_notifications[\s\S]*WHERE workspace_id=\$1[\s\S]*ORDER BY created_at DESC LIMIT 100/);
  assert.doesNotMatch(repository, /status <> 'snoozed'/);
  assert.match(repository, /WHERE workspace_id=\$1 AND id=\$2 AND status <> 'archived' RETURNING \*/);
  assert.match(repository, /preference\?\.enabled !== false/);
  assert.match(service, /Notification status must be read, archived, or snoozed/);
  assert.match(service, /A future snooze time is required/);
  assert.match(service, /not found or is already archived/);
  assert.match(service, /assurance_notification_updated/);
  assert.match(service, /channel !== 'in_app'/);
  assert.match(route, /getActorName\(req\), getActorUserId\(req\)/);
  assert.match(frontendPage, /Mark read/);
  assert.match(frontendPage, /Snooze 24h/);
  assert.match(frontendPage, /Email, Teams and Slack delivery require an approved provider/);
  assert.match(frontendPage, /export function ContinuousAssuranceNotifications/);
  assert.match(frontendPage, /Internal Notification Register/);
  assert.match(frontendPage, /Resume and mark read/);
  assert.match(frontendPage, /Until \{new Date\(item\.snoozedUntil\)\.toLocaleString\(\)\}/);
  assert.match(frontendPage, /No matching notifications/);
  assert.match(frontendPage, /Open test register/);
});

test('continuous assurance decisions use reviewed accessible dialogs', async () => {
  const [frontendPage, decisionModals] = await Promise.all([
    read('frontend/src/pages/ContinuousAssurancePages.tsx'),
    read('frontend/src/components/ContinuousAssuranceDecisionModals.tsx'),
  ]);
  assert.doesNotMatch(frontendPage, /window\.(prompt|alert|confirm)/);
  assert.match(frontendPage, /<ControlMonitorModal/);
  assert.match(frontendPage, /<TestResultModal/);
  assert.match(frontendPage, /<ExceptionResolutionModal/);
  assert.match(decisionModals, /accessibleDialog/);
  assert.match(decisionModals, /role="alert"/);
  assert.match(decisionModals, /Select evidence metadata and enter a resolution rationale/);
  assert.match(decisionModals, /apiCall<Api<EvidenceItem\[\]>>\('\/api\/v1\/evidence'\)/);
  assert.match(decisionModals, /workspaceId !== currentWorkspace\.id/);
  assert.match(decisionModals, /type="checkbox" checked=\{value\.includes\(item\.id\)\}/);
  assert.match(decisionModals, /Metadata does not prove that a binary attachment is stored/);
  assert.doesNotMatch(decisionModals, /Evidence IDs \(comma separated/);
  assert.match(frontendPage, /TestResultModal key=\{`\$\{workspaceId\}-\$\{selectedTest\?\.id \|\| 'closed'\}`\}/);
  assert.match(frontendPage, /ExceptionResolutionModal key=\{`\$\{workspaceId\}-\$\{resolving\?\.id \|\| 'closed'\}`\}/);
  assert.match(decisionModals, /catch \(cause\)/);
  assert.equal((decisionModals.match(/const submitLock = useRef\(false\);/g) || []).length, 3);
  assert.equal((decisionModals.match(/const requestClose = \(\) => \{ if \(!busy && !submitLock\.current\) onClose\(\); \};/g) || []).length, 3);
  assert.equal((decisionModals.match(/if \(submitLock\.current\) return;/g) || []).length, 3);
  assert.equal((decisionModals.match(/submitLock\.current = true;/g) || []).length, 3);
  assert.equal((decisionModals.match(/submitLock\.current = false;/g) || []).length, 3);
  assert.equal((decisionModals.match(/onClose=\{requestClose\}/g) || []).length, 3);
  assert.equal((decisionModals.match(/onClick=\{requestClose\} disabled=\{busy\}/g) || []).length, 3);
  assert.equal((decisionModals.match(/<fieldset disabled=\{busy\} aria-busy=\{busy\}/g) || []).length, 3);
});

test('exception row mutations reject duplicate writes and announce failures', async () => {
  const frontendPage = await read('frontend/src/pages/ContinuousAssurancePages.tsx');
  assert.match(frontendPage, /const exceptionActionLock = useRef<string \| null>\(null\)/);
  assert.match(frontendPage, /if \(exceptionActionLock\.current\) return/);
  assert.match(frontendPage, /disabled=\{!canResolve \|\| Boolean\(exceptionActionKey\)\}/);
  assert.match(frontendPage, /exceptionActionError \? <div role="alert"/);
  assert.match(frontendPage, /Select a workspace before creating a remediation task/);
  assert.match(frontendPage, /Select a workspace before reopening an exception/);
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
  assert.doesNotMatch(riskPage, /window\.(prompt|alert|confirm)/);
  assert.match(riskPage, /A rationale is required for this governed decision/);
  assert.match(riskPage, /Transfer owner and due date are required/);
  assert.match(riskPage, /type="date"/);
  assert.match(riskPage, /role="alert"/);
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
