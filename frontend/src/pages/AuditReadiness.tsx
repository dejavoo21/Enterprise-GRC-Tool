import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  createAuditCorrectiveAction,
  createAuditEngagement,
  createAuditEvidenceRequest,
  createAuditFinding,
  createAuditPlanItem,
  createAuditRecommendation,
  createAuditWorkpaper,
  fetchAuditManagementState,
} from '../lib/api';
import { theme } from '../theme';
import type {
  AnnualAuditPlanItem,
  AuditFindingRecord,
  AuditManagementState,
  AuditPriority,
  AuditStatus,
} from '../types/auditManagement';

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
  const [state, setState] = useState<AuditManagementState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuditManagementState();
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit command center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

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

  const addAudit = async () => {
    try {
      setBusyAction('plan');
      const planItem = await createAuditPlanItem({
        auditId: `AUD-${Date.now().toString().slice(-5)}`,
        auditName: 'New Internal Audit',
        auditType: 'internal_audit',
        department: 'Corporate',
        framework: 'Custom',
        auditor: 'Internal Auditor',
        startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 20 * 86400000).toISOString(),
        status: 'planned',
        priority: 'medium',
        riskRating: 65,
        budget: 15000,
        hours: 80,
        owner: 'Audit Manager',
      });
      await createAuditEngagement({
        planItemId: planItem.id,
        auditName: planItem.auditName,
        auditType: planItem.auditType,
        objectives: ['Confirm design and operating effectiveness'],
        scope: ['Controls', 'Evidence', 'Policies'],
        outOfScope: ['Archived systems'],
        auditCriteria: [planItem.framework],
        auditFramework: planItem.framework,
        riskAreas: ['Access control', 'Monitoring'],
        testingStrategy: 'Risk-based testing',
        samplingApproach: 'Targeted high-risk sample',
        leadAuditor: planItem.auditor,
        status: 'scoping',
      });
      await loadState();
    } finally {
      setBusyAction(null);
    }
  };

  const raiseFinding = async () => {
    if (!state?.engagements[0]) return;
    try {
      setBusyAction('finding');
      const finding = await createAuditFinding({
        engagementId: state.engagements[0].id,
        findingId: `FND-${Date.now().toString().slice(-4)}`,
        title: 'Control evidence not available for sample',
        description: 'Evidence request was not fulfilled within the audit timeline.',
        rootCause: 'Documentation',
        riskLevel: 'high',
        businessImpact: 'Reduces certification and management assurance.',
        owner: 'Business Owner',
        targetDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        status: 'open',
        validationStatus: 'Pending validation',
      });
      await createAuditRecommendation({
        findingRecordId: finding.id,
        recommendation: 'Establish evidence submission cadence and assign backup owners.',
        owner: finding.owner,
        priority: 'high',
        dueDate: new Date(Date.now() + 21 * 86400000).toISOString(),
        status: 'open',
        completionPercent: 0,
        evidenceOfClosure: [],
      });
      await createAuditCorrectiveAction({
        findingRecordId: finding.id,
        actionTitle: 'Close evidence collection gap',
        owner: finding.owner,
        deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
        dependencies: ['Evidence owner assignment', 'Repository update'],
        progressPercent: 10,
        verification: 'Pending internal audit verification',
        closureStatus: 'Open',
      });
      await loadState();
    } finally {
      setBusyAction(null);
    }
  };

  const addEvidenceRequest = async () => {
    if (!state?.engagements[0]) return;
    try {
      setBusyAction('evidence');
      await createAuditEvidenceRequest({
        engagementId: state.engagements[0].id,
        requestTitle: 'Quarterly audit evidence refresh',
        owner: 'Control Owner',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'requested',
        evidenceReuseCount: 1,
        linkedEvidence: ['EVID-001'],
      });
      await createAuditWorkpaper({
        engagementId: state.engagements[0].id,
        title: 'Evidence request workpaper',
        testingProcedures: ['Request updated evidence', 'Validate completeness'],
        samplingNotes: 'Focused on highest-risk controls.',
        evidenceCollection: ['EVID-001'],
        notes: 'Evidence refresh initiated.',
        observations: ['Awaiting evidence upload'],
        attachments: ['request-note.docx'],
        reviewerSignoff: null,
        versionTag: 'v1.0',
      });
      await loadState();
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
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
            <Button variant="secondary" onClick={() => void addEvidenceRequest()} disabled={busyAction === 'evidence'}>
              {busyAction === 'evidence' ? 'Adding...' : 'Request Evidence'}
            </Button>
            <Button variant="primary" onClick={() => void addAudit()} disabled={busyAction === 'plan'}>
              {busyAction === 'plan' ? 'Creating...' : 'Add Audit'}
            </Button>
          </>
        }
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={
          <>
            <Button variant="secondary" onClick={() => void raiseFinding()} disabled={busyAction === 'finding'}>
              {busyAction === 'finding' ? 'Raising...' : 'Raise Finding'}
            </Button>
          </>
        }
      >
        <input
          type="search"
          placeholder="Search audits, frameworks, departments, auditors"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, minWidth: 280 }}
        />
      </PageToolbar>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[4] }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <DataTableShell
          title="Annual Audit Plan"
          subtitle="Internal, external, certification, regulatory, supplier, operational, and AI audit portfolio."
          action={<Badge variant="default" size="sm">{filteredPlan.length} audits</Badge>}
        >
          {filteredPlan.length === 0 ? (
            <EmptyStatePanel title="No audits planned yet" description="Create the first annual audit plan item to start the audit calendar and engagement flow." actions={<Button variant="primary" onClick={() => void addAudit()}>Add Audit</Button>} />
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <DataTableShell
          title="Audit Findings Management"
          subtitle="Root cause, risk, owner, target dates, validation, closure, and remediation readiness."
          action={<Badge variant="danger" size="sm">{state.findings.length} findings</Badge>}
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
              {state.findings.slice(0, 10).map((item: AuditFindingRecord) => (
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <PageSectionCard title="Management Action Tracker" subtitle="Recommendations, corrective actions, dependencies, progress, verification, and closure.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {state.correctiveActions.slice(0, 8).map((item) => (
              <Card key={item.id} style={{ padding: theme.spacing[3], minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                  <strong style={{ fontSize: theme.typography.sizes.sm }}>{item.actionTitle}</strong>
                  <Badge variant={item.progressPercent >= 100 ? 'success' : item.progressPercent >= 50 ? 'warning' : 'default'} size="sm">{item.progressPercent}%</Badge>
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {item.owner} · Due {formatDate(item.deadline)} · {item.verification}
                </div>
              </Card>
            ))}
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
    </div>
  );
}
