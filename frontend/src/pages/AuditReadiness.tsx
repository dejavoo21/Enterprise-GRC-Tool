import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  AuditEntryModal,
} from '../components';
import {
  createAuditCorrectiveAction,
  createAuditEngagement,
  createAuditEvidenceRequest,
  createAuditFinding,
  createAuditPlanItem,
  createAuditRecommendation,
  decideAuditActionVerification,
  fetchAuditManagementState,
  submitAuditActionForVerification,
} from '../lib/api';
import type { AuditEntryKind } from '../components/AuditEntryModal';
import { useWorkspace } from '../context/WorkspaceContext';
import { getAuditAssuranceReadiness } from '../services/continuousAssurance/continuousAssurance';
import { theme } from '../theme';
import type {
  AnnualAuditPlanItem,
  AuditFindingRecord,
  AuditManagementState,
  AuditPriority,
  AuditStatus,
} from '../types/auditManagement';
import { FrameworkAssessmentScopePanel } from '../components/FrameworkAssessmentScopePanel';
import { AppliedQueryFilter } from '../components/AppliedQueryFilter';
import { updateQueryFilters } from '../lib/queryFilters';

const pageStyle = {
  maxWidth: 1400,
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

const cellClampStyle = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

const statusBadge: Record<AuditStatus, 'default' | 'warning' | 'danger' | 'success'> = {
  planned: 'default',
  scoping: 'warning',
  fieldwork: 'warning',
  reporting: 'default',
  follow_up: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const priorityBadge: Record<AuditPriority, 'default' | 'warning' | 'danger' | 'success'> = {
  low: 'success',
  medium: 'default',
  high: 'warning',
  critical: 'danger',
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not scheduled';
}

function MiniBarList({ items }: { items: Array<{ label: string; value: number }> }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'grid', gap: theme.spacing[1] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
            <span style={{ color: theme.colors.text.main }}>{item.label}</span>
            <span style={{ color: theme.colors.text.secondary }}>{item.value}</span>
          </div>
          <div style={{ width: '100%', height: 8, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceHover, overflow: 'hidden' }}>
            <div style={{ width: `${(item.value / maxValue) * 100}%`, height: '100%', backgroundColor: theme.colors.primary }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditReadiness() {
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') === 'audit-blocker' ? 'audit-blocker' : null;
  const requestFilter = searchParams.get('request');
  const actionFilter = searchParams.get('action');
  const blockerMode = Boolean(typeFilter);
  const { workspaceId } = useWorkspace();
  const activeWorkspaceId=workspaceId||'';
  const [state, setState] = useState<AuditManagementState | null>(null);
  const [stateWorkspaceId, setStateWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stateRequestSequence=useRef(0);
  const currentWorkspaceIdRef=useRef(activeWorkspaceId);
  currentWorkspaceIdRef.current=activeWorkspaceId;
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedActionId,setSelectedActionId]=useState<string|null>(actionFilter);
  const [verificationEvidence,setVerificationEvidence]=useState('');
  const [verificationComments,setVerificationComments]=useState('');
  const [entryKind,setEntryKind]=useState<AuditEntryKind|null>(null);
  const actionTriggerRef=useRef<HTMLElement|null>(null);
  const actionDetailRef=useRef<HTMLDivElement|null>(null);
  const verificationLock=useRef(false);
  const verificationSequence=useRef(0);
  const entrySequence=useRef(0);
  const selectedAction=state?.correctiveActions.find(item=>item.id===selectedActionId);
  const selectedEvidenceRequest=state?.evidenceRequests.find(item=>item.id===requestFilter) || null;
  const evidenceIds=verificationEvidence.split(',').map(value=>value.trim()).filter(Boolean);
  const runVerificationAction=async(action:()=>Promise<unknown>)=>{if(verificationLock.current)return;verificationLock.current=true;const sequence=++verificationSequence.current;const requestedWorkspaceId=currentWorkspaceIdRef.current;try{setBusyAction('verification');setError(null);await action();if(sequence===verificationSequence.current&&requestedWorkspaceId===currentWorkspaceIdRef.current)await loadState();}catch(err){if(sequence===verificationSequence.current&&requestedWorkspaceId===currentWorkspaceIdRef.current)setError(err instanceof Error?err.message:'Verification action failed');}finally{if(sequence===verificationSequence.current){verificationLock.current=false;if(requestedWorkspaceId===currentWorkspaceIdRef.current)setBusyAction(null);}}};
  const selectAction=(id:string,target:HTMLElement)=>{if(verificationLock.current)return;actionTriggerRef.current=target;setSelectedActionId(id);};
  const closeAction=()=>{if(busyAction||verificationLock.current)return;setSelectedActionId(null);requestAnimationFrame(()=>actionTriggerRef.current?.focus());};

  const saveEntry=async(payload:Record<string,unknown>)=>{const sequence=++entrySequence.current;const requestedWorkspaceId=currentWorkspaceIdRef.current;const reviewedEntryKind=entryKind;if(reviewedEntryKind==='plan')await createAuditPlanItem(payload);if(reviewedEntryKind==='engagement')await createAuditEngagement(payload);if(reviewedEntryKind==='finding')await createAuditFinding(payload);if(reviewedEntryKind==='recommendation')await createAuditRecommendation(payload);if(reviewedEntryKind==='action')await createAuditCorrectiveAction(payload);if(reviewedEntryKind==='evidence')await createAuditEvidenceRequest(payload);if(sequence===entrySequence.current&&requestedWorkspaceId===currentWorkspaceIdRef.current)await loadState();};

  const loadState = useCallback(async () => {
    const sequence=++stateRequestSequence.current;
    const requestedWorkspaceId=currentWorkspaceIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuditManagementState();
      if(sequence!==stateRequestSequence.current||requestedWorkspaceId!==currentWorkspaceIdRef.current)return;
      setState(data);
      setStateWorkspaceId(requestedWorkspaceId);
    } catch (err) {
      if(sequence===stateRequestSequence.current&&requestedWorkspaceId===currentWorkspaceIdRef.current){
        setStateWorkspaceId(requestedWorkspaceId);
        setError(err instanceof Error ? err.message : 'Failed to load audit command center');
      }
    } finally {
      if(sequence===stateRequestSequence.current&&requestedWorkspaceId===currentWorkspaceIdRef.current)setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sequenceRef=stateRequestSequence;
    verificationSequence.current+=1;verificationLock.current=false;entrySequence.current+=1;
    setState(null);setStateWorkspaceId('');setSearch('');setSelectedActionId(actionFilter);
    setVerificationEvidence('');setVerificationComments('');setEntryKind(null);setBusyAction(null);
    void loadState();
    return()=>{sequenceRef.current++;};
  }, [activeWorkspaceId, loadState, actionFilter]);
  useEffect(()=>{if(selectedAction)actionDetailRef.current?.focus();},[selectedAction]);

  const metrics = useMemo(() => {
    if (!state) return [];
    return [
      { label: 'Annual Audit Plan', value: state.summary.annualAuditPlan, detail: 'Planned audits in the portfolio', tone: 'default' as const },
      { label: 'Audits In Progress', value: state.summary.auditsInProgress, detail: 'Scoping, fieldwork, reporting, follow-up', tone: 'warning' as const },
      { label: 'Upcoming Audits', value: state.summary.upcomingAudits, detail: 'Next audits on the calendar', tone: 'default' as const },
      { label: 'Completed Audits', value: state.summary.completedAudits, detail: 'Closed audit engagements', tone: 'success' as const },
      { label: 'Open Findings', value: state.summary.openFindings, detail: 'Findings still requiring action', tone: 'danger' as const },
      { label: 'Overdue Findings', value: state.summary.overdueFindings, detail: 'Past target date or overdue status', tone: 'danger' as const },
      { label: 'Audit Readiness', value: `${state.summary.auditReadiness}%`, detail: 'Control testing pass posture', tone: 'warning' as const },
      { label: 'Evidence Readiness', value: `${state.summary.evidenceReadiness}%`, detail: 'Submitted or approved evidence', tone: 'success' as const },
    ];
  }, [state]);

  const filteredPlan = useMemo(() => {
    if (!state) return [];
    const term = search.trim().toLowerCase();
    if (!term) return state.annualPlan;
    return state.annualPlan.filter((item) =>
      [item.auditId, item.auditName, item.department, item.framework, item.auditor, item.owner].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  }, [search, state]);

  const blockerFindings = useMemo(
    () => state?.findings.filter((item) => item.status !== 'closed') ?? [],
    [state],
  );
  const visibleFindings = blockerMode ? blockerFindings : state?.findings ?? [];
  const blockerFindingIds = useMemo(
    () => new Set(blockerFindings.map((item) => item.id)),
    [blockerFindings],
  );
  const visibleCorrectiveActions = blockerMode
    ? state?.correctiveActions.filter((item) => blockerFindingIds.has(item.findingRecordId)) ?? []
    : state?.correctiveActions ?? [];

  if (loading || stateWorkspaceId !== activeWorkspaceId) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Audit Command Center" description="Integrated enterprise audit management across planning, fieldwork, findings, remediation, and reporting." />
        <Card style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
          Loading audit command center...
        </Card>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Audit Command Center" description="Integrated enterprise audit management across planning, fieldwork, findings, remediation, and reporting." />
        <EmptyStatePanel
          eyebrow="Audit Command Center"
          title="The audit workspace is unavailable"
          description={error || 'No audit management data is available yet.'}
          actions={<Button variant="primary" onClick={loadState}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Audit Command Center"
        description="Run internal, external, certification, regulatory, supplier, operational, and AI audits from one enterprise audit management platform."
        action={
          <>
            <Button variant="outline" onClick={loadState}>Refresh</Button>
            <Button variant="secondary" onClick={()=>setEntryKind('evidence')} disabled={!state.engagements.length}>Request Evidence</Button>
            <Button variant="primary" onClick={()=>setEntryKind('plan')}>Add Audit</Button>
          </>
        }
      />

      {typeFilter ? <AppliedQueryFilter label="Audit blockers" description={`Showing ${visibleFindings.length} open audit finding${visibleFindings.length === 1 ? '' : 's'} and their linked corrective actions.`} onRemove={() => setSearchParams(updateQueryFilters(searchParams, { type: null }))} /> : null}

      <SummaryMetricStrip metrics={metrics} />

      <FrameworkAssessmentScopePanel />

      {workspaceId ? (
        <PageSectionCard title="Continuous Assurance Readiness" subtitle="Audit readiness influenced by continuously monitored controls, automated evidence, failed tests, and assurance exceptions.">
          {(() => {
            const readiness = getAuditAssuranceReadiness(workspaceId);
            if (!readiness) {
              return <div style={{ color: theme.colors.text.secondary }}>Continuous assurance readiness is unavailable until the workspace assurance state loads.</div>;
            }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: theme.spacing[3] }}>
                <Card style={{ padding: theme.spacing[3] }}><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Continuously Monitored Controls</div><div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{readiness.continuouslyMonitoredControls}</div></Card>
                <Card style={{ padding: theme.spacing[3] }}><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Failed Tests</div><div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: readiness.failedTests > 0 ? theme.colors.semantic.danger : theme.colors.text.main }}>{readiness.failedTests}</div></Card>
                <Card style={{ padding: theme.spacing[3] }}><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Automated Evidence Available</div><div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{readiness.availableAutomatedEvidence}</div></Card>
                <Card style={{ padding: theme.spacing[3] }}><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Exceptions Affecting Readiness</div><div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: readiness.auditReadinessExceptions > 0 ? theme.colors.semantic.warning : theme.colors.text.main }}>{readiness.auditReadinessExceptions}</div></Card>
              </div>
            );
          })()}
        </PageSectionCard>
      ) : null}

      <PageToolbar
        actions={
          <>
            <Button variant="secondary" onClick={()=>setEntryKind('engagement')} disabled={!state.annualPlan.length}>Add Engagement</Button>
            <Button variant="secondary" onClick={()=>setEntryKind('finding')} disabled={!state.engagements.length}>Raise Finding</Button>
            <Button variant="secondary" onClick={()=>setEntryKind('recommendation')} disabled={!state.findings.length}>Add Recommendation</Button>
            <Button variant="secondary" onClick={()=>setEntryKind('action')} disabled={!state.findings.length}>Add Corrective Action</Button>
          </>
        }
      >
        <input
          type="search"
          aria-label="Search audits"
          placeholder="Search audits, frameworks, departments, auditors"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, minWidth: 280 }}
        />
      </PageToolbar>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: theme.spacing[4] }}>
        <PageSectionCard title="Audit Pipeline" subtitle="Planned, in-progress, completed, and follow-up workload across the annual plan.">
          <MiniBarList
            items={[
              { label: 'Planned', value: state.annualPlan.filter((item) => item.status === 'planned').length },
              { label: 'In Progress', value: state.summary.auditsInProgress },
              { label: 'Completed', value: state.summary.completedAudits },
              { label: 'Follow-up', value: state.annualPlan.filter((item) => item.status === 'follow_up').length },
            ]}
          />
        </PageSectionCard>
        <PageSectionCard title="Findings Trend" subtitle="Open, overdue, ready-for-validation, and closed finding posture.">
          <MiniBarList
            items={[
              { label: 'Open', value: state.findings.filter((item) => item.status === 'open').length },
              { label: 'In Progress', value: state.findings.filter((item) => item.status === 'in_progress').length },
              { label: 'Overdue', value: state.findings.filter((item) => item.status === 'overdue').length },
              { label: 'Closed', value: state.findings.filter((item) => item.status === 'closed').length },
            ]}
          />
        </PageSectionCard>
        <PageSectionCard title="Framework Readiness" subtitle="Readiness, open findings, and evidence posture by framework.">
          <MiniBarList items={state.frameworkReadiness.map((item) => ({ label: item.framework, value: item.readinessPercent }))} />
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: theme.spacing[4] }}>
        <DataTableShell
          title="Annual Audit Plan"
          subtitle="Internal, external, certification, regulatory, supplier, operational, and AI audit portfolio."
          action={<Badge variant="default" size="sm">{filteredPlan.length} audits</Badge>}
        >
          {filteredPlan.length === 0 ? (
            <EmptyStatePanel title="No audits planned yet" description="No reviewed annual audit plan items have been recorded for this workspace." />
          ) : (
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '13%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                  <th style={{ padding: `${theme.spacing[2]} 0` }}>Audit ID</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Audit</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Type</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Framework</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Auditor</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Window</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Status</th>
                  <th style={{ padding: `${theme.spacing[2]} 0` }}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlan.map((item: AnnualAuditPlanItem) => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                    <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{item.auditId}</td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                      <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                        <strong style={cellClampStyle}>{item.auditName}</strong>
                        <span style={{ ...cellClampStyle, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.department} · {item.owner}</span>
                      </div>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}><Badge variant="default" size="sm">{item.auditType.replace(/_/g, ' ')}</Badge></td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{item.framework}</td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.auditor}</td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{formatDate(item.startDate)} - {formatDate(item.endDate)}</td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}><Badge variant={statusBadge[item.status]} size="sm">{item.status.replace(/_/g, ' ')}</Badge></td>
                    <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={priorityBadge[item.priority]} size="sm">{item.priority}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataTableShell>

        <PageSectionCard title="Audit Calendar" subtitle="Annual, monthly, weekly, milestone, and deadline events across audit execution.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {state.calendar.slice(0, 8).map((item) => (
              <Card key={item.id} style={{ padding: theme.spacing[3], minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                  <strong style={{ fontSize: theme.typography.sizes.sm }}>{item.title}</strong>
                  <Badge variant="default" size="sm">{item.eventType}</Badge>
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {formatDate(item.eventDate)} · {item.owner}
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: theme.spacing[4] }}>
        <DataTableShell
          title="Audit Findings Management"
          subtitle="Root cause, risk, owner, target dates, validation, closure, and remediation readiness."
          action={<Badge variant="danger" size="sm">{visibleFindings.length} {blockerMode ? 'open findings' : 'findings'}</Badge>}
        >
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Finding ID</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Finding</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Root Cause</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Risk</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Owner</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Target</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleFindings.slice(0, 10).map((item: AuditFindingRecord) => (
                <tr key={item.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{item.findingId}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                    <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                      <strong style={cellClampStyle}>{item.title}</strong>
                      <span style={{ ...cellClampStyle, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.businessImpact}</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{item.rootCause}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}><Badge variant={item.riskLevel === 'critical' || item.riskLevel === 'high' ? 'danger' : item.riskLevel === 'medium' ? 'warning' : 'success'} size="sm">{item.riskLevel}</Badge></td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{item.owner}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{formatDate(item.targetDate)}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={item.status === 'closed' ? 'success' : item.status === 'overdue' ? 'danger' : 'warning'} size="sm">{item.status.replace(/_/g, ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleFindings.length === 0 ? <EmptyStatePanel eyebrow="Audit findings" title={blockerMode ? 'No open audit blockers' : 'No audit findings recorded'} description={blockerMode ? 'No persisted findings currently require remediation in this workspace.' : 'Create a finding from an existing audit engagement when an issue is identified.'} /> : null}
        </DataTableShell>

        <PageSectionCard title="Auditor Workbench" subtitle="Assigned audits, workpapers, testing, findings, evidence requests, and review queue.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <Card style={{ padding: theme.spacing[4] }}>
              <div style={{ display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Assigned audits</span><strong>{state.workbench.assignedAudits}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Open workpapers</span><strong>{state.workbench.openWorkpapers}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pending reviews</span><strong>{state.workbench.pendingReviews}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Evidence requests</span><strong>{state.workbench.evidenceRequests}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Findings in draft</span><strong>{state.workbench.findingsInDraft}</strong></div>
              </div>
            </Card>
            <Card style={{ padding: theme.spacing[4] }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Three Lines Model</div>
              <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1st Line Open Actions</span><strong>{state.threeLines.firstLineOpenActions}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2nd Line Oversight Reviews</span><strong>{state.threeLines.secondLineOversightReviews}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>3rd Line Audits</span><strong>{state.threeLines.thirdLineAudits}</strong></div>
              </div>
            </Card>
            <Card style={{ padding: theme.spacing[4] }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Audit Reporting</div>
              <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
                <div>{state.reporting.availableReports.slice(0, 4).join(' · ')}</div>
                <div>Board pack: {state.reporting.boardPackStatus}</div>
                <div>Certification: {state.reporting.certificationStatus}</div>
              </div>
            </Card>
          </div>
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: theme.spacing[4] }}>
        <PageSectionCard title="Management Action Tracker" subtitle="Recommendations, corrective actions, dependencies, progress, verification, and closure.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {visibleCorrectiveActions.slice(0, 8).map((item) => (
              <div key={item.id} role="button" tabIndex={0} onClick={event=>selectAction(item.id,event.currentTarget)} onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectAction(item.id,event.currentTarget);}}} style={{ minWidth: 0, cursor:'pointer', outline:selectedActionId===item.id?`2px solid ${theme.colors.primary}`:'none', borderRadius:theme.borderRadius.lg }}>
              <Card style={{ padding: theme.spacing[3], minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                  <strong style={{ fontSize: theme.typography.sizes.sm }}>{item.actionTitle}</strong>
                  <Badge variant={item.progressPercent >= 100 ? 'success' : item.progressPercent >= 50 ? 'warning' : 'default'} size="sm">{item.progressPercent}%</Badge>
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {item.owner} · Due {formatDate(item.deadline)} · {item.closureStatus} · {item.verification}
                </div>
              </Card>
              </div>
            ))}
            {visibleCorrectiveActions.length === 0 ? <EmptyStatePanel eyebrow="Management actions" title={blockerMode ? 'No corrective actions linked to open findings' : 'No corrective actions recorded'} description={blockerMode ? 'Open findings remain visible above; add a corrective action only when accountable remediation has been agreed.' : 'Create a corrective action from a persisted audit finding.'} /> : null}
            {selectedAction&&<div ref={actionDetailRef} role="dialog" aria-modal="false" aria-labelledby="audit-action-detail-title" aria-busy={busyAction==='verification'} tabIndex={-1} onKeyDown={event=>{if(event.key==='Escape'&&!busyAction&&!verificationLock.current){event.stopPropagation();closeAction();}}}><Card style={{padding:theme.spacing[4],display:'grid',gap:theme.spacing[3]}}><div style={{display:'flex',justifyContent:'space-between',gap:theme.spacing[3],flexWrap:'wrap'}}><div><strong id="audit-action-detail-title">{selectedAction.actionTitle}</strong><div style={{fontSize:theme.typography.sizes.xs,color:theme.colors.text.secondary}}>CAP {selectedAction.id} · Finding {selectedAction.findingRecordId}</div></div><Button variant="outline" disabled={busyAction==='verification'} onClick={event=>{event.stopPropagation();closeAction();}}>Close</Button></div><dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,140px),1fr))',gap:theme.spacing[2],margin:0}}><div><dt>Owner</dt><dd>{selectedAction.owner}</dd></div><div><dt>Due</dt><dd>{formatDate(selectedAction.deadline)}</dd></div><div><dt>Closure</dt><dd>{selectedAction.closureStatus}</dd></div></dl><fieldset disabled={busyAction==='verification'} style={{display:'contents'}}><label htmlFor="audit-verification-evidence">Evidence IDs (comma separated)<input id="audit-verification-evidence" value={verificationEvidence} onChange={event=>setVerificationEvidence(event.target.value)} placeholder="Select persisted evidence references"/></label><label htmlFor="audit-verification-comments">Reviewer comments<textarea id="audit-verification-comments" value={verificationComments} onChange={event=>setVerificationComments(event.target.value)} placeholder="Record review rationale"/></label><div style={{display:'flex',flexWrap:'wrap',gap:theme.spacing[2]}}>{selectedAction.closureStatus!=='Awaiting Verification'&&selectedAction.closureStatus!=='Verified Closed'&&<Button disabled={!evidenceIds.length||busyAction==='verification'} onClick={()=>void runVerificationAction(()=>submitAuditActionForVerification(selectedAction.id,evidenceIds))}>{busyAction==='verification'?'Submitting...':'Submit completion evidence'}</Button>}{selectedAction.closureStatus==='Awaiting Verification'&&<><Button disabled={!evidenceIds.length||verificationComments.trim().length<3||busyAction==='verification'} onClick={()=>void runVerificationAction(()=>decideAuditActionVerification(selectedAction.id,{outcome:'verified_closed',method:'Evidence review',comments:verificationComments,evidenceIds}))}>{busyAction==='verification'?'Saving decision...':'Verify and close'}</Button><Button variant="outline" disabled={verificationComments.trim().length<3||busyAction==='verification'} onClick={()=>void runVerificationAction(()=>decideAuditActionVerification(selectedAction.id,{outcome:'changes_required',method:'Evidence review',comments:verificationComments,evidenceIds}))}>Request changes</Button><Button variant="danger" disabled={verificationComments.trim().length<3||busyAction==='verification'} onClick={()=>void runVerificationAction(()=>decideAuditActionVerification(selectedAction.id,{outcome:'reopened',method:'Evidence review',comments:verificationComments,evidenceIds}))}>Reopen</Button></>}</div></fieldset><p style={{margin:0,fontSize:theme.typography.sizes.xs,color:theme.colors.text.secondary}}>Action completion does not close the finding. A different authorised reviewer must verify the evidence.</p></Card></div>}{actionFilter && !selectedAction ? <EmptyStatePanel title="Corrective action unavailable" description="The requested corrective action is not available in this workspace or no longer exists." /> : null}
          </div>
        </PageSectionCard>

        <PageSectionCard title="Evidence Center & Analytics" subtitle="Evidence requests, reuse, expired items, and audit analytics by department and framework.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <Card style={{ padding: theme.spacing[4] }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evidence Center</div>
              <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Requested</span><strong>{state.evidenceRequests.filter((item) => item.status === 'requested').length}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Submitted</span><strong>{state.evidenceRequests.filter((item) => item.status === 'submitted').length}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Approved</span><strong>{state.evidenceRequests.filter((item) => item.status === 'approved').length}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Expired</span><strong>{state.evidenceRequests.filter((item) => item.status === 'expired').length}</strong></div>
              </div>
            </Card>
            <DataTableShell title="Evidence requests" subtitle={`${state.evidenceRequests.length} persisted audit requests`}>
              <table>
                <thead><tr><th scope="col">Request</th><th scope="col">Owner</th><th scope="col">Due date</th><th scope="col">Status</th></tr></thead>
                <tbody>{state.evidenceRequests.map((item) => <tr key={item.id}><th scope="row"><button type="button" onClick={() => setSearchParams(updateQueryFilters(searchParams, { request: item.id }))}>{item.requestTitle}</button><small style={{ display: 'block' }}>{item.id}</small></th><td>{item.owner}</td><td>{formatDate(item.dueDate)}</td><td><Badge variant={item.status === 'approved' ? 'success' : item.status === 'expired' ? 'danger' : 'warning'}>{item.status}</Badge></td></tr>)}</tbody>
              </table>
            </DataTableShell>
            {selectedEvidenceRequest ? <Card style={{ padding: theme.spacing[4], display: 'grid', gap: theme.spacing[3] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: theme.spacing[3] }}><div><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Selected evidence request</div><h3 style={{ margin: `${theme.spacing[1]} 0` }}>{selectedEvidenceRequest.requestTitle}</h3><span>{selectedEvidenceRequest.id}</span></div><Button variant="outline" onClick={() => setSearchParams(updateQueryFilters(searchParams, { request: null }))}>Close</Button></div>
              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: theme.spacing[3], margin: 0 }}><div><dt>Owner</dt><dd>{selectedEvidenceRequest.owner}</dd></div><div><dt>Due date</dt><dd>{formatDate(selectedEvidenceRequest.dueDate)}</dd></div><div><dt>Status</dt><dd>{selectedEvidenceRequest.status}</dd></div><div><dt>Engagement</dt><dd>{selectedEvidenceRequest.engagementId}</dd></div><div><dt>Linked evidence</dt><dd>{selectedEvidenceRequest.linkedEvidence.join(', ') || 'None linked'}</dd></div><div><dt>Reuse count</dt><dd>{selectedEvidenceRequest.evidenceReuseCount}</dd></div></dl>
            </Card> : requestFilter ? <EmptyStatePanel title="Evidence request unavailable" description="The requested record is not available in this workspace or no longer exists." /> : null}
            <Card style={{ padding: theme.spacing[4] }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Audit Analytics</div>
              <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
                <div>Repeat findings: {state.analytics.repeatFindings}</div>
                <div>Audit effectiveness: {state.analytics.auditEffectiveness}%</div>
                <div>Auditor productivity: {state.analytics.auditorProductivity} hrs average</div>
                <div>Top risk areas: {state.analytics.topRiskAreas.join(', ')}</div>
              </div>
            </Card>
          </div>
        </PageSectionCard>
      </div>

      <AuditEntryModal
        kind={entryKind}
        open={entryKind !== null}
        state={state}
        onClose={() => setEntryKind(null)}
        onSubmit={saveEntry}
      />
    </div>
  );
}
