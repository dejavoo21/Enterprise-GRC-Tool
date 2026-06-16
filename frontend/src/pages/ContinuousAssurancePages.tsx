import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTableShell,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  SummaryMetricStrip,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  acknowledgeDrift,
  canPerformContinuousAssuranceAction,
  closeDrift,
  configureConnector,
  createAutomatedTest,
  createConnector,
  createControlMonitor,
  createEvidenceCollectionJob,
  createRemediationTask,
  deleteControlMonitor,
  generateContinuousAssuranceReport,
  getContinuousAssuranceState,
  runAutomatedTest,
  runEvidenceCollectionJob,
  syncConnector,
  testConnector,
  updateAssuranceException,
  updateContinuousAssuranceSettings,
  updateControlMonitor,
  updateDriftItem,
} from '../services/continuousAssurance/continuousAssurance';
import { theme } from '../theme';
import type {
  Connector,
  ContinuousAssuranceState,
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
  return (
    <ContinuousAssuranceScaffold
      title="Continuous Assurance Overview"
      description="Live control monitoring, evidence automation, drift posture, connector health, and assurance trend visibility."
    >
      {({ state, reload }) => {
        const overview = state!.overview;
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
                    </Card>
                  ))}
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
                  <Card key={task.id} style={{ padding: theme.spacing[3] }}>
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
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceMonitors() {
  return (
    <ContinuousAssuranceScaffold title="Control Monitors" description="Manage continuous control monitors, linked controls, frameworks, owners, cadence, and evidence output.">
      {({ state, workspaceId, role, reload }) => {
        const canManage = canPerformContinuousAssuranceAction(role, 'manage_control_monitors');
        const monitors = state!.monitors;
        const addMonitor = async () => {
          if (!workspaceId) return;
          await createControlMonitor(workspaceId, role, {});
          await reload();
        };
        const toggleMonitor = async (id: string, disabled: boolean) => {
          if (!workspaceId) return;
          await updateControlMonitor(workspaceId, role, id, { status: disabled ? 'active' : 'disabled' });
          await reload();
        };
        const removeMonitor = async (id: string) => {
          if (!workspaceId) return;
          await deleteControlMonitor(workspaceId, role, id);
          await reload();
        };

        return (
          <>
            <PageToolbar actions={<Button variant="primary" onClick={() => void addMonitor()} disabled={!canManage}>Create Monitor</Button>}>
              <Badge variant="default" size="sm">{monitors.length} monitors</Badge>
            </PageToolbar>
            <DataTableShell title="Control Monitor Register" subtitle="Link monitors to controls, frameworks, and evidence requirements without horizontal overflow.">
              {monitors.length === 0 ? (
                <EmptyStatePanel title="No monitors yet" description="Create the first monitor to start continuous controls monitoring." actions={<Button variant="primary" onClick={() => void addMonitor()} disabled={!canManage}>Create Monitor</Button>} />
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
                          <Button variant="secondary" onClick={() => void toggleMonitor(monitor.id, monitor.status === 'disabled')} disabled={!canManage}>{monitor.status === 'disabled' ? 'Enable' : 'Disable'}</Button>
                          <Button variant="secondary" onClick={() => void removeMonitor(monitor.id)} disabled={!canManage}>Delete</Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </DataTableShell>
          </>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceTests() {
  return (
    <ContinuousAssuranceScaffold title="Automated Tests" description="Build, schedule, run, and review automated control tests with retest and manual override support.">
      {({ state, workspaceId, role, reload }) => {
        const tests = state!.tests;
        const canRun = canPerformContinuousAssuranceAction(role, 'run_automated_tests');
        return (
          <>
            <PageToolbar actions={<Button variant="primary" onClick={async () => { if (!workspaceId) return; await createAutomatedTest(workspaceId, role, {}); await reload(); }} disabled={!canRun}>Create Test</Button>}>
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
                        <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await runAutomatedTest(workspaceId, role, test.id, { forceStatus: 'passed', justification: 'Retest completed after corrective action.' }); await reload(); }} disabled={!canRun}>Retest</Button>
                        <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await runAutomatedTest(workspaceId, role, test.id, { forceStatus: 'warning', justification: 'Manual override recorded with justification.' }); await reload(); }} disabled={!canRun}>Manual Override</Button>
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
                      <div><Button variant="secondary" onClick={async () => { if (!workspaceId) return; await runAutomatedTest(workspaceId, role, test.id); await reload(); }} disabled={!canRun}>Run Test</Button></div>
                    </div>
                  </Card>
                ))}
              </div>
            </DataTableShell>
          </>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceEvidenceCollection() {
  return (
    <ContinuousAssuranceScaffold title="Automated Evidence Collection" description="Operate evidence jobs, preview collection output, review freshness, and re-collect missing or expired evidence.">
      {({ state, workspaceId, role, reload }) => {
        const canManage = canPerformContinuousAssuranceAction(role, 'manage_evidence_jobs');
        const jobs = state!.evidenceJobs;
        return (
          <>
            <PageToolbar actions={<Button variant="primary" onClick={async () => { if (!workspaceId) return; await createEvidenceCollectionJob(workspaceId, role, {}); await reload(); }} disabled={!canManage}>Create Evidence Job</Button>}>
              <Badge variant="default" size="sm">{jobs.filter((job) => job.freshnessStatus !== 'fresh').length} gaps</Badge>
            </PageToolbar>
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              {jobs.length === 0 ? (
                <EmptyStatePanel title="No evidence jobs" description="Configure an automated evidence collection job to start collecting artifacts." actions={<Button variant="primary" onClick={async () => { if (!workspaceId) return; await createEvidenceCollectionJob(workspaceId, role, {}); await reload(); }} disabled={!canManage}>Create Job</Button>} />
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
                    <div><Button variant="secondary" onClick={async () => { if (!workspaceId) return; await runEvidenceCollectionJob(workspaceId, role, job.id); await reload(); }} disabled={!canManage}>Re-collect</Button></div>
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
  return (
    <ContinuousAssuranceScaffold title="Assurance Exceptions" description="Manage failed control tests, missing evidence, connector failures, drift alerts, and overdue assurance blockers.">
      {({ state, workspaceId, role, reload }) => {
        const exceptions = state!.exceptions;
        const canResolve = canPerformContinuousAssuranceAction(role, 'resolve_exceptions');
        return (
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
                        <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await createRemediationTask(workspaceId, role, { sourceType: 'exception', sourceId: item.id, linkedObjectLabel: item.type, title: `Resolve ${item.type}`, description: item.remediationAction, owner: item.owner, priority: item.severity, dueDate: item.dueDate || null, status: 'open', linkedObjectType: 'exception', linkedObjectId: item.id }); await reload(); }} disabled={!canResolve}>Create Task</Button>
                        <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await updateAssuranceException(workspaceId, role, item.id, { status: item.status === 'resolved' ? 'open' : 'resolved' }); await reload(); }} disabled={!canResolve}>{item.status === 'resolved' ? 'Reopen' : 'Resolve'}</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </DataTableShell>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceDrift() {
  return (
    <ContinuousAssuranceScaffold title="Compliance Drift Detection" description="Review drift events, assign owners, acknowledge exceptions, and resolve compliance or configuration drift.">
      {({ state, workspaceId, role, reload }) => {
        const canAcknowledge = canPerformContinuousAssuranceAction(role, 'acknowledge_drift');
        return (
          <PageSectionCard title="Drift Register" subtitle="Detect control regressions, evidence expiry, connector sync failures, policy review gaps, and framework coverage changes.">
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              {state!.drift.length === 0 ? (
                <EmptyStatePanel title="No drift detected" description="The active workspace does not currently have open drift alerts." />
              ) : state!.drift.map((item) => (
                <Card key={item.id} style={{ padding: theme.spacing[4] }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) repeat(4, minmax(0, 1fr)) auto', gap: theme.spacing[3], alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <strong>{item.driftType}</strong>
                        <Badge variant={toneForStatus(item.severity)} size="sm">{item.severity}</Badge>
                        <Badge variant={toneForStatus(item.status)} size="sm">{item.status}</Badge>
                      </div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.affectedObject} · {item.recommendedAction}</div>
                    </div>
                    <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Owner</div><div>{item.owner}</div></div>
                    <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Framework</div><div>{item.linkedFramework || '—'}</div></div>
                    <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Control</div><div>{item.linkedControlId || '—'}</div></div>
                    <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Detected</div><div>{new Date(item.detectedDate).toLocaleDateString()}</div></div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await acknowledgeDrift(workspaceId, role, item.id); await reload(); }} disabled={!canAcknowledge || item.status !== 'open'}>Acknowledge</Button>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await updateDriftItem(workspaceId, role, item.id, { owner: 'Assigned Assurance Owner' }); await reload(); }} disabled={!canAcknowledge}>Assign Owner</Button>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await createRemediationTask(workspaceId, role, { sourceType: 'drift_alert', sourceId: item.id, linkedObjectLabel: item.affectedObject, title: `Resolve ${item.driftType}`, description: item.recommendation || item.recommendedAction, owner: item.owner, priority: item.severity, dueDate: new Date(Date.now() + 5 * 86400000).toISOString(), status: 'open', linkedObjectType: 'drift', linkedObjectId: item.id }); await reload(); }} disabled={!canAcknowledge}>Create Task</Button>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await updateAssuranceException(workspaceId, role, state!.exceptions[0]?.id || '', { status: 'in_progress' }).catch(() => undefined); await reload(); }} disabled={!canAcknowledge}>Create Issue</Button>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await updateDriftItem(workspaceId, role, item.id, { relatedEvidence: [...(item.relatedEvidence || []), 'EVID-LINKED-001'] }); await reload(); }} disabled={!canAcknowledge}>Link Evidence</Button>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await updateDriftItem(workspaceId, role, item.id, { relatedControls: [...(item.relatedControls || []), item.linkedControlId || 'CTRL-NEW'] }); await reload(); }} disabled={!canAcknowledge}>Link Control</Button>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await closeDrift(workspaceId, role, item.id); await reload(); }} disabled={!canAcknowledge || item.status === 'resolved'}>Close</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </PageSectionCard>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}

export function ContinuousAssuranceConnectors() {
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [tenantLabel, setTenantLabel] = useState('');
  const [authMode, setAuthMode] = useState<'oauth' | 'api_key' | 'service_principal' | 'basic' | 'custom'>('oauth');
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'sandbox'>('sandbox');

  return (
    <ContinuousAssuranceScaffold title="Connector Management" description="Configure, test, sync, and monitor connector health for Microsoft 365, cloud, identity, ticketing, and custom assurance sources.">
      {({ state, workspaceId, role, reload }) => {
        const canManage = canPerformContinuousAssuranceAction(role, 'manage_connectors');
        return (
          <>
            <PageToolbar actions={<Button variant="primary" onClick={async () => { if (!workspaceId) return; await createConnector(workspaceId, role, {}); await reload(); }} disabled={!canManage}>Add Connector</Button>}>
              <Badge variant="default" size="sm">{state!.connectors.filter((connector) => connector.connectionStatus !== 'connected').length} attention needed</Badge>
            </PageToolbar>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: theme.spacing[3] }}>
              {state!.connectors.length === 0 ? (
                <EmptyStatePanel title="No connectors configured" description="Add the first assurance connector to enable automated evidence collection and test execution." actions={<Button variant="primary" onClick={async () => { if (!workspaceId) return; await createConnector(workspaceId, role, {}); await reload(); }} disabled={!canManage}>Add Connector</Button>} />
              ) : state!.connectors.map((connector) => (
                <Card key={connector.id} style={{ padding: theme.spacing[4] }}>
                  <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <strong>{connector.name}</strong>
                      <Badge variant={toneForStatus(connector.connectionStatus)} size="sm">{connector.connectionStatus}</Badge>
                    </div>
                    <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{connector.type} · Owner: {connector.owner}</div>
                    <div style={{ display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Health</span><strong>{connector.healthStatus}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Last sync</span><strong>{connector.lastSync ? new Date(connector.lastSync).toLocaleDateString() : 'Never'}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Frequency</span><strong>{connector.syncFrequency}</strong></div>
                    </div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await testConnector(workspaceId, role, connector.id); await reload(); }} disabled={!canManage}>Test Connection</Button>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await syncConnector(workspaceId, role, connector.id); await reload(); }} disabled={!canManage}>Sync Now</Button>
                      <Button variant="secondary" onClick={() => { setSelectedConnector(connector); setTenantLabel(`${connector.name} tenant`); setAuthMode(connector.authMode || 'custom'); setEnvironment(connector.environment || 'sandbox'); }} disabled={!canManage}>Configure</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {selectedConnector ? (
              <PageSectionCard title="Connector Configuration Wizard" subtitle="Mock-safe configuration, health validation, logs, and sync history without live credentials.">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                      <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                        <span>Tenant label</span>
                        <input value={tenantLabel} onChange={(event) => setTenantLabel(event.target.value)} style={inputStyle} />
                      </label>
                      <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                        <span>Environment</span>
                        <select value={environment} onChange={(event) => setEnvironment(event.target.value as typeof environment)} style={inputStyle}>
                          <option value="production">Production</option>
                          <option value="staging">Staging</option>
                          <option value="sandbox">Sandbox</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                        <span>Authentication mode</span>
                        <select value={authMode} onChange={(event) => setAuthMode(event.target.value as typeof authMode)} style={inputStyle}>
                          <option value="oauth">OAuth</option>
                          <option value="api_key">API Key</option>
                          <option value="service_principal">Service Principal</option>
                          <option value="basic">Basic</option>
                          <option value="custom">Custom API</option>
                        </select>
                      </label>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Button variant="primary" onClick={async () => { if (!workspaceId) return; await configureConnector(workspaceId, role, selectedConnector.id, { tenantLabel, environment, authMode, scopes: ['read', 'assurance.sync'], endpoints: ['https://api.example.com', 'https://status.example.com'], notes: 'Mock-safe wizard completed.' }); await reload(); }}>Save Configuration</Button>
                        <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await testConnector(workspaceId, role, selectedConnector.id); await reload(); }}>Test Connector</Button>
                        <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await syncConnector(workspaceId, role, selectedConnector.id); await reload(); }}>Run Sync</Button>
                        <Button variant="ghost" onClick={() => setSelectedConnector(null)}>Close Wizard</Button>
                      </div>
                    </div>
                  </Card>
                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Connector Health</div>
                        <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{selectedConnector.healthStatus} · {selectedConnector.connectionStatus}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Connector Logs</div>
                        <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                          <div>Authentication profile loaded for mock-safe testing.</div>
                          <div>Endpoint reachability validated against synthetic connector target.</div>
                          <div>Last tested: {selectedConnector.lastTestedAt ? new Date(selectedConnector.lastTestedAt).toLocaleString() : 'Not tested yet'}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Sync History</div>
                        <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                          {state!.connectorSyncLogs.filter((item) => item.connectorId === selectedConnector.id).slice(0, 4).map((log) => (
                            <div key={log.id}>{new Date(log.timestamp).toLocaleString()} · {log.status} · {log.summary}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </PageSectionCard>
            ) : null}
          </>
        );
      }}
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
    'Continuous Assurance Report',
    'Control Monitoring Report',
    'Failed Controls Report',
    'Evidence Collection Report',
    'Compliance Drift Report',
    'Connector Health Report',
    'Framework Assurance Report',
    'Executive Assurance Summary',
  ];

  return (
    <ContinuousAssuranceScaffold title="Continuous Assurance Reports" description="Generate executive and operational assurance packs in PDF, Excel, or CSV-ready format.">
      {({ state, workspaceId, role, reload }) => {
        const canGenerate = canPerformContinuousAssuranceAction(role, 'generate_assurance_reports');
        return (
          <div style={{ display: 'grid', gap: theme.spacing[4] }}>
            <PageSectionCard title="Report Templates" subtitle="Generate prebuilt continuous assurance reports for operations, audit, and executive review.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: theme.spacing[3] }}>
                {reportTemplates.map((template) => (
                  <Card key={template} style={{ padding: theme.spacing[4] }}>
                    <strong>{template}</strong>
                    <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Exports PDF, Excel, and CSV from current continuous assurance data.</div>
                    <div style={{ marginTop: theme.spacing[3] }}>
                      <Button variant="secondary" onClick={async () => { if (!workspaceId) return; await generateContinuousAssuranceReport(workspaceId, role, template); await reload(); }} disabled={!canGenerate}>Generate</Button>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) repeat(3, minmax(0, 1fr))', gap: theme.spacing[3], alignItems: 'center' }}>
                        <div>
                          <strong>{report.title}</strong>
                          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{report.summary}</div>
                        </div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Generated</div><div>{new Date(report.generatedAt).toLocaleDateString()}</div></div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>By</div><div>{report.generatedBy}</div></div>
                        <div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Formats</div><div>{report.formatSupport.join(', ')}</div></div>
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

export function ContinuousAssuranceSettings() {
  return (
    <ContinuousAssuranceScaffold title="Continuous Assurance Settings" description="Configure test cadence, evidence freshness thresholds, drift severity, exception SLA, notifications, and connector sync policies.">
      {({ state, workspaceId, role, reload }) => {
        const settings = state!.settings;
        const canManage = canPerformContinuousAssuranceAction(role, 'manage_control_monitors');
        return (
          <PageSectionCard title="Automation Settings" subtitle="Compact enterprise settings for continuous controls monitoring and automated assurance.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[4] }}>
              <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                <span>Default test frequency</span>
                <input defaultValue={settings.defaultTestFrequency} style={inputStyle} readOnly />
              </label>
              <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                <span>Evidence freshness period (days)</span>
                <input defaultValue={settings.evidenceFreshnessPeriodDays} style={inputStyle} readOnly />
              </label>
              <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                <span>Drift severity threshold</span>
                <input defaultValue={settings.driftSeverityThreshold} style={inputStyle} readOnly />
              </label>
              <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                <span>Exception SLA (days)</span>
                <input defaultValue={settings.exceptionSlaDays} style={inputStyle} readOnly />
              </label>
              <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                <span>Connector sync frequency</span>
                <input defaultValue={settings.connectorSyncFrequency} style={inputStyle} readOnly />
              </label>
              <label style={{ display: 'grid', gap: theme.spacing[2] }}>
                <span>Notification rules</span>
                <input defaultValue={settings.notificationRules.join(', ')} style={inputStyle} readOnly />
              </label>
            </div>
            <div style={{ marginTop: theme.spacing[4], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Badge variant={settings.autoCreateRemediationTask ? 'success' : 'default'} size="sm">Auto-create remediation {settings.autoCreateRemediationTask ? 'enabled' : 'disabled'}</Badge>
              <Badge variant={settings.autoLinkEvidence ? 'success' : 'default'} size="sm">Auto-link evidence {settings.autoLinkEvidence ? 'enabled' : 'disabled'}</Badge>
              <Button variant="primary" onClick={async () => { if (!workspaceId) return; await updateContinuousAssuranceSettings(workspaceId, role, { autoCreateRemediationTask: !settings.autoCreateRemediationTask }); await reload(); }} disabled={!canManage}>Toggle Remediation Automation</Button>
            </div>
          </PageSectionCard>
        );
      }}
    </ContinuousAssuranceScaffold>
  );
}
