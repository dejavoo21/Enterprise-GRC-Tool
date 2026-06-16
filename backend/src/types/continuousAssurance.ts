export type AssuranceStatus = 'strong' | 'stable' | 'degraded' | 'critical';
export type AssuranceTrend = 'improving' | 'stable' | 'declining';
export type MonitorStatus = 'active' | 'warning' | 'disabled' | 'failed';
export type TestResultStatus = 'passed' | 'failed' | 'warning' | 'not_run' | 'not_applicable';
export type ConnectorStatus = 'connected' | 'degraded' | 'disconnected' | 'error';
export type ConnectorHealth = 'healthy' | 'warning' | 'critical';
export type DriftStatus = 'open' | 'acknowledged' | 'resolved';
export type ExceptionStatus = 'open' | 'in_progress' | 'resolved' | 'accepted';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type NotificationStatus = 'unread' | 'read' | 'archived' | 'snoozed';
export type NotificationChannel = 'in_app' | 'email' | 'teams' | 'slack';
export type NotificationType =
  | 'failed_test'
  | 'drift_alert'
  | 'connector_failure'
  | 'missing_evidence'
  | 'expired_evidence'
  | 'review_assignment'
  | 'approval_request'
  | 'risk_escalation';
export type EvidenceCollectionSource =
  | 'manual_upload'
  | 'api_connector'
  | 'system_generated'
  | 'scheduled_job'
  | 'imported_file';
export type TestType =
  | 'mfa_enabled'
  | 'password_policy'
  | 'privileged_review'
  | 'backup_success'
  | 'vulnerability_sla'
  | 'endpoint_protection'
  | 'logging_enabled'
  | 'encryption_enabled'
  | 'access_review'
  | 'evidence_freshness'
  | 'vendor_assessment'
  | 'policy_review';
export type CcmPermission =
  | 'view_continuous_assurance'
  | 'manage_control_monitors'
  | 'run_automated_tests'
  | 'manage_connectors'
  | 'manage_evidence_jobs'
  | 'acknowledge_drift'
  | 'resolve_exceptions'
  | 'generate_assurance_reports'
  | 'export_assurance_reports';

export type CcmWorkspaceRole = 'owner' | 'admin' | 'grc' | 'auditor' | 'viewer';

export interface AssuranceDriver {
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface ControlMonitor {
  id: string;
  workspaceId: string;
  name: string;
  controlId: string;
  controlName: string;
  framework: string;
  frameworkId?: string;
  controlObjective: string;
  testType: TestType;
  frequency: string;
  owner: string;
  status: MonitorStatus;
  lastRun?: string | null;
  nextRun?: string | null;
  result: TestResultStatus;
  evidenceOutput: string;
  evidenceRequirementId?: string | null;
  evidenceJobId?: string | null;
  exceptionCount: number;
}

export interface AutomatedTest {
  id: string;
  workspaceId: string;
  monitorId: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  owner: string;
  lastRun?: string | null;
  lastResult: TestResultStatus;
  manualOverride?: { enabled: boolean; justification?: string | null };
}

export interface TestRun {
  id: string;
  workspaceId: string;
  automatedTestId: string;
  monitorId: string;
  startedAt: string;
  completedAt?: string | null;
  status: TestResultStatus;
  summary: string;
  details: string;
  evidenceGenerated?: string[];
}

export interface EvidenceCollectionJob {
  id: string;
  workspaceId: string;
  name: string;
  source: EvidenceCollectionSource;
  linkedControls: string[];
  linkedMonitorId?: string | null;
  collectionFrequency: string;
  status: 'ready' | 'collecting' | 'failed' | 'paused';
  lastCollectedAt?: string | null;
  nextCollectionAt?: string | null;
  evidencePreview: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  freshnessStatus: 'fresh' | 'warning' | 'expired';
}

export interface ConnectorSyncLog {
  id: string;
  connectorId: string;
  timestamp: string;
  status: 'success' | 'failed';
  summary: string;
}

export interface Connector {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  owner: string;
  connectionStatus: ConnectorStatus;
  healthStatus: ConnectorHealth;
  lastSync?: string | null;
  syncFrequency: string;
  linkedJobIds: string[];
  lastTestedAt?: string | null;
  configurationStatus?: 'not_configured' | 'configured' | 'testing';
  environment?: 'production' | 'staging' | 'sandbox';
  authMode?: 'oauth' | 'api_key' | 'service_principal' | 'basic' | 'custom';
}

export interface ComplianceDrift {
  id: string;
  workspaceId: string;
  driftType: string;
  affectedObject: string;
  severity: Severity;
  detectedDate: string;
  owner: string;
  recommendedAction: string;
  status: DriftStatus;
  linkedControlId?: string | null;
  linkedFramework?: string | null;
  rootCause?: string | null;
  impact?: string | null;
  recommendation?: string | null;
  relatedAssets?: string[];
  relatedControls?: string[];
  relatedRisks?: string[];
  relatedEvidence?: string[];
}

export interface AssuranceException {
  id: string;
  workspaceId: string;
  type: string;
  severity: Severity;
  source: string;
  linkedControlId?: string | null;
  linkedFramework?: string | null;
  linkedRiskId?: string | null;
  owner: string;
  dueDate?: string | null;
  status: ExceptionStatus;
  remediationAction: string;
  evidence?: string | null;
}

export interface AssuranceReport {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  generatedAt: string;
  generatedBy: string;
  formatSupport: Array<'pdf' | 'excel' | 'csv'>;
  summary: string;
}

export interface ConnectorConfigurationRecord {
  connectorId: string;
  workspaceId: string;
  tenantLabel: string;
  environment: 'production' | 'staging' | 'sandbox';
  authMode: 'oauth' | 'api_key' | 'service_principal' | 'basic' | 'custom';
  scopes: string[];
  endpoints: string[];
  lastConfiguredAt?: string | null;
  lastConfiguredBy?: string | null;
  testStatus: 'not_tested' | 'passed' | 'failed';
  notes?: string | null;
}

export interface RemediationTask {
  id: string;
  workspaceId: string;
  sourceType: 'failed_test' | 'drift_alert' | 'exception' | 'missing_evidence';
  sourceId: string;
  linkedObjectLabel: string;
  title: string;
  description: string;
  owner: string;
  priority: Severity;
  dueDate?: string | null;
  status: 'open' | 'in_progress' | 'blocked' | 'resolved' | 'closed';
  linkedObjectType: 'test' | 'drift' | 'exception' | 'evidence-job';
  linkedObjectId: string;
  createdAt: string;
}

export interface NotificationPreference {
  channel: NotificationChannel;
  type: NotificationType;
  enabled: boolean;
}

export interface AssuranceNotification {
  id: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  detail: string;
  severity: Severity;
  status: NotificationStatus;
  routeKey: string;
  createdAt: string;
  assignedTo?: string | null;
  snoozedUntil?: string | null;
}

export interface AssuranceSetting {
  defaultTestFrequency: string;
  evidenceFreshnessPeriodDays: number;
  driftSeverityThreshold: Severity;
  exceptionSlaDays: number;
  notificationRules: string[];
  connectorSyncFrequency: string;
  autoCreateRemediationTask: boolean;
  autoLinkEvidence: boolean;
}

export interface ContinuousAssuranceAnalytics {
  controlsByFramework: Array<{ framework: string; count: number }>;
  passFailByDomain: Array<{ domain: string; passed: number; failed: number }>;
  exceptionsBySeverity: Array<{ severity: Severity; count: number }>;
  evidenceFreshnessTrend: TrendPoint[];
  connectorReliabilityTrend: TrendPoint[];
  assuranceScoreByMonth: TrendPoint[];
  controlFailureRecurrence: Array<{ control: string; count: number }>;
  topFailingControls: Array<{ control: string; count: number }>;
  topOverdueEvidence: Array<{ job: string; daysOverdue: number }>;
  coverageByBusinessUnit: Array<{ unit: string; coverage: number }>;
}

export interface ContinuousAssuranceOverview {
  score: number;
  status: AssuranceStatus;
  trend: AssuranceTrend;
  topDrivers: AssuranceDriver[];
  controlsMonitored: number;
  controlsPassing: number;
  controlsFailing: number;
  controlsDegraded: number;
  evidenceCollectedAutomatically: number;
  evidenceMissing: number;
  complianceDriftAlerts: number;
  connectorHealth: number;
  openExceptions: number;
  failedTests: number;
  upcomingControlReviews: number;
  controlHealthTrend: TrendPoint[];
  testPassFailTrend: TrendPoint[];
  evidenceCollectionTrend: TrendPoint[];
  complianceDriftTrend: TrendPoint[];
  frameworkAssuranceCoverage: Array<{ framework: string; coverage: number }>;
  connectorStatusDistribution: Array<{ status: ConnectorStatus; count: number }>;
  exceptionSeverityDistribution: Array<{ severity: Severity; count: number }>;
  notifications: AssuranceNotification[];
}

export interface ContinuousAssuranceState {
  overview: ContinuousAssuranceOverview;
  monitors: ControlMonitor[];
  tests: AutomatedTest[];
  testRuns: TestRun[];
  evidenceJobs: EvidenceCollectionJob[];
  connectors: Connector[];
  connectorSyncLogs: ConnectorSyncLog[];
  drift: ComplianceDrift[];
  exceptions: AssuranceException[];
  remediationTasks: RemediationTask[];
  notifications: AssuranceNotification[];
  notificationPreferences: NotificationPreference[];
  connectorConfigurations: ConnectorConfigurationRecord[];
  reports: AssuranceReport[];
  settings: AssuranceSetting;
  analytics: ContinuousAssuranceAnalytics;
}

export const continuousAssurancePermissionMap: Record<CcmPermission, CcmWorkspaceRole[]> = {
  view_continuous_assurance: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
  manage_control_monitors: ['owner', 'admin', 'grc'],
  run_automated_tests: ['owner', 'admin', 'grc', 'auditor'],
  manage_connectors: ['owner', 'admin', 'grc'],
  manage_evidence_jobs: ['owner', 'admin', 'grc'],
  acknowledge_drift: ['owner', 'admin', 'grc', 'auditor'],
  resolve_exceptions: ['owner', 'admin', 'grc', 'auditor'],
  generate_assurance_reports: ['owner', 'admin', 'grc', 'auditor'],
  export_assurance_reports: ['owner', 'admin', 'grc', 'auditor'],
};
