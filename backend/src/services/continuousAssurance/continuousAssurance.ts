import {
  type AssuranceException,
  type AssuranceNotification,
  type AssuranceReport,
  type AssuranceSetting,
  type AutomatedTest,
  type CcmPermission,
  type CcmWorkspaceRole,
  type ComplianceDrift,
  type Connector,
  type ConnectorConfigurationRecord,
  type ConnectorSyncLog,
  type ContinuousAssuranceAnalytics,
  type ContinuousAssuranceOverview,
  type ContinuousAssuranceState,
  type ControlMonitor,
  type EvidenceCollectionJob,
  type NotificationPreference,
  type RemediationTask,
  type TestRun,
  continuousAssurancePermissionMap,
} from '../../types/continuousAssurance.js';
import { recordActivity } from '../activityLedger/activityLedger.js';

const stateStore = new Map<string, ContinuousAssuranceState>();

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

function getDateValue(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function sortTrend(points: Array<{ label: string; value: number }>) {
  return [...points].sort((left, right) => left.label.localeCompare(right.label));
}

function notificationPreferences(): NotificationPreference[] {
  return [
    { channel: 'in_app', type: 'failed_test', enabled: true },
    { channel: 'in_app', type: 'drift_alert', enabled: true },
    { channel: 'in_app', type: 'connector_failure', enabled: true },
    { channel: 'in_app', type: 'missing_evidence', enabled: true },
    { channel: 'email', type: 'approval_request', enabled: true },
    { channel: 'email', type: 'risk_escalation', enabled: true },
    { channel: 'teams', type: 'review_assignment', enabled: false },
  ];
}

function initialSettings(): AssuranceSetting {
  return {
    defaultTestFrequency: 'Weekly',
    evidenceFreshnessPeriodDays: 30,
    driftSeverityThreshold: 'medium',
    exceptionSlaDays: 14,
    notificationRules: ['failed_test', 'drift_detected', 'connector_failure', 'exception_overdue'],
    connectorSyncFrequency: 'Daily',
    autoCreateRemediationTask: true,
    autoLinkEvidence: true,
  };
}

function buildAnalytics(
  monitors: ControlMonitor[],
  evidenceJobs: EvidenceCollectionJob[],
  exceptions: AssuranceException[],
  connectors: Connector[],
): ContinuousAssuranceAnalytics {
  const frameworkCounts = new Map<string, number>();
  const passFailByDomain = new Map<string, { passed: number; failed: number }>();

  for (const monitor of monitors) {
    frameworkCounts.set(monitor.framework, (frameworkCounts.get(monitor.framework) ?? 0) + 1);
    const domain = passFailByDomain.get(monitor.framework) ?? { passed: 0, failed: 0 };
    if (monitor.result === 'passed') domain.passed += 1;
    if (monitor.result === 'failed') domain.failed += 1;
    passFailByDomain.set(monitor.framework, domain);
  }

  return {
    controlsByFramework: Array.from(frameworkCounts.entries()).map(([framework, count]) => ({ framework, count })),
    passFailByDomain: Array.from(passFailByDomain.entries()).map(([domain, counts]) => ({
      domain,
      passed: counts.passed,
      failed: counts.failed,
    })),
    exceptionsBySeverity: ['low', 'medium', 'high', 'critical'].map((severity) => ({
      severity: severity as AssuranceException['severity'],
      count: exceptions.filter((item) => item.severity === severity).length,
    })),
    evidenceFreshnessTrend: sortTrend([
      { label: 'Jan', value: 72 },
      { label: 'Feb', value: 75 },
      { label: 'Mar', value: 80 },
      { label: 'Apr', value: 78 },
      { label: 'May', value: 84 },
      { label: 'Jun', value: 87 },
    ]),
    connectorReliabilityTrend: sortTrend([
      { label: 'Jan', value: 84 },
      { label: 'Feb', value: 82 },
      { label: 'Mar', value: 86 },
      { label: 'Apr', value: 88 },
      { label: 'May', value: 83 },
      { label: 'Jun', value: 85 },
    ]),
    assuranceScoreByMonth: sortTrend([
      { label: 'Jan', value: 68 },
      { label: 'Feb', value: 70 },
      { label: 'Mar', value: 72 },
      { label: 'Apr', value: 73 },
      { label: 'May', value: 75 },
      { label: 'Jun', value: 78 },
    ]),
    controlFailureRecurrence: monitors
      .filter((monitor) => monitor.result === 'failed' || monitor.result === 'warning')
      .map((monitor) => ({ control: monitor.controlName, count: monitor.result === 'failed' ? 3 : 1 })),
    topFailingControls: monitors
      .filter((monitor) => monitor.result === 'failed')
      .map((monitor) => ({ control: monitor.controlName, count: 1 })),
    topOverdueEvidence: evidenceJobs
      .filter((job) => job.freshnessStatus !== 'fresh')
      .map((job) => ({
        job: job.name,
        daysOverdue: Math.max(1, Math.round((Date.now() - getDateValue(job.lastCollectedAt)) / (1000 * 60 * 60 * 24))),
      })),
    coverageByBusinessUnit: [
      { unit: 'Security', coverage: 92 },
      { unit: 'Technology', coverage: 84 },
      { unit: 'Operations', coverage: 76 },
      { unit: 'Compliance', coverage: 89 },
    ],
  };
}

function calculateOverview(
  monitors: ControlMonitor[],
  tests: AutomatedTest[],
  evidenceJobs: EvidenceCollectionJob[],
  connectors: Connector[],
  drift: ComplianceDrift[],
  exceptions: AssuranceException[],
  notifications: AssuranceNotification[],
  analytics: ContinuousAssuranceAnalytics,
): ContinuousAssuranceOverview {
  const controlsPassing = monitors.filter((monitor) => monitor.result === 'passed').length;
  const controlsFailing = monitors.filter((monitor) => monitor.result === 'failed').length;
  const controlsDegraded = monitors.filter((monitor) => monitor.result === 'warning').length;
  const failedTests = tests.filter((test) => test.lastResult === 'failed').length;
  const evidenceMissing = evidenceJobs.filter((job) => job.freshnessStatus !== 'fresh').length;
  const connectorHealthy = connectors.filter((connector) => connector.healthStatus === 'healthy').length;
  const connectorHealth = connectors.length ? Math.round((connectorHealthy / connectors.length) * 100) : 0;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        82 -
          controlsFailing * 9 -
          controlsDegraded * 4 -
          evidenceMissing * 3 -
          drift.filter((item) => item.status !== 'resolved').length * 2 -
          exceptions.filter((item) => item.status !== 'resolved').length * 2 +
          connectorHealthy * 2,
      ),
    ),
  );

  const status =
    score >= 85 ? 'strong' :
    score >= 72 ? 'stable' :
    score >= 58 ? 'degraded' :
    'critical';

  return {
    score,
    status,
    trend: score >= 75 ? 'improving' : score >= 60 ? 'stable' : 'declining',
    topDrivers: [
      { label: 'Controls Passing', value: controlsPassing, weight: 0.35, contribution: Math.round(controlsPassing * 3.5) },
      { label: 'Evidence Freshness', value: evidenceJobs.length - evidenceMissing, weight: 0.2, contribution: Math.max(0, 20 - evidenceMissing * 5) },
      { label: 'Connector Reliability', value: connectorHealth, weight: 0.2, contribution: Math.round(connectorHealth * 0.2) },
      { label: 'Drift Pressure', value: drift.filter((item) => item.status !== 'resolved').length, weight: 0.15, contribution: -drift.length * 2 },
      { label: 'Open Exceptions', value: exceptions.filter((item) => item.status !== 'resolved').length, weight: 0.1, contribution: -exceptions.length * 2 },
    ],
    controlsMonitored: monitors.length,
    controlsPassing,
    controlsFailing,
    controlsDegraded,
    evidenceCollectedAutomatically: evidenceJobs.filter((job) => job.source !== 'manual_upload').length,
    evidenceMissing,
    complianceDriftAlerts: drift.filter((item) => item.status !== 'resolved').length,
    connectorHealth,
    openExceptions: exceptions.filter((item) => item.status !== 'resolved').length,
    failedTests,
    upcomingControlReviews: monitors.filter((monitor) => getDateValue(monitor.nextRun) < Date.now() + 14 * 24 * 60 * 60 * 1000).length,
    controlHealthTrend: analytics.assuranceScoreByMonth,
    testPassFailTrend: analytics.connectorReliabilityTrend,
    evidenceCollectionTrend: analytics.evidenceFreshnessTrend,
    complianceDriftTrend: sortTrend([
      { label: 'Jan', value: 1 },
      { label: 'Feb', value: 2 },
      { label: 'Mar', value: 2 },
      { label: 'Apr', value: 3 },
      { label: 'May', value: 2 },
      { label: 'Jun', value: drift.filter((item) => item.status !== 'resolved').length },
    ]),
    frameworkAssuranceCoverage: analytics.controlsByFramework.map((item) => ({
      framework: item.framework,
      coverage: Math.min(100, Math.round((item.count / Math.max(1, monitors.length)) * 100 * 2)),
    })),
    connectorStatusDistribution: ['connected', 'degraded', 'disconnected', 'error'].map((status) => ({
      status: status as Connector['connectionStatus'],
      count: connectors.filter((connector) => connector.connectionStatus === status).length,
    })),
    exceptionSeverityDistribution: ['low', 'medium', 'high', 'critical'].map((severity) => ({
      severity: severity as AssuranceException['severity'],
      count: exceptions.filter((item) => item.severity === severity).length,
    })),
    notifications,
  };
}

function createSeedState(workspaceId: string): ContinuousAssuranceState {
  const monitors: ControlMonitor[] = [
    {
      id: 'mon-mfa',
      workspaceId,
      name: 'MFA Enforcement Monitor',
      controlId: 'CTRL-ACCESS-01',
      controlName: 'Privileged access requires MFA',
      framework: 'ISO 27001',
      controlObjective: 'Ensure MFA is enabled for privileged access.',
      testType: 'mfa_enabled',
      frequency: 'Daily',
      owner: 'Identity Security',
      status: 'active',
      lastRun: nowIso(-1),
      nextRun: nowIso(1),
      result: 'passed',
      evidenceOutput: 'Authenticator coverage snapshot',
      evidenceRequirementId: 'EVREQ-001',
      evidenceJobId: 'job-mfa',
      exceptionCount: 0,
    },
    {
      id: 'mon-evidence',
      workspaceId,
      name: 'Evidence Freshness Monitor',
      controlId: 'CTRL-EVID-04',
      controlName: 'Evidence remains current',
      framework: 'SOC 2',
      controlObjective: 'Maintain current evidence for key controls.',
      testType: 'evidence_freshness',
      frequency: 'Weekly',
      owner: 'Assurance Office',
      status: 'warning',
      lastRun: nowIso(-2),
      nextRun: nowIso(5),
      result: 'warning',
      evidenceOutput: 'Freshness backlog report',
      evidenceRequirementId: 'EVREQ-014',
      evidenceJobId: 'job-evidence',
      exceptionCount: 2,
    },
    {
      id: 'mon-backup',
      workspaceId,
      name: 'Backup Success Monitor',
      controlId: 'CTRL-OPS-09',
      controlName: 'Backups complete successfully',
      framework: 'NIST CSF',
      controlObjective: 'Validate backup execution and recovery evidence.',
      testType: 'backup_success',
      frequency: 'Daily',
      owner: 'Infrastructure Operations',
      status: 'failed',
      lastRun: nowIso(-1),
      nextRun: nowIso(1),
      result: 'failed',
      evidenceOutput: 'Backup job confirmation',
      evidenceRequirementId: 'EVREQ-031',
      evidenceJobId: 'job-backup',
      exceptionCount: 1,
    },
  ];

  const tests: AutomatedTest[] = monitors.map((monitor) => ({
    id: `test-${monitor.id}`,
    workspaceId,
    monitorId: monitor.id,
    name: `${monitor.name} Test`,
    description: monitor.controlObjective,
    schedule: monitor.frequency,
    enabled: true,
    owner: monitor.owner,
    lastRun: monitor.lastRun,
    lastResult: monitor.result,
  }));

  const testRuns: TestRun[] = tests.map((test) => ({
    id: `run-${test.id}`,
    workspaceId,
    automatedTestId: test.id,
    monitorId: test.monitorId,
    startedAt: test.lastRun || nowIso(-1),
    completedAt: test.lastRun || nowIso(-1),
    status: test.lastResult,
    summary: test.lastResult === 'failed' ? 'Control failed assurance validation' : test.lastResult === 'warning' ? 'Control requires review' : 'Control passed',
    details: `Latest run for ${test.name} finished with status ${test.lastResult}.`,
    evidenceGenerated: test.lastResult === 'passed' ? ['EVID-AUTO-001'] : [],
  }));

  const evidenceJobs: EvidenceCollectionJob[] = [
    {
      id: 'job-mfa',
      workspaceId,
      name: 'MFA posture collection',
      source: 'api_connector',
      linkedControls: ['CTRL-ACCESS-01'],
      linkedMonitorId: 'mon-mfa',
      collectionFrequency: 'Daily',
      status: 'ready',
      lastCollectedAt: nowIso(-1),
      nextCollectionAt: nowIso(1),
      evidencePreview: 'Authenticator enrollment and enforcement coverage',
      approvalStatus: 'approved',
      freshnessStatus: 'fresh',
    },
    {
      id: 'job-backup',
      workspaceId,
      name: 'Backup confirmation collection',
      source: 'scheduled_job',
      linkedControls: ['CTRL-OPS-09'],
      linkedMonitorId: 'mon-backup',
      collectionFrequency: 'Daily',
      status: 'failed',
      lastCollectedAt: nowIso(-2),
      nextCollectionAt: nowIso(1),
      evidencePreview: 'Latest backup task output',
      approvalStatus: 'pending',
      freshnessStatus: 'warning',
    },
  ];

  const connectors: Connector[] = [
    { id: 'con-entra', workspaceId, name: 'Microsoft Entra ID', type: 'Microsoft Entra ID', owner: 'Identity Security', connectionStatus: 'connected', healthStatus: 'healthy', lastSync: nowIso(-1), syncFrequency: 'Daily', linkedJobIds: ['job-mfa'], lastTestedAt: nowIso(-1), configurationStatus: 'configured', environment: 'production', authMode: 'oauth' },
    { id: 'con-aws', workspaceId, name: 'AWS', type: 'AWS', owner: 'Cloud Security', connectionStatus: 'degraded', healthStatus: 'warning', lastSync: nowIso(-2), syncFrequency: 'Daily', linkedJobIds: ['job-backup'], lastTestedAt: nowIso(-2), configurationStatus: 'configured', environment: 'production', authMode: 'service_principal' },
    { id: 'con-github', workspaceId, name: 'GitHub', type: 'GitHub', owner: 'Platform Engineering', connectionStatus: 'connected', healthStatus: 'healthy', lastSync: nowIso(-1), syncFrequency: 'Daily', linkedJobIds: [], lastTestedAt: nowIso(-1), configurationStatus: 'configured', environment: 'sandbox', authMode: 'oauth' },
  ];

  const connectorConfigurations: ConnectorConfigurationRecord[] = connectors.map((connector) => ({
    connectorId: connector.id,
    workspaceId,
    tenantLabel: `${connector.name} tenant`,
    environment: connector.environment || 'production',
    authMode: connector.authMode || 'custom',
    scopes: ['read'],
    endpoints: ['https://api.example.com'],
    lastConfiguredAt: connector.lastTestedAt,
    lastConfiguredBy: connector.owner,
    testStatus: connector.connectionStatus === 'error' ? 'failed' : 'passed',
    notes: 'Configuration is valid for mock-safe testing.',
  }));

  const connectorSyncLogs: ConnectorSyncLog[] = connectors.map((connector) => ({
    id: makeId('sync'),
    connectorId: connector.id,
    timestamp: connector.lastSync || nowIso(-1),
    status: connector.connectionStatus === 'error' ? 'failed' : 'success',
    summary: connector.connectionStatus === 'error' ? 'Authentication or transport failure detected.' : 'Sync completed successfully.',
  }));

  const drift: ComplianceDrift[] = [
    {
      id: 'drift-aws',
      workspaceId,
      driftType: 'Connector stopped syncing',
      affectedObject: 'AWS backup evidence feed',
      severity: 'high',
      detectedDate: nowIso(-2),
      owner: 'Cloud Security',
      recommendedAction: 'Restore connector credentials and re-run collection job.',
      status: 'open',
      linkedControlId: 'CTRL-OPS-09',
      linkedFramework: 'NIST CSF',
      rootCause: 'Expired access key in connector profile.',
      impact: 'Backup evidence freshness is falling behind.',
      recommendation: 'Reconfigure connector secrets, validate sync, and collect missing evidence.',
      relatedAssets: ['ASSET-BACKUP-01'],
      relatedControls: ['CTRL-OPS-09'],
      relatedRisks: ['RISK-OPS-14'],
      relatedEvidence: ['EVID-AUTO-091'],
    },
  ];

  const exceptions: AssuranceException[] = [
    {
      id: 'exc-backup',
      workspaceId,
      type: 'failed control test',
      severity: 'high',
      source: 'Backup Success Monitor',
      linkedControlId: 'CTRL-OPS-09',
      linkedFramework: 'NIST CSF',
      linkedRiskId: 'RISK-OPS-14',
      owner: 'Infrastructure Operations',
      dueDate: nowIso(5),
      status: 'open',
      remediationAction: 'Investigate failed backup and attach recovery validation.',
      evidence: 'EVID-AUTO-091',
    },
  ];

  const remediationTasks: RemediationTask[] = [
    {
      id: 'task-backup',
      workspaceId,
      sourceType: 'failed_test',
      sourceId: 'test-mon-backup',
      linkedObjectLabel: 'Backup Success Monitor Test',
      title: 'Restore backup job assurance evidence',
      description: 'Investigate the failed backup control test and attach a validated recovery evidence pack.',
      owner: 'Infrastructure Operations',
      priority: 'high',
      dueDate: nowIso(5),
      status: 'open',
      linkedObjectType: 'test',
      linkedObjectId: 'test-mon-backup',
      createdAt: nowIso(-1),
    },
  ];

  const notifications: AssuranceNotification[] = [
    { id: 'notif-failed-test', workspaceId, type: 'failed_test', title: 'Failed control test requires response', detail: 'Backup Success Monitor failed in the latest daily run.', severity: 'high', status: 'unread', routeKey: 'ccm-tests', createdAt: nowIso(-1), assignedTo: 'Infrastructure Operations' },
    { id: 'notif-drift', workspaceId, type: 'drift_alert', title: 'Connector drift alert is open', detail: 'AWS backup evidence feed has stopped syncing and needs remediation.', severity: 'high', status: 'unread', routeKey: 'ccm-drift', createdAt: nowIso(-1), assignedTo: 'Cloud Security' },
  ];

  const reports: AssuranceReport[] = [
    { id: 'rpt-assurance', workspaceId, title: 'Continuous Assurance Report', type: 'Continuous Assurance Report', generatedAt: nowIso(-6), generatedBy: 'Risk Office', formatSupport: ['pdf', 'excel', 'csv'], summary: 'Monthly assurance score, drift, and exceptions summary.' },
  ];

  const analytics = buildAnalytics(monitors, evidenceJobs, exceptions, connectors);
  const overview = calculateOverview(monitors, tests, evidenceJobs, connectors, drift, exceptions, notifications, analytics);

  return {
    overview,
    monitors,
    tests,
    testRuns,
    evidenceJobs,
    connectors,
    connectorSyncLogs,
    drift,
    exceptions,
    remediationTasks,
    notifications,
    notificationPreferences: notificationPreferences(),
    connectorConfigurations,
    reports,
    settings: initialSettings(),
    analytics,
  };
}

function refreshDerivedState(workspaceId: string, state: ContinuousAssuranceState) {
  state.analytics = buildAnalytics(state.monitors, state.evidenceJobs, state.exceptions, state.connectors);
  state.overview = calculateOverview(
    state.monitors,
    state.tests,
    state.evidenceJobs,
    state.connectors,
    state.drift,
    state.exceptions,
    state.notifications,
    state.analytics,
  );
  stateStore.set(workspaceId, state);
  return state;
}

function getState(workspaceId: string) {
  if (!stateStore.has(workspaceId)) {
    stateStore.set(workspaceId, createSeedState(workspaceId));
  }
  return stateStore.get(workspaceId)!;
}

function cloneState(workspaceId: string) {
  return structuredClone(getState(workspaceId));
}

export function ensureContinuousAssuranceSchema() {
  return Promise.resolve();
}

export function assertCcmPermission(role: string | null | undefined, permission: CcmPermission) {
  const normalizedRole = (role || 'viewer') as CcmWorkspaceRole;
  if (!continuousAssurancePermissionMap[permission].includes(normalizedRole)) {
    const error = new Error(`Insufficient permission for ${permission}`);
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
}

async function logCcmActivity(workspaceId: string, actorName: string, actorRole: string, action: string, targetType: string, targetId: string, targetName: string, notes: string, severity: 'info' | 'low' | 'medium' | 'high' | 'critical' = 'low') {
  await recordActivity({
    workspaceId,
    actorUserId: 'system-user',
    actorName,
    actorRole,
    action,
    category: 'control',
    targetType,
    targetId,
    targetName,
    outcome: 'success',
    severity,
    source: 'backend',
    notes,
  });
}

export async function getContinuousAssuranceState(workspaceId: string) {
  return cloneState(workspaceId);
}

export async function listControlMonitors(workspaceId: string) {
  return cloneState(workspaceId).monitors;
}

export async function createControlMonitor(workspaceId: string, role: string | null | undefined, input: Partial<ControlMonitor>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'manage_control_monitors');
  const state = getState(workspaceId);
  const monitor: ControlMonitor = {
    id: makeId('mon'),
    workspaceId,
    name: input.name || 'New Control Monitor',
    controlId: input.controlId || 'CTRL-NEW',
    controlName: input.controlName || input.name || 'New Control',
    framework: input.framework || 'ISO 27001',
    frameworkId: input.frameworkId,
    controlObjective: input.controlObjective || 'Monitor control state continuously.',
    testType: input.testType || 'policy_review',
    frequency: input.frequency || state.settings.defaultTestFrequency,
    owner: input.owner || actorName,
    status: input.status || 'active',
    lastRun: input.lastRun || null,
    nextRun: input.nextRun || nowIso(7),
    result: input.result || 'not_run',
    evidenceOutput: input.evidenceOutput || 'Awaiting automated evidence output',
    evidenceRequirementId: input.evidenceRequirementId || null,
    evidenceJobId: input.evidenceJobId || null,
    exceptionCount: input.exceptionCount || 0,
  };
  state.monitors.unshift(monitor);
  state.tests.unshift({
    id: makeId('test'),
    workspaceId,
    monitorId: monitor.id,
    name: `${monitor.name} Test`,
    description: monitor.controlObjective,
    schedule: monitor.frequency,
    enabled: true,
    owner: monitor.owner,
    lastResult: 'not_run',
  });
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'control monitor created', 'monitor', monitor.id, monitor.name, 'Continuous assurance monitor created.');
  return monitor;
}

export async function updateControlMonitor(workspaceId: string, role: string | null | undefined, monitorId: string, patch: Partial<ControlMonitor>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'manage_control_monitors');
  const state = getState(workspaceId);
  const monitor = state.monitors.find((item) => item.id === monitorId);
  if (!monitor) throw new Error('Control monitor not found.');
  Object.assign(monitor, patch);
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'control monitor updated', 'monitor', monitor.id, monitor.name, 'Continuous assurance monitor updated.');
  return monitor;
}

export async function listAutomatedTests(workspaceId: string) {
  return cloneState(workspaceId).tests;
}

export async function runAutomatedTest(workspaceId: string, role: string | null | undefined, testId: string, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'run_automated_tests');
  const state = getState(workspaceId);
  const test = state.tests.find((item) => item.id === testId);
  if (!test) throw new Error('Automated test not found.');
  let result: TestRun['status'];
  if (test.lastResult === 'failed') {
    result = 'passed';
  } else if (test.lastResult === 'passed') {
    result = 'warning';
  } else {
    result = 'passed';
  }
  const completedAt = new Date().toISOString();
  test.lastRun = completedAt;
  test.lastResult = result;
  const monitor = state.monitors.find((item) => item.id === test.monitorId);
  if (monitor) {
    monitor.lastRun = completedAt;
    monitor.result = result;
    monitor.status = result === 'warning' ? 'warning' : 'active';
    monitor.nextRun = nowIso(7);
  }
  const run: TestRun = {
    id: makeId('run'),
    workspaceId,
    automatedTestId: test.id,
    monitorId: test.monitorId,
    startedAt: completedAt,
    completedAt,
    status: result,
    summary: result === 'warning' ? 'Automated test requires review.' : 'Automated test passed.',
    details: `${test.name} completed with result ${result}.`,
    evidenceGenerated: result === 'passed' ? [makeId('EVID')] : [],
  };
  state.testRuns.unshift(run);
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'automated test executed', 'test', test.id, test.name, `Automated test run completed with result ${result}.`, result === 'warning' ? 'medium' : 'low');
  return { test, run };
}

export async function updateAutomatedTest(workspaceId: string, role: string | null | undefined, testId: string, patch: Partial<AutomatedTest>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'run_automated_tests');
  const state = getState(workspaceId);
  const test = state.tests.find((item) => item.id === testId);
  if (!test) throw new Error('Automated test not found.');
  Object.assign(test, patch);
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'automated test updated', 'test', test.id, test.name, 'Automated test configuration updated.');
  return test;
}

export async function listEvidenceJobs(workspaceId: string) {
  return cloneState(workspaceId).evidenceJobs;
}

export async function recordEvidenceDecision(workspaceId: string, role: string | null | undefined, evidenceJobId: string, action: 'approved' | 'rejected' | 'recollected' | 'archived', note?: string, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'manage_evidence_jobs');
  const state = getState(workspaceId);
  const job = state.evidenceJobs.find((item) => item.id === evidenceJobId);
  if (!job) throw new Error('Evidence collection job not found.');
  if (action === 'approved' || action === 'rejected') job.approvalStatus = action;
  if (action === 'recollected') {
    job.freshnessStatus = 'fresh';
    job.lastCollectedAt = new Date().toISOString();
  }
  if (action === 'archived') job.status = 'paused';
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', `evidence ${action}`, 'evidence-job', job.id, job.name, note || `Evidence job ${action}.`);
  return job;
}

export async function listConnectors(workspaceId: string) {
  return cloneState(workspaceId).connectors;
}

export async function updateConnector(workspaceId: string, role: string | null | undefined, connectorId: string, patch: Partial<Connector>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'manage_connectors');
  const state = getState(workspaceId);
  const connector = state.connectors.find((item) => item.id === connectorId);
  if (!connector) throw new Error('Connector not found.');
  Object.assign(connector, patch);
  connector.lastSync = connector.lastSync || new Date().toISOString();
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'connector updated', 'connector', connector.id, connector.name, 'Connector state updated.');
  return connector;
}

export async function configureConnector(workspaceId: string, role: string | null | undefined, connectorId: string, patch: Partial<ConnectorConfigurationRecord>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'manage_connectors');
  const state = getState(workspaceId);
  const connector = state.connectors.find((item) => item.id === connectorId);
  if (!connector) throw new Error('Connector not found.');
  const existing = state.connectorConfigurations.find((item) => item.connectorId === connectorId);
  const config: ConnectorConfigurationRecord = {
    connectorId,
    workspaceId,
    tenantLabel: patch.tenantLabel || existing?.tenantLabel || `${connector.name} tenant`,
    environment: patch.environment || existing?.environment || connector.environment || 'sandbox',
    authMode: patch.authMode || existing?.authMode || connector.authMode || 'custom',
    scopes: patch.scopes || existing?.scopes || ['read'],
    endpoints: patch.endpoints || existing?.endpoints || ['https://api.example.com'],
    lastConfiguredAt: new Date().toISOString(),
    lastConfiguredBy: actorName,
    testStatus: patch.testStatus || existing?.testStatus || 'not_tested',
    notes: patch.notes ?? existing?.notes ?? 'Connector configuration updated.',
  };
  state.connectorConfigurations = [
    config,
    ...state.connectorConfigurations.filter((item) => item.connectorId !== connectorId),
  ];
  connector.configurationStatus = 'configured';
  connector.environment = config.environment;
  connector.authMode = config.authMode;
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'connector configured', 'connector', connector.id, connector.name, 'Connector configuration saved.');
  return config;
}

export async function listComplianceDrift(workspaceId: string) {
  return cloneState(workspaceId).drift;
}

export async function updateDriftItem(workspaceId: string, role: string | null | undefined, driftId: string, patch: Partial<ComplianceDrift>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'acknowledge_drift');
  const state = getState(workspaceId);
  const drift = state.drift.find((item) => item.id === driftId);
  if (!drift) throw new Error('Drift alert not found.');
  Object.assign(drift, patch);
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'drift updated', 'drift', drift.id, drift.affectedObject, 'Drift item updated.');
  return drift;
}

export async function closeDrift(workspaceId: string, role: string | null | undefined, driftId: string, actorName = 'Workspace Operator') {
  return updateDriftItem(workspaceId, role, driftId, { status: 'resolved' }, actorName);
}

export async function listAssuranceExceptions(workspaceId: string) {
  return cloneState(workspaceId).exceptions;
}

export async function createAssuranceException(workspaceId: string, role: string | null | undefined, input: Partial<AssuranceException>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'resolve_exceptions');
  const state = getState(workspaceId);
  const exception: AssuranceException = {
    id: makeId('exc'),
    workspaceId,
    type: input.type || 'control health degraded',
    severity: input.severity || 'medium',
    source: input.source || 'Continuous Assurance',
    linkedControlId: input.linkedControlId || null,
    linkedFramework: input.linkedFramework || null,
    linkedRiskId: input.linkedRiskId || null,
    owner: input.owner || actorName,
    dueDate: input.dueDate || nowIso(14),
    status: input.status || 'open',
    remediationAction: input.remediationAction || 'Investigate and document corrective action.',
    evidence: input.evidence || null,
  };
  state.exceptions.unshift(exception);
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'assurance exception created', 'exception', exception.id, exception.type, 'Assurance exception created.');
  return exception;
}

export async function updateAssuranceException(workspaceId: string, role: string | null | undefined, exceptionId: string, patch: Partial<AssuranceException>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'resolve_exceptions');
  const state = getState(workspaceId);
  const exception = state.exceptions.find((item) => item.id === exceptionId);
  if (!exception) throw new Error('Assurance exception not found.');
  Object.assign(exception, patch);
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'assurance exception updated', 'exception', exception.id, exception.type, 'Assurance exception updated.');
  return exception;
}

export async function getContinuousAssuranceAnalytics(workspaceId: string) {
  return cloneState(workspaceId).analytics;
}

export async function listContinuousAssuranceReports(workspaceId: string) {
  return cloneState(workspaceId).reports;
}

export async function generateContinuousAssuranceReport(workspaceId: string, role: string | null | undefined, title: string, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'generate_assurance_reports');
  const state = getState(workspaceId);
  const report: AssuranceReport = {
    id: makeId('rpt'),
    workspaceId,
    title,
    type: title,
    generatedAt: new Date().toISOString(),
    generatedBy: actorName,
    formatSupport: ['pdf', 'excel', 'csv'],
    summary: `${title} generated from current continuous assurance posture.`,
  };
  state.reports.unshift(report);
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'assurance report generated', 'report', report.id, report.title, report.summary);
  return report;
}

export async function getContinuousAssuranceSettings(workspaceId: string) {
  return cloneState(workspaceId).settings;
}

export async function updateContinuousAssuranceSettings(workspaceId: string, role: string | null | undefined, patch: Partial<AssuranceSetting>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'manage_control_monitors');
  const state = getState(workspaceId);
  state.settings = { ...state.settings, ...patch };
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'assurance settings updated', 'settings', 'ccm-settings', 'Continuous Assurance Settings', 'Continuous assurance settings updated.');
  return state.settings;
}

export async function listRemediationTasks(workspaceId: string) {
  return cloneState(workspaceId).remediationTasks.sort((left, right) => getDateValue(left.dueDate) - getDateValue(right.dueDate));
}

export async function createRemediationTask(workspaceId: string, role: string | null | undefined, input: Omit<RemediationTask, 'id' | 'workspaceId' | 'createdAt'>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'resolve_exceptions');
  const state = getState(workspaceId);
  const task: RemediationTask = {
    ...input,
    id: makeId('task'),
    workspaceId,
    createdAt: new Date().toISOString(),
  };
  state.remediationTasks.unshift(task);
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'remediation task created', 'task', task.id, task.title, task.description);
  return task;
}

export async function updateRemediationTask(workspaceId: string, role: string | null | undefined, taskId: string, patch: Partial<RemediationTask>, actorName = 'Workspace Operator') {
  assertCcmPermission(role, 'resolve_exceptions');
  const state = getState(workspaceId);
  const task = state.remediationTasks.find((item) => item.id === taskId);
  if (!task) throw new Error('Remediation task not found.');
  Object.assign(task, patch);
  refreshDerivedState(workspaceId, state);
  await logCcmActivity(workspaceId, actorName, role || 'viewer', 'remediation task updated', 'task', task.id, task.title, 'Remediation task updated.');
  return task;
}

export async function listAssuranceNotifications(workspaceId: string) {
  return cloneState(workspaceId).notifications;
}

export async function updateAssuranceNotification(workspaceId: string, role: string | null | undefined, notificationId: string, patch: Partial<AssuranceNotification>) {
  assertCcmPermission(role, 'view_continuous_assurance');
  const state = getState(workspaceId);
  const notification = state.notifications.find((item) => item.id === notificationId);
  if (!notification) throw new Error('Notification not found.');
  Object.assign(notification, patch);
  refreshDerivedState(workspaceId, state);
  return notification;
}

export async function updateNotificationPreference(workspaceId: string, role: string | null | undefined, channel: NotificationPreference['channel'], type: NotificationPreference['type'], enabled: boolean) {
  assertCcmPermission(role, 'manage_control_monitors');
  const state = getState(workspaceId);
  state.notificationPreferences = state.notificationPreferences.map((item) =>
    item.channel === channel && item.type === type ? { ...item, enabled } : item,
  );
  refreshDerivedState(workspaceId, state);
  return state.notificationPreferences;
}
