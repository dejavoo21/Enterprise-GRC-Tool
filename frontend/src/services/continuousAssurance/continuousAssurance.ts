import { appendLocalActivity } from '../../lib/localActivityLedger';
import { apiCall } from '../../lib/api';
import type { ActivityLedgerCategory } from '../../types/activityLedger';
import type { WorkspaceRole } from '../../types/auth';
import type { ControlWithFrameworks } from '../../types/control';
import type { EvidenceItem } from '../../types/evidence';
import type { Risk } from '../../types/risk';
import {
  continuousAssurancePermissionMap,
  type AssuranceException,
  type AssuranceNotification,
  type AssuranceReport,
  type AssuranceSetting,
  type AutomatedTest,
  type CcmPermission,
  type ComplianceDrift,
  type Connector,
  type ConnectorConfigurationRecord,
  type ContinuousAssuranceState,
  type ControlMonitor,
  type EvidenceCollectionJob,
  type NotificationPreference,
  type RemediationTask,
} from '../../types/continuousAssurance';

const cache = new Map<string, ContinuousAssuranceState>();

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

function parseDate(value?: string | null) {
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

function seedState(workspaceId: string): ContinuousAssuranceState {
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
  ];

  const notifications: AssuranceNotification[] = [
    { id: 'notif-failed-test', workspaceId, type: 'failed_test', title: 'Failed control test requires response', detail: 'Backup Success Monitor failed in the latest daily run.', severity: 'high', status: 'unread', routeKey: 'ccm-tests', createdAt: nowIso(-1), assignedTo: 'Infrastructure Operations' },
    { id: 'notif-drift', workspaceId, type: 'drift_alert', title: 'Connector drift alert is open', detail: 'AWS backup evidence feed has stopped syncing and needs remediation.', severity: 'high', status: 'unread', routeKey: 'ccm-drift', createdAt: nowIso(-1), assignedTo: 'Cloud Security' },
  ];

  return {
    overview: {
      score: 78,
      status: 'stable',
      trend: 'improving',
      topDrivers: [],
      controlsMonitored: monitors.length,
      controlsPassing: 1,
      controlsFailing: 1,
      controlsDegraded: 0,
      evidenceCollectedAutomatically: evidenceJobs.length,
      evidenceMissing: 1,
      complianceDriftAlerts: 1,
      connectorHealth: 76,
      openExceptions: 1,
      failedTests: 1,
      upcomingControlReviews: 2,
      controlHealthTrend: sortTrend([{ label: 'Jan', value: 68 }, { label: 'Feb', value: 71 }, { label: 'Mar', value: 74 }, { label: 'Apr', value: 75 }, { label: 'May', value: 77 }, { label: 'Jun', value: 78 }]),
      testPassFailTrend: sortTrend([{ label: 'Jan', value: 80 }, { label: 'Feb', value: 82 }, { label: 'Mar', value: 84 }, { label: 'Apr', value: 79 }, { label: 'May', value: 83 }, { label: 'Jun', value: 85 }]),
      evidenceCollectionTrend: sortTrend([{ label: 'Jan', value: 72 }, { label: 'Feb', value: 74 }, { label: 'Mar', value: 77 }, { label: 'Apr', value: 81 }, { label: 'May', value: 82 }, { label: 'Jun', value: 86 }]),
      complianceDriftTrend: sortTrend([{ label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }, { label: 'Mar', value: 1 }, { label: 'Apr', value: 2 }, { label: 'May', value: 1 }, { label: 'Jun', value: 1 }]),
      frameworkAssuranceCoverage: [{ framework: 'ISO 27001', coverage: 88 }, { framework: 'NIST CSF', coverage: 72 }],
      connectorStatusDistribution: [{ status: 'connected', count: 1 }, { status: 'degraded', count: 1 }, { status: 'disconnected', count: 0 }, { status: 'error', count: 0 }],
      exceptionSeverityDistribution: [{ severity: 'low', count: 0 }, { severity: 'medium', count: 0 }, { severity: 'high', count: 1 }, { severity: 'critical', count: 0 }],
      notifications,
    },
    monitors,
    tests,
    testRuns: tests.map((test) => ({
      id: `run-${test.id}`,
      workspaceId,
      automatedTestId: test.id,
      monitorId: test.monitorId,
      startedAt: test.lastRun || nowIso(-1),
      completedAt: test.lastRun || nowIso(-1),
      status: test.lastResult,
      summary: `Latest run finished with status ${test.lastResult}.`,
      details: `${test.name} completed with status ${test.lastResult}.`,
      evidenceGenerated: test.lastResult === 'passed' ? ['EVID-AUTO-001'] : [],
    })),
    evidenceJobs,
    connectors,
    connectorSyncLogs: connectors.map((connector) => ({
      id: makeId('sync'),
      connectorId: connector.id,
      timestamp: connector.lastSync || nowIso(-1),
      status: connector.connectionStatus === 'error' ? 'failed' : 'success',
      summary: connector.connectionStatus === 'error' ? 'Authentication or transport failure detected.' : 'Sync completed successfully.',
    })),
    drift: [
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
    ],
    exceptions: [
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
    ],
    remediationTasks: [
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
    ],
    notifications,
    notificationPreferences: notificationPreferences(),
    connectorConfigurations: connectors.map((connector) => ({
      connectorId: connector.id,
      workspaceId,
      tenantLabel: `${connector.name} tenant`,
      environment: connector.environment || 'production',
      authMode: connector.authMode || 'custom',
      scopes: ['read'],
      endpoints: ['https://api.example.com'],
      lastConfiguredAt: connector.lastTestedAt,
      lastConfiguredBy: connector.owner,
      testStatus: 'passed',
      notes: 'Configuration is valid for mock-safe testing.',
    })),
    reports: [
      {
        id: 'rpt-assurance',
        workspaceId,
        title: 'Continuous Assurance Report',
        type: 'Continuous Assurance Report',
        generatedAt: nowIso(-6),
        generatedBy: 'Risk Office',
        formatSupport: ['pdf', 'excel', 'csv'],
        summary: 'Monthly assurance score, drift, and exceptions summary.',
      },
    ],
    settings: {
      defaultTestFrequency: 'Weekly',
      evidenceFreshnessPeriodDays: 30,
      driftSeverityThreshold: 'medium',
      exceptionSlaDays: 14,
      notificationRules: ['failed_test', 'drift_detected', 'connector_failure', 'exception_overdue'],
      connectorSyncFrequency: 'Daily',
      autoCreateRemediationTask: true,
      autoLinkEvidence: true,
    },
    analytics: {
      controlsByFramework: [{ framework: 'ISO 27001', count: 1 }, { framework: 'NIST CSF', count: 1 }],
      passFailByDomain: [{ domain: 'ISO 27001', passed: 1, failed: 0 }, { domain: 'NIST CSF', passed: 0, failed: 1 }],
      exceptionsBySeverity: [{ severity: 'low', count: 0 }, { severity: 'medium', count: 0 }, { severity: 'high', count: 1 }, { severity: 'critical', count: 0 }],
      evidenceFreshnessTrend: sortTrend([{ label: 'Jan', value: 72 }, { label: 'Feb', value: 74 }, { label: 'Mar', value: 77 }, { label: 'Apr', value: 81 }, { label: 'May', value: 82 }, { label: 'Jun', value: 86 }]),
      connectorReliabilityTrend: sortTrend([{ label: 'Jan', value: 80 }, { label: 'Feb', value: 83 }, { label: 'Mar', value: 85 }, { label: 'Apr', value: 82 }, { label: 'May', value: 84 }, { label: 'Jun', value: 85 }]),
      assuranceScoreByMonth: sortTrend([{ label: 'Jan', value: 68 }, { label: 'Feb', value: 71 }, { label: 'Mar', value: 74 }, { label: 'Apr', value: 75 }, { label: 'May', value: 77 }, { label: 'Jun', value: 78 }]),
      controlFailureRecurrence: [{ control: 'Backups complete successfully', count: 1 }],
      topFailingControls: [{ control: 'Backups complete successfully', count: 1 }],
      topOverdueEvidence: [{ job: 'Backup confirmation collection', daysOverdue: 2 }],
      coverageByBusinessUnit: [{ unit: 'Security', coverage: 92 }, { unit: 'Technology', coverage: 84 }, { unit: 'Operations', coverage: 76 }, { unit: 'Compliance', coverage: 89 }],
    },
  };
}

function getCachedState(workspaceId: string) {
  if (!cache.has(workspaceId)) {
    cache.set(workspaceId, seedState(workspaceId));
  }
  return cache.get(workspaceId)!;
}

function setCachedState(workspaceId: string, state: ContinuousAssuranceState) {
  cache.set(workspaceId, state);
  return state;
}

async function fetchStateFromApi(workspaceId: string) {
  void workspaceId;
  const result = await apiCall<{ data: ContinuousAssuranceState; error: null }>('/api/v1/continuous-assurance/state');
  return setCachedState(workspaceId, result.data);
}

async function withApiFallback<T>(workspaceId: string, operation: () => Promise<T>, fallback: () => T | Promise<T>) {
  void workspaceId;
  try {
    return await operation();
  } catch {
    return await fallback();
  }
}

function enforceContinuousAssurancePermission(role: WorkspaceRole | null, permission: CcmPermission) {
  if (!role || !continuousAssurancePermissionMap[permission].includes(role)) {
    throw new Error(`Insufficient permission for ${permission}`);
  }
}

function recordLedgerEvent(workspaceId: string, action: string, category: string, targetId: string, targetName: string, notes: string, outcome: 'success' | 'failed' | 'blocked' | 'pending' = 'success') {
  appendLocalActivity({
    id: makeId('activity'),
    workspaceId,
    actorUserId: 'current-user',
    actorName: 'Workspace Operator',
    action,
    category: category as ActivityLedgerCategory,
    targetType: category,
    targetId,
    targetName,
    outcome,
    severity: outcome === 'failed' ? 'high' : 'low',
    source: 'frontend',
    timestamp: new Date().toISOString(),
    notes,
  });
}

export async function getContinuousAssuranceState(workspaceId: string) {
  return withApiFallback(workspaceId, () => fetchStateFromApi(workspaceId), () => getCachedState(workspaceId));
}

export async function listControlMonitors(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.monitors;
}

export async function createControlMonitor(workspaceId: string, role: WorkspaceRole | null, input: Partial<ControlMonitor>) {
  enforceContinuousAssurancePermission(role, 'manage_control_monitors');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: ControlMonitor; error: null }>('/api/v1/continuous-assurance/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      const monitor: ControlMonitor = {
        id: makeId('mon'),
        workspaceId,
        name: input.name || 'New Control Monitor',
        controlId: input.controlId || 'CTRL-NEW',
        controlName: input.controlName || input.name || 'New Control',
        framework: input.framework || 'ISO 27001',
        controlObjective: input.controlObjective || 'Monitor control state continuously.',
        testType: input.testType || 'policy_review',
        frequency: input.frequency || 'Weekly',
        owner: input.owner || 'Workspace Operator',
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
      setCachedState(workspaceId, state);
      recordLedgerEvent(workspaceId, 'Control Monitor Created', 'control', monitor.id, monitor.name, 'Continuous assurance monitor created.');
      return monitor;
    },
  );
}

export async function updateControlMonitor(workspaceId: string, role: WorkspaceRole | null, monitorId: string, patch: Partial<ControlMonitor>) {
  enforceContinuousAssurancePermission(role, 'manage_control_monitors');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: ControlMonitor; error: null }>(`/api/v1/continuous-assurance/monitors/${monitorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      state.monitors = state.monitors.map((item) => (item.id === monitorId ? { ...item, ...patch } : item));
      setCachedState(workspaceId, state);
      return state.monitors.find((item) => item.id === monitorId)!;
    },
  );
}

export async function listAutomatedTests(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.tests;
}

export async function runAutomatedTest(
  workspaceId: string,
  role: WorkspaceRole | null,
  testId: string,
  options?: { forceStatus?: AutomatedTest['lastResult']; justification?: string },
) {
  enforceContinuousAssurancePermission(role, 'run_automated_tests');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: { test: AutomatedTest }; error: null }>(`/api/v1/continuous-assurance/tests/${testId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    async () => {
      const state = getCachedState(workspaceId);
      const test = state.tests.find((item) => item.id === testId);
      if (!test) throw new Error('Automated test not found.');
      test.lastRun = new Date().toISOString();
      test.lastResult = options?.forceStatus || (test.lastResult === 'failed' ? 'passed' : test.lastResult === 'passed' ? 'warning' : 'passed');
      setCachedState(workspaceId, state);
      return { test };
    },
  );
}

export async function createAutomatedTest(workspaceId: string, role: WorkspaceRole | null, input: Partial<AutomatedTest>) {
  enforceContinuousAssurancePermission(role, 'run_automated_tests');
  return withApiFallback(
    workspaceId,
    async () => {
      const monitor = await createControlMonitor(workspaceId, role, {
        name: input.name || 'New Automated Test Monitor',
        controlId: input.monitorId || 'CTRL-NEW-TEST',
        controlName: input.name || 'New Automated Test Monitor',
        controlObjective: input.description || 'New automated test monitor created from test builder.',
      });
      await fetchStateFromApi(workspaceId);
      const state = getCachedState(workspaceId);
      return state.tests.find((item) => item.monitorId === monitor.id) || state.tests[0];
    },
    () => {
      const state = getCachedState(workspaceId);
      const test: AutomatedTest = {
        id: makeId('test'),
        workspaceId,
        monitorId: input.monitorId || 'mon-manual',
        name: input.name || 'New Automated Test',
        description: input.description || 'New automated assurance test.',
        schedule: input.schedule || 'Weekly',
        enabled: input.enabled ?? true,
        owner: input.owner || 'Workspace Operator',
        lastRun: input.lastRun || null,
        lastResult: input.lastResult || 'not_run',
        manualOverride: input.manualOverride,
      };
      state.tests.unshift(test);
      setCachedState(workspaceId, state);
      return test;
    },
  );
}

export async function updateAutomatedTest(workspaceId: string, role: WorkspaceRole | null, testId: string, patch: Partial<AutomatedTest>) {
  enforceContinuousAssurancePermission(role, 'run_automated_tests');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: AutomatedTest; error: null }>(`/api/v1/continuous-assurance/tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      state.tests = state.tests.map((item) => (item.id === testId ? { ...item, ...patch } : item));
      setCachedState(workspaceId, state);
      return state.tests.find((item) => item.id === testId)!;
    },
  );
}

export function canPerformContinuousAssuranceAction(role: WorkspaceRole | null, permission: CcmPermission) {
  return Boolean(role && continuousAssurancePermissionMap[permission].includes(role));
}

export async function listEvidenceCollectionJobs(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.evidenceJobs;
}

export async function createEvidenceCollectionJob(workspaceId: string, role: WorkspaceRole | null, input: Partial<EvidenceCollectionJob>) {
  enforceContinuousAssurancePermission(role, 'manage_evidence_jobs');
  return withApiFallback(
    workspaceId,
    async () => {
      const state = await fetchStateFromApi(workspaceId);
      return state.evidenceJobs[0];
    },
    () => {
      const state = getCachedState(workspaceId);
      const job: EvidenceCollectionJob = {
        id: makeId('job'),
        workspaceId,
        name: input.name || 'New Evidence Collection Job',
        source: input.source || 'system_generated',
        linkedControls: input.linkedControls || [],
        linkedMonitorId: input.linkedMonitorId || null,
        collectionFrequency: input.collectionFrequency || 'Weekly',
        status: input.status || 'ready',
        lastCollectedAt: input.lastCollectedAt || null,
        nextCollectionAt: input.nextCollectionAt || nowIso(7),
        evidencePreview: input.evidencePreview || 'Automated evidence collection preview',
        approvalStatus: input.approvalStatus || 'pending',
        freshnessStatus: input.freshnessStatus || 'warning',
      };
      state.evidenceJobs.unshift(job);
      setCachedState(workspaceId, state);
      return job;
    },
  );
}

export async function listTestRuns(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.testRuns;
}

export async function listConnectors(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.connectors;
}

export async function createConnector(workspaceId: string, role: WorkspaceRole | null, input: Partial<Connector>) {
  enforceContinuousAssurancePermission(role, 'manage_connectors');
  return withApiFallback(
    workspaceId,
    async () => {
      const state = await fetchStateFromApi(workspaceId);
      return state.connectors[0];
    },
    () => {
      const state = getCachedState(workspaceId);
      const connector: Connector = {
        id: makeId('con'),
        workspaceId,
        name: input.name || 'New Connector',
        type: input.type || 'Custom',
        owner: input.owner || 'Workspace Operator',
        connectionStatus: input.connectionStatus || 'disconnected',
        healthStatus: input.healthStatus || 'warning',
        lastSync: input.lastSync || null,
        syncFrequency: input.syncFrequency || 'Daily',
        linkedJobIds: input.linkedJobIds || [],
        lastTestedAt: input.lastTestedAt || null,
        configurationStatus: input.configurationStatus || 'not_configured',
        environment: input.environment || 'sandbox',
        authMode: input.authMode || 'custom',
      };
      state.connectors.unshift(connector);
      setCachedState(workspaceId, state);
      return connector;
    },
  );
}

export async function listConnectorSyncLogs(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.connectorSyncLogs;
}

export async function listConnectorConfigurations(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.connectorConfigurations;
}

export async function updateConnectorStatus(workspaceId: string, role: WorkspaceRole | null, connectorId: string, patch: Partial<Connector>) {
  enforceContinuousAssurancePermission(role, 'manage_connectors');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: Connector; error: null }>(`/api/v1/continuous-assurance/connectors/${connectorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      state.connectors = state.connectors.map((item) => (item.id === connectorId ? { ...item, ...patch } : item));
      setCachedState(workspaceId, state);
      return state.connectors.find((item) => item.id === connectorId)!;
    },
  );
}

export async function syncConnector(workspaceId: string, role: WorkspaceRole | null, connectorId: string) {
  return updateConnectorStatus(workspaceId, role, connectorId, {
    lastSync: new Date().toISOString(),
    connectionStatus: 'connected',
    healthStatus: 'healthy',
  });
}

export async function testConnector(workspaceId: string, role: WorkspaceRole | null, connectorId: string) {
  return updateConnectorStatus(workspaceId, role, connectorId, {
    lastTestedAt: new Date().toISOString(),
    healthStatus: 'healthy',
  });
}

export async function listComplianceDrift(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.drift;
}

export async function listAssuranceExceptions(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.exceptions;
}

export async function createAssuranceException(workspaceId: string, role: WorkspaceRole | null, input: Partial<AssuranceException>) {
  enforceContinuousAssurancePermission(role, 'resolve_exceptions');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: AssuranceException; error: null }>('/api/v1/continuous-assurance/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
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
        status: input.status || 'open',
        remediationAction: input.remediationAction || 'Investigate and document corrective action.',
        evidence: input.evidence || null,
      };
      state.exceptions.unshift(exception);
      setCachedState(workspaceId, state);
      return exception;
    },
  );
}

export async function updateAssuranceException(workspaceId: string, role: WorkspaceRole | null, exceptionId: string, patch: Partial<AssuranceException>) {
  enforceContinuousAssurancePermission(role, 'resolve_exceptions');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: AssuranceException; error: null }>(`/api/v1/continuous-assurance/exceptions/${exceptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      state.exceptions = state.exceptions.map((item) => (item.id === exceptionId ? { ...item, ...patch } : item));
      setCachedState(workspaceId, state);
      return state.exceptions.find((item) => item.id === exceptionId)!;
    },
  );
}

export async function getContinuousAssuranceAnalytics(workspaceId: string) {
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: ContinuousAssuranceState['analytics']; error: null }>('/api/v1/continuous-assurance/analytics');
      return result.data;
    },
    () => getCachedState(workspaceId).analytics,
  );
}

export async function listContinuousAssuranceReports(workspaceId: string) {
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: AssuranceReport[]; error: null }>('/api/v1/continuous-assurance/reports');
      return result.data;
    },
    () => getCachedState(workspaceId).reports,
  );
}

export async function generateContinuousAssuranceReport(workspaceId: string, role: WorkspaceRole | null, title: string) {
  enforceContinuousAssurancePermission(role, 'generate_assurance_reports');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: AssuranceReport; error: null }>('/api/v1/continuous-assurance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
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
      state.reports.unshift(report);
      setCachedState(workspaceId, state);
      return report;
    },
  );
}

export async function getContinuousAssuranceSettings(workspaceId: string) {
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: AssuranceSetting; error: null }>('/api/v1/continuous-assurance/settings');
      return result.data;
    },
    () => getCachedState(workspaceId).settings,
  );
}

export async function updateContinuousAssuranceSettings(workspaceId: string, role: WorkspaceRole | null, patch: Partial<AssuranceSetting>) {
  enforceContinuousAssurancePermission(role, 'manage_control_monitors');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: AssuranceSetting; error: null }>('/api/v1/continuous-assurance/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      state.settings = { ...state.settings, ...patch };
      setCachedState(workspaceId, state);
      return state.settings;
    },
  );
}

export async function configureConnector(workspaceId: string, role: WorkspaceRole | null, connectorId: string, patch: Partial<ConnectorConfigurationRecord>) {
  enforceContinuousAssurancePermission(role, 'manage_connectors');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: ConnectorConfigurationRecord; error: null }>(`/api/v1/continuous-assurance/connectors/${connectorId}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      const connector = state.connectors.find((item) => item.id === connectorId);
      if (!connector) throw new Error('Connector not found.');
      const config: ConnectorConfigurationRecord = {
        connectorId,
        workspaceId,
        tenantLabel: patch.tenantLabel || `${connector.name} tenant`,
        environment: patch.environment || connector.environment || 'sandbox',
        authMode: patch.authMode || connector.authMode || 'custom',
        scopes: patch.scopes || ['read'],
        endpoints: patch.endpoints || ['https://api.example.com'],
        lastConfiguredAt: new Date().toISOString(),
        lastConfiguredBy: 'Workspace Operator',
        testStatus: patch.testStatus || 'not_tested',
        notes: patch.notes || 'Connector configuration updated.',
      };
      state.connectorConfigurations = [config, ...state.connectorConfigurations.filter((item) => item.connectorId !== connectorId)];
      setCachedState(workspaceId, state);
      return config;
    },
  );
}

export async function updateDriftItem(workspaceId: string, role: WorkspaceRole | null, driftId: string, patch: Partial<ComplianceDrift>) {
  enforceContinuousAssurancePermission(role, 'acknowledge_drift');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: ComplianceDrift; error: null }>(`/api/v1/continuous-assurance/drift/${driftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      state.drift = state.drift.map((item) => (item.id === driftId ? { ...item, ...patch } : item));
      setCachedState(workspaceId, state);
      return state.drift.find((item) => item.id === driftId)!;
    },
  );
}

export async function closeDrift(workspaceId: string, role: WorkspaceRole | null, driftId: string) {
  enforceContinuousAssurancePermission(role, 'acknowledge_drift');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: ComplianceDrift; error: null }>(`/api/v1/continuous-assurance/drift/${driftId}/close`, { method: 'POST' });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => updateDriftItem(workspaceId, role, driftId, { status: 'resolved' }),
  );
}

export async function acknowledgeDrift(workspaceId: string, role: WorkspaceRole | null, driftId: string) {
  return updateDriftItem(workspaceId, role, driftId, { status: 'acknowledged' });
}

export async function listRemediationTasks(workspaceId: string) {
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: RemediationTask[]; error: null }>('/api/v1/continuous-assurance/remediation-tasks');
      return result.data;
    },
    () => getCachedState(workspaceId).remediationTasks.sort((left, right) => parseDate(left.dueDate) - parseDate(right.dueDate)),
  );
}

export async function createRemediationTask(workspaceId: string, role: WorkspaceRole | null, input: Omit<RemediationTask, 'id' | 'workspaceId' | 'createdAt'>) {
  enforceContinuousAssurancePermission(role, 'resolve_exceptions');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: RemediationTask; error: null }>('/api/v1/continuous-assurance/remediation-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      const task: RemediationTask = { ...input, id: makeId('task'), workspaceId, createdAt: new Date().toISOString() };
      state.remediationTasks.unshift(task);
      setCachedState(workspaceId, state);
      return task;
    },
  );
}

export async function deleteControlMonitor(workspaceId: string, role: WorkspaceRole | null, monitorId: string) {
  enforceContinuousAssurancePermission(role, 'manage_control_monitors');
  const state = getCachedState(workspaceId);
  state.monitors = state.monitors.filter((item) => item.id !== monitorId);
  state.tests = state.tests.filter((item) => item.monitorId !== monitorId);
  setCachedState(workspaceId, state);
}

export async function updateRemediationTask(workspaceId: string, role: WorkspaceRole | null, taskId: string, patch: Partial<RemediationTask>) {
  enforceContinuousAssurancePermission(role, 'resolve_exceptions');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: RemediationTask; error: null }>(`/api/v1/continuous-assurance/remediation-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      state.remediationTasks = state.remediationTasks.map((item) => (item.id === taskId ? { ...item, ...patch } : item));
      setCachedState(workspaceId, state);
      return state.remediationTasks.find((item) => item.id === taskId)!;
    },
  );
}

export async function listAssuranceNotifications(workspaceId: string) {
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: AssuranceNotification[]; error: null }>('/api/v1/continuous-assurance/notifications');
      return result.data;
    },
    () => getCachedState(workspaceId).notifications,
  );
}

export async function getContinuousAssuranceOverview(workspaceId: string) {
  const state = await getContinuousAssuranceState(workspaceId);
  return state.overview;
}

export async function overrideAutomatedTest(workspaceId: string, role: WorkspaceRole | null, testId: string, justification: string, enabled = true) {
  return updateAutomatedTest(workspaceId, role, testId, {
    manualOverride: {
      enabled,
      justification,
    },
  });
}

export async function updateAssuranceNotification(workspaceId: string, role: WorkspaceRole | null, notificationId: string, patch: Partial<AssuranceNotification>) {
  enforceContinuousAssurancePermission(role, 'view_continuous_assurance');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: AssuranceNotification; error: null }>(`/api/v1/continuous-assurance/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      state.notifications = state.notifications.map((item) => (item.id === notificationId ? { ...item, ...patch } : item));
      setCachedState(workspaceId, state);
      return state.notifications.find((item) => item.id === notificationId)!;
    },
  );
}

export async function updateNotificationPreference(workspaceId: string, role: WorkspaceRole | null, channel: NotificationPreference['channel'], type: NotificationPreference['type'], enabled: boolean) {
  enforceContinuousAssurancePermission(role, 'manage_control_monitors');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: NotificationPreference[]; error: null }>('/api/v1/continuous-assurance/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, type, enabled }),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      state.notificationPreferences = state.notificationPreferences.map((item) =>
        item.channel === channel && item.type === type ? { ...item, enabled } : item,
      );
      setCachedState(workspaceId, state);
      return state.notificationPreferences;
    },
  );
}

export async function recordEvidenceDecision(workspaceId: string, role: WorkspaceRole | null, evidenceId: string, action: 'approved' | 'rejected' | 'recollected' | 'archived', note?: string) {
  enforceContinuousAssurancePermission(role, 'manage_evidence_jobs');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await apiCall<{ data: EvidenceCollectionJob; error: null }>(`/api/v1/continuous-assurance/evidence-jobs/${evidenceId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      await fetchStateFromApi(workspaceId);
      return result.data;
    },
    () => {
      const state = getCachedState(workspaceId);
      const job = state.evidenceJobs.find((item) => item.id === evidenceId || item.evidencePreview.includes(evidenceId));
      if (!job) throw new Error('Evidence collection job not found.');
      if (action === 'approved' || action === 'rejected') job.approvalStatus = action;
      if (action === 'recollected') {
        job.freshnessStatus = 'fresh';
        job.lastCollectedAt = new Date().toISOString();
      }
      if (action === 'archived') job.status = 'paused';
      setCachedState(workspaceId, state);
      return job;
    },
  );
}

export async function runEvidenceCollectionJob(workspaceId: string, role: WorkspaceRole | null, evidenceJobId: string) {
  enforceContinuousAssurancePermission(role, 'manage_evidence_jobs');
  return withApiFallback(
    workspaceId,
    async () => {
      const result = await recordEvidenceDecision(workspaceId, role, evidenceJobId, 'recollected', 'Evidence collection job executed.');
      await fetchStateFromApi(workspaceId);
      return result;
    },
    () => {
      const state = getCachedState(workspaceId);
      const job = state.evidenceJobs.find((item) => item.id === evidenceJobId);
      if (!job) throw new Error('Evidence collection job not found.');
      job.lastCollectedAt = new Date().toISOString();
      job.freshnessStatus = 'fresh';
      job.status = 'ready';
      setCachedState(workspaceId, state);
      return job;
    },
  );
}

export async function recordRiskAssuranceAction(workspaceId: string, role: WorkspaceRole | null, riskId: string, action: 'treated' | 'escalated' | 'accepted' | 'transferred', note?: string) {
  enforceContinuousAssurancePermission(role, 'resolve_exceptions');
  recordLedgerEvent(
    workspaceId,
    action === 'treated' ? 'Risk Treated' : action === 'escalated' ? 'Risk Escalated' : action === 'accepted' ? 'Risk Accepted' : 'Risk Transferred',
    'risk',
    riskId,
    riskId,
    note || `Risk ${action} from assurance workspace.`,
  );
}

export function getContinuousAssuranceSearchIndex(workspaceId: string) {
  const state = getCachedState(workspaceId);
  return [
    ...state.evidenceJobs.map((job) => ({
      key: 'ccm-evidence-jobs',
      label: job.name,
      description: job.evidencePreview,
      workspaceId: 'continuous-assurance',
      workspaceTitle: 'Continuous Assurance Workspace',
      keywords: `${job.name} ${job.evidencePreview} ${job.linkedControls.join(' ')} evidence job`.toLowerCase(),
    })),
    ...state.drift.map((item) => ({
      key: 'ccm-drift',
      label: item.driftType,
      description: item.affectedObject,
      workspaceId: 'continuous-assurance',
      workspaceTitle: 'Continuous Assurance Workspace',
      keywords: `${item.driftType} ${item.affectedObject} ${item.owner} drift alert`.toLowerCase(),
    })),
    ...state.exceptions.map((item) => ({
      key: 'ccm-exceptions',
      label: item.type,
      description: item.remediationAction,
      workspaceId: 'continuous-assurance',
      workspaceTitle: 'Continuous Assurance Workspace',
      keywords: `${item.type} ${item.source} ${item.owner} exception`.toLowerCase(),
    })),
    ...state.connectors.map((item) => ({
      key: 'ccm-connectors',
      label: item.name,
      description: `${item.type} ${item.connectionStatus} ${item.healthStatus}`,
      workspaceId: 'continuous-assurance',
      workspaceTitle: 'Continuous Assurance Workspace',
      keywords: `${item.name} ${item.type} connector ${item.connectionStatus} ${item.healthStatus}`.toLowerCase(),
    })),
    ...state.monitors.map((item) => ({
      key: 'ccm-monitors',
      label: item.name,
      description: item.controlObjective,
      workspaceId: 'continuous-assurance',
      workspaceTitle: 'Continuous Assurance Workspace',
      keywords: `${item.name} ${item.controlName} monitor ${item.framework}`.toLowerCase(),
    })),
    ...state.tests.map((item) => ({
      key: 'ccm-tests',
      label: item.name,
      description: item.description,
      workspaceId: 'continuous-assurance',
      workspaceTitle: 'Continuous Assurance Workspace',
      keywords: `${item.name} ${item.description} test ${item.owner}`.toLowerCase(),
    })),
  ];
}

export function getControlAssuranceSummary(workspaceId: string, controlId: string) {
  const state = getCachedState(workspaceId);
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
  const state = getCachedState(workspaceId);
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
  const state = getCachedState(workspaceId);
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
  const state = getCachedState(workspaceId);
  return {
    continuouslyMonitoredControls: state.monitors.filter((monitor) => monitor.status !== 'disabled').length,
    failedTests: state.tests.filter((test) => test.lastResult === 'failed').length,
    availableAutomatedEvidence: state.evidenceJobs.filter((job) => job.approvalStatus === 'approved').length,
    auditReadinessExceptions: state.exceptions.filter((item) => item.status !== 'resolved').length,
  };
}

export function getExecutiveContinuousAssuranceWidgets(workspaceId: string) {
  const overview = getCachedState(workspaceId).overview;
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
  const state = getCachedState(workspaceId);
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
