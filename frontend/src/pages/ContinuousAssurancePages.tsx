import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  DataTableShell,
  EmptyStatePanel,
  Modal,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  SummaryMetricStrip,
} from '../components';
import { ControlMonitorModal, ExceptionResolutionModal, TestResultModal } from '../components/ContinuousAssuranceDecisionModals';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  canPerformContinuousAssuranceAction,
  archiveControlMonitor,
  createControlMonitor,
  createRemediationTask,
  downloadContinuousAssuranceReport,
  generateContinuousAssuranceReport,
  getContinuousAssuranceState,
  runAutomatedTest,
  updateAssuranceException,
  updateAssuranceNotification,
  updateContinuousAssuranceSettings,
  updateNotificationPreference,
  updateControlMonitor,
} from '../services/continuousAssurance/continuousAssurance';
import { theme } from '../theme';
import type { WorkspaceRole } from '../types/auth';
import type {
  AssuranceException,
  AssuranceNotification,
  AssuranceSetting,
  AutomatedTest,
  ControlMonitor,
  ContinuousAssuranceState,
  Severity,
  TrendPoint,
} from '../types/continuousAssurance';

type MetricTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

const pageStyle = {
  maxWidth: 1440,
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

const inputStyle = {
  padding: theme.spacing[3],
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.md,
  backgroundColor: theme.colors.surface,
  color: theme.colors.text.main,
  fontSize: theme.typography.sizes.sm,
};

function toneForStatus(status: string): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'passed' || status === 'connected' || status === 'resolved' || status === 'accepted' || status === 'low' || status === 'stable' || status === 'strong') return 'success';
  if (status === 'failed' || status === 'error' || status === 'critical' || status === 'high') return 'danger';
  if (status === 'warning' || status === 'degraded' || status === 'acknowledged' || status === 'open' || status === 'in_progress' || status === 'medium' || status === 'declining') return 'warning';
  return 'default';
}

function MiniTrend({ points, color }: { points: TrendPoint[]; color: string }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const width = 100;
  const height = 36;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const line = points.map((point, index) => {
    const x = index * step;
    const y = height - (point.value / max) * height;
    return `${x},${Math.max(4, y)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height + 4}`} preserveAspectRatio="none" style={{ width: '100%', height: 72 }}>
      <polyline fill="none" stroke={color} strokeWidth="3" points={line} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DistributionList({
  items,
  formatter,
}: {
  items: Array<{ label: string; value: number; tone?: 'default' | 'success' | 'warning' | 'danger' }>;
  formatter?: (value: number) => string;
}) {
  const total = Math.max(...items.map((item) => item.value), 1);
  return (
    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'grid', gap: theme.spacing[1] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
            <span style={{ color: theme.colors.text.secondary }}>{item.label}</span>
            <strong style={{ color: theme.colors.text.main }}>{formatter ? formatter(item.value) : item.value}</strong>
          </div>
          <div style={{ height: 8, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.borderLight }}>
            <div style={{ width: `${Math.max(6, Math.round((item.value / total) * 100))}%`, height: '100%', borderRadius: theme.borderRadius.full, backgroundColor: item.tone === 'danger' ? theme.colors.semantic.danger : item.tone === 'warning' ? theme.colors.semantic.warning : item.tone === 'success' ? theme.colors.semantic.success : theme.colors.primary }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function useContinuousAssurance() {
  const { workspaceId } = useWorkspace();
  const { role } = useAuth();
  const [state, setState] = useState<ContinuousAssuranceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) {
      setError('No active workspace available.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setState(await getContinuousAssuranceState(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load continuous assurance workspace.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { workspaceId, role, state, loading, error, reload: load };
}

function GuardedPage({
  title,
  description,
  children,
  loading,
  error,
  onRetry,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title={title} description={description} />
        <Card style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading continuous assurance workspace...</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <PageHeader title={title} description={description} />
        <EmptyStatePanel eyebrow="Continuous Assurance" title="Unable to load workspace" description={error} actions={<Button variant="primary" onClick={onRetry}>Retry</Button>} />
      </div>
    );
  }

  return <div style={pageStyle}>{children}</div>;
}

function ContinuousAssuranceScaffold({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: (ctx: ReturnType<typeof useContinuousAssurance>) => React.ReactNode;
}) {
  const ctx = useContinuousAssurance();

  return (
    <GuardedPage title={title} description={description} loading={ctx.loading} error={ctx.error} onRetry={ctx.reload}>
      <PageHeader
        title={title}
        description={description}
        breadcrumb={`Continuous Assurance / ${title}`}
        action={action}
      />
      {ctx.state ? children(ctx) : null}
    </GuardedPage>
  );
}

export function ContinuousAssuranceWorkspace({ onNavigate }: { onNavigate?: (key: string) => void }) {
  return (
    <ContinuousAssuranceScaffold
      title="Continuous Assurance Workspace"
      description="Control monitors, automated tests, evidence automation, drift detection, exceptions, analytics, and executive assurance reporting."
      action={<Badge variant="primary" size="sm">Continuous Assurance</Badge>}
    >
      {({ state }) => (
        <>
          <SummaryMetricStrip
            metrics={[
              { label: 'Assurance Score', value: state!.overview.score, detail: state!.overview.status, tone: toneForStatus(state!.overview.status) as MetricTone },
              { label: 'Monitors', value: state!.monitors.length, detail: 'Controls linked to automated checks', tone: 'primary' as const },
              { label: 'Evidence Jobs', value: state!.evidenceJobs.length, detail: 'Automated evidence collection workflows', tone: 'success' as const },
              { label: 'Open Exceptions', value: state!.overview.openExceptions, detail: 'Requires remediation or acceptance', tone: 'warning' as const },
              { label: 'Connectors', value: state!.connectors.length, detail: 'Connected data sources and adapters', tone: 'default' as const },
            ]}
          />

          <PageSectionCard
            title="Workspace Actions"
            subtitle="Use the dedicated views to manage monitors, test execution, evidence automation, and assurance reporting."
            action={
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                <Button variant="primary" onClick={() => onNavigate?.('continuous-assurance-overview')}>Open Overview</Button>
                <Button variant="secondary" onClick={() => onNavigate?.('ccm-monitors')}>Control Monitors</Button>
                <Button variant="secondary" onClick={() => onNavigate?.('ccm-tests')}>Automated Tests</Button>
                <Button variant="secondary" onClick={() => onNavigate?.('ccm-connectors')}>Connectors</Button>
              </div>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}>
              {[
                ['Overview', 'Continuous assurance score, alerts, and platform summary.', 'continuous-assurance-overview'],
                ['Control Monitors', 'Create, link, disable, and review monitor posture.', 'ccm-monitors'],
                ['Automated Tests', 'Run tests, review failures, and manage overrides.', 'ccm-tests'],
                ['Evidence Collection', 'Operate automated evidence collection jobs.', 'ccm-evidence-jobs'],
                ['Exceptions', 'Track failed tests, stale evidence, and open blockers.', 'ccm-exceptions'],
                ['Drift Detection', 'Review drift events and assign remediation.', 'ccm-drift'],
                ['Connectors', 'Operate SaaS and cloud connectors.', 'ccm-connectors'],
                ['Analytics', 'Monitor assurance trends and recurring failures.', 'ccm-analytics'],
                ['Reports', 'Generate executive and framework assurance output.', 'ccm-reports'],
                ['Settings', 'Configure thresholds, cadence, and automation rules.', 'ccm-settings'],
              ].map(([label, detail, route]) => (
                <Card key={label} style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}` }}>
                  <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{label}</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{detail}</div>
                  <div style={{ marginTop: theme.spacing[3] }}>
                    <Button variant="secondary" onClick={() => onNavigate?.(route)}>Open</Button>
                  </div>
                </Card>
              ))}
            </div>
          </PageSectionCard>
        </>
      )}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceOverview() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const taskFilter = searchParams.get('task');
  const notificationActionLock = useRef(false);
  const [notificationActionId, setNotificationActionId] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  return (
    <ContinuousAssuranceScaffold
      title="Continuous Assurance Overview"
      description="Live control monitoring, evidence automation, drift posture, connector health, and assurance trend visibility."
    >
      {({ workspaceId, role, state, reload }) => {
        const overview = state!.overview;
        const selectedTask = state!.remediationTasks.find((task) => task.id === taskFilter) || null;
        const canManageNotifications = canPerformContinuousAssuranceAction(role, 'manage_control_monitors');
        const updateNotification = async (notificationId: string, status: 'read' | 'archived' | 'snoozed') => {
          if (notificationActionLock.current || !workspaceId || !state?.notifications.some((item) => item.id === notificationId)) return;
          notificationActionLock.current = true;
          setNotificationActionId(notificationId);
          setNotificationError(null);
          try {
            await updateAssuranceNotification(workspaceId, role, notificationId, {
              status,
              snoozedUntil: status === 'snoozed' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
            });
            await reload();
          } catch (cause) {
            setNotificationError(cause instanceof Error ? cause.message : 'Unable to update the notification.');
          } finally {
            notificationActionLock.current = false;
            setNotificationActionId(null);
          }
        };
        return (
          <>
            <SummaryMetricStrip
              metrics={[
                { label: 'Continuous Assurance Score', value: overview.score, detail: `${overview.status} · ${overview.trend}`, tone: toneForStatus(overview.status) as MetricTone },
                { label: 'Controls Monitored', value: overview.controlsMonitored, detail: `${overview.controlsPassing} passing`, tone: 'primary' as const },
                { label: 'Controls Failing', value: overview.controlsFailing, detail: `${overview.controlsDegraded} degraded`, tone: 'danger' as const },
                { label: 'Auto Evidence', value: overview.evidenceCollectedAutomatically, detail: `${overview.evidenceMissing} missing`, tone: 'success' as const },
                { label: 'Connector Health', value: `${overview.connectorHealth}%`, detail: `${overview.complianceDriftAlerts} drift alerts`, tone: overview.connectorHealth < 75 ? 'warning' as const : 'success' as const },
                { label: 'Open Exceptions', value: overview.openExceptions, detail: `${overview.failedTests} failed tests`, tone: 'warning' as const },
                { label: 'Remediation Tasks', value: state!.remediationTasks.length, detail: `${state!.remediationTasks.filter((item) => item.status !== 'closed').length} active`, tone: state!.remediationTasks.some((item) => item.priority === 'critical' || item.priority === 'high') ? 'danger' as const : 'default' as const },
              ]}
            />

            <PageToolbar actions={<Button variant="secondary" onClick={reload}>Refresh</Button>}>
              <Badge variant="default" size="sm">{overview.upcomingControlReviews} upcoming control reviews</Badge>
            </PageToolbar>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
              <PageSectionCard title="Assurance Score Drivers" subtitle="Weighted contributors to the current continuous assurance score.">
                <DistributionList items={overview.topDrivers.map((driver) => ({ label: driver.label, value: driver.value, tone: driver.value < 60 ? 'danger' : driver.value < 80 ? 'warning' : 'success' }))} formatter={(value) => `${value}%`} />
              </PageSectionCard>
              <PageSectionCard title="Notifications" subtitle="Immediate alerts from tests, evidence, connectors, and drift.">
                <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                  {overview.notifications.length === 0 ? (
                    <EmptyStatePanel title="No active alerts" description="The current assurance posture does not have urgent notifications." />
                  ) : overview.notifications.map((item) => (
                    <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                        <strong style={{ color: theme.colors.text.main }}>{item.title}</strong>
                        <Badge variant={toneForStatus(item.severity)} size="sm">{item.severity}</Badge>
                      </div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.detail}</div>
                      <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Button variant="outline" size="sm" onClick={() => navigate('/continuous-assurance/tests')}>Open test register</Button>
                        {canManageNotifications ? <>
                          <Button variant="secondary" size="sm" onClick={() => void updateNotification(item.id, 'read')} disabled={Boolean(notificationActionId)}>Mark read</Button>
                          <Button variant="outline" size="sm" onClick={() => void updateNotification(item.id, 'snoozed')} disabled={Boolean(notificationActionId)}>Snooze 24h</Button>
                          <Button variant="outline" size="sm" onClick={() => void updateNotification(item.id, 'archived')} disabled={Boolean(notificationActionId)}>Archive</Button>
                        </> : null}
                      </div>
                    </Card>
                  ))}
                  {notificationError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{notificationError}</div> : null}
                </div>
              </PageSectionCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[4] }}>
              <PageSectionCard title="Control Health Trend" subtitle="Assurance score and control health over time.">
                <MiniTrend points={overview.controlHealthTrend} color={theme.colors.primary} />
              </PageSectionCard>
              <PageSectionCard title="Test Pass/Fail Trend" subtitle="Run success versus failure pressure.">
                <MiniTrend points={overview.testPassFailTrend} color={theme.colors.semantic.warning} />
              </PageSectionCard>
              <PageSectionCard title="Evidence Collection Trend" subtitle="Evidence freshness and automated collection posture.">
                <MiniTrend points={overview.evidenceCollectionTrend} color={theme.colors.semantic.success} />
              </PageSectionCard>
              <PageSectionCard title="Compliance Drift Trend" subtitle="Drift events detected across the current period.">
                <MiniTrend points={overview.complianceDriftTrend} color={theme.colors.semantic.danger} />
              </PageSectionCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[4] }}>
              <PageSectionCard title="Framework Assurance Coverage" subtitle="Continuous monitoring coverage by framework.">
                <DistributionList items={overview.frameworkAssuranceCoverage.map((item) => ({ label: item.framework, value: item.coverage, tone: item.coverage < 70 ? 'warning' : 'success' }))} formatter={(value) => `${value}%`} />
              </PageSectionCard>
              <PageSectionCard title="Connector Status Distribution" subtitle="Status of assurance connectors and adapters.">
                <DistributionList items={overview.connectorStatusDistribution.map((item) => ({ label: item.status, value: item.count, tone: toneForStatus(item.status) }))} />
              </PageSectionCard>
              <PageSectionCard title="Exception Severity Distribution" subtitle="Open exception load by severity band.">
                <DistributionList items={overview.exceptionSeverityDistribution.map((item) => ({ label: item.severity, value: item.count, tone: toneForStatus(item.severity) }))} />
              </PageSectionCard>
            </div>

            <PageSectionCard title="Remediation Tasks" subtitle="Tasks created from failed tests, drift alerts, exceptions, and missing evidence.">
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {state!.remediationTasks.length === 0 ? (
                  <EmptyStatePanel title="No remediation tasks" description="Failed tests, drift alerts, and evidence gaps will create remediation work here." />
                ) : state!.remediationTasks.slice(0, 5).map((task) => (
                  <Card key={task.id} style={{ padding: theme.spacing[3], outline: selectedTask?.id === task.id ? `2px solid ${theme.colors.primary}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{task.title}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                          {task.owner} · {task.sourceType.replace(/_/g, ' ')} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
                        <Badge variant={toneForStatus(task.priority)} size="sm">{task.priority}</Badge>
                        <Badge variant={toneForStatus(task.status)} size="sm">{task.status}</Badge>
                        <Button variant="outline" onClick={() => setSearchParams({ task: task.id })}>Review</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              {selectedTask ? <Card style={{ marginTop: theme.spacing[3], padding: theme.spacing[4], display: 'grid', gap: theme.spacing[3] }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'start' }}><div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Selected remediation task</div><h3 style={{ margin: `${theme.spacing[1]} 0` }}>{selectedTask.title}</h3><span>{selectedTask.id}</span></div><Button variant="outline" onClick={() => setSearchParams({})}>Close</Button></div><p style={{ margin: 0 }}>{selectedTask.description}</p><dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: theme.spacing[3], margin: 0 }}><div><dt>Owner</dt><dd>{selectedTask.owner}</dd></div><div><dt>Priority</dt><dd>{selectedTask.priority}</dd></div><div><dt>Status</dt><dd>{selectedTask.status}</dd></div><div><dt>Due date</dt><dd>{selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : 'Not set'}</dd></div><div><dt>Source</dt><dd>{selectedTask.sourceType.replace(/_/g, ' ')}</dd></div><div><dt>Linked object</dt><dd>{selectedTask.linkedObjectLabel}</dd></div></dl></Card> : taskFilter ? <EmptyStatePanel title="Remediation task unavailable" description="The requested task is not available in this workspace or no longer exists." /> : null}
            </PageSectionCard>
          </>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceMonitors() {
  const [creating, setCreating] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ControlMonitor | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const archiveLock = useRef(false);
  return (
    <ContinuousAssuranceScaffold title="Control Monitors" description="Manage continuous control monitors, linked controls, frameworks, owners, cadence, and evidence output.">
      {({ state, workspaceId, role, reload }) => {
        const canManage = canPerformContinuousAssuranceAction(role, 'manage_control_monitors');
        const monitors = state!.monitors;
        const addMonitor = async (draft: { name: string; controlId: string; controlName: string; controlObjective: string; owner: string }) => {
          if (!workspaceId) throw new Error('Select a workspace before creating a monitor.');
          await createControlMonitor(workspaceId, role, {
            ...draft, framework: 'Unmapped',
            testType: 'policy_review', frequency: 'Monthly', evidenceOutput: 'Manual reviewed test result',
          });
          await reload();
        };
        const toggleMonitor = async (id: string, disabled: boolean) => {
          if (!workspaceId) return;
          await updateControlMonitor(workspaceId, role, id, { status: disabled ? 'active' : 'disabled' });
          await reload();
        };
        const closeArchive = () => {
          if (archiving || archiveLock.current) return;
          setArchiveTarget(null);
          setArchiveReason('');
          setArchiveError('');
        };
        const submitArchive = async () => {
          if (!workspaceId || !archiveTarget || archiveLock.current) return;
          const reason = archiveReason.trim();
          if (reason.length < 10) {
            setArchiveError('Provide at least 10 characters explaining why this monitor is being archived.');
            return;
          }
          archiveLock.current = true;
          setArchiving(true);
          setArchiveError('');
          try {
            await archiveControlMonitor(workspaceId, role, archiveTarget.id, reason);
            await reload();
            setArchiveTarget(null);
            setArchiveReason('');
          } catch (cause) {
            setArchiveError(cause instanceof Error ? cause.message : 'Unable to archive this monitor.');
          } finally {
            archiveLock.current = false;
            setArchiving(false);
          }
        };
        return (
          <>
            <PageToolbar actions={<Button variant="primary" onClick={() => setCreating(true)} disabled={!canManage}>Create Monitor</Button>}>
              <Badge variant="default" size="sm">{monitors.length} monitors</Badge>
            </PageToolbar>
            <DataTableShell title="Control Monitor Register" subtitle="Link monitors to controls, frameworks, and evidence requirements without horizontal overflow.">
              {monitors.length === 0 ? (
                <EmptyStatePanel title="No monitors yet" description="Create the first monitor to start continuous controls monitoring." actions={<Button variant="primary" onClick={() => setCreating(true)} disabled={!canManage}>Create Monitor</Button>} />
              ) : (
                <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                  {monitors.map((monitor) => (
                    <Card key={monitor.id} style={{ padding: theme.spacing[4] }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) repeat(4, minmax(0, 1fr)) auto', gap: theme.spacing[3], alignItems: 'start' }}>
                        <div>
                          <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                            <strong style={{ color: theme.colors.text.main }}>{monitor.name}</strong>
                            <Badge variant={toneForStatus(monitor.status)} size="sm">{monitor.status}</Badge>
                            <Badge variant={toneForStatus(monitor.result)} size="sm">{monitor.result}</Badge>
                          </div>
                          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{monitor.controlName} · {monitor.framework} · {monitor.controlObjective}</div>
                        </div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Owner</div><div>{monitor.owner}</div></div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Frequency</div><div>{monitor.frequency}</div></div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Last Run</div><div>{monitor.lastRun ? new Date(monitor.lastRun).toLocaleDateString() : 'Not run'}</div></div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Exceptions</div><div>{monitor.exceptionCount}</div></div>
                        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {monitor.status !== 'archived' ? <Button variant="secondary" onClick={() => void toggleMonitor(monitor.id, monitor.status === 'disabled')} disabled={!canManage}>{monitor.status === 'disabled' ? 'Enable' : 'Disable'}</Button> : null}
                          {monitor.status === 'disabled' ? <Button variant="danger" onClick={() => { setArchiveTarget(monitor); setArchiveReason(''); setArchiveError(''); }} disabled={!canManage}>Archive</Button> : null}
                        </div>
                      </div>
                      {monitor.status === 'archived' ? <div style={{ marginTop: theme.spacing[3], paddingTop: theme.spacing[3], borderTop: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}><strong>Archived:</strong> {monitor.archiveReason || 'Reason unavailable'}{monitor.archivedAt ? ` · ${new Date(monitor.archivedAt).toLocaleString()}` : ''}</div> : null}
                    </Card>
                  ))}
                </div>
              )}
            </DataTableShell>
            <ControlMonitorModal open={creating} onClose={() => setCreating(false)} onSubmit={addMonitor} />
            <Modal accessibleDialog isOpen={Boolean(archiveTarget)} onClose={closeArchive} title="Archive control monitor" width="620px" footer={<><Button variant="secondary" onClick={closeArchive} disabled={archiving}>Cancel</Button><Button variant="danger" onClick={() => void submitArchive()} disabled={archiving || archiveReason.trim().length < 10}>{archiving ? 'Archiving...' : 'Archive monitor'}</Button></>}>
              <fieldset disabled={archiving} aria-busy={archiving} style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: theme.spacing[3] }}>
                <p style={{ margin: 0 }}>Archive <strong>{archiveTarget?.name}</strong> without deleting its test runs, exceptions, remediation history, or audit events. This action cannot be reversed.</p>
                <label style={{ display: 'grid', gap: theme.spacing[2] }}>Archive reason<textarea rows={4} maxLength={1000} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} required /></label>
                <div style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.sm }}>{archiveReason.trim().length}/1000 characters · minimum 10</div>
                {archiveError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{archiveError}</div> : null}
              </fieldset>
            </Modal>
          </>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceTests() {
  const [selectedTest, setSelectedTest] = useState<AutomatedTest | null>(null);
  return (
    <ContinuousAssuranceScaffold title="Automated Tests" description="Build, schedule, run, and review automated control tests with retest and manual override support.">
      {({ state, workspaceId, role, reload }) => {
        const tests = state!.tests;
        const canRun = canPerformContinuousAssuranceAction(role, 'run_automated_tests');
        const reviewTest = async (testId: string, input: { status: 'passed' | 'failed' | 'warning' | 'not_applicable'; summary: string; details: string; evidenceIds: string[] }) => {
          if (!workspaceId) throw new Error('Select a workspace before recording a test result.');
          await runAutomatedTest(workspaceId, role, testId, input);
          await reload();
        };
        return (
          <>
            <PageToolbar actions={<Badge variant="default" size="sm">Tests are created with their control monitor</Badge>}>
              <Badge variant="default" size="sm">{tests.filter((test) => test.lastResult === 'failed').length} failed</Badge>
            </PageToolbar>
            <PageSectionCard title="Failed Test Queue" subtitle="Queue failed tests for retest or justified manual override.">
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                {tests.filter((test) => test.lastResult === 'failed').length === 0 ? (
                  <EmptyStatePanel title="No failed tests" description="All current automated tests are passing or in warning state." />
                ) : tests.filter((test) => test.lastResult === 'failed').map((test) => (
                  <Card key={test.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center' }}>
                      <div>
                        <strong>{test.name}</strong>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{test.description}</div>
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Button variant="secondary" onClick={() => setSelectedTest(test)} disabled={!canRun}>Record Retest</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
            <DataTableShell title="Automated Test Catalog" subtitle="MFA, backup, access review, evidence freshness, vendor assessment, and policy tests.">
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                {tests.map((test) => (
                  <Card key={test.id} style={{ padding: theme.spacing[4] }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) repeat(3, minmax(0, 1fr)) auto', gap: theme.spacing[3], alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                          <strong>{test.name}</strong>
                          <Badge variant={toneForStatus(test.lastResult)} size="sm">{test.lastResult}</Badge>
                        </div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{test.description}</div>
                      </div>
                      <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Schedule</div><div>{test.schedule}</div></div>
                      <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Owner</div><div>{test.owner}</div></div>
                      <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Last Run</div><div>{test.lastRun ? new Date(test.lastRun).toLocaleString() : 'Not run'}</div></div>
                      <div><Button variant="secondary" onClick={() => setSelectedTest(test)} disabled={!canRun}>Record Reviewed Result</Button></div>
                    </div>
                  </Card>
                ))}
              </div>
            </DataTableShell>
            <TestResultModal test={selectedTest} onClose={() => setSelectedTest(null)} onSubmit={reviewTest} />
          </>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceEvidenceCollection() {
  return (
    <ContinuousAssuranceScaffold title="Automated Evidence Collection" description="Operate evidence jobs, preview collection output, review freshness, and re-collect missing or expired evidence.">
      {({ state }) => {
        const jobs = state!.evidenceJobs;
        return (
          <>
            <PageToolbar actions={<Badge variant="warning" size="sm">Provider integration unavailable</Badge>}>
              <Badge variant="default" size="sm">{jobs.filter((job) => job.freshnessStatus !== 'fresh').length} gaps</Badge>
            </PageToolbar>
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              {jobs.length === 0 ? (
                <EmptyStatePanel title="Automated evidence collection unavailable" description="No approved provider is configured. Evidence jobs cannot be created or represented as successful." />
              ) : jobs.map((job) => (
                <Card key={job.id} style={{ padding: theme.spacing[4] }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) repeat(4, minmax(0, 1fr)) auto', gap: theme.spacing[3], alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <strong>{job.name}</strong>
                        <Badge variant={toneForStatus(job.freshnessStatus === 'expired' ? 'high' : job.freshnessStatus === 'warning' ? 'medium' : 'low')} size="sm">{job.freshnessStatus}</Badge>
                        <Badge variant={toneForStatus(job.approvalStatus === 'rejected' ? 'high' : job.approvalStatus === 'pending' ? 'medium' : 'low')} size="sm">{job.approvalStatus}</Badge>
                      </div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{job.evidencePreview}</div>
                    </div>
                    <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Source</div><div>{job.source}</div></div>
                    <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Frequency</div><div>{job.collectionFrequency}</div></div>
                    <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Last Collected</div><div>{job.lastCollectedAt ? new Date(job.lastCollectedAt).toLocaleDateString() : 'Never'}</div></div>
                    <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Linked Controls</div><div>{job.linkedControls.join(', ') || 'None'}</div></div>
                    <div><Badge variant="warning" size="sm">Provider required</Badge></div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceExceptions() {
  const [resolving, setResolving] = useState<AssuranceException | null>(null);
  const [exceptionActionKey, setExceptionActionKey] = useState<string | null>(null);
  const [exceptionActionError, setExceptionActionError] = useState<string | null>(null);
  const exceptionActionLock = useRef<string | null>(null);

  const runExceptionAction = async (key: string, action: () => Promise<void>) => {
    if (exceptionActionLock.current) return;

    exceptionActionLock.current = key;
    setExceptionActionKey(key);
    setExceptionActionError(null);
    try {
      await action();
    } catch (error) {
      setExceptionActionError(error instanceof Error ? error.message : 'Unable to update the assurance exception.');
    } finally {
      exceptionActionLock.current = null;
      setExceptionActionKey(null);
    }
  };

  return (
    <ContinuousAssuranceScaffold title="Assurance Exceptions" description="Manage failed control tests, missing evidence, connector failures, drift alerts, and overdue assurance blockers.">
      {({ state, workspaceId, role, reload }) => {
        const exceptions = state!.exceptions;
        const canResolve = canPerformContinuousAssuranceAction(role, 'resolve_exceptions');
        return (
          <>
          {exceptionActionError ? <div role="alert" style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.semantic.dangerLight, color: theme.colors.semantic.danger }}>{exceptionActionError}</div> : null}
          <DataTableShell title="Open Exceptions" subtitle="Compact exception workflow with severity, source, linked control, framework, risk, owner, due date, and evidence.">
            {exceptions.length === 0 ? (
              <EmptyStatePanel title="No exceptions" description="No assurance exceptions are currently open in this workspace." />
            ) : (
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                {exceptions.map((item) => (
                  <Card key={item.id} style={{ padding: theme.spacing[4] }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) repeat(4, minmax(0, 1fr)) auto', gap: theme.spacing[3], alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                          <strong>{item.type}</strong>
                          <Badge variant={toneForStatus(item.severity)} size="sm">{item.severity}</Badge>
                          <Badge variant={toneForStatus(item.status)} size="sm">{item.status}</Badge>
                        </div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.source} · {item.remediationAction}</div>
                      </div>
                      <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Control</div><div>{item.linkedControlId || '—'}</div></div>
                      <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Framework</div><div>{item.linkedFramework || '—'}</div></div>
                      <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Owner</div><div>{item.owner}</div></div>
                      <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Due</div><div>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</div></div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Button variant="secondary" onClick={() => void runExceptionAction(`task:${item.id}`, async () => {
                          if (!workspaceId) throw new Error('Select a workspace before creating a remediation task.');
                          await createRemediationTask(workspaceId, role, { sourceType: 'exception', sourceId: item.id, linkedObjectLabel: item.type, title: `Resolve ${item.type}`, description: item.remediationAction, owner: item.owner, priority: item.severity, dueDate: item.dueDate || null, status: 'open', linkedObjectType: 'exception', linkedObjectId: item.id });
                          await reload();
                        })} disabled={!canResolve || Boolean(exceptionActionKey)}>{exceptionActionKey === `task:${item.id}` ? 'Creating...' : 'Create Task'}</Button>
                        <Button variant="secondary" onClick={() => {
                          if (item.status !== 'resolved') {
                            setExceptionActionError(null);
                            setResolving(item);
                            return;
                          }
                          void runExceptionAction(`reopen:${item.id}`, async () => {
                            if (!workspaceId) throw new Error('Select a workspace before reopening an exception.');
                            await updateAssuranceException(workspaceId, role, item.id, { status: 'open' });
                            await reload();
                          });
                        }} disabled={!canResolve || Boolean(exceptionActionKey)}>{exceptionActionKey === `reopen:${item.id}` ? 'Reopening...' : item.status === 'resolved' ? 'Reopen' : 'Resolve'}</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </DataTableShell>
          <ExceptionResolutionModal exception={resolving} onClose={() => setResolving(null)} onSubmit={async (id, evidenceIds, resolutionRationale) => {
            if (!workspaceId) throw new Error('Select a workspace before resolving an exception.');
            await updateAssuranceException(workspaceId, role, id, { status: 'resolved', evidenceIds, resolutionRationale });
            await reload();
          }} />
          </>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceDrift() {
  return (
    <ContinuousAssuranceScaffold title="Compliance Drift Detection" description="Provider-backed compliance and configuration drift detection is not configured.">
      {() => (
        <EmptyStatePanel
          eyebrow="Integration unavailable"
          title="No compliance drift provider configured"
          description="LAFLO will not fabricate drift events, owners, controls, evidence links, or remediation outcomes. Configure an approved provider before this workflow can be enabled."
        />
      )}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceConnectors() {
  return (
    <ContinuousAssuranceScaffold title="Connector Management" description="Connector-backed assurance sources require an approved external provider configuration.">
      {() => (
        <EmptyStatePanel
          eyebrow="Integration unavailable"
          title="No assurance connectors configured"
          description="LAFLO will not simulate connector health, sync results, or evidence collection. Configure an approved provider before this workflow can be enabled."
        />
      )}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceAnalytics() {
  return (
    <ContinuousAssuranceScaffold title="Assurance Analytics" description="Analyze monitored controls, pass/fail domains, evidence freshness, connector reliability, assurance score movement, and overdue coverage.">
      {({ state }) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[4] }}>
          <PageSectionCard title="Controls Monitored by Framework" subtitle="Framework distribution of active monitors.">
            <DistributionList items={state!.analytics.controlsByFramework.map((item) => ({ label: item.framework, value: item.count, tone: 'default' }))} />
          </PageSectionCard>
          <PageSectionCard title="Pass/Fail by Control Domain" subtitle="Failures and pass volume by framework domain.">
            <DistributionList items={state!.analytics.passFailByDomain.map((item) => ({ label: item.domain, value: item.failed, tone: item.failed > 0 ? 'danger' : 'success' }))} />
          </PageSectionCard>
          <PageSectionCard title="Evidence Freshness Trend" subtitle="Trend of evidence freshness over time.">
            <MiniTrend points={state!.analytics.evidenceFreshnessTrend} color={theme.colors.semantic.success} />
          </PageSectionCard>
          <PageSectionCard title="Connector Reliability Trend" subtitle="Connector reliability by month.">
            <MiniTrend points={state!.analytics.connectorReliabilityTrend} color={theme.colors.primary} />
          </PageSectionCard>
          <PageSectionCard title="Top Failing Controls" subtitle="Controls with the most recurring failure pressure.">
            <DistributionList items={state!.analytics.topFailingControls.map((item) => ({ label: item.control, value: item.count, tone: 'danger' }))} />
          </PageSectionCard>
          <PageSectionCard title="Coverage by Business Unit" subtitle="Assurance coverage posture across key operating groups.">
            <DistributionList items={state!.analytics.coverageByBusinessUnit.map((item) => ({ label: item.unit, value: item.coverage, tone: item.coverage < 70 ? 'warning' : 'success' }))} formatter={(value) => `${value}%`} />
          </PageSectionCard>
        </div>
      )}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceReports() {
  const reportTemplates = [
    { title: 'Continuous Assurance Report', description: 'Current monitor, test and exception posture.' },
    { title: 'Control Monitoring Report', description: 'Current monitored-control results by framework.' },
    { title: 'Failed Controls Report', description: 'Current failed-control and exception counts.' },
    { title: 'Framework Assurance Report', description: 'Current framework monitoring coverage and outcomes.' },
    { title: 'Executive Assurance Summary', description: 'Concise current assurance snapshot for management review.' },
  ];
  const operationLock = useRef(false);
  const [operation, setOperation] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const download = async (workspaceId: string, role: WorkspaceRole | null, reportId: string, format: 'json' | 'csv') => {
    if (operationLock.current) return;
    operationLock.current = true;
    setOperation(`${reportId}:${format}`);
    setFeedback('');
    try {
      const result = await downloadContinuousAssuranceReport(workspaceId, role, reportId, format);
      const bytes = Uint8Array.from(atob(result.base64), character => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setFeedback(`Prepared ${result.filename}.`);
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Unable to download assurance report.');
    } finally {
      operationLock.current = false;
      setOperation(null);
    }
  };

  return (
    <ContinuousAssuranceScaffold title="Continuous Assurance Reports" description="Generate persisted internal assurance snapshots and download them as JSON or CSV.">
      {({ state, workspaceId, role, reload }) => {
        const canGenerate = canPerformContinuousAssuranceAction(role, 'generate_assurance_reports');
        const canExport = canPerformContinuousAssuranceAction(role, 'export_assurance_reports');
        const generate = async (title: string) => {
          if (!workspaceId || operationLock.current) return;
          operationLock.current = true;
          setOperation(title);
          setFeedback('');
          try {
            await generateContinuousAssuranceReport(workspaceId, role, title);
            await reload();
            setFeedback(`${title} generated from current persisted assurance records.`);
          } catch (cause) {
            setFeedback(cause instanceof Error ? cause.message : 'Unable to generate assurance report.');
          } finally {
            operationLock.current = false;
            setOperation(null);
          }
        };
        return (
          <div style={{ display: 'grid', gap: theme.spacing[4] }}>
            {feedback ? <div role="status" aria-live="polite" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>{feedback}</div> : null}
            <PageSectionCard title="Report Templates" subtitle="Generate prebuilt continuous assurance reports for operations, audit, and executive review.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: theme.spacing[3] }}>
                {reportTemplates.map((template) => (
                  <Card key={template.title} style={{ padding: theme.spacing[4] }}>
                    <strong>{template.title}</strong>
                    <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{template.description} JSON and CSV only; no external provider is required.</div>
                    <div style={{ marginTop: theme.spacing[3] }}>
                      <Button variant="secondary" onClick={() => void generate(template.title)} disabled={!canGenerate || Boolean(operation)}>{operation === template.title ? 'Generating...' : 'Generate snapshot'}</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
            <DataTableShell title="Generated Reports" subtitle="Recent report output from the active workspace.">
              {state!.reports.length === 0 ? (
                <EmptyStatePanel title="No reports generated" description="Generate the first assurance report to build a reporting history." />
              ) : (
                <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                  {state!.reports.map((report) => (
                    <Card key={report.id} style={{ padding: theme.spacing[4] }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: theme.spacing[3], alignItems: 'center' }}>
                        <div>
                          <strong>{report.title}</strong>
                          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{report.summary}</div>
                        </div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Generated</div><div>{new Date(report.generatedAt).toLocaleDateString()}</div></div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>By</div><div>{report.generatedBy}</div></div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Formats</div><div>{report.formatSupport.join(', ')}</div></div>
                        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}><Button variant="secondary" size="sm" aria-label={`Download ${report.title} as JSON`} onClick={() => workspaceId && void download(workspaceId, role, report.id, 'json')} disabled={!canExport || Boolean(operation)}>JSON</Button><Button variant="secondary" size="sm" aria-label={`Download ${report.title} as CSV`} onClick={() => workspaceId && void download(workspaceId, role, report.id, 'csv')} disabled={!canExport || Boolean(operation)}>CSV</Button></div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </DataTableShell>
          </div>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceNotifications() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AssuranceNotification['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AssuranceNotification['type']>('all');
  const actionLock = useRef(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <ContinuousAssuranceScaffold title="Assurance Notifications" description="Review internal assurance alerts generated from persisted control-test results. External delivery is not implied.">
      {({ workspaceId, role, state, reload }) => {
        const canManage = canPerformContinuousAssuranceAction(role, 'manage_control_monitors');
        const normalizedSearch = search.trim().toLowerCase();
        const filtered = state!.notifications.filter((item) => {
          const matchesSearch = !normalizedSearch || `${item.title} ${item.detail} ${item.assignedTo || ''}`.toLowerCase().includes(normalizedSearch);
          return matchesSearch && (statusFilter === 'all' || item.status === statusFilter) && (typeFilter === 'all' || item.type === typeFilter);
        });
        const mutate = async (item: AssuranceNotification, status: 'read' | 'archived' | 'snoozed') => {
          if (actionLock.current || !workspaceId) return;
          actionLock.current = true;
          setActionId(item.id);
          setActionError(null);
          try {
            await updateAssuranceNotification(workspaceId, role, item.id, {
              status,
              snoozedUntil: status === 'snoozed' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
            });
            await reload();
          } catch (cause) {
            setActionError(cause instanceof Error ? cause.message : 'Unable to update the notification.');
          } finally {
            actionLock.current = false;
            setActionId(null);
          }
        };
        return <>
          <SummaryMetricStrip metrics={[
            { label: 'Visible alerts', value: state!.notifications.length, detail: 'Current internal history', tone: 'primary' as const },
            { label: 'Unread', value: state!.notifications.filter((item) => item.status === 'unread').length, detail: 'Requires review', tone: 'warning' as const },
            { label: 'Read', value: state!.notifications.filter((item) => item.status === 'read').length, detail: 'Reviewed alerts', tone: 'success' as const },
            { label: 'Snoozed', value: state!.notifications.filter((item) => item.status === 'snoozed').length, detail: 'Temporarily deferred', tone: 'default' as const },
            { label: 'Archived', value: state!.notifications.filter((item) => item.status === 'archived').length, detail: 'Retained history', tone: 'default' as const },
          ]} />
          <PageToolbar>
            <label style={{ display: 'grid', gap: theme.spacing[1], minWidth: 240 }}>
              <span style={{ fontSize: theme.typography.sizes.xs }}>Search notifications</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, detail, or owner" style={inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: theme.spacing[1], minWidth: 170 }}>
              <span style={{ fontSize: theme.typography.sizes.xs }}>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} style={inputStyle}>
                <option value="all">All statuses</option><option value="unread">Unread</option><option value="read">Read</option><option value="snoozed">Snoozed</option><option value="archived">Archived</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: theme.spacing[1], minWidth: 190 }}>
              <span style={{ fontSize: theme.typography.sizes.xs }}>Type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} style={inputStyle}>
                <option value="all">All types</option><option value="failed_test">Failed test</option><option value="missing_evidence">Missing evidence</option><option value="expired_evidence">Expired evidence</option><option value="review_assignment">Review assignment</option><option value="approval_request">Approval request</option><option value="risk_escalation">Risk escalation</option><option value="drift_alert">Drift alert</option><option value="connector_failure">Connector failure</option>
              </select>
            </label>
            <Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); }}>Clear filters</Button>
          </PageToolbar>
          <DataTableShell title="Internal Notification Register" subtitle={`${filtered.length} of ${state!.notifications.length} persisted notifications. Email, Teams and Slack delivery is unavailable without an approved provider.`}>
            {state!.notifications.length === 0 ? <EmptyStatePanel title="No assurance notifications" description="Reviewed failed or warning control-test results will create internal alerts when the workspace preference is enabled." /> : filtered.length === 0 ? <EmptyStatePanel title="No matching notifications" description="Clear or adjust the filters to review retained notification history." actions={<Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); }}>Clear filters</Button>} /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                  <thead><tr>{['Notification','Type','Severity','Status','Assigned to','Created','Actions'].map((label) => <th key={label} scope="col" style={{ textAlign: 'left', padding: theme.spacing[3], borderBottom: `1px solid ${theme.colors.border}` }}>{label}</th>)}</tr></thead>
                  <tbody>{filtered.map((item) => <tr key={item.id}>
                    <td style={{ padding: theme.spacing[3], borderBottom: `1px solid ${theme.colors.borderLight}` }}><strong>{item.title}</strong><div style={{ marginTop: theme.spacing[1], color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>{item.detail}</div></td>
                    <td style={{ padding: theme.spacing[3], borderBottom: `1px solid ${theme.colors.borderLight}` }}>{item.type.replaceAll('_', ' ')}</td>
                    <td style={{ padding: theme.spacing[3], borderBottom: `1px solid ${theme.colors.borderLight}` }}><Badge variant={toneForStatus(item.severity)} size="sm">{item.severity}</Badge></td>
                    <td style={{ padding: theme.spacing[3], borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                      <Badge variant={toneForStatus(item.status)} size="sm">{item.status}</Badge>
                      {item.status === 'snoozed' && item.snoozedUntil ? <div style={{ marginTop: theme.spacing[1], color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs, whiteSpace: 'nowrap' }}>Until {new Date(item.snoozedUntil).toLocaleString()}</div> : null}
                    </td>
                    <td style={{ padding: theme.spacing[3], borderBottom: `1px solid ${theme.colors.borderLight}` }}>{item.assignedTo || 'Unassigned'}</td>
                    <td style={{ padding: theme.spacing[3], borderBottom: `1px solid ${theme.colors.borderLight}`, whiteSpace: 'nowrap' }}>{new Date(item.createdAt).toLocaleString()}</td>
                    <td style={{ padding: theme.spacing[3], borderBottom: `1px solid ${theme.colors.borderLight}` }}><div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      <Button variant="outline" size="sm" onClick={() => navigate('/continuous-assurance/tests')}>Open test register</Button>
                      {canManage && (item.status === 'unread' || item.status === 'snoozed') ? <Button variant="secondary" size="sm" onClick={() => void mutate(item, 'read')} disabled={Boolean(actionId)}>{item.status === 'snoozed' ? 'Resume and mark read' : 'Mark read'}</Button> : null}
                      {canManage && item.status !== 'archived' && item.status !== 'snoozed' ? <Button variant="secondary" size="sm" onClick={() => void mutate(item, 'snoozed')} disabled={Boolean(actionId)}>Snooze 24h</Button> : null}
                      {canManage && item.status !== 'archived' ? <Button variant="outline" size="sm" onClick={() => void mutate(item, 'archived')} disabled={Boolean(actionId)}>Archive</Button> : null}
                    </div></td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
            {actionError ? <div role="alert" style={{ marginTop: theme.spacing[3], color: theme.colors.semantic.danger }}>{actionError}</div> : null}
          </DataTableShell>
        </>;
      }}
    </ContinuousAssuranceScaffold>
  );
}

function AssuranceSettingsForm({
  settings,
  workspaceId,
  role,
  reload,
}: {
  settings: AssuranceSetting;
  workspaceId: string | null;
  role: WorkspaceRole | null;
  reload: () => Promise<void>;
}) {
  const canManage = canPerformContinuousAssuranceAction(role, 'manage_control_monitors');
  const saveLock = useRef(false);
  const [frequency, setFrequency] = useState(settings.defaultTestFrequency);
  const [freshnessDays, setFreshnessDays] = useState(String(settings.evidenceFreshnessPeriodDays));
  const [driftSeverity, setDriftSeverity] = useState<Severity>(settings.driftSeverityThreshold);
  const [exceptionSlaDays, setExceptionSlaDays] = useState(String(settings.exceptionSlaDays));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const syncFromSettings = useCallback(() => {
    setFrequency(settings.defaultTestFrequency);
    setFreshnessDays(String(settings.evidenceFreshnessPeriodDays));
    setDriftSeverity(settings.driftSeverityThreshold);
    setExceptionSlaDays(String(settings.exceptionSlaDays));
  }, [settings.defaultTestFrequency, settings.driftSeverityThreshold, settings.evidenceFreshnessPeriodDays, settings.exceptionSlaDays]);

  useEffect(() => syncFromSettings(), [syncFromSettings]);

  const reset = useCallback(() => {
    syncFromSettings();
    setMessage(null);
  }, [syncFromSettings]);

  const dirty = frequency !== settings.defaultTestFrequency
    || freshnessDays !== String(settings.evidenceFreshnessPeriodDays)
    || driftSeverity !== settings.driftSeverityThreshold
    || exceptionSlaDays !== String(settings.exceptionSlaDays);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveLock.current || !workspaceId || !canManage) return;
    const normalizedFrequency = frequency.trim();
    const parsedFreshness = Number(freshnessDays);
    const parsedSla = Number(exceptionSlaDays);
    if (!normalizedFrequency || normalizedFrequency.length > 100) {
      setMessage({ tone: 'danger', text: 'Default test frequency must be between 1 and 100 characters.' });
      return;
    }
    if (!Number.isInteger(parsedFreshness) || parsedFreshness < 1 || parsedFreshness > 3650) {
      setMessage({ tone: 'danger', text: 'Evidence freshness must be a whole number between 1 and 3650 days.' });
      return;
    }
    if (!Number.isInteger(parsedSla) || parsedSla < 1 || parsedSla > 3650) {
      setMessage({ tone: 'danger', text: 'Exception SLA must be a whole number between 1 and 3650 days.' });
      return;
    }
    saveLock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await updateContinuousAssuranceSettings(workspaceId, role, {
        defaultTestFrequency: normalizedFrequency,
        evidenceFreshnessPeriodDays: parsedFreshness,
        driftSeverityThreshold: driftSeverity,
        exceptionSlaDays: parsedSla,
      });
      await reload();
      setMessage({ tone: 'success', text: 'Continuous assurance settings saved.' });
    } catch (cause) {
      setMessage({ tone: 'danger', text: cause instanceof Error ? cause.message : 'Unable to save continuous assurance settings.' });
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void save(event)}>
      <fieldset disabled={busy || !canManage} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[4] }}>
          <label style={{ display: 'grid', gap: theme.spacing[2] }}>
            <span>Default test frequency</span>
            <input value={frequency} onChange={(event) => setFrequency(event.target.value)} maxLength={100} required style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: theme.spacing[2] }}>
            <span>Evidence freshness period (days)</span>
            <input type="number" min={1} max={3650} step={1} value={freshnessDays} onChange={(event) => setFreshnessDays(event.target.value)} required style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: theme.spacing[2] }}>
            <span>Drift severity threshold</span>
            <select value={driftSeverity} onChange={(event) => setDriftSeverity(event.target.value as Severity)} style={inputStyle}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: theme.spacing[2] }}>
            <span>Exception SLA (days)</span>
            <input type="number" min={1} max={3650} step={1} value={exceptionSlaDays} onChange={(event) => setExceptionSlaDays(event.target.value)} required style={inputStyle} />
          </label>
        </div>
      </fieldset>
      <div style={{ marginTop: theme.spacing[4], display: 'flex', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
        <Button type="submit" variant="primary" disabled={busy || !workspaceId || !canManage || !dirty}>{busy ? 'Saving...' : 'Save settings'}</Button>
        <Button type="button" variant="secondary" onClick={reset} disabled={busy || !dirty}>Reset</Button>
        {!canManage ? <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>You have read-only access to assurance settings.</span> : null}
      </div>
      {message ? <div role={message.tone === 'danger' ? 'alert' : 'status'} style={{ marginTop: theme.spacing[3], color: message.tone === 'danger' ? theme.colors.semantic.danger : theme.colors.semantic.success }}>{message.text}</div> : null}
    </form>
  );
}

export function ContinuousAssuranceSettings() {
  const { workspaceId } = useWorkspace();
  const { role } = useAuth();
  const preferenceLock = useRef(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  return (
    <ContinuousAssuranceScaffold title="Continuous Assurance Settings" description="Review test cadence, evidence freshness thresholds, drift severity, exception SLA, notifications, and connector sync availability.">
      {({ state, reload }) => {
        const settings = state!.settings;
        const canConfigureNotifications = canPerformContinuousAssuranceAction(role, 'manage_control_monitors');
        const failedTestEnabled = state!.notificationPreferences.find((item) => item.channel === 'in_app' && item.type === 'failed_test')?.enabled ?? true;
        const toggleFailedTestNotifications = async () => {
          if (preferenceLock.current || !workspaceId) return;
          preferenceLock.current = true;
          setPreferenceBusy(true);
          setPreferenceError(null);
          try {
            await updateNotificationPreference(workspaceId, role, 'in_app', 'failed_test', !failedTestEnabled);
            await reload();
          } catch (cause) {
            setPreferenceError(cause instanceof Error ? cause.message : 'Unable to update the in-app notification preference.');
          } finally {
            preferenceLock.current = false;
            setPreferenceBusy(false);
          }
        };
        return (
          <PageSectionCard title="Assurance Settings" subtitle="Current thresholds and provider-dependent automation availability.">
            <AssuranceSettingsForm settings={settings} workspaceId={workspaceId} role={role} reload={reload} />
            <div style={{ marginTop: theme.spacing[5], paddingTop: theme.spacing[4], borderTop: `1px solid ${theme.colors.borderLight}` }}>
              <h3 style={{ margin: 0, fontSize: theme.typography.sizes.base }}>Provider-dependent settings</h3>
              <p style={{ margin: `${theme.spacing[1]} 0 ${theme.spacing[3]}`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>These values remain read-only until an approved connector or delivery provider is configured.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[4] }}>
              <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                <span>Connector sync frequency</span>
                <input value={settings.connectorSyncFrequency} style={inputStyle} readOnly />
              </label>
              <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                <span>Notification rules</span>
                <input value={settings.notificationRules.join(', ') || 'No provider-backed rules configured'} style={inputStyle} readOnly />
              </label>
              </div>
            </div>
            <div style={{ marginTop: theme.spacing[4], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Badge variant={settings.autoCreateRemediationTask ? 'success' : 'default'} size="sm">Auto-create remediation {settings.autoCreateRemediationTask ? 'enabled' : 'disabled'}</Badge>
              <Badge variant={settings.autoLinkEvidence ? 'success' : 'default'} size="sm">Auto-link evidence {settings.autoLinkEvidence ? 'enabled' : 'disabled'}</Badge>
              <Button variant="secondary" size="sm" onClick={() => void toggleFailedTestNotifications()} disabled={preferenceBusy || !workspaceId || !canConfigureNotifications}>
                Failed-test in-app alerts: {failedTestEnabled ? 'On' : 'Off'}
              </Button>
              <Badge variant="warning" size="sm">Automation unavailable until an approved provider is configured. Email, Teams and Slack delivery require an approved provider.</Badge>
            </div>
            {preferenceError ? <div role="alert" style={{ marginTop: theme.spacing[3], color: theme.colors.semantic.danger }}>{preferenceError}</div> : null}
          </PageSectionCard>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}
