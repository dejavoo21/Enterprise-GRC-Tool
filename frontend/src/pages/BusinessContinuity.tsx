import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityFeed,
  BcmEntryModal,
  BcmCorrectiveActionClosureModal,
  type BcmEntryKind,
  Badge,
  Button,
  Card,
  ControlGovernanceSummary,
  DataTableShell,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  StepUpVerificationModal,
  SummaryMetricStrip,
} from '../components';
import {
  approveBcmRecoveryPlan,
  createBcmBiaProcess,
  createBcmCrisisEvent,
  createBcmCorrectiveAction,
  createBcmCriticalService,
  createBcmDependency,
  createBcmExercise,
  createBcmRecoveryPlan,
  createBcmResilienceScenario,
  fetchBusinessContinuityState,
  generateBcmReport,
  submitBcmRecoveryPlan,
  closeBcmCorrectiveAction,
  transitionBcmCorrectiveAction,
} from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { theme } from '../theme';
import type {
  BcmCriticality,
  BcmReportType,
  BiaProcessRecord,
  BusinessContinuityState,
  BcmCorrectiveActionRecord,
  RecoveryPlanRecord,
} from '../types/resilience';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

function criticalityVariant(criticality: BcmCriticality) {
  switch (criticality) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'primary';
    default:
      return 'default';
  }
}

function statusVariant(status: string) {
  if (status === 'approved' || status === 'completed' || status === 'active') return 'success';
  if (status === 'critical' || status === 'declared' || status === 'degraded') return 'danger';
  if (status === 'in_review' || status === 'planned' || status === 'monitoring') return 'warning';
  return 'default';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
}

function avg(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatPercent(value: number | null) {
  return value === null ? 'Not assessed' : `${value}%`;
}

export function BusinessContinuity() {
  const { currentWorkspace } = useWorkspace();
  const [state, setState] = useState<BusinessContinuityState | null>(null);
  const [stateWorkspaceId, setStateWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const actionLock = useRef(false);
  const actionSequence = useRef(0);
  const stateRequestSequence = useRef(0);
  const currentWorkspaceIdRef = useRef(currentWorkspace.id);
  const stateWorkspaceIdRef = useRef('');
  currentWorkspaceIdRef.current = currentWorkspace.id;
  const [approvalTarget, setApprovalTarget] = useState<RecoveryPlanRecord | null>(null);
  const [entryKind, setEntryKind] = useState<BcmEntryKind | null>(null);
  const [closureTarget, setClosureTarget] = useState<BcmCorrectiveActionRecord | null>(null);
  const [selectedBia, setSelectedBia] = useState<BiaProcessRecord | null>(null);

  const loadState = useCallback(async () => {
    const sequence = ++stateRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const nextState = await fetchBusinessContinuityState();
      if (sequence !== stateRequestSequence.current || requestedWorkspaceId !== currentWorkspaceIdRef.current) return;
      setState(nextState);
      stateWorkspaceIdRef.current = requestedWorkspaceId;
      setStateWorkspaceId(requestedWorkspaceId);
    } catch (err) {
      if (sequence === stateRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) {
        if (stateWorkspaceIdRef.current !== requestedWorkspaceId) setState(null);
        stateWorkspaceIdRef.current = requestedWorkspaceId;
        setStateWorkspaceId(requestedWorkspaceId);
        setError(err instanceof Error ? err.message : 'Unable to load business continuity state');
      }
    } finally {
      if (sequence === stateRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const sequenceRef = stateRequestSequence;
    actionSequence.current += 1;
    actionLock.current = false;
    setWorking(null);
    setApprovalTarget(null);
    setEntryKind(null);
    setClosureTarget(null);
    setSelectedBia(null);
    void loadState();
    return () => { sequenceRef.current++; };
  }, [currentWorkspace.id, loadState]);

  const metrics = useMemo(() => {
    if (!state) {
      return [
        { label: 'Critical Processes', value: 0, detail: 'Loading continuity posture', tone: 'default' as const },
        { label: 'Recovery Plans', value: 0, detail: 'Loading', tone: 'default' as const },
        { label: 'Exercises', value: 0, detail: 'Loading', tone: 'default' as const },
        { label: 'Recovery Readiness', value: '0%', detail: 'Loading', tone: 'warning' as const },
        { label: 'Resilience Score', value: 0, detail: 'Loading', tone: 'primary' as const },
      ];
    }
    return [
      { label: 'Critical Processes', value: state.summary.criticalProcesses, detail: `${state.biaProcesses.length} BIA records in scope`, tone: 'danger' as const },
      { label: 'Recovery Plans', value: state.summary.recoveryPlans, detail: `${state.criticalServices.length} critical services mapped`, tone: 'primary' as const },
      { label: 'Exercises', value: state.summary.recoveryExercises, detail: state.summary.testingStatus === null ? 'Testing completion not assessed' : `${state.summary.testingStatus}% testing completion`, tone: state.summary.testingStatus !== null && state.summary.testingStatus >= 75 ? 'success' as const : 'warning' as const },
      { label: 'Recovery Readiness', value: formatPercent(state.summary.recoveryReadiness), detail: state.summary.recoveryCoverage === null ? 'Service recovery coverage not assessed' : `${state.summary.recoveryCoverage}% service recovery coverage`, tone: state.summary.recoveryReadiness !== null && state.summary.recoveryReadiness >= 75 ? 'success' as const : 'warning' as const },
      { label: 'Resilience Score', value: state.summary.resilienceScore ?? 'Not assessed', detail: `${state.summary.openRisks} linked open risks`, tone: state.summary.resilienceScore !== null && state.summary.resilienceScore >= 75 ? 'success' as const : 'warning' as const },
    ];
  }, [state]);

  const handleAction = async (key: string, action: () => Promise<void>, propagateError = false) => {
    if (actionLock.current) return false;
    actionLock.current = true;
    const sequence = ++actionSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setWorking(key);
      await action();
      if (sequence !== actionSequence.current || requestedWorkspaceId !== currentWorkspaceIdRef.current) return false;
      await loadState();
      return sequence === actionSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current;
    } catch (err) {
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) {
        setError(err instanceof Error ? err.message : 'Action failed');
        if (propagateError) throw err;
      }
      return false;
    } finally {
      if (sequence === actionSequence.current) {
        actionLock.current = false;
        if (requestedWorkspaceId === currentWorkspaceIdRef.current) setWorking(null);
      }
    }
  };

  const createEntry = async (kind: BcmEntryKind, payload: Record<string, unknown>) => {
    await handleAction(`create-${kind}`, async () => {
      if (kind === 'bia') await createBcmBiaProcess(payload);
      else if (kind === 'service') await createBcmCriticalService(payload);
      else if (kind === 'plan') await createBcmRecoveryPlan(payload);
      else if (kind === 'exercise') await createBcmExercise(payload);
      else if (kind === 'corrective') await createBcmCorrectiveAction(payload);
      else if (kind === 'crisis') await createBcmCrisisEvent(payload);
      else if (kind === 'dependency') await createBcmDependency(payload);
      else await createBcmResilienceScenario(payload);
    }, true);
  };

  const transitionCorrective = async (action: BcmCorrectiveActionRecord, status: BcmCorrectiveActionRecord['status']) => {
    await handleAction(`corrective-${action.id}-${status}`, async () => { await transitionBcmCorrectiveAction(action.id, status); });
  };

  const closeCorrective = async (evidenceIds: string[], closureNotes: string) => {
    if (!closureTarget) return;
    await handleAction(`corrective-${closureTarget.id}-close`, async () => { await closeBcmCorrectiveAction(closureTarget.id, evidenceIds, closureNotes); }, true);
  };

  const generateReport = async (reportType: BcmReportType) => {
    await generateBcmReport(reportType);
  };

  const handleApprovePlan = async (stepUpToken?: string) => {
    if (!approvalTarget) return;
    const approved = await handleAction(`approve-${approvalTarget.id}`, async () => {
      await approveBcmRecoveryPlan(approvalTarget.id, stepUpToken);
    }, true);
    if (approved) setApprovalTarget(null);
  };

  const submitPlan = async (plan: RecoveryPlanRecord) => {
    await handleAction(`submit-${plan.id}`, async () => { await submitBcmRecoveryPlan(plan.id); });
  };

  const dependencyCoverage = useMemo(() => {
    if (!state) return [];
    return [
      { label: 'Process -> Application', value: state.dependencies.filter((item) => item.sourceType === 'process' && item.targetType === 'application').length },
      { label: 'Application -> Asset', value: state.dependencies.filter((item) => item.sourceType === 'application' && item.targetType === 'asset').length },
      { label: 'Asset -> Vendor', value: state.dependencies.filter((item) => item.sourceType === 'asset' && item.targetType === 'vendor').length },
      { label: 'Vendor / Service -> Plan', value: state.dependencies.filter((item) => item.targetType === 'recovery_plan').length },
    ];
  }, [state]);

  const readinessByPlan = useMemo(() => (state?.recoveryPlans || []).map((plan) => plan.recoveryReadinessPercent), [state]);

  if (loading || stateWorkspaceId !== currentWorkspace.id) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Business Continuity Dashboard" description="ISO 22301-aligned continuity, disaster recovery, and operational resilience oversight." />
        <PageSectionCard title="Loading continuity program">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
            Building resilience dashboard, BIA records, and recovery coverage...
          </div>
        </PageSectionCard>
      </div>
    );
  }

  if (error && (!state || stateWorkspaceId !== currentWorkspace.id)) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Business Continuity Dashboard" description="ISO 22301-aligned continuity, disaster recovery, and operational resilience oversight." />
        <EmptyStatePanel
          eyebrow="Business Continuity"
          title="Unable to load continuity data"
          description={error}
          actions={<Button variant="primary" onClick={() => void loadState()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Business Continuity Dashboard"
        description="Coordinate BCM, disaster recovery, DORA resilience, crisis response, and testing from one integrated operating console."
        action={<Button variant="primary" onClick={() => void handleAction('report-board', () => generateReport('board_bcm_pack'))}>Generate Board BCM Pack</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={
          <>
            <Button variant="outline" onClick={() => void loadState()}>Refresh</Button>
            <Button variant="secondary" onClick={() => setEntryKind('scenario')} disabled={Boolean(working) || !state?.criticalServices.length}>New Resilience Scenario</Button>
          </>
        }
      >
        <Button variant="primary" onClick={() => setEntryKind('bia')} disabled={Boolean(working)}>Add BIA Process</Button>
        <Button variant="outline" onClick={() => setEntryKind('service')} disabled={Boolean(working)}>Register Critical Service</Button>
        <Button variant="outline" onClick={() => setEntryKind('plan')} disabled={Boolean(working)}>Create Recovery Plan</Button>
        <Button variant="outline" onClick={() => setEntryKind('exercise')} disabled={Boolean(working) || !state?.recoveryPlans.length}>Log Exercise</Button>
        <Button variant="outline" onClick={() => setEntryKind('corrective')} disabled={Boolean(working) || !state?.exercises.length}>Add Corrective Action</Button>
        <Button variant="outline" onClick={() => setEntryKind('crisis')} disabled={Boolean(working)}>Declare Crisis</Button>
        <Button variant="outline" onClick={() => setEntryKind('dependency')} disabled={Boolean(working) || !(state?.recoveryPlans.length && (state.biaProcesses.length || state.criticalServices.length))}>Map Dependency</Button>
      </PageToolbar>

      {error ? (
        <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.semantic.warningLight, color: theme.colors.text.main }}>
          {error}
        </Card>
      ) : null}

      {state ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="Recovery Readiness"
              subtitle="Current readiness, testing, and resilience indicators for the operational resilience program."
              action={<Badge variant={state.summary.resilienceScore !== null && state.summary.resilienceScore >= 75 ? 'success' : 'warning'} size="sm">{state.summary.resilienceScore === null ? 'Not assessed' : `Score ${state.summary.resilienceScore}`}</Badge>}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Recovery Coverage</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{formatPercent(state.summary.recoveryCoverage)}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Critical service recovery plan coverage</div>
                </Card>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Testing Status</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{formatPercent(state.summary.testingStatus)}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Exercises completed versus planned</div>
                </Card>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Average Plan Readiness</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{formatPercent(avg(readinessByPlan))}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Across technology, cyber, vendor, and crisis plans</div>
                </Card>
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="Dependency Mapping"
              subtitle="Relationship engine showing continuity coverage across process, application, asset, vendor, and plan layers."
              action={<Badge variant="default" size="sm">{state.dependencies.length} links</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {dependencyCoverage.map((item) => (
                  <Card key={item.label} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item.label}</div>
                      <Badge variant="primary" size="sm">{item.value}</Badge>
                    </div>
                  </Card>
                ))}
                {state.dependencies.slice(0, 4).map((dependency) => (
                  <div key={dependency.id} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    {dependency.sourceName} <strong style={{ color: theme.colors.text.main }}>→</strong> {dependency.targetName}
                  </div>
                ))}
              </div>
            </PageSectionCard>
          </div>

          <DataTableShell
            title="Business Impact Analysis"
            subtitle="Critical process register with business-unit ownership, impact severity, dependencies, and RTO/RPO gap posture."
            action={<Badge variant="default" size="sm">{state.biaProcesses.length} processes</Badge>}
          >
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '21%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '25%' }} />
              </colgroup>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Process</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Criticality</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Priority</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>RTO</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>RPO</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Gap</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Dependencies</th>
                </tr>
              </thead>
              <tbody>
                {state.biaProcesses.map((process) => (
                  <tr key={process.id} tabIndex={0} onClick={() => setSelectedBia(process)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedBia(process); } }} style={{ borderTop: `1px solid ${theme.colors.borderLight}`, cursor: 'pointer' }}>
                    <td style={{ padding: theme.spacing[3], verticalAlign: 'top' }}>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{process.processName}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{process.processOwner} · {process.businessUnit}</div>
                    </td>
                    <td style={{ padding: theme.spacing[3] }}><Badge variant={criticalityVariant(process.criticality)} size="sm">{process.criticality}</Badge></td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{process.recoveryPriority.replace('_', ' ')}</td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{process.rtoHours}h target / {process.currentRecoveryTimeHours}h current</td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{process.rpoHours}h target / {process.currentDataRecoveryHours}h current</td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>
                      <Badge variant={process.currentRecoveryTimeHours > process.rtoHours || process.currentDataRecoveryHours > process.rpoHours ? 'warning' : 'success'} size="sm">
                        {(process.currentRecoveryTimeHours - process.rtoHours).toFixed(0)}h / {(process.currentDataRecoveryHours - process.rpoHours).toFixed(0)}h
                      </Badge>
                    </td>
                    <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{process.dependencies.join(', ') || 'No dependencies captured'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>

          {selectedBia ? (
            <PageSectionCard title={selectedBia.processName} subtitle="Selected BIA process and its persisted control governance context." action={<Button variant="ghost" onClick={() => setSelectedBia(null)}>Close</Button>}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr)', gap: theme.spacing[4] }}>
                <div style={{ display: 'grid', gap: theme.spacing[2], alignContent: 'start' }}>
                  <div><strong>Owner</strong><div>{selectedBia.processOwner}</div></div>
                  <div><strong>Criticality</strong><div>{selectedBia.criticality}</div></div>
                  <div><strong>Recovery priority</strong><div>{selectedBia.recoveryPriority.replace('_', ' ')}</div></div>
                  <div><strong>Linked controls</strong><div>{selectedBia.linkedControlIds.join(', ') || 'No controls linked'}</div></div>
                </div>
                <div><strong>RACI and SoA context</strong><div style={{ marginTop: theme.spacing[3] }}><ControlGovernanceSummary controlIds={selectedBia.linkedControlIds} /></div></div>
              </div>
            </PageSectionCard>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="Critical Service Register"
              subtitle="Operational resilience view of business services, DORA relevance, and recovery coverage."
              action={<Badge variant="default" size="sm">{state.criticalServices.length} services</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {state.criticalServices.map((service) => (
                  <Card key={service.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{service.serviceName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{service.owner} · {service.businessUnit}</div>
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Badge variant={criticalityVariant(service.criticality)} size="sm">{service.criticality}</Badge>
                        {service.doraRelevant ? <Badge variant="primary" size="sm">DORA</Badge> : null}
                        <Badge variant={statusVariant(service.status)} size="sm">{service.status}</Badge>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      Impact tolerance: {service.impactToleranceHours}h · Recovery coverage: {service.recoveryCoveragePercent}%
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="Operational Resilience Engine"
              subtitle="Scenario-driven impact tolerances, operating capacity, and recovery capability across critical services."
              action={<Badge variant={state.summary.resilienceScore !== null && state.summary.resilienceScore >= 75 ? 'success' : 'warning'} size="sm">{state.summary.resilienceScore === null ? 'Not assessed' : `${state.summary.resilienceScore} / 100`}</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {state.resilienceScenarios.map((scenario) => (
                  <Card key={scenario.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{scenario.title}</div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        {scenario.doraScenario ? <Badge variant="primary" size="sm">DORA</Badge> : null}
                        <Badge variant={statusVariant(scenario.status)} size="sm">{scenario.status}</Badge>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{scenario.disruptionScenario}</div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>Impact tolerance: <strong style={{ color: theme.colors.text.main }}>{scenario.impactToleranceHours}h</strong></div>
                      <div>Capacity: <strong style={{ color: theme.colors.text.main }}>{scenario.operationalCapacityPercent}%</strong></div>
                      <div>Recovery capability: <strong style={{ color: theme.colors.text.main }}>{scenario.recoveryCapabilityPercent}%</strong></div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="Recovery Plans"
              subtitle="Technology, cyber, vendor, facility, and crisis response plans with readiness, ownership, and review status."
              action={<Badge variant="default" size="sm">{state.recoveryPlans.length} plans</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {state.recoveryPlans.map((plan) => (
                  <Card key={plan.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{plan.title}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                          {plan.planType.replace(/_/g, ' ')} · Owners: {plan.owners.join(', ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Badge variant={statusVariant(plan.status)} size="sm">{plan.status}</Badge>
                        <Badge variant={plan.recoveryReadinessPercent >= 75 ? 'success' : 'warning'} size="sm">{plan.recoveryReadinessPercent}% ready</Badge>
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>RTO: <strong style={{ color: theme.colors.text.main }}>{plan.targetRtoHours}h / {plan.currentRtoHours}h</strong></div>
                      <div>RPO: <strong style={{ color: theme.colors.text.main }}>{plan.targetRpoHours}h / {plan.currentRpoHours}h</strong></div>
                      <div>Next review: <strong style={{ color: theme.colors.text.main }}>{formatDate(plan.nextReviewAt)}</strong></div>
                    </div>
                    {plan.status === 'draft' ? (
                      <div style={{ marginTop: theme.spacing[3] }}>
                        <Button variant="outline" onClick={() => void submitPlan(plan)} disabled={Boolean(working)}>Submit for review</Button>
                      </div>
                    ) : null}
                    {plan.status === 'in_review' ? <div style={{ marginTop: theme.spacing[3] }}><Button variant="outline" onClick={() => setApprovalTarget(plan)}>Approve Plan</Button></div> : null}
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <ActivityFeed
              title="Exercises and Crisis Activity"
              subtitle="Testing performance, open crisis response, and corrective-action signals."
              countLabel={`${state.exercises.length + state.crisisEvents.length} events · ${state.correctiveActions.filter((item) => item.status !== 'closed').length} open actions`}
            >
              {state.exercises.slice(0, 4).map((exercise) => (
                <Card key={exercise.id} style={{ padding: theme.spacing[3] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{exercise.title}</div>
                    <Badge variant={exercise.performanceScore >= 75 ? 'success' : 'warning'} size="sm">{exercise.performanceScore || 0}%</Badge>
                  </div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{exercise.exerciseType.replace(/_/g, ' ')} · {formatDate(exercise.exerciseDate)}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{exercise.resultSummary}</div>
                </Card>
              ))}
              {state.correctiveActions.slice(0, 6).map((action) => (
                <Card key={action.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                    <div><div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{action.title}</div><div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{action.owner} · Due {formatDate(action.dueDate)}</div></div>
                    <div style={{ display: 'flex', gap: theme.spacing[1] }}><Badge variant={criticalityVariant(action.priority)} size="sm">{action.priority}</Badge><Badge variant={statusVariant(action.status)} size="sm">{action.status.replace(/_/g, ' ')}</Badge></div>
                  </div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{action.description}</div>
                  {action.status !== 'closed' ? <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    {action.status === 'open' || action.status === 'blocked' ? <Button variant="outline" onClick={() => void transitionCorrective(action, 'in_progress')} disabled={Boolean(working)}>Start work</Button> : null}
                    {action.status === 'in_progress' ? <><Button variant="outline" onClick={() => void transitionCorrective(action, 'blocked')} disabled={Boolean(working)}>Mark blocked</Button><Button variant="outline" onClick={() => void transitionCorrective(action, 'awaiting_review')} disabled={Boolean(working)}>Submit for closure</Button></> : null}
                    {action.status === 'awaiting_review' ? <><Button variant="outline" onClick={() => void transitionCorrective(action, 'in_progress')} disabled={Boolean(working)}>Return for work</Button><Button variant="primary" onClick={() => setClosureTarget(action)} disabled={Boolean(working)}>Verify closure</Button></> : null}
                  </div> : <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Closed with {action.evidenceIds.length} evidence reference(s).</div>}
                </Card>
              ))}
              {state.crisisEvents.slice(0, 3).map((event) => (
                <Card key={event.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{event.eventTitle}</div>
                    <div style={{ display: 'flex', gap: theme.spacing[2] }}>
                      <Badge variant={criticalityVariant(event.severity as BcmCriticality)} size="sm">{event.severity}</Badge>
                      <Badge variant={statusVariant(event.status)} size="sm">{event.status}</Badge>
                    </div>
                  </div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{event.owner} · {formatDate(event.openedAt)}</div>
                </Card>
              ))}
            </ActivityFeed>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <DataTableShell
              title="BCM Compliance Mapping"
              subtitle="ISO 22301, ISO 27001, NIST, DORA, and COBIT continuity/control coverage mapped to plans and evidence."
              action={<Badge variant="default" size="sm">{state.complianceMappings.length} frameworks</Badge>}
            >
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Framework</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Coverage</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Controls</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Evidence</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Recovery Plans</th>
                  </tr>
                </thead>
                <tbody>
                  {state.complianceMappings.map((mapping) => (
                    <tr key={mapping.id} style={{ borderTop: `1px solid ${theme.colors.borderLight}` }}>
                      <td style={{ padding: theme.spacing[3] }}>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{mapping.frameworkName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{mapping.frameworkCode}</div>
                      </td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={mapping.coveragePercent >= 75 ? 'success' : 'warning'} size="sm">{mapping.coveragePercent}%</Badge></td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{mapping.mappedControlIds.length}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{mapping.mappedEvidenceIds.length}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{mapping.mappedRecoveryPlanIds.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>

            <PageSectionCard
              title="BCM Reporting"
              subtitle="Generate continuity reporting packs for executive, board, resilience, and DORA oversight."
              action={<Badge variant="default" size="sm">{state.reports.length} reports</Badge>}
            >
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', marginBottom: theme.spacing[3] }}>
                <Button variant="outline" onClick={() => void handleAction('rpt-bcm', () => generateReport('business_continuity_report'))}>Business Continuity Report</Button>
                <Button variant="outline" onClick={() => void handleAction('rpt-ready', () => generateReport('recovery_readiness_report'))}>Recovery Readiness</Button>
                <Button variant="outline" onClick={() => void handleAction('rpt-dora', () => generateReport('dora_report'))}>DORA Report</Button>
                <Button variant="outline" onClick={() => void handleAction('rpt-res', () => generateReport('operational_resilience_report'))}>Resilience Report</Button>
              </div>
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {state.reports.map((report) => (
                  <Card key={report.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{report.title}</div>
                      <Badge variant={statusVariant(report.status)} size="sm">{report.status}</Badge>
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      {report.reportType.replace(/_/g, ' ')} · {report.generatedBy} · {formatDate(report.generatedAt)}
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1] }}>
                      {report.summary.slice(0, 4).map((line) => (
                        <div key={line} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{line}</div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>
        </>
      ) : (
        <EmptyStatePanel
          eyebrow="Business Continuity"
          title="No continuity program data available"
          description="Create the first BIA process, recovery plan, or exercise to start the operational resilience program."
          actions={<Button variant="primary" onClick={() => setEntryKind('bia')}>Create First BIA Process</Button>}
        />
      )}

      <StepUpVerificationModal
        isOpen={Boolean(approvalTarget)}
        onClose={() => setApprovalTarget(null)}
        onVerified={handleApprovePlan}
        title="Approve Recovery Plan"
        description="Verify your identity before approving this recovery plan for operational use."
        purpose="change_permissions"
      />
      <BcmEntryModal kind={entryKind} state={state || { summary: { criticalProcesses: 0, recoveryPlans: 0, recoveryExercises: 0, recoveryReadiness: null, openRisks: 0, criticalDependencies: 0, thirdPartyDependencies: 0, testingStatus: null, resilienceScore: null, recoveryCoverage: null }, biaProcesses: [], criticalServices: [], recoveryPlans: [], exercises: [], correctiveActions: [], crisisEvents: [], dependencies: [], resilienceScenarios: [], complianceMappings: [], reports: [] }} onClose={() => setEntryKind(null)} onSubmit={createEntry} />
      <BcmCorrectiveActionClosureModal action={closureTarget} onClose={() => setClosureTarget(null)} onSubmit={closeCorrective} />
    </div>
  );
}
