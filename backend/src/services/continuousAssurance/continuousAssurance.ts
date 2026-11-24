import * as repo from '../../repositories/continuousAssuranceRepo.js';
import type { AssuranceException, AssuranceNotification, AssuranceReport, AssuranceSetting, AutomatedTest, CcmPermission, CcmWorkspaceRole, ComplianceDrift, Connector, ContinuousAssuranceAnalytics, ContinuousAssuranceOverview, ContinuousAssuranceState, ControlMonitor, EvidenceCollectionJob, NotificationPreference, RemediationTask, Severity, TestResultStatus } from '../../types/continuousAssurance.js';
import { continuousAssurancePermissionMap } from '../../types/continuousAssurance.js';
import { assertWorkspaceLinks } from '../workspaceLinkValidation.js';
import { recordActivity } from '../activityLedger/activityLedger.js';

type Actor = { userId: string; name: string; role: string };
const makeActor = (name = 'Workspace Operator', userId = 'unknown-user', role = 'viewer'): Actor => ({ name, userId, role });
const errorWithStatus = (message: string, status: number) => { const error = new Error(message); (error as Error & { status?: number }).status = status; return error; };
const unavailable = (capability: string) => errorWithStatus(`${capability} is unavailable until an approved provider is configured`, 501);

export function ensureContinuousAssuranceSchema() { return Promise.resolve(); }

export function assertCcmPermission(role: string | null | undefined, permission: CcmPermission) {
  const normalizedRole = (role || 'viewer') as CcmWorkspaceRole;
  if (!continuousAssurancePermissionMap[permission].includes(normalizedRole)) throw errorWithStatus(`Insufficient permission for ${permission}`, 403);
}

async function logActivity(workspaceId: string, who: Actor, action: string, targetType: string, targetId: string, targetName: string, notes: string, severity: 'low'|'medium'|'high'|'critical' = 'low') {
  await recordActivity({ workspaceId, actorUserId: who.userId, actorName: who.name, actorRole: who.role, action,
    category: 'control', targetType, targetId, targetName, outcome: 'success', severity, source: 'backend', notes });
}

function buildAnalytics(monitors: ControlMonitor[], exceptions: AssuranceException[]): ContinuousAssuranceAnalytics {
  const frameworks = new Map<string, number>();
  const domains = new Map<string, { passed: number; failed: number }>();
  monitors.forEach((monitor) => {
    frameworks.set(monitor.framework, (frameworks.get(monitor.framework) || 0) + 1);
    const counts = domains.get(monitor.framework) || { passed: 0, failed: 0 };
    if (monitor.result === 'passed') counts.passed += 1;
    if (monitor.result === 'failed') counts.failed += 1;
    domains.set(monitor.framework, counts);
  });
  return {
    controlsByFramework: [...frameworks].map(([framework, count]) => ({ framework, count })),
    passFailByDomain: [...domains].map(([domain, counts]) => ({ domain, ...counts })),
    exceptionsBySeverity: (['low','medium','high','critical'] as Severity[]).map(severity => ({ severity, count: exceptions.filter(item => item.severity === severity && !['resolved','accepted'].includes(item.status)).length })),
    evidenceFreshnessTrend: [], connectorReliabilityTrend: [], assuranceScoreByMonth: [],
    controlFailureRecurrence: monitors.filter(item => item.result === 'failed').map(item => ({ control: item.controlName, count: 1 })),
    topFailingControls: monitors.filter(item => item.result === 'failed').map(item => ({ control: item.controlName, count: 1 })),
    topOverdueEvidence: [], coverageByBusinessUnit: [],
  };
}

function buildOverview(monitors: ControlMonitor[], tests: AutomatedTest[], exceptions: AssuranceException[], data: ContinuousAssuranceAnalytics): ContinuousAssuranceOverview {
  const active = monitors.filter(item => item.status !== 'disabled');
  const passing = active.filter(item => item.result === 'passed').length;
  const failing = active.filter(item => item.result === 'failed').length;
  const warning = active.filter(item => item.result === 'warning').length;
  const open = exceptions.filter(item => !['resolved','accepted'].includes(item.status)).length;
  const score = active.length ? Math.max(0, Math.round((passing / active.length) * 100 - open * 3)) : 0;
  return {
    score, status: score >= 85 ? 'strong' : score >= 65 ? 'stable' : score >= 40 ? 'degraded' : 'critical', trend: 'stable',
    topDrivers: [
      { label: 'Passing monitored controls', value: passing, weight: 60, contribution: active.length ? Math.round((passing / active.length) * 60) : 0 },
      { label: 'Open assurance exceptions', value: open, weight: 40, contribution: Math.max(0, 40 - open * 5) },
    ],
    controlsMonitored: active.length, controlsPassing: passing, controlsFailing: failing, controlsDegraded: warning,
    evidenceCollectedAutomatically: 0, evidenceMissing: 0, complianceDriftAlerts: 0, connectorHealth: 0,
    openExceptions: open, failedTests: tests.filter(item => item.lastResult === 'failed').length, upcomingControlReviews: 0,
    controlHealthTrend: [], testPassFailTrend: [], evidenceCollectionTrend: [], complianceDriftTrend: [],
    frameworkAssuranceCoverage: data.controlsByFramework.map(item => ({ framework: item.framework, coverage: item.count })),
    connectorStatusDistribution: [], exceptionSeverityDistribution: data.exceptionsBySeverity, notifications: [],
  };
}

export async function getContinuousAssuranceState(workspaceId: string): Promise<ContinuousAssuranceState> {
  const [monitors, tests, testRuns, exceptions, remediationTasks, settings] = await Promise.all([
    repo.listMonitors(workspaceId), repo.listTests(workspaceId), repo.listRuns(workspaceId), repo.listExceptions(workspaceId), repo.listTasks(workspaceId), repo.getSettings(workspaceId),
  ]);
  const data = buildAnalytics(monitors, exceptions);
  return { overview: buildOverview(monitors, tests, exceptions, data), monitors, tests, testRuns, evidenceJobs: [], connectors: [], connectorSyncLogs: [], drift: [], exceptions, remediationTasks, notifications: [], notificationPreferences: [], connectorConfigurations: [], reports: [], settings, analytics: data };
}

export const listControlMonitors = repo.listMonitors;
export const listAutomatedTests = repo.listTests;
export const listAssuranceExceptions = repo.listExceptions;
export const listRemediationTasks = repo.listTasks;
export async function listEvidenceJobs(_workspaceId: string): Promise<EvidenceCollectionJob[]> { return []; }
export async function listConnectors(_workspaceId: string): Promise<Connector[]> { return []; }
export async function listComplianceDrift(_workspaceId: string): Promise<ComplianceDrift[]> { return []; }
export async function listContinuousAssuranceReports(_workspaceId: string): Promise<AssuranceReport[]> { return []; }
export async function listAssuranceNotifications(_workspaceId: string): Promise<AssuranceNotification[]> { return []; }

export async function createControlMonitor(workspaceId: string, role: string | null | undefined, input: Partial<ControlMonitor>, actorName = 'Workspace Operator', actorUserId = 'unknown-user') {
  assertCcmPermission(role, 'manage_control_monitors');
  const required = ['name','controlId','controlName','framework','controlObjective','testType','frequency','owner'] as const;
  if (required.some(key => !String(input[key] || '').trim())) throw errorWithStatus(`Required monitor fields: ${required.join(', ')}`, 400);
  await assertWorkspaceLinks(workspaceId, { controls: [input.controlId!] });
  const who = makeActor(actorName, actorUserId, role || 'viewer');
  const monitor = await repo.createMonitorWithTest(workspaceId, { name: input.name!, controlId: input.controlId!, controlName: input.controlName!, framework: input.framework!, frameworkId: input.frameworkId, controlObjective: input.controlObjective!, testType: input.testType!, frequency: input.frequency!, owner: input.owner!, nextRun: input.nextRun }, who);
  await logActivity(workspaceId, who, 'control_monitor_created', 'control_monitor', monitor.id, monitor.name, 'Persisted continuous assurance monitor and test created.');
  return monitor;
}

export async function updateControlMonitor(workspaceId: string, role: string | null | undefined, id: string, patch: Partial<ControlMonitor>, actorName = 'Workspace Operator', actorUserId = 'unknown-user') {
  assertCcmPermission(role, 'manage_control_monitors');
  if (patch.controlId || patch.id || patch.workspaceId) throw errorWithStatus('Monitor identity and linked control cannot be changed', 400);
  const updated = await repo.updateMonitor(workspaceId, id, patch);
  if (!updated) throw errorWithStatus('Control monitor not found in this workspace', 404);
  await logActivity(workspaceId, makeActor(actorName, actorUserId, role || 'viewer'), 'control_monitor_updated', 'control_monitor', id, updated.name, 'Continuous assurance monitor updated.');
  return updated;
}

export async function updateAutomatedTest(workspaceId: string, role: string | null | undefined, id: string, patch: Partial<AutomatedTest>, actorName = 'Workspace Operator', actorUserId = 'unknown-user') {
  assertCcmPermission(role, 'run_automated_tests');
  if (patch.id || patch.workspaceId || patch.monitorId || patch.lastResult || patch.lastRun) throw errorWithStatus('Test identity and recorded results cannot be edited', 400);
  const updated = await repo.updateTest(workspaceId, id, patch);
  if (!updated) throw errorWithStatus('Automated test not found in this workspace', 404);
  await logActivity(workspaceId, makeActor(actorName, actorUserId, role || 'viewer'), 'control_test_updated', 'control_test', id, updated.name, 'Control test configuration updated.');
  return updated;
}

export async function runAutomatedTest(workspaceId: string, role: string | null | undefined, testId: string, input: { status?: TestResultStatus; summary?: string; details?: string; evidenceIds?: string[]; severity?: Severity } = {}, actorName = 'Workspace Operator', actorUserId = 'unknown-user') {
  assertCcmPermission(role, 'run_automated_tests');
  if (!input.status || !['passed','failed','warning','not_applicable'].includes(input.status) || !input.summary?.trim() || !input.details?.trim()) throw errorWithStatus('A reviewed result, summary and details are required; tests are not executed by an external connector', 400);
  if (input.evidenceIds?.length) await assertWorkspaceLinks(workspaceId, { evidence: input.evidenceIds });
  const who = makeActor(actorName, actorUserId, role || 'viewer');
  const result = await repo.recordTestRun(workspaceId, testId, { status: input.status, summary: input.summary, details: input.details, evidenceIds: input.evidenceIds || [], severity: input.severity || 'medium' }, who);
  await logActivity(workspaceId, who, 'control_test_recorded', 'control_test', testId, result.test.name, `Reviewed test result recorded as ${input.status}.`, input.status === 'failed' ? 'high' : input.status === 'warning' ? 'medium' : 'low');
  return result;
}

export async function createAssuranceException(workspaceId: string, role: string | null | undefined, input: Partial<AssuranceException>, actorName = 'Workspace Operator', actorUserId = 'unknown-user') {
  assertCcmPermission(role, 'resolve_exceptions');
  if (!input.type?.trim() || !input.source?.trim() || !input.owner?.trim() || !input.remediationAction?.trim()) throw errorWithStatus('Exception type, source, owner and remediation action are required', 400);
  await assertWorkspaceLinks(workspaceId, { controls: input.linkedControlId ? [input.linkedControlId] : undefined, risks: input.linkedRiskId ? [input.linkedRiskId] : undefined });
  const who = makeActor(actorName, actorUserId, role || 'viewer');
  const exception = await repo.createException(workspaceId, { type: input.type, severity: input.severity || 'medium', source: input.source, linkedControlId: input.linkedControlId, linkedFramework: input.linkedFramework, linkedRiskId: input.linkedRiskId, owner: input.owner, dueDate: input.dueDate, remediationAction: input.remediationAction }, who);
  await logActivity(workspaceId, who, 'assurance_exception_created', 'assurance_exception', exception.id, exception.type, 'Assurance exception created.');
  return exception;
}

export async function updateAssuranceException(workspaceId: string, role: string | null | undefined, id: string, patch: Partial<AssuranceException>, actorName = 'Workspace Operator', actorUserId = 'unknown-user') {
  assertCcmPermission(role, 'resolve_exceptions');
  if (patch.id || patch.workspaceId || patch.linkedControlId || patch.linkedRiskId) throw errorWithStatus('Exception identity and source links cannot be changed', 400);
  if (patch.evidenceIds?.length) await assertWorkspaceLinks(workspaceId, { evidence: patch.evidenceIds });
  const who = makeActor(actorName, actorUserId, role || 'viewer');
  const updated = await repo.updateException(workspaceId, id, { owner: patch.owner, dueDate: patch.dueDate, status: patch.status, remediationAction: patch.remediationAction, evidenceIds: patch.evidenceIds, resolutionRationale: patch.resolutionRationale || undefined, actor: who });
  if (!updated) throw errorWithStatus('Assurance exception not found in this workspace', 404);
  await logActivity(workspaceId, who, 'assurance_exception_updated', 'assurance_exception', id, updated.type, `Exception status is ${updated.status}.`);
  return updated;
}

export async function createRemediationTask(workspaceId: string, role: string | null | undefined, input: Omit<RemediationTask,'id'|'workspaceId'|'createdAt'>, actorName = 'Workspace Operator', actorUserId = 'unknown-user') {
  assertCcmPermission(role, 'resolve_exceptions');
  const who = makeActor(actorName, actorUserId, role || 'viewer');
  const task = await repo.createTask(workspaceId, input, who);
  await logActivity(workspaceId, who, 'assurance_remediation_created', 'assurance_task', task.id, task.title, task.description);
  return task;
}

export async function updateRemediationTask(workspaceId: string, role: string | null | undefined, id: string, patch: Partial<RemediationTask>, actorName = 'Workspace Operator', actorUserId = 'unknown-user') {
  assertCcmPermission(role, 'resolve_exceptions');
  if (patch.id || patch.workspaceId || patch.linkedObjectId || patch.linkedObjectType || patch.sourceId || patch.sourceType) throw errorWithStatus('Task identity and source links cannot be changed', 400);
  const updated = await repo.updateTask(workspaceId, id, patch);
  if (!updated) throw errorWithStatus('Remediation task not found in this workspace', 404);
  await logActivity(workspaceId, makeActor(actorName, actorUserId, role || 'viewer'), 'assurance_remediation_updated', 'assurance_task', id, updated.title, `Task status is ${updated.status}.`);
  return updated;
}

export async function getContinuousAssuranceAnalytics(workspaceId: string) { return (await getContinuousAssuranceState(workspaceId)).analytics; }
export const getContinuousAssuranceSettings = repo.getSettings;
export async function updateContinuousAssuranceSettings(workspaceId: string, role: string | null | undefined, patch: Partial<AssuranceSetting>, actorName = 'Workspace Operator', actorUserId = 'unknown-user') {
  assertCcmPermission(role, 'manage_control_monitors');
  const updated = await repo.updateSettings(workspaceId, patch, actorUserId);
  await logActivity(workspaceId, makeActor(actorName, actorUserId, role || 'viewer'), 'assurance_settings_updated', 'assurance_settings', workspaceId, 'Continuous Assurance Settings', 'Continuous assurance settings updated.');
  return updated;
}

export async function recordEvidenceDecision(..._args: unknown[]): Promise<never> { throw unavailable('Automated evidence collection'); }
export async function updateConnector(..._args: unknown[]): Promise<never> { throw unavailable('Assurance connectors'); }
export async function configureConnector(..._args: unknown[]): Promise<never> { throw unavailable('Assurance connectors'); }
export async function updateDriftItem(..._args: unknown[]): Promise<never> { throw unavailable('Connector-backed drift detection'); }
export async function closeDrift(..._args: unknown[]): Promise<never> { throw unavailable('Connector-backed drift detection'); }
export async function generateContinuousAssuranceReport(..._args: unknown[]): Promise<never> { throw unavailable('Continuous assurance export'); }
export async function updateAssuranceNotification(..._args: unknown[]): Promise<never> { throw unavailable('Assurance notifications'); }
export async function updateNotificationPreference(..._args: unknown[]): Promise<NotificationPreference[]> { throw unavailable('Assurance notifications'); }
