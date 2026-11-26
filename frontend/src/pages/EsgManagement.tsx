import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityFeed,
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
import { EsgEntryModal, type EsgEntryKind } from '../components/EsgEntryModal';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  fetchEsgState,
  generateEsgReport,
} from '../lib/api';
import { theme } from '../theme';
import type {
  EsgReportType,
  EsgState,
  EsgStatus,
  EsgTrend,
} from '../types/esg';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

function statusVariant(status: EsgStatus) {
  if (status === 'healthy' || status === 'complete' || status === 'closed') return 'success';
  if (status === 'critical' || status === 'open') return 'danger';
  if (status === 'watch' || status === 'in_progress') return 'warning';
  return 'default';
}

function trendLabel(trend: EsgTrend) {
  if (trend === 'up') return 'Improving';
  if (trend === 'down') return 'Reducing';
  return 'Stable';
}

function severityVariant(value: number) {
  if (value >= 75) return 'danger';
  if (value >= 55) return 'warning';
  return 'success';
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Not set';
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

export function EsgManagement() {
  const { workspaceId } = useWorkspace();
  const activeWorkspaceId = workspaceId || '';
  const [state, setState] = useState<EsgState | null>(null);
  const [stateWorkspaceId, setStateWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [entryKind, setEntryKind] = useState<EsgEntryKind | null>(null);
  const [feedback, setFeedback] = useState('');
  const stateRequestSequence = useRef(0);
  const actionSequence = useRef(0);
  const actionLock = useRef(false);
  const currentWorkspaceIdRef = useRef(activeWorkspaceId);
  currentWorkspaceIdRef.current = activeWorkspaceId;

  const loadState = useCallback(async () => {
    const sequence = ++stateRequestSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const next = await fetchEsgState();
      if (sequence !== stateRequestSequence.current || requestedWorkspaceId !== currentWorkspaceIdRef.current) return;
      setState(next);
      setStateWorkspaceId(requestedWorkspaceId);
    } catch (err) {
      if (sequence === stateRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) {
        setStateWorkspaceId(requestedWorkspaceId);
        setError(err instanceof Error ? err.message : 'Unable to load ESG program state');
      }
    } finally {
      if (sequence === stateRequestSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestSequenceRef = stateRequestSequence;
    setState(null);
    setStateWorkspaceId('');
    setError(null);
    setFeedback('');
    setEntryKind(null);
    setWorking(null);
    setLoading(true);
    actionSequence.current++;
    actionLock.current = false;
    void loadState();
    return () => { requestSequenceRef.current++; };
  }, [activeWorkspaceId, loadState]);

  const handleAction = async (key: string, action: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    const sequence = ++actionSequence.current;
    const requestedWorkspaceId = currentWorkspaceIdRef.current;
    try {
      setWorking(key);
      await action();
      if (requestedWorkspaceId === currentWorkspaceIdRef.current) await loadState();
    } catch (err) {
      if (sequence === actionSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      if (sequence === actionSequence.current) actionLock.current = false;
      if (sequence === actionSequence.current && requestedWorkspaceId === currentWorkspaceIdRef.current) setWorking(null);
    }
  };

  const handleEntrySaved = async (message: string) => {
    const requestedWorkspaceId = activeWorkspaceId;
    if (requestedWorkspaceId !== currentWorkspaceIdRef.current) return;
    await loadState();
    if (requestedWorkspaceId === currentWorkspaceIdRef.current) setFeedback(message);
  };

  const metrics = useMemo(() => {
    if (!state) {
      return [
        { label: 'Overall ESG', value: '0%', detail: 'Loading command center', tone: 'default' as const },
        { label: 'Carbon Footprint', value: 0, detail: 'Loading carbon inventory', tone: 'default' as const },
        { label: 'ESG Risk Exposure', value: 0, detail: 'Loading risk posture', tone: 'default' as const },
        { label: 'Supplier ESG', value: '0%', detail: 'Loading supplier coverage', tone: 'default' as const },
        { label: 'Board Readiness', value: '0%', detail: 'Loading board signals', tone: 'default' as const },
      ];
    }

    return [
      { label: 'Overall ESG', value: `${state.summary.overallScore}%`, detail: `${state.maturity.level} maturity`, tone: state.summary.overallScore >= 80 ? 'success' as const : 'warning' as const },
      { label: 'Carbon Footprint', value: `${state.summary.carbonFootprint} tCO2e`, detail: `${state.carbonRecords.length} carbon sources tracked`, tone: 'primary' as const },
      { label: 'ESG Risk Exposure', value: state.summary.esgRiskExposure, detail: `${state.risks.filter((risk) => risk.severity === 'high' || risk.severity === 'critical').length} elevated risks`, tone: state.summary.esgRiskExposure >= 70 ? 'danger' as const : 'warning' as const },
      { label: 'Supplier ESG', value: `${state.summary.supplierEsgRating}%`, detail: `${state.suppliers.length} suppliers in scope`, tone: state.summary.supplierEsgRating >= 80 ? 'success' as const : 'warning' as const },
      { label: 'Board Readiness', value: `${state.summary.boardReadiness}%`, detail: `${state.boardView.openFindings} open findings`, tone: state.summary.boardReadiness >= 80 ? 'success' as const : 'warning' as const },
    ];
  }, [state]);

  const generateReport = async (reportType: EsgReportType) => {
    await generateEsgReport(reportType);
  };

  if (loading || stateWorkspaceId !== activeWorkspaceId) {
    return (
      <div style={pageStyle}>
        <PageHeader title="ESG Management Platform" description="Investor-ready and regulator-ready ESG command center across environmental, social, governance, carbon, supplier, audit, and compliance workflows." />
        <PageSectionCard title="Loading ESG command center">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
            Loading ESG scores, frameworks, carbon accounting, supplier ESG posture, and board reporting readiness...
          </div>
        </PageSectionCard>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div style={pageStyle}>
        <PageHeader title="ESG Management Platform" description="Investor-ready and regulator-ready ESG command center across environmental, social, governance, carbon, supplier, audit, and compliance workflows." />
        <EmptyStatePanel
          eyebrow="ESG"
          title="Unable to load ESG program data"
          description={error}
          actions={<Button variant="primary" onClick={() => void loadState()}>Retry</Button>}
        />
      </div>
    );
  }

  const stateData = state;

  return (
    <div style={pageStyle}>
      <PageHeader
        title="ESG Management Platform"
        description="Run environmental management, carbon accounting, social and governance oversight, ESG risk, supplier posture, board readiness, and sustainability reporting from one enterprise command center."
        action={<Button variant="primary" onClick={() => void handleAction('report-board', async () => { await generateReport('board_esg_report'); })}>Generate Board ESG Report</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadState()}>Refresh</Button>
            <Button variant="outline" onClick={() => void handleAction('report-csrd', async () => { await generateReport('csrd_report'); })} disabled={Boolean(working)}>CSRD Report</Button>
            <Button variant="outline" onClick={() => void handleAction('report-carbon', async () => { await generateReport('carbon_report'); })} disabled={Boolean(working)}>Carbon Report</Button>
          </>
        }
      >
        <Button variant="primary" onClick={() => setEntryKind('environmental')}>Add Environmental Metric</Button>
        <Button variant="outline" onClick={() => setEntryKind('carbon')}>Capture Carbon Update</Button>
        <Button variant="outline" onClick={() => setEntryKind('incident')}>Log ESG Incident</Button>
      </PageToolbar>

      {error ? (
        <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.semantic.warningLight, color: theme.colors.text.main }}>
          {error}
        </Card>
      ) : null}
      {feedback ? <div role="status" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, background: theme.colors.backgroundAlt, color: theme.colors.text.secondary }}>{feedback}</div> : null}

      {stateData ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(340px, 0.9fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="ESG Command Center"
              subtitle="Unified view of environmental, social, governance, carbon, supplier, and compliance posture for executive and board reporting."
              action={<Badge variant={stateData.summary.overallScore >= 80 ? 'success' : 'warning'} size="sm">{stateData.summary.overallScore}% overall</Badge>}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: theme.spacing[3] }}>
                {[
                  { label: 'Environmental', value: stateData.summary.environmentalScore, detail: `${stateData.environmentalMetrics.length} tracked metrics` },
                  { label: 'Social', value: stateData.summary.socialScore, detail: `${stateData.socialMetrics.length} people metrics` },
                  { label: 'Governance', value: stateData.summary.governanceScore, detail: `${stateData.governanceMetrics.length} governance metrics` },
                  { label: 'Compliance', value: stateData.summary.complianceStatus, detail: `${stateData.compliancePrograms.length} active programs` },
                  { label: 'Targets', value: stateData.summary.sustainabilityTargetProgress, detail: `${stateData.targets.length} active commitments` },
                ].map((item) => (
                  <Card key={item.label} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{item.value}%</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.detail}</div>
                  </Card>
                ))}
              </div>

              <div style={{ marginTop: theme.spacing[4], display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: theme.spacing[2] }}>
                {stateData.analytics.esgTrend.map((point) => (
                  <div key={point.month} style={{ textAlign: 'center' }}>
                    <div style={{ height: 72, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div style={{ width: 18, height: `${Math.max(point.score, 10)}%`, borderRadius: theme.borderRadius.sm, backgroundColor: point.score >= 80 ? theme.colors.semantic.success : theme.colors.primary }} />
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{point.month}</div>
                  </div>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="Board ESG View"
              subtitle="Compact board-ready narrative showing top risks, carbon progress, supplier exposure, readiness, and open findings."
              action={<Badge variant={stateData.summary.boardReadiness >= 80 ? 'success' : 'warning'} size="sm">{stateData.summary.boardReadiness}% ready</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Top ESG Risks</div>
                  <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1] }}>
                    {stateData.boardView.topRisks.map((risk) => (
                      <div key={risk} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{risk}</div>
                    ))}
                  </div>
                </Card>
                <Card style={{ padding: theme.spacing[3] }}>
                  <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>Carbon Progress</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{stateData.boardView.carbonProgress}</div>
                </Card>
                <Card style={{ padding: theme.spacing[3] }}>
                  <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>Supplier ESG Exposure</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{stateData.boardView.supplierExposure}</div>
                </Card>
                <Card style={{ padding: theme.spacing[3] }}>
                  <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>Compliance & Targets</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{stateData.boardView.complianceStatus}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{stateData.boardView.targetAchievement}</div>
                </Card>
              </div>
            </PageSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <DataTableShell
              title="Environmental Management"
              subtitle="Energy, water, waste, recycling, incident, renewable, and operational environmental KPIs."
              action={<Badge variant="default" size="sm">{stateData.environmentalMetrics.length} records</Badge>}
            >
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Metric</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Category</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Current</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Target</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Trend</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Owner</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stateData.environmentalMetrics.map((metric) => (
                    <tr key={metric.id} style={{ borderTop: `1px solid ${theme.colors.borderLight}` }}>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{metric.metricName}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{metric.category.replace(/_/g, ' ')}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{metric.currentValue} {metric.unit}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{metric.targetValue} {metric.unit}</td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant="default" size="sm">{trendLabel(metric.trend)}</Badge></td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{metric.owner}</td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(metric.status)} size="sm">{metric.status.replace(/_/g, ' ')}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>

            <DataTableShell
              title="Carbon Accounting"
              subtitle="Scope 1, 2, and 3 emissions, intensity, targets, and year-over-year reduction trajectory."
              action={<Badge variant="warning" size="sm">{stateData.summary.carbonFootprint} tCO2e</Badge>}
            >
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Scope</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Source</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>tCO2e</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Intensity</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Target</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Reduction</th>
                  </tr>
                </thead>
                <tbody>
                  {stateData.carbonRecords.map((record) => (
                    <tr key={record.id} style={{ borderTop: `1px solid ${theme.colors.borderLight}` }}>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{record.scope.replace('_', ' ').toUpperCase()}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{record.sourceName}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{record.tonnesCo2e}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{record.intensity}</td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{record.targetTonnesCo2e}</td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant="default" size="sm">{record.reductionTargetPercent}%</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="Social Responsibility"
              subtitle="Diversity, wellbeing, health and safety, human rights, training, and engagement metrics."
              action={<Button variant="outline" onClick={() => setEntryKind('social')}>Add Social Metric</Button>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.socialMetrics.map((metric) => (
                  <Card key={metric.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{metric.metricName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{metric.businessUnit} · {metric.owner}</div>
                      </div>
                      <Badge variant={statusVariant(metric.status)} size="sm">{metric.currentValue}{metric.unit}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="Governance Management"
              subtitle="Board composition, ethics, conduct, policy governance, whistleblowing, and compliance culture indicators."
              action={<Button variant="outline" onClick={() => setEntryKind('governance')}>Add Governance Metric</Button>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.governanceMetrics.map((metric) => (
                  <Card key={metric.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{metric.metricName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{metric.owner} · {metric.category.replace(/_/g, ' ')}</div>
                      </div>
                      <Badge variant={statusVariant(metric.status)} size="sm">{metric.currentValue}{metric.unit}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(340px, 0.9fr)', gap: theme.spacing[4] }}>
            <DataTableShell
              title="ESG Risk Register"
              subtitle="Climate, environmental, human rights, labor, ethics, reputation, governance, and supply-chain risks mapped into enterprise risk management."
              action={<Button variant="outline" onClick={() => setEntryKind('risk')}>Add ESG Risk</Button>}
            >
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Risk</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Category</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Severity</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Score</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Owner</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stateData.risks.map((risk) => (
                    <tr key={risk.id} style={{ borderTop: `1px solid ${theme.colors.borderLight}` }}>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>
                        <div>{risk.title}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{risk.mitigation}</div>
                      </td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{risk.category.replace(/_/g, ' ')}</td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={risk.severity === 'critical' || risk.severity === 'high' ? 'danger' : 'warning'} size="sm">{risk.severity}</Badge></td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={severityVariant(risk.riskScore)} size="sm">{risk.riskScore}</Badge></td>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{risk.owner}</td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(risk.status as EsgStatus)} size="sm">{risk.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>

            <PageSectionCard
              title="ESG KPI & Target Management"
              subtitle="KPI library, variance management, target ownership, and sustainability commitment tracking."
              action={<Button variant="outline" onClick={() => setEntryKind('kpi')}>Add KPI</Button>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.kpis.map((kpi) => (
                  <Card key={kpi.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{kpi.kpiName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{kpi.businessUnit} · {kpi.reportingFrequency}</div>
                      </div>
                      <Badge variant={statusVariant(kpi.status)} size="sm">{kpi.actualValue}/{kpi.targetValue}</Badge>
                    </div>
                  </Card>
                ))}
                <div style={{ display: 'grid', gap: theme.spacing[2], marginTop: theme.spacing[1] }}>
                  {stateData.targets.map((target) => (
                    <Card key={target.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{target.targetName}</div>
                          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Due {formatDate(target.dueDate)} · {target.owner}</div>
                        </div>
                        <Badge variant={statusVariant(target.status)} size="sm">{percent((target.currentValue / Math.max(target.targetValue, 1)) * 100)}</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                  <Button variant="outline" onClick={() => setEntryKind('target')}>Add Target</Button>
                </div>
              </div>
            </PageSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <DataTableShell
              title="Supplier ESG Management"
              subtitle="Supplier ESG rating, carbon performance, human rights compliance, sustainability practices, and third-party ESG risk."
              action={<Button variant="outline" onClick={() => setEntryKind('supplier')}>Add Supplier Review</Button>}
            >
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '16%' }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Supplier</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>ESG Rating</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Carbon</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Human Rights</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Assessment</th>
                    <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}` }}>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {stateData.suppliers.map((supplier) => (
                    <tr key={supplier.id} style={{ borderTop: `1px solid ${theme.colors.borderLight}` }}>
                      <td style={{ padding: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>{supplier.supplierName}</td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={supplier.supplierEsgRating >= 80 ? 'success' : 'warning'} size="sm">{supplier.supplierEsgRating}%</Badge></td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={supplier.supplierCarbonScore >= 75 ? 'success' : 'warning'} size="sm">{supplier.supplierCarbonScore}%</Badge></td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(supplier.humanRightsCompliance)} size="sm">{supplier.humanRightsCompliance}</Badge></td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={statusVariant(supplier.assessmentStatus)} size="sm">{supplier.assessmentStatus.replace(/_/g, ' ')}</Badge></td>
                      <td style={{ padding: theme.spacing[3] }}><Badge variant={supplier.supplierRiskLevel === 'high' || supplier.supplierRiskLevel === 'critical' ? 'danger' : 'warning'} size="sm">{supplier.supplierRiskLevel}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>

            <ActivityFeed
              title="ESG Incident & Audit Management"
              subtitle="Environmental incidents, health and safety events, ethics issues, supplier breaches, sustainability audits, findings, and remediation."
              countLabel={`${stateData.incidents.length + stateData.audits.length} records`}
            >
              {stateData.incidents.map((incident) => (
                <Card key={incident.id} style={{ padding: theme.spacing[3] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{incident.title}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{formatDate(incident.occurredAt)} · {incident.owner}</div>
                    </div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      <Badge variant={incident.severity === 'high' || incident.severity === 'critical' ? 'danger' : 'warning'} size="sm">{incident.severity}</Badge>
                      <Badge variant={statusVariant(incident.status as EsgStatus)} size="sm">{incident.status}</Badge>
                    </div>
                  </div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{incident.summary}</div>
                </Card>
              ))}
              {stateData.audits.map((audit) => (
                <Card key={audit.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{audit.auditName}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{audit.auditType} · due {formatDate(audit.dueDate)}</div>
                    </div>
                    <Badge variant={statusVariant(audit.status as EsgStatus)} size="sm">{audit.findingsCount} findings</Badge>
                  </div>
                </Card>
              ))}
            </ActivityFeed>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="ESG Compliance Engine"
              subtitle="Framework coverage, control coverage, evidence coverage, assessment coverage, supplier coverage, and policy coverage."
              action={<Badge variant={stateData.summary.complianceStatus >= 80 ? 'success' : 'warning'} size="sm">{stateData.summary.complianceStatus}% readiness</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {stateData.compliancePrograms.map((program) => (
                  <Card key={program.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{program.frameworkName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{program.gapCount} gaps · target {program.targetScore}%</div>
                      </div>
                      <Badge variant={statusVariant(program.status as EsgStatus)} size="sm">{program.score}%</Badge>
                    </div>
                    <div style={{ marginTop: theme.spacing[2], display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      <div>Controls {program.controlCoveragePercent}%</div>
                      <div>Evidence {program.evidenceCoveragePercent}%</div>
                      <div>Assessments {program.assessmentCoveragePercent}%</div>
                      <div>Suppliers {program.supplierCoveragePercent}%</div>
                      <div>Policies {program.policyCoveragePercent}%</div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="ESG Reporting & Maturity"
              subtitle="Generate sustainability, carbon, CSRD, ISSB, GRI, supplier, and board reporting packs while tracking maturity progression."
              action={<Badge variant="default" size="sm">{stateData.maturity.level}</Badge>}
            >
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', marginBottom: theme.spacing[3] }}>
                <Button variant="outline" onClick={() => void handleAction('report-esg', async () => { await generateReport('esg_report'); })} disabled={Boolean(working)}>ESG Report</Button>
                <Button variant="outline" onClick={() => void handleAction('report-issb', async () => { await generateReport('issb_report'); })} disabled={Boolean(working)}>ISSB Report</Button>
                <Button variant="outline" onClick={() => void handleAction('report-gri', async () => { await generateReport('gri_report'); })} disabled={Boolean(working)}>GRI Report</Button>
                <Button variant="outline" onClick={() => void handleAction('report-supplier', async () => { await generateReport('supplier_esg_report'); })} disabled={Boolean(working)}>Supplier ESG Report</Button>
              </div>
              <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>Maturity score {stateData.maturity.score}%</div>
                <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1] }}>
                  {stateData.maturity.strengths.map((strength) => (
                    <div key={strength} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{strength}</div>
                  ))}
                </div>
              </Card>
              <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
                {stateData.reports.map((report) => (
                  <Card key={report.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{report.title}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{report.generatedBy} · {formatDate(report.generatedAt)}</div>
                      </div>
                      <Badge variant={report.status === 'approved' ? 'success' : 'default'} size="sm">{report.status}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>
        </>
      ) : (
        <EmptyStatePanel
          eyebrow="ESG"
          title="No ESG program data available"
          description="No persisted environmental, social, governance, carbon, supplier, or reporting records are available in this workspace."
          actions={<Button variant="primary" onClick={() => setEntryKind('environmental')}>Add first environmental metric</Button>}
        />
      )}
      <EsgEntryModal kind={entryKind} onClose={() => setEntryKind(null)} onSaved={handleEntrySaved} />
    </div>
  );
}

export default EsgManagement;
