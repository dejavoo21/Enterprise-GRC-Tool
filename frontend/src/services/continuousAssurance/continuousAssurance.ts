import { appendLocalActivity } from '../../lib/localActivityLedger';
import type { WorkspaceRole } from '../../types/auth';
import type { ControlWithFrameworks } from '../../types/control';
import type { EvidenceItem } from '../../types/evidence';
import type { Risk } from '../../types/risk';
import { continuousAssurancePermissionMap } from '../../types/continuousAssurance';
import type {
  AssuranceDriver,
  AssuranceException,
  AssuranceReport,
  AssuranceSetting,
  AssuranceStatus,
  AssuranceTrend,
  AutomatedTest,
  CcmPermission,
  ComplianceDrift,
  Connector,
  ConnectorStatus,
  ConnectorSyncLog,
  ContinuousAssuranceAnalytics,
  ContinuousAssuranceOverview,
  ContinuousAssuranceState,
  ControlMonitor,
  EvidenceCollectionJob,
  TestResultStatus,
  TestRun,
  TrendPoint,
} from '../../types/continuousAssurance';

const STORAGE_KEY = 'grc.continuous-assurance';

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function sortTrend(points: TrendPoint[]) {
  return [...points].sort((left, right) => left.label.localeCompare(right.label));
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

function seedState(workspaceId: string): ContinuousAssuranceState {
  const monitors: ControlMonitor[] = [
    {
      id: makeId('mon'),
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
      id: makeId('mon'),
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
      id: makeId('mon'),
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
    {
      id: makeId('mon'),
      workspaceId,
      name: 'Access Review Freshness Monitor',
      controlId: 'CTRL-GOV-07',
      controlName: 'Access reviews are current',
      framework: 'ISO 27701',
      controlObjective: 'Confirm scheduled access reviews completed on time.',
      testType: 'access_review',
      frequency: 'Monthly',
      owner: 'Security Governance',
      status: 'active',
      lastRun: nowIso(-7),
      nextRun: nowIso(21),
      result: 'passed',
      evidenceOutput: 'Quarterly access review completion pack',
      evidenceRequirementId: 'EVREQ-090',
      evidenceJobId: 'job-access',
      exceptionCount: 0,
    },
    {
      id: makeId('mon'),
      workspaceId,
      name: 'Vendor Assessment Freshness Monitor',
      controlId: 'CTRL-VEND-03',
      controlName: 'Vendor assessments stay current',
      framework: 'PCI DSS',
      controlObjective: 'Track due vendor assurance evidence.',
      testType: 'vendor_assessment',
      frequency: 'Monthly',
      owner: 'Vendor Risk',
      status: 'warning',
      lastRun: nowIso(-10),
      nextRun: nowIso(20),
      result: 'warning',
      evidenceOutput: 'Vendor assessment aging report',
      evidenceRequirementId: 'EVREQ-141',
      evidenceJobId: 'job-vendor',
      exceptionCount: 1,
    },
  ];

  const tests: AutomatedTest[] = monitors.map((monitor, index) => ({
    id: makeId('test'),
    workspaceId,
    monitorId: monitor.id,
    name: `${monitor.name} Test`,
    description: monitor.controlObjective,
    schedule: monitor.frequency,
    enabled: true,
    owner: monitor.owner,
    lastRun: monitor.lastRun,
    lastResult: monitor.result,
    manualOverride: index === 1 ? { enabled: false } : undefined,
  }));

  const testRuns: TestRun[] = tests.flatMap((test) => [
    {
      id: makeId('run'),
      workspaceId,
      automatedTestId: test.id,
      monitorId: test.monitorId,
      startedAt: nowIso(-6),
      completedAt: nowIso(-6),
      status: 'passed',
      summary: 'Monitor completed successfully',
      details: 'The configured control state matched the expected policy baseline.',
      evidenceGenerated: ['EVID-AUTO-001'],
    },
    {
      id: makeId('run'),
      workspaceId,
      automatedTestId: test.id,
      monitorId: test.monitorId,
      startedAt: test.lastRun ?? nowIso(-1),
      completedAt: test.lastRun ?? nowIso(-1),
      status: test.lastResult,
      summary: test.lastResult === 'failed' ? 'Control failed assurance validation' : test.lastResult === 'warning' ? 'Control requires review' : 'Control passed',
      details: `Latest run for ${test.name} finished with status ${test.lastResult}.`,
      evidenceGenerated: test.lastResult === 'passed' ? ['EVID-AUTO-002'] : [],
    },
  ]);

  const evidenceJobs: EvidenceCollectionJob[] = [
    {
      id: 'job-mfa',
      workspaceId,
      name: 'MFA posture collection',
      source: 'api_connector',
      linkedControls: ['CTRL-ACCESS-01'],
      linkedMonitorId: monitors[0].id,
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
      linkedMonitorId: monitors[2].id,
      collectionFrequency: 'Daily',
      status: 'failed',
      lastCollectedAt: nowIso(-2),
      nextCollectionAt: nowIso(1),
      evidencePreview: 'Latest backup task output',
      approvalStatus: 'pending',
      freshnessStatus: 'warning',
    },
    {
      id: 'job-evidence',
      workspaceId,
      name: 'Evidence freshness sweep',
      source: 'system_generated',
      linkedControls: ['CTRL-EVID-04'],
      linkedMonitorId: monitors[1].id,
      collectionFrequency: 'Weekly',
      status: 'collecting',
      lastCollectedAt: nowIso(-3),
      nextCollectionAt: nowIso(4),
      evidencePreview: 'Stale and expiring evidence inventory',
      approvalStatus: 'pending',
      freshnessStatus: 'expired',
    },
  ];

  const connectors: Connector[] = [
    { id: makeId('con'), workspaceId, name: 'Microsoft Entra ID', type: 'Microsoft Entra ID', owner: 'Identity Security', connectionStatus: 'connected', healthStatus: 'healthy', lastSync: nowIso(-1), syncFrequency: 'Daily', linkedJobIds: ['job-mfa'], lastTestedAt: nowIso(-1) },
    { id: makeId('con'), workspaceId, name: 'AWS', type: 'AWS', owner: 'Cloud Security', connectionStatus: 'degraded', healthStatus: 'warning', lastSync: nowIso(-2), syncFrequency: 'Daily', linkedJobIds: ['job-backup'], lastTestedAt: nowIso(-3) },
    { id: makeId('con'), workspaceId, name: 'GitHub', type: 'GitHub', owner: 'Platform Engineering', connectionStatus: 'connected', healthStatus: 'healthy', lastSync: nowIso(-1), syncFrequency: 'Daily', linkedJobIds: ['job-evidence'], lastTestedAt: nowIso(-2) },
    { id: makeId('con'), workspaceId, name: 'ServiceNow', type: 'ServiceNow', owner: 'Assurance Operations', connectionStatus: 'error', healthStatus: 'critical', lastSync: nowIso(-5), syncFrequency: 'Weekly', linkedJobIds: [], lastTestedAt: nowIso(-5) },
  ];

  const connectorSyncLogs: ConnectorSyncLog[] = connectors.map((connector) => ({
    id: makeId('sync'),
    connectorId: connector.id,
    timestamp: connector.lastSync ?? nowIso(-1),
    status: connector.connectionStatus === 'error' ? 'failed' : 'success',
    summary: connector.connectionStatus === 'error' ? 'Authentication or transport failure detected.' : 'Sync completed successfully.',
  }));

  const drift: ComplianceDrift[] = [
    { id: makeId('drift'), workspaceId, driftType: 'Connector stopped syncing', affectedObject: 'AWS backup evidence feed', severity: 'high', detectedDate: nowIso(-2), owner: 'Cloud Security', recommendedAction: 'Restore connector credentials and re-run collection job.', status: 'open', linkedControlId: 'CTRL-OPS-09', linkedFramework: 'NIST CSF' },
    { id: makeId('drift'), workspaceId, driftType: 'Evidence expired', affectedObject: 'Quarterly policy attestation evidence', severity: 'medium', detectedDate: nowIso(-4), owner: 'Assurance Office', recommendedAction: 'Trigger evidence recollection and approval workflow.', status: 'acknowledged', linkedControlId: 'CTRL-EVID-04', linkedFramework: 'SOC 2' },
    { id: makeId('drift'), workspaceId, driftType: 'Risk moved outside appetite', affectedObject: 'Privileged access review overdue', severity: 'critical', detectedDate: nowIso(-1), owner: 'Security Governance', recommendedAction: 'Escalate to risk owner and complete review.', status: 'open', linkedControlId: 'CTRL-GOV-07', linkedFramework: 'ISO 27701' },
  ];

  const exceptions: AssuranceException[] = [
    { id: makeId('exc'), workspaceId, type: 'failed control test', severity: 'high', source: 'Backup Success Monitor', linkedControlId: 'CTRL-OPS-09', linkedFramework: 'NIST CSF', linkedRiskId: 'RISK-OPS-14', owner: 'Infrastructure Operations', dueDate: nowIso(5), status: 'open', remediationAction: 'Investigate failed backup and attach recovery validation.', evidence: 'EVID-AUTO-091' },
    { id: makeId('exc'), workspaceId, type: 'missing evidence', severity: 'medium', source: 'Evidence Freshness Monitor', linkedControlId: 'CTRL-EVID-04', linkedFramework: 'SOC 2', linkedRiskId: 'RISK-COMP-02', owner: 'Assurance Office', dueDate: nowIso(10), status: 'in_progress', remediationAction: 'Collect refreshed evidence from control owner.', evidence: null },
    { id: makeId('exc'), workspaceId, type: 'vendor assessment overdue', severity: 'medium', source: 'Vendor Assessment Freshness Monitor', linkedControlId: 'CTRL-VEND-03', linkedFramework: 'PCI DSS', linkedRiskId: 'RISK-VEND-04', owner: 'Vendor Risk', dueDate: nowIso(12), status: 'open', remediationAction: 'Complete renewal assessment and upload supporting artifact.', evidence: null },
  ];

  const reports: AssuranceReport[] = [
    { id: makeId('rpt'), workspaceId, title: 'Continuous Assurance Report', type: 'Continuous Assurance Report', generatedAt: nowIso(-6), generatedBy: 'Risk Office', formatSupport: ['pdf', 'excel', 'csv'], summary: 'Monthly assurance score, drift, and exceptions summary.' },
    { id: makeId('rpt'), workspaceId, title: 'Connector Health Report', type: 'Connector Health Report', generatedAt: nowIso(-3), generatedBy: 'Assurance Operations', formatSupport: ['pdf', 'excel', 'csv'], summary: 'Connector reliability, failures, and sync cadence.' },
  ];

  const analytics = buildAnalytics(monitors, evidenceJobs, exceptions);
  const overview = calculateOverview(monitors, tests, evidenceJobs, connectors, drift, exceptions, analytics);

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
    reports,
    settings: initialSettings(),
    analytics,
  };
}

function buildAnalytics(
  monitors: ControlMonitor[],
  evidenceJobs: EvidenceCollectionJob[],
  exceptions: AssuranceException[],
): ContinuousAssuranceAnalytics {
  const frameworkMap = new Map<string, number>();
  monitors.forEach((monitor) => frameworkMap.set(monitor.framework, (frameworkMap.get(monitor.framework) ?? 0) + 1));

  const statusCounts = new Map<string, { passed: number; failed: number }>();
  monitors.forEach((monitor) => {
    const bucket = statusCounts.get(monitor.framework) ?? { passed: 0, failed: 0 };
    if (monitor.result === 'passed') bucket.passed += 1;
    if (monitor.result === 'failed') bucket.failed += 1;
    statusCounts.set(monitor.framework, bucket);
  });

  return {
    controlsByFramework: Array.from(frameworkMap.entries()).map(([framework, count]) => ({ framework, count })),
    passFailByDomain: Array.from(statusCounts.entries()).map(([domain, counts]) => ({ domain, passed: counts.passed, failed: counts.failed })),
    exceptionsBySeverity: ['low', 'medium', 'high', 'critical'].map((severity) => ({
      severity: severity as AssuranceException['severity'],
      count: exceptions.filter((item) => item.severity === severity).length,
    })),
    evidenceFreshnessTrend: sortTrend([
      { label: 'Jan', value: 72 },
      { label: 'Feb', value: 76 },
      { label: 'Mar', value: 79 },
      { label: 'Apr', value: 82 },
      { label: 'May', value: 78 },
      { label: 'Jun', value: 84 },
    ]),
    connectorReliabilityTrend: sortTrend([
      { label: 'Jan', value: 88 },
      { label: 'Feb', value: 86 },
      { label: 'Mar', value: 92 },
      { label: 'Apr', value: 90 },
      { label: 'May', value: 85 },
      { label: 'Jun', value: 87 },
    ]),
    assuranceScoreByMonth: sortTrend([
      { label: 'Jan', value: 68 },
      { label: 'Feb', value: 71 },
      { label: 'Mar', value: 74 },
      { label: 'Apr', value: 76 },
      { label: 'May', value: 72 },
      { label: 'Jun', value: 78 },
    ]),
    controlFailureRecurrence: monitors.map((monitor) => ({ control: monitor.controlName, count: monitor.exceptionCount })),
    topFailingControls: monitors.filter((monitor) => monitor.result === 'failed' || monitor.result === 'warning').map((monitor) => ({ control: monitor.controlName, count: monitor.exceptionCount || 1 })),
    topOverdueEvidence: evidenceJobs.filter((job) => job.freshnessStatus === 'expired').map((job) => ({ job: job.name, daysOverdue: 7 })),
    coverageByBusinessUnit: [
      { unit: 'Security', coverage: 84 },
      { unit: 'IT Operations', coverage: 72 },
      { unit: 'Assurance', coverage: 79 },
      { unit: 'Vendor Risk', coverage: 68 },
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
  analytics: ContinuousAssuranceAnalytics,
): ContinuousAssuranceOverview {
  const controlsMonitored = monitors.length;
  const controlsPassing = monitors.filter((monitor) => monitor.result === 'passed').length;
  const controlsFailing = monitors.filter((monitor) => monitor.result === 'failed').length;
  const controlsDegraded = monitors.filter((monitor) => monitor.result === 'warning' || monitor.status === 'warning').length;
  const evidenceCollectedAutomatically = evidenceJobs.filter((job) => job.source !== 'manual_upload').length;
  const evidenceMissing = evidenceJobs.filter((job) => job.freshnessStatus === 'expired' || job.approvalStatus === 'rejected').length;
  const complianceDriftAlerts = drift.filter((item) => item.status !== 'resolved').length;
  const openExceptions = exceptions.filter((item) => item.status !== 'resolved').length;
  const failedTests = tests.filter((test) => test.lastResult === 'failed').length;
  const connectorHealthy = connectors.filter((connector) => connector.healthStatus === 'healthy').length;
  const connectorHealth = connectors.length ? Math.round((connectorHealthy / connectors.length) * 100) : 0;
  const upcomingControlReviews = monitors.filter((monitor) => {
    const nextRun = parseDate(monitor.nextRun);
    return nextRun !== null && nextRun <= Date.now() + 14 * 24 * 60 * 60 * 1000;
  }).length;

  const drivers: AssuranceDriver[] = [
    { label: 'Monitored coverage', value: controlsMonitored ? Math.round((controlsMonitored / Math.max(controlsMonitored, 10)) * 100) : 0, weight: 0.2, contribution: 0 },
    { label: 'Passing tests', value: controlsMonitored ? Math.round((controlsPassing / controlsMonitored) * 100) : 0, weight: 0.25, contribution: 0 },
    { label: 'Evidence freshness', value: evidenceJobs.length ? Math.round((evidenceJobs.filter((job) => job.freshnessStatus === 'fresh').length / evidenceJobs.length) * 100) : 0, weight: 0.15, contribution: 0 },
    { label: 'Connector health', value: connectorHealth, weight: 0.15, contribution: 0 },
    { label: 'Open exceptions', value: Math.max(0, 100 - openExceptions * 12), weight: 0.15, contribution: 0 },
    { label: 'Compliance drift', value: Math.max(0, 100 - complianceDriftAlerts * 15), weight: 0.1, contribution: 0 },
  ].map((driver) => ({ ...driver, contribution: Math.round(driver.value * driver.weight) }));

  const score = Math.max(0, Math.min(100, drivers.reduce((sum, driver) => sum + driver.contribution, 0)));
  const status: AssuranceStatus = score >= 85 ? 'strong' : score >= 70 ? 'stable' : score >= 55 ? 'degraded' : 'critical';
  const trend: AssuranceTrend = analytics.assuranceScoreByMonth.length >= 2 && analytics.assuranceScoreByMonth[analytics.assuranceScoreByMonth.length - 1].value > analytics.assuranceScoreByMonth[0].value ? 'improving' : analytics.assuranceScoreByMonth.length >= 2 && analytics.assuranceScoreByMonth[analytics.assuranceScoreByMonth.length - 1].value < analytics.assuranceScoreByMonth[0].value ? 'declining' : 'stable';

  return {
    score,
    status,
    trend,
    topDrivers: drivers.sort((left, right) => right.contribution - left.contribution).slice(0, 4),
    controlsMonitored,
    controlsPassing,
    controlsFailing,
    controlsDegraded,
    evidenceCollectedAutomatically,
    evidenceMissing,
    complianceDriftAlerts,
    connectorHealth,
    openExceptions,
    failedTests,
    upcomingControlReviews,
    controlHealthTrend: analytics.assuranceScoreByMonth,
    testPassFailTrend: analytics.assuranceScoreByMonth.map((point, index) => ({ label: point.label, value: index % 2 === 0 ? point.value - 5 : point.value - 12 })),
    evidenceCollectionTrend: analytics.evidenceFreshnessTrend,
    complianceDriftTrend: [
      { label: 'Jan', value: 2 },
      { label: 'Feb', value: 3 },
      { label: 'Mar', value: 2 },
      { label: 'Apr', value: 4 },
      { label: 'May', value: 3 },
      { label: 'Jun', value: complianceDriftAlerts },
    ],
    frameworkAssuranceCoverage: analytics.controlsByFramework.map((item) => ({ framework: item.framework, coverage: Math.min(100, 45 + item.count * 11) })),
    connectorStatusDistribution: ['connected', 'degraded', 'disconnected', 'error'].map((status) => ({
      status: status as ConnectorStatus,
      count: connectors.filter((connector) => connector.connectionStatus === status).length,
    })),
    exceptionSeverityDistribution: analytics.exceptionsBySeverity,
    notifications: [
      ...(failedTests > 0 ? [{ id: makeId('notif'), title: 'Failed test queue requires attention', detail: `${failedTests} automated control tests failed in the latest cycle.`, severity: 'high' as const }] : []),
      ...(complianceDriftAlerts > 0 ? [{ id: makeId('notif'), title: 'Compliance drift detected', detail: `${complianceDriftAlerts} drift alerts are currently open or acknowledged.`, severity: 'medium' as const }] : []),
      ...(evidenceMissing > 0 ? [{ id: makeId('notif'), title: 'Evidence collection gap', detail: `${evidenceMissing} evidence jobs are stale, rejected, or expired.`, severity: 'medium' as const }] : []),
    ],
  };
}

function readStore(): Record<string, ContinuousAssuranceState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ContinuousAssuranceState>) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, ContinuousAssuranceState>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function refreshState(state: ContinuousAssuranceState): ContinuousAssuranceState {
  const analytics = buildAnalytics(state.monitors, state.evidenceJobs, state.exceptions);
  return {
    ...state,
    analytics,
    overview: calculateOverview(state.monitors, state.tests, state.evidenceJobs, state.connectors, state.drift, state.exceptions, analytics),
  };
}

function getState(workspaceId: string) {
  const store = readStore();
  if (!store[workspaceId]) {
    store[workspaceId] = seedState(workspaceId);
    writeStore(store);
  }
  return refreshState(store[workspaceId]);
}

function setState(workspaceId: string, nextState: ContinuousAssuranceState) {
  const store = readStore();
  store[workspaceId] = refreshState(nextState);
  writeStore(store);
  return store[workspaceId];
}

function recordLedgerEvent(workspaceId: string, action: string, targetType: string, targetId: string, targetName: string, notes: string, outcome: 'success' | 'failed' | 'blocked' | 'pending', category: 'control' | 'evidence' | 'audit' | 'risk' | 'vendor' | 'framework' | 'system' | 'report' | 'auth') {
  appendLocalActivity({
    id: makeId('ledger'),
    workspaceId,
    actorName: 'Workspace Operator',
    actorRole: 'grc',
    action,
    category,
    targetType,
    targetId,
    targetName,
    outcome,
    severity: outcome === 'failed' || outcome === 'blocked' ? 'high' : 'info',
    source: 'frontend',
    timestamp: new Date().toISOString(),
    notes,
  });
}

export function canPerformContinuousAssuranceAction(role: WorkspaceRole | null, permission: CcmPermission) {
  if (!role) return false;
  return continuousAssurancePermissionMap[permission].includes(role);
}

export function enforceContinuousAssurancePermission(workspaceId: string, role: WorkspaceRole | null, permission: CcmPermission) {
  const allowed = canPerformContinuousAssuranceAction(role, permission);
  if (!allowed) {
    recordLedgerEvent(workspaceId, 'Continuous Assurance permission denied', 'rbac', permission, permission, `Denied action for role ${role ?? 'unknown'}.`, 'blocked', 'auth');
    throw new Error('You do not have permission to perform this Continuous Assurance action.');
  }
}

export async function getContinuousAssuranceState(workspaceId: string) {
  return getState(workspaceId);
}

export async function getContinuousAssuranceOverview(workspaceId: string) {
  return getState(workspaceId).overview;
}

export async function listControlMonitors(workspaceId: string) {
  return getState(workspaceId).monitors;
}

export async function createControlMonitor(workspaceId: string, role: WorkspaceRole | null, input: Partial<ControlMonitor>) {
  enforceContinuousAssurancePermission(workspaceId, role, 'manage_control_monitors');
  const state = getState(workspaceId);
  const monitor: ControlMonitor = {
    id: makeId('mon'),
    workspaceId,
    name: input.name || 'New Control Monitor',
    controlId: input.controlId || 'CTRL-NEW',
    controlName: input.controlName || 'New control',
    framework: input.framework || 'ISO 27001',
    controlObjective: input.controlObjective || 'Control objective pending configuration.',
    testType: input.testType || 'logging_enabled',
    frequency: input.frequency || state.settings.defaultTestFrequency,
    owner: input.owner || 'Assurance Owner',
    status: 'active',
    lastRun: null,
    nextRun: nowIso(7),
    result: 'not_run',
    evidenceOutput: input.evidenceOutput || 'Pending evidence output',
    evidenceRequirementId: input.evidenceRequirementId || null,
    evidenceJobId: input.evidenceJobId || null,
    exceptionCount: 0,
  };
  state.monitors = [monitor, ...state.monitors];
  state.tests = [{
    id: makeId('test'),
    workspaceId,
    monitorId: monitor.id,
    name: `${monitor.name} Test`,
    description: monitor.controlObjective,
    schedule: monitor.frequency,
    enabled: true,
    owner: monitor.owner,
    lastRun: null,
    lastResult: 'not_run',
  }, ...state.tests];
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Monitor Created', 'monitor', monitor.id, monitor.name, `Linked to ${monitor.controlName}.`, 'success', 'control');
  return monitor;
}

export async function updateControlMonitor(workspaceId: string, role: WorkspaceRole | null, monitorId: string, patch: Partial<ControlMonitor>) {
  enforceContinuousAssurancePermission(workspaceId, role, 'manage_control_monitors');
  const state = getState(workspaceId);
  state.monitors = state.monitors.map((monitor) => monitor.id === monitorId ? { ...monitor, ...patch } : monitor);
  const updated = state.monitors.find((monitor) => monitor.id === monitorId);
  if (!updated) throw new Error('Monitor not found.');
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Monitor Updated', 'monitor', updated.id, updated.name, `Status ${updated.status} and result ${updated.result}.`, 'success', 'control');
  return updated;
}

export async function deleteControlMonitor(workspaceId: string, role: WorkspaceRole | null, monitorId: string) {
  enforceContinuousAssurancePermission(workspaceId, role, 'manage_control_monitors');
  const state = getState(workspaceId);
  const target = state.monitors.find((monitor) => monitor.id === monitorId);
  state.monitors = state.monitors.filter((monitor) => monitor.id !== monitorId);
  state.tests = state.tests.filter((test) => test.monitorId !== monitorId);
  setState(workspaceId, state);
  if (target) {
    recordLedgerEvent(workspaceId, 'Monitor Deleted', 'monitor', target.id, target.name, 'Control monitor removed from the workspace.', 'success', 'control');
  }
}

export async function listAutomatedTests(workspaceId: string) {
  return getState(workspaceId).tests;
}

export async function createAutomatedTest(workspaceId: string, role: WorkspaceRole | null, input: Partial<AutomatedTest>) {
  enforceContinuousAssurancePermission(workspaceId, role, 'run_automated_tests');
  const state = getState(workspaceId);
  const test: AutomatedTest = {
    id: makeId('test'),
    workspaceId,
    monitorId: input.monitorId || state.monitors[0]?.id || 'unlinked',
    name: input.name || 'New Automated Test',
    description: input.description || 'Define the rule and evidence criteria for this control test.',
    schedule: input.schedule || state.settings.defaultTestFrequency,
    enabled: true,
    owner: input.owner || 'Assurance Owner',
    lastRun: null,
    lastResult: 'not_run',
    manualOverride: input.manualOverride,
  };
  state.tests = [test, ...state.tests];
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Automated Test Created', 'test', test.id, test.name, 'Continuous control test added.', 'success', 'control');
  return test;
}

export async function runAutomatedTest(workspaceId: string, role: WorkspaceRole | null, testId: string, options?: { forceStatus?: TestResultStatus; justification?: string }) {
  enforceContinuousAssurancePermission(workspaceId, role, 'run_automated_tests');
  const state = getState(workspaceId);
  const test = state.tests.find((item) => item.id === testId);
  if (!test) throw new Error('Automated test not found.');

  const status = options?.forceStatus || (test.lastResult === 'failed' ? 'passed' : test.lastResult === 'warning' ? 'failed' : test.lastResult === 'passed' ? 'warning' : 'passed');
  const now = new Date().toISOString();
  const run: TestRun = {
    id: makeId('run'),
    workspaceId,
    automatedTestId: test.id,
    monitorId: test.monitorId,
    startedAt: now,
    completedAt: now,
    status,
    summary: status === 'passed' ? 'Automated assurance rule passed.' : status === 'failed' ? 'Automated assurance rule failed.' : status === 'warning' ? 'Automated assurance rule returned a warning state.' : 'Automated assurance rule was not run.',
    details: options?.justification || `Run executed for ${test.name}.`,
    evidenceGenerated: status === 'passed' ? [`EVID-AUTO-${Math.floor(Math.random() * 900 + 100)}`] : [],
  };

  test.lastRun = now;
  test.lastResult = status;

  const monitor = state.monitors.find((item) => item.id === test.monitorId);
  if (monitor) {
    monitor.lastRun = now;
    monitor.result = status;
    monitor.status = status === 'failed' ? 'failed' : status === 'warning' ? 'warning' : 'active';
    monitor.exceptionCount = status === 'failed' ? monitor.exceptionCount + 1 : monitor.exceptionCount;
  }

  if (status === 'failed') {
    state.exceptions = [{
      id: makeId('exc'),
      workspaceId,
      type: 'failed control test',
      severity: 'high',
      source: test.name,
      linkedControlId: monitor?.controlId || null,
      linkedFramework: monitor?.framework || null,
      linkedRiskId: null,
      owner: test.owner,
      dueDate: nowIso(state.settings.exceptionSlaDays),
      status: 'open',
      remediationAction: 'Investigate failure and re-run control validation.',
      evidence: null,
    }, ...state.exceptions];
  }

  state.testRuns = [run, ...state.testRuns];
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, status === 'failed' ? 'Test Failed' : status === 'passed' ? 'Test Passed' : 'Test Run', 'test-run', run.id, test.name, run.summary, status === 'failed' ? 'failed' : 'success', 'control');
  return run;
}

export async function getTestResults(workspaceId: string, testId: string) {
  return getState(workspaceId).testRuns.filter((run) => run.automatedTestId === testId);
}

export async function listEvidenceCollectionJobs(workspaceId: string) {
  return getState(workspaceId).evidenceJobs;
}

export async function createEvidenceCollectionJob(workspaceId: string, role: WorkspaceRole | null, input: Partial<EvidenceCollectionJob>) {
  enforceContinuousAssurancePermission(workspaceId, role, 'manage_evidence_jobs');
  const state = getState(workspaceId);
  const job: EvidenceCollectionJob = {
    id: makeId('job'),
    workspaceId,
    name: input.name || 'New Evidence Job',
    source: input.source || 'scheduled_job',
    linkedControls: input.linkedControls || [],
    linkedMonitorId: input.linkedMonitorId || null,
    collectionFrequency: input.collectionFrequency || state.settings.defaultTestFrequency,
    status: 'ready',
    lastCollectedAt: null,
    nextCollectionAt: nowIso(7),
    evidencePreview: input.evidencePreview || 'Pending evidence output preview.',
    approvalStatus: 'pending',
    freshnessStatus: 'warning',
  };
  state.evidenceJobs = [job, ...state.evidenceJobs];
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Evidence Job Created', 'evidence-job', job.id, job.name, `Source ${job.source}.`, 'success', 'evidence');
  return job;
}

export async function runEvidenceCollectionJob(workspaceId: string, role: WorkspaceRole | null, jobId: string) {
  enforceContinuousAssurancePermission(workspaceId, role, 'manage_evidence_jobs');
  const state = getState(workspaceId);
  const job = state.evidenceJobs.find((item) => item.id === jobId);
  if (!job) throw new Error('Evidence job not found.');
  const now = new Date().toISOString();
  job.status = job.status === 'failed' ? 'collecting' : 'ready';
  job.lastCollectedAt = now;
  job.nextCollectionAt = nowIso(7);
  job.approvalStatus = 'approved';
  job.freshnessStatus = 'fresh';
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Evidence Collected', 'evidence-job', job.id, job.name, 'Automated evidence collection completed.', 'success', 'evidence');
  return job;
}

export async function listConnectors(workspaceId: string) {
  return getState(workspaceId).connectors;
}

export async function createConnector(workspaceId: string, role: WorkspaceRole | null, input: Partial<Connector>) {
  enforceContinuousAssurancePermission(workspaceId, role, 'manage_connectors');
  const state = getState(workspaceId);
  const connector: Connector = {
    id: makeId('con'),
    workspaceId,
    name: input.name || 'New Connector',
    type: input.type || 'Custom API',
    owner: input.owner || 'Assurance Owner',
    connectionStatus: 'connected',
    healthStatus: 'healthy',
    lastSync: null,
    syncFrequency: input.syncFrequency || state.settings.connectorSyncFrequency,
    linkedJobIds: input.linkedJobIds || [],
    lastTestedAt: null,
  };
  state.connectors = [connector, ...state.connectors];
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Connector Created', 'connector', connector.id, connector.name, `Connector type ${connector.type}.`, 'success', 'system');
  return connector;
}

export async function testConnector(workspaceId: string, role: WorkspaceRole | null, connectorId: string) {
  enforceContinuousAssurancePermission(workspaceId, role, 'manage_connectors');
  const state = getState(workspaceId);
  const connector = state.connectors.find((item) => item.id === connectorId);
  if (!connector) throw new Error('Connector not found.');
  connector.lastTestedAt = new Date().toISOString();
  connector.healthStatus = connector.healthStatus === 'critical' ? 'warning' : 'healthy';
  connector.connectionStatus = connector.connectionStatus === 'error' ? 'degraded' : 'connected';
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Connector Tested', 'connector', connector.id, connector.name, `Connector health is ${connector.healthStatus}.`, 'success', 'system');
  return connector;
}

export async function syncConnector(workspaceId: string, role: WorkspaceRole | null, connectorId: string) {
  enforceContinuousAssurancePermission(workspaceId, role, 'manage_connectors');
  const state = getState(workspaceId);
  const connector = state.connectors.find((item) => item.id === connectorId);
  if (!connector) throw new Error('Connector not found.');
  const now = new Date().toISOString();
  const hadError = connector.connectionStatus === 'error';
  connector.lastSync = now;
  connector.connectionStatus = hadError ? 'degraded' : 'connected';
  connector.healthStatus = connector.connectionStatus === 'connected' ? 'healthy' : connector.healthStatus;
  state.connectorSyncLogs = [{
    id: makeId('sync'),
    connectorId: connector.id,
    timestamp: now,
    status: hadError ? 'failed' : 'success',
    summary: hadError ? 'Connector sync failed.' : 'Connector sync completed.',
  }, ...state.connectorSyncLogs];
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, hadError ? 'Connector Failed' : 'Connector Synced', 'connector', connector.id, connector.name, 'Connector synchronization executed.', hadError ? 'failed' : 'success', 'system');
  return connector;
}

export async function listComplianceDrift(workspaceId: string) {
  return getState(workspaceId).drift;
}

export async function acknowledgeDrift(workspaceId: string, role: WorkspaceRole | null, driftId: string) {
  enforceContinuousAssurancePermission(workspaceId, role, 'acknowledge_drift');
  const state = getState(workspaceId);
  const drift = state.drift.find((item) => item.id === driftId);
  if (!drift) throw new Error('Drift alert not found.');
  drift.status = 'acknowledged';
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Drift Detected', 'drift', drift.id, drift.affectedObject, `Drift acknowledged by operator.`, 'success', 'framework');
  return drift;
}

export async function resolveDrift(workspaceId: string, role: WorkspaceRole | null, driftId: string) {
  enforceContinuousAssurancePermission(workspaceId, role, 'acknowledge_drift');
  const state = getState(workspaceId);
  const drift = state.drift.find((item) => item.id === driftId);
  if (!drift) throw new Error('Drift alert not found.');
  drift.status = 'resolved';
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Drift Resolved', 'drift', drift.id, drift.affectedObject, `Resolution recorded for drift item.`, 'success', 'framework');
  return drift;
}

export async function listAssuranceExceptions(workspaceId: string) {
  return getState(workspaceId).exceptions;
}

export async function createAssuranceException(workspaceId: string, role: WorkspaceRole | null, input: Partial<AssuranceException>) {
  enforceContinuousAssurancePermission(workspaceId, role, 'resolve_exceptions');
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
    owner: input.owner || 'Assurance Owner',
    dueDate: input.dueDate || nowIso(14),
    status: 'open',
    remediationAction: input.remediationAction || 'Investigate and document corrective action.',
    evidence: input.evidence || null,
  };
  state.exceptions = [exception, ...state.exceptions];
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Exception Created', 'exception', exception.id, exception.type, exception.remediationAction, 'success', 'audit');
  return exception;
}

export async function updateAssuranceException(workspaceId: string, role: WorkspaceRole | null, exceptionId: string, patch: Partial<AssuranceException>) {
  enforceContinuousAssurancePermission(workspaceId, role, 'resolve_exceptions');
  const state = getState(workspaceId);
  state.exceptions = state.exceptions.map((item) => item.id === exceptionId ? { ...item, ...patch } : item);
  const updated = state.exceptions.find((item) => item.id === exceptionId);
  if (!updated) throw new Error('Exception not found.');
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, updated.status === 'resolved' ? 'Exception Resolved' : 'Exception Updated', 'exception', updated.id, updated.type, updated.remediationAction, 'success', 'audit');
  return updated;
}

export async function getContinuousAssuranceAnalytics(workspaceId: string) {
  return getState(workspaceId).analytics;
}

export async function listContinuousAssuranceReports(workspaceId: string) {
  return getState(workspaceId).reports;
}

export async function generateContinuousAssuranceReport(workspaceId: string, role: WorkspaceRole | null, title: string) {
  enforceContinuousAssurancePermission(workspaceId, role, 'generate_assurance_reports');
  const state = getState(workspaceId);
  const report: AssuranceReport = {
    id: makeId('rpt'),
    workspaceId,
    title,
    type: title,
    generatedAt: new Date().toISOString(),
    generatedBy: 'Workspace Operator',
    formatSupport: ['pdf', 'excel', 'csv'],
    summary: `${title} generated from current continuous assurance posture.`,
  };
  state.reports = [report, ...state.reports];
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Report Generated', 'report', report.id, report.title, report.summary, 'success', 'report');
  return report;
}

export async function getContinuousAssuranceSettings(workspaceId: string) {
  return getState(workspaceId).settings;
}

export async function updateContinuousAssuranceSettings(workspaceId: string, role: WorkspaceRole | null, patch: Partial<AssuranceSetting>) {
  enforceContinuousAssurancePermission(workspaceId, role, 'manage_control_monitors');
  const state = getState(workspaceId);
  state.settings = { ...state.settings, ...patch };
  setState(workspaceId, state);
  recordLedgerEvent(workspaceId, 'Continuous Assurance Settings Updated', 'settings', 'ccm-settings', 'Continuous Assurance Settings', 'Settings saved for the active workspace.', 'success', 'system');
  return state.settings;
}

export function getControlAssuranceSummary(workspaceId: string, controlId: string) {
  const state = getState(workspaceId);
  const monitors = state.monitors.filter((monitor) => monitor.controlId === controlId);
  const runs = state.testRuns.filter((run) => monitors.some((monitor) => monitor.id === run.monitorId)).slice(0, 5);
  const exceptions = state.exceptions.filter((item) => item.linkedControlId === controlId);
  const evidenceJobs = state.evidenceJobs.filter((job) => monitors.some((monitor) => monitor.id === job.linkedMonitorId));
  return {
    monitoringStatus: monitors[0]?.status ?? 'disabled',
    lastTestResult: runs[0]?.status ?? 'not_run',
    evidenceAutomationStatus: evidenceJobs[0]?.freshnessStatus ?? 'warning',
    linkedMonitors: monitors,
    recentTestRuns: runs,
    exceptions,
  };
}

export function getEvidenceAutomationSummary(workspaceId: string, evidence: EvidenceItem) {
  const state = getState(workspaceId);
  const monitor = state.monitors.find((item) => item.controlId === evidence.controlId);
  const job = state.evidenceJobs.find((item) => item.linkedMonitorId === monitor?.id);
  return {
    collectionSource: job?.source ?? 'manual_upload',
    collectionJob: job?.name ?? 'Manual collection',
    linkedMonitor: monitor?.name ?? 'No linked monitor',
    lastCollectionDate: job?.lastCollectedAt ?? evidence.collectedAt,
    freshnessStatus: job?.freshnessStatus ?? 'fresh',
    approvalStatus: job?.approvalStatus ?? 'approved',
  };
}

export function getRiskAssuranceImpact(workspaceId: string, risk: Risk) {
  const state = getState(workspaceId);
  const failedLinkedControls = state.monitors.filter((monitor) => risk.controlIds?.includes(monitor.controlId) && monitor.result === 'failed');
  const evidenceGaps = state.evidenceJobs.filter((job) => risk.controlIds?.some((controlId) => job.linkedControls.includes(controlId)) && job.freshnessStatus !== 'fresh');
  const driftAlerts = state.drift.filter((item) => risk.controlIds?.includes(item.linkedControlId ?? ''));
  const unresolvedExceptions = state.exceptions.filter((item) => risk.controlIds?.includes(item.linkedControlId ?? '') && item.status !== 'resolved');
  const assurancePenalty = failedLinkedControls.length * 4 + evidenceGaps.length * 3 + driftAlerts.length * 3 + unresolvedExceptions.length * 4;
  return {
    assuranceImpact: Math.min(25, assurancePenalty),
    failedLinkedControls,
    evidenceGaps,
    driftAlerts,
    unresolvedExceptions,
  };
}

export function getAuditAssuranceReadiness(workspaceId: string) {
  const state = getState(workspaceId);
  return {
    continuouslyMonitoredControls: state.monitors.filter((monitor) => monitor.status !== 'disabled').length,
    failedTests: state.tests.filter((test) => test.lastResult === 'failed').length,
    availableAutomatedEvidence: state.evidenceJobs.filter((job) => job.approvalStatus === 'approved').length,
    auditReadinessExceptions: state.exceptions.filter((item) => item.status !== 'resolved').length,
  };
}

export function getExecutiveContinuousAssuranceWidgets(workspaceId: string) {
  const overview = getState(workspaceId).overview;
  return [
    { label: 'Continuous Assurance Score', value: overview.score, detail: overview.status, tone: overview.status === 'critical' ? 'danger' : overview.status === 'degraded' ? 'warning' : 'success' as const },
    { label: 'Controls Monitored', value: overview.controlsMonitored, detail: `${overview.controlsPassing} passing`, tone: 'primary' as const },
    { label: 'Failed Control Tests', value: overview.failedTests, detail: `${overview.controlsFailing} controls failing`, tone: overview.failedTests > 0 ? 'danger' as const : 'success' as const },
    { label: 'Auto Evidence', value: overview.evidenceCollectedAutomatically, detail: `${overview.evidenceMissing} gaps`, tone: overview.evidenceMissing > 0 ? 'warning' as const : 'success' as const },
    { label: 'Drift Alerts', value: overview.complianceDriftAlerts, detail: `${overview.openExceptions} open exceptions`, tone: overview.complianceDriftAlerts > 0 ? 'warning' as const : 'success' as const },
    { label: 'Connector Health', value: `${overview.connectorHealth}%`, detail: `${overview.connectorStatusDistribution.reduce((sum, item) => sum + item.count, 0)} connectors`, tone: overview.connectorHealth < 70 ? 'danger' as const : overview.connectorHealth < 85 ? 'warning' as const : 'success' as const },
  ];
}

export function mapControlsToSuggestedMonitors(workspaceId: string, controls: ControlWithFrameworks[]) {
  const state = getState(workspaceId);
  const linkedControlIds = new Set(state.monitors.map((monitor) => monitor.controlId));
  return controls
    .filter((control) => !linkedControlIds.has(control.id))
    .slice(0, 3)
    .map((control) => ({
      controlId: control.id,
      controlName: control.title,
      framework: control.primaryFramework || control.frameworks[0] || 'ISO 27001',
      objective: control.description || 'Continuous monitor recommended for control assurance.',
    }));
}
