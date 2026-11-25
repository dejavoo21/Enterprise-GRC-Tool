import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  ControlGovernanceSummary,
  DataTableShell,
  EmptyStatePanel,
  Modal,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  RegulatoryEntryModal,
  SummaryMetricStrip,
} from '../components';
import { createRegulatoryChange, createRegulatoryObligation, createRegulatoryRequirement, createRegulatoryTask, decideRegulatoryChange, fetchRegulatoryWorkspaceState, runRegulatoryImpactAssessment, submitRegulatoryChange, updateRegulatoryTaskStatus } from '../lib/api';
import type { RegulatoryEntryKind } from '../components/RegulatoryEntryModal';
import { theme } from '../theme';
import type {
  ChangeSeverity,
  RegulatoryAlert,
  RegulatoryChangeLogEntry,
  RegulatoryObligation,
  RegulatoryWorkspaceState,
  TaskStatus,
} from '../types/regulatory';

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

const severityBadge: Record<ChangeSeverity, 'default' | 'warning' | 'danger' | 'success'> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

const obligationBadge: Record<RegulatoryObligation['status'], 'default' | 'warning' | 'danger' | 'success'> = {
  open: 'default',
  in_progress: 'warning',
  compliant: 'success',
  at_risk: 'warning',
  overdue: 'danger',
};

const taskBadge: Record<TaskStatus, 'default' | 'warning' | 'danger' | 'success'> = {
  open: 'default',
  in_progress: 'warning',
  blocked: 'danger',
  completed: 'success',
  overdue: 'danger',
};

const alertBadge: Record<RegulatoryAlert['status'], 'default' | 'warning' | 'danger' | 'success'> = {
  open: 'warning',
  acknowledged: 'default',
  resolved: 'success',
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not scheduled';
}

function MiniBarList({
  items,
  labelKey,
  valueKey,
}: {
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
}) {
  const maxValue = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);
  return (
    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
      {items.map((item, index) => (
        <div key={`${item[labelKey]}-${index}`} style={{ display: 'grid', gap: theme.spacing[1] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
            <span style={{ color: theme.colors.text.main }}>{String(item[labelKey])}</span>
            <span style={{ color: theme.colors.text.secondary }}>{item[valueKey]}</span>
          </div>
          <div style={{ width: '100%', height: 8, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceHover, overflow: 'hidden' }}>
            <div style={{ width: `${(Number(item[valueKey]) / maxValue) * 100}%`, height: '100%', backgroundColor: theme.colors.primary }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RegulatoryChangeManagement() {
  const [searchParams] = useSearchParams();
  const taskFilter = searchParams.get('task');
  const [state, setState] = useState<RegulatoryWorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [entryKind, setEntryKind] = useState<RegulatoryEntryKind | null>(null);
  const [selectedObligation, setSelectedObligation] = useState<RegulatoryObligation | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{ change: RegulatoryChangeLogEntry; decision: 'approved' | 'rejected' } | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRegulatoryWorkspaceState();
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load regulatory workspace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const filteredRequirements = useMemo(() => {
    if (!state) return [];
    const term = search.trim().toLowerCase();
    if (!term) return state.requirements;
    return state.requirements.filter((item) =>
      [item.requirementId, item.regulationName, item.title, item.jurisdiction, item.owner].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [search, state]);

  const topChanges = useMemo(() => state?.changes.slice(0, 5) || [], [state]);
  const recentImpacts = useMemo(() => state?.impacts.slice(0, 4) || [], [state]);
  const topAlerts = useMemo(() => state?.alerts.slice(0, 5) || [], [state]);
  const selectedTask = useMemo(() => state?.tasks.find((task) => task.id === taskFilter) ?? null, [state, taskFilter]);
  const visibleTasks = useMemo(() => {
    if (!state) return [];
    if (!selectedTask) return state.tasks.slice(0, 8);
    return [selectedTask, ...state.tasks.filter((task) => task.id !== selectedTask.id)].slice(0, 8);
  }, [selectedTask, state]);

  const metrics = useMemo(() => {
    if (!state) return [];
    return [
      { label: 'Total Regulations', value: state.dashboard.totalRegulations, detail: 'Register coverage in scope', tone: 'primary' as const },
      { label: 'Active Obligations', value: state.dashboard.activeObligations, detail: 'Open follow-through required', tone: 'warning' as const },
      { label: 'New Changes', value: state.dashboard.newRegulatoryChanges, detail: 'Last 30 days', tone: 'default' as const },
      { label: 'Pending Reviews', value: state.dashboard.pendingReviews, detail: 'Awaiting reviewer decisions', tone: 'warning' as const },
      { label: 'Overdue Actions', value: state.dashboard.overdueActions, detail: 'Escalation needed', tone: 'danger' as const },
      { label: 'High Impact Changes', value: state.dashboard.highImpactChanges, detail: 'Requires leadership attention', tone: 'danger' as const },
      { label: 'Compliance Exposure', value: state.dashboard.complianceExposure === null ? 'Not assessed' : `${state.dashboard.complianceExposure}%`, detail: 'At-risk obligations ratio', tone: 'warning' as const },
      { label: 'Upcoming Deadlines', value: state.dashboard.upcomingDeadlines, detail: 'Next 30 days', tone: 'success' as const },
    ];
  }, [state]);

  const runImpact = async (change: RegulatoryChangeLogEntry) => {
    try {
      setBusyAction(change.id);
      await runRegulatoryImpactAssessment(change.id);
      await loadState();
    } finally {
      setBusyAction(null);
    }
  };

  const saveEntry = async (payload: Record<string, unknown>) => {
    if (entryKind === 'requirement') await createRegulatoryRequirement(payload);
    if (entryKind === 'change') await createRegulatoryChange(payload);
    if (entryKind === 'obligation') await createRegulatoryObligation(payload);
    if (entryKind === 'task') await createRegulatoryTask(payload);
    await loadState();
  };

  const transitionChange = async (change: RegulatoryChangeLogEntry) => {
    setBusyAction(change.id);
    try {
      await submitRegulatoryChange(change.id);
      await loadState();
    } finally { setBusyAction(null); }
  };

  const openDecision = (change: RegulatoryChangeLogEntry, decision: 'approved' | 'rejected') => {
    setDecisionTarget({ change, decision });
    setDecisionNotes('');
    setDecisionError(null);
  };

  const confirmDecision = async () => {
    if (!decisionTarget || decisionNotes.trim().length < 3) return;
    setBusyAction(decisionTarget.change.id);
    setDecisionError(null);
    try {
      await decideRegulatoryChange(decisionTarget.change.id, decisionTarget.decision, decisionNotes.trim());
      await loadState();
      setDecisionTarget(null);
      setDecisionNotes('');
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Unable to record the regulatory decision.');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Regulatory Change Management" description="Track legal obligations, regulatory changes, and enterprise compliance impact." />
        <Card style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
          Building the regulatory intelligence workspace...
        </Card>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Regulatory Change Management" description="Track legal obligations, regulatory changes, and enterprise compliance impact." />
        <EmptyStatePanel
          eyebrow="Regulatory Workspace"
          title="The regulatory workspace is unavailable"
          description={error || 'No regulatory data is available yet.'}
          actions={<Button variant="primary" onClick={loadState}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Regulatory Change Management"
        description="Continuously track regulatory requirements, obligations, change impact, and compliance exposure across the enterprise."
        action={
          <>
            <Button variant="outline" onClick={loadState}>Refresh</Button>
            <Button variant="secondary" onClick={() => setEntryKind('obligation')}>Add Obligation</Button>
            <Button variant="primary" onClick={() => setEntryKind('change')}>Log Change</Button>
          </>
        }
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={
          <>
            <Button variant="secondary" onClick={() => setEntryKind('requirement')}>Add Regulation</Button>
            <Button variant="secondary" onClick={() => setEntryKind('task')} disabled={!state.changes.length}>Add Action</Button>
            <Button variant="primary" onClick={() => topChanges[0] && runImpact(topChanges[0])} disabled={!topChanges[0] || busyAction === topChanges[0]?.id}>
              {busyAction === topChanges[0]?.id ? 'Modelling...' : 'Generate Impact Index'}
            </Button>
          </>
        }
      >
        <input
          type="search"
          placeholder="Search requirements, jurisdictions, owners"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, minWidth: 260 }}
        />
      </PageToolbar>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[4] }}>
        <PageSectionCard title="Regulatory Trend Graph" subtitle="Recent change volume and obligation follow-through.">
          <MiniBarList
            items={state.dashboard.trendPoints.map((point) => ({ label: point.label, value: point.changes + point.obligations }))}
            labelKey="label"
            valueKey="value"
          />
        </PageSectionCard>
        <PageSectionCard title="Obligation Status" subtitle="Live distribution across the obligations repository.">
          <MiniBarList items={state.dashboard.obligationStatusChart.map((item) => ({ label: item.status.replace('_', ' '), value: item.count }))} labelKey="label" valueKey="value" />
        </PageSectionCard>
        <PageSectionCard title="Executive Summary" subtitle="Board-ready talking points and exposure highlights.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {state.dashboard.executiveSummary.map((item) => (
              <Card key={item} style={{ padding: theme.spacing[3], minWidth: 0, backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item}</div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <DataTableShell
          title="Legal & Regulatory Register"
          subtitle="Central register of requirements, clauses, jurisdictions, owners, and linked controls."
          action={<Badge variant="default" size="sm">{filteredRequirements.length} requirements</Badge>}
        >
          {filteredRequirements.length === 0 ? (
            <EmptyStatePanel title="No regulatory requirements yet" description="No reviewed requirements have been recorded for this workspace." />
          ) : (
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                  <th style={{ padding: `${theme.spacing[2]} 0` }}>Requirement ID</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Regulation</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Title</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Jurisdiction</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Owner</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Ratings</th>
                  <th style={{ padding: `${theme.spacing[2]} 0` }}>Review Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequirements.slice(0, 14).map((item) => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                    <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
                      <div style={cellClampStyle} title={item.requirementId}>{item.requirementId}</div>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                      <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                        <strong style={cellClampStyle}>{item.regulationName}</strong>
                        <span style={{ ...cellClampStyle, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.regulator}</span>
                      </div>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      <div style={cellClampStyle} title={item.title}>{item.title}</div>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>
                      <Badge variant="default" size="sm">{item.jurisdiction}</Badge>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      <div style={cellClampStyle}>{item.owner}</div>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>
                      <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                        <span>Compliance {item.complianceRating ?? 'Not assessed'}</span>
                        <span>Risk {item.riskRating ?? 'Not assessed'}</span>
                      </div>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      {formatDate(item.reviewDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataTableShell>

        <PageSectionCard title="Jurisdiction Breakdown" subtitle="Applicable regulatory footprint by country and regulator.">
          <MiniBarList items={state.dashboard.jurisdictionBreakdown.map((item) => ({ label: item.jurisdiction, value: item.count }))} labelKey="label" valueKey="value" />
          <div style={{ marginTop: theme.spacing[4], display: 'grid', gap: theme.spacing[2] }}>
            {state.jurisdictions.slice(0, 4).map((item) => (
              <Card key={item.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                  <strong style={{ fontSize: theme.typography.sizes.sm }}>{item.country}</strong>
                  <Badge variant="default" size="sm">{item.complianceStatus}</Badge>
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {item.regulator} · {item.applicability}
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <DataTableShell title="Obligations Register" subtitle="Legal, contractual, regulatory, and internal obligations with due dates and evidence linkage." action={<Badge variant="warning" size="sm">{state.obligations.length} obligations</Badge>}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Obligation</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Type</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Owner</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Due Date</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Status</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Linked Controls / Policies</th>
              </tr>
            </thead>
            <tbody>
              {state.obligations.slice(0, 10).map((item) => (
                <tr
                  key={item.id}
                  tabIndex={0}
                  onClick={() => setSelectedObligation(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedObligation(item);
                    }
                  }}
                  style={{ borderTop: `1px solid ${theme.colors.border}`, cursor: 'pointer' }}
                >
                  <td style={{ padding: `${theme.spacing[3]} 0` }}>
                    <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                      <strong style={cellClampStyle}>{item.title}</strong>
                      <span style={{ ...cellClampStyle, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.description}</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                    <Badge variant="default" size="sm">{item.obligationType}</Badge>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.owner}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{formatDate(item.dueDate)}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                    <Badge variant={obligationBadge[item.status]} size="sm">{item.status.replace('_', ' ')}</Badge>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    {item.linkedControls.join(', ') || 'No controls'} · {item.linkedPolicies.join(', ') || 'No policies'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>

        <PageSectionCard title="Impact Heatmap" subtitle="Regulatory changes mapped to operational surfaces and severity.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {state.dashboard.impactHeatmap.map((item) => (
              <Card key={item.area} style={{ padding: theme.spacing[3], minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                  <strong style={{ fontSize: theme.typography.sizes.sm }}>{item.area}</strong>
                  <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
                    <Badge variant={item.severity === 'high' ? 'danger' : 'warning'} size="sm">{item.severity}</Badge>
                    <Badge variant="default" size="sm">{item.count}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      </div>

      {selectedObligation ? (
        <PageSectionCard
          title={selectedObligation.title}
          subtitle="Selected regulatory obligation and its persisted control governance context."
          action={<Button variant="ghost" onClick={() => setSelectedObligation(null)}>Close</Button>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr)', gap: theme.spacing[4] }}>
            <div style={{ display: 'grid', gap: theme.spacing[2], alignContent: 'start' }}>
              <div><strong>Owner</strong><div>{selectedObligation.owner}</div></div>
              <div><strong>Status</strong><div>{selectedObligation.status.replace('_', ' ')}</div></div>
              <div><strong>Due date</strong><div>{formatDate(selectedObligation.dueDate)}</div></div>
              <div><strong>Linked controls</strong><div>{selectedObligation.linkedControls.join(', ') || 'No controls linked'}</div></div>
              <div><strong>Linked policies</strong><div>{selectedObligation.linkedPolicies.join(', ') || 'No policies linked'}</div></div>
              <div><strong>Linked risks</strong><div>{selectedObligation.linkedRisks.join(', ') || 'No risks linked'}</div></div>
            </div>
            <div>
              <strong>RACI and SoA context</strong>
              <div style={{ marginTop: theme.spacing[3] }}>
                <ControlGovernanceSummary controlIds={selectedObligation.linkedControls} />
              </div>
            </div>
          </div>
        </PageSectionCard>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <PageSectionCard title="Regulatory Change Log" subtitle="Version history, impact assessments, reviewers, and approval posture.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {topChanges.map((change) => (
              <Card key={change.id} style={{ padding: theme.spacing[4], minWidth: 0 }}>
                <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Badge variant={severityBadge[change.severity]} size="sm">{change.severity}</Badge>
                        <Badge variant={change.approvalStatus === 'approved' ? 'success' : change.approvalStatus === 'rejected' ? 'danger' : 'warning'} size="sm">
                          {change.approvalStatus.replace('_', ' ')}
                        </Badge>
                      </div>
                      <h3 style={{ margin: `${theme.spacing[2]} 0 0 0`, fontSize: theme.typography.sizes.lg }}>{change.regulationName}</h3>
                    </div>
                    <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{formatDate(change.changeDate)}</span>
                  </div>
                  <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{change.changeSummary}</div>
                  <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{change.impactAssessment}</div>
                  <div style={{ display: 'flex', gap: theme.spacing[3], flexWrap: 'wrap', fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                    <span>Reviewer: {change.reviewer}</span>
                    <span>Version: {change.versionTag}</span>
                    <span>Actions: {change.requiredActions.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="primary" onClick={() => runImpact(change)} disabled={busyAction === change.id}>
                      {busyAction === change.id ? 'Modelling...' : 'Generate Impact Index'}
                    </Button>
                    {change.approvalStatus === 'pending' && <Button variant="secondary" onClick={() => transitionChange(change)}>Submit</Button>}
                    {change.approvalStatus === 'in_review' && <><Button variant="primary" onClick={() => openDecision(change, 'approved')}>Approve</Button><Button variant="secondary" onClick={() => openDecision(change, 'rejected')}>Reject</Button></>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard title="Impact Prioritisation" subtitle="Deterministic index calculated from recorded severity and linked records; this is not an observed risk score.">
          {recentImpacts.length === 0 ? (
            <EmptyStatePanel title="No impact indices yet" description="Generate a modelled index from a change log entry to support prioritisation." />
          ) : (
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              {recentImpacts.map((impact) => (
                <Card key={impact.id} style={{ padding: theme.spacing[4], minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <strong>Modelled Impact Index {impact.impactScore}</strong>
                    <Badge variant={severityBadge[impact.severity]} size="sm">{impact.priority}</Badge>
                  </div>
                  <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    <div>Controls: {impact.affectedControls.join(', ') || 'None'}</div>
                    <div>Policies: {impact.affectedPolicies.join(', ') || 'None'}</div>
                    <div>Risks: {impact.affectedRisks.join(', ') || 'None'}</div>
                    <div>Vendors / Assets: {(impact.affectedVendors.length + impact.affectedAssets.length)} in scope</div>
                    <div>Required actions: {impact.requiredActions.join(', ')}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <PageSectionCard title="Workflow Engine & Task Management" subtitle="Review assignment, impact assessment, control updates, policy updates, validation, and closure.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {taskFilter && !selectedTask ? (
              <EmptyStatePanel title="Regulatory task unavailable" description="This task is not available in the current workspace or permitted scope." />
            ) : null}
            {visibleTasks.map((task) => (
              <Card key={task.id} style={{ padding: theme.spacing[3], minWidth: 0, borderColor: task.id === taskFilter ? theme.colors.primary : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: theme.typography.sizes.sm }}>{task.title}</strong>
                  <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
                    {task.id === taskFilter ? <Badge variant="default" size="sm">Selected task</Badge> : null}
                    <Badge variant={taskBadge[task.status]} size="sm">{task.status.replace('_', ' ')}</Badge>
                  </div>
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {task.workflowStage} · {task.owner} · Due {formatDate(task.dueDate)}
                </div>
                <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2] }}>
                  {task.status === 'open' && <Button size="sm" variant="secondary" onClick={async () => { await updateRegulatoryTaskStatus(task.id, 'in_progress'); await loadState(); }}>Start</Button>}
                  {(task.status === 'in_progress' || task.status === 'overdue') && <Button size="sm" variant="primary" onClick={async () => { await updateRegulatoryTaskStatus(task.id, 'completed'); await loadState(); }}>Complete</Button>}
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard title="Mapping Engine & Reporting Center" subtitle="Trace regulation to requirement, control, evidence, risk, and reporting packs.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Framework Mapping Coverage</div>
              <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
                {state.dashboard.frameworkCoverage.map((item) => (
                  <div key={item.framework} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
                    <span>{item.framework}</span>
                    <Badge variant="default" size="sm">{item.mappedRequirements}</Badge>
                  </div>
                ))}
              </div>
            </Card>
            <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reporting Center</div>
              <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>Regulatory Change Report</div>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>Obligations Report</div>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>Compliance Impact Report</div>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>Board / Executive Summary</div>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>Regulatory Readiness Pack</div>
              </div>
            </Card>
            <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supported Regulations</div>
              <div style={{ marginTop: theme.spacing[3], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                {Array.from(new Set(state.requirements.map((item) => item.regulationName))).map((name) => (
                  <Badge key={name} variant="default" size="sm">{name}</Badge>
                ))}
              </div>
            </Card>
          </div>
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <PageSectionCard title="Regulatory Alerts" subtitle="New regulations, due reviews, evidence gaps, and compliance risk warnings.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {topAlerts.map((alert) => (
              <Card key={alert.id} style={{ padding: theme.spacing[3], minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: theme.typography.sizes.sm }}>{alert.title}</strong>
                  <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
                    <Badge variant={severityBadge[alert.severity]} size="sm">{alert.severity}</Badge>
                    <Badge variant={alertBadge[alert.status]} size="sm">{alert.status}</Badge>
                  </div>
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {alert.message}
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                  Due {formatDate(alert.dueDate)}
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard title="Workflow Engine" subtitle="Volume by regulatory workflow stage from intake through closure.">
          <MiniBarList
            items={state.workflowStages.map((item) => ({ label: item.stage, value: item.count }))}
            labelKey="label"
            valueKey="value"
          />
        </PageSectionCard>

        <PageSectionCard title="Executive View" subtitle="Board-level exposure summary for leadership reporting.">
          <div style={{ display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Regulatory exposure</span><strong>{state.executiveView.regulatoryExposureScore ?? 'Not assessed'}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Compliance exposure</span><strong>{state.executiveView.complianceExposureScore === null ? 'Not assessed' : `${state.executiveView.complianceExposureScore}%`}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>High-impact changes</span><strong>{state.executiveView.highImpactChanges}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Open actions</span><strong>{state.executiveView.openActions}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Upcoming deadlines</span><strong>{state.executiveView.upcomingDeadlines}</strong></div>
            <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              {state.executiveView.topJurisdictions.map((item) => (
                <Badge key={item.jurisdiction} variant="default" size="sm">{item.jurisdiction} {item.count}</Badge>
              ))}
            </div>
          </div>
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[4] }}>
        <PageSectionCard title="Policy Impact Analysis" subtitle="Policies affected, update backlog, approvals, and version tracking.">
          <div style={{ display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            <div>Policies affected: {state.policyImpact.affectedPolicies.join(', ') || 'None'}</div>
            <div>Policies requiring updates: {state.policyImpact.policiesRequiringUpdates.join(', ') || 'None'}</div>
            <div>Policies overdue for review: {state.policyImpact.policiesOverdueForReview.join(', ') || 'None'}</div>
            <div>Approval workflows pending: {state.policyImpact.approvalWorkflowsPending}</div>
            <div>Tracked versions: {state.policyImpact.versionTrackingCount}</div>
          </div>
        </PageSectionCard>

        <PageSectionCard title="Control Impact Analysis" subtitle="Control owners, effectiveness posture, gaps, and remediation actions.">
          <div style={{ display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            <div>Controls affected: {state.controlImpact.affectedControls.join(', ') || 'None'}</div>
            <div>Control owners: {state.controlImpact.controlOwners.join(', ') || 'None'}</div>
            <div>Average recorded compliance rating: {state.controlImpact.controlEffectivenessAverage ?? 'Not assessed'}</div>
            <div>Control gaps: {state.controlImpact.controlGaps.join(', ') || 'None'}</div>
            <div>Required remediation: {state.controlImpact.requiredRemediation.join(', ') || 'None'}</div>
          </div>
        </PageSectionCard>

        <PageSectionCard title="Risk Impact Analysis" subtitle="New and modified risks, appetite shifts, thresholds, and treatment actions.">
          <div style={{ display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            <div>New risks: {state.riskImpact.newRisks.join(', ') || 'No created risk records'}</div>
            <div>Modified risks: {state.riskImpact.modifiedRisks.join(', ') || 'No recorded risk changes'}</div>
            <div>Residual changes: {state.riskImpact.residualRiskChanges.map((item) => `${item.riskId} ${item.change >= 0 ? '+' : ''}${item.change}`).join(', ') || 'Not assessed'}</div>
            <div>Appetite impact: {state.riskImpact.appetiteImpacts.join(' ') || 'Not assessed'}</div>
            <div>Threshold impact: {state.riskImpact.thresholdImpacts.join(' ') || 'Not assessed'}</div>
            <div>Treatment actions: {state.riskImpact.treatmentActions.join(', ') || 'None'}</div>
          </div>
        </PageSectionCard>
      </div>

      <PageSectionCard title="Regulatory Reference Catalogue" subtitle="Reference names available when recording requirements; these are not active obligations until saved in the register.">
        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          {state.supportedRegulations.map((name) => (
            <Badge key={name} variant="default" size="sm">{name}</Badge>
          ))}
        </div>
      </PageSectionCard>
      <RegulatoryEntryModal kind={entryKind} isOpen={entryKind !== null} requirements={state.requirements} changes={state.changes} onClose={() => setEntryKind(null)} onSubmit={saveEntry} />
      <Modal
        accessibleDialog
        isOpen={Boolean(decisionTarget)}
        onClose={() => { if (!busyAction) { setDecisionTarget(null); setDecisionNotes(''); setDecisionError(null); } }}
        title={decisionTarget ? `${decisionTarget.decision === 'approved' ? 'Approve' : 'Reject'} regulatory change` : 'Review regulatory change'}
        width="620px"
        footer={<><Button variant="secondary" onClick={() => { setDecisionTarget(null); setDecisionNotes(''); setDecisionError(null); }} disabled={Boolean(busyAction)}>Cancel</Button><Button variant={decisionTarget?.decision === 'rejected' ? 'danger' : 'primary'} onClick={() => void confirmDecision()} disabled={Boolean(busyAction) || decisionNotes.trim().length < 3}>{busyAction ? 'Saving...' : 'Record decision'}</Button></>}
      >
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          <p style={{ margin: 0, color: theme.colors.text.secondary }}>Record the reviewer rationale. The existing independent-review rule remains enforced by the server.</p>
          <label htmlFor="regulatory-decision-notes" style={{ display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
            Review notes
            <textarea id="regulatory-decision-notes" rows={5} required autoFocus value={decisionNotes} onChange={(event) => setDecisionNotes(event.target.value)} style={{ width: '100%', resize: 'vertical', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' }} />
          </label>
          {decisionError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{decisionError}</div> : null}
        </div>
      </Modal>
    </div>
  );
}

export default RegulatoryChangeManagement;
