import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, EmptyStatePanel } from '../components';
import { ActivityIcon, ClockIcon, IssueIcon, MatrixIcon, PlusIcon, ReviewIcon, RiskIcon, TargetIcon, TreatmentIcon } from '../components/icons';
import { useWorkspace } from '../context/WorkspaceContext';
import { fetchRiskIntelligenceState, listRiskTreatmentPlans } from '../lib/api';
import { buildFilteredPath } from '../lib/queryFilters';
import { fetchDashboardShellSummary, type DashboardShellSummary } from '../services/dashboard/shellSummary';
import type { RiskIntelligenceState } from '../types/riskIntelligence';
import './RiskWorkspaceLanding.css';
import './RiskVisualSystem.css';

type RiskWorkspaceLandingProps = { onNavigate?: (key: string) => void };

type ActionCard = {
  title: string;
  description: string;
  button: string;
  routeKey: string;
  icon: ReactNode;
  tone: 'blue' | 'violet' | 'green' | 'slate';
};

const actions: ActionCard[] = [
  { title: 'Risk Register', description: 'Enterprise risk posture, treatments, and analytics.', button: 'Open Register', routeKey: 'risks', icon: <ReviewIcon size={22} />, tone: 'violet' },
  { title: 'Risk Assessments', description: 'Heatmaps, scoring views, and exposure analysis.', button: 'Open Assessments', routeKey: 'risk-matrix', icon: <MatrixIcon size={22} />, tone: 'green' },
  { title: 'Risk Operations', description: 'Issues, remediation, and accountable actions.', button: 'Open Operations', routeKey: 'issues', icon: <IssueIcon size={22} />, tone: 'slate' },
];

function MetricCard({ icon, value, label, detail, tone, routeKey, filterHint, actionLabel, onClick }: { icon: ReactNode; value: string | number; label: string; detail: string; tone: string; routeKey: string; filterHint: string; actionLabel: string; onClick: () => void }) {
  return <button type="button" className={`riskWsMetric riskWsTone-${tone}`} aria-label={actionLabel} title={actionLabel} data-route-key={routeKey} data-drilldown-filter={filterHint} onClick={onClick}><span className="riskWsMetricIcon" aria-hidden="true">{icon}</span><span className="riskWsMetricCopy"><strong>{value}</strong><span>{label}</span><small>{detail}</small></span><span className="riskWsMetricArrow" aria-hidden="true">›</span></button>;
}

function SummaryCard({ icon, eyebrow, value, description, action, onClick, tone }: { icon: ReactNode; eyebrow: string; value: string | number; description: string; action: string; onClick: () => void; tone: string }) {
  return <article className={`riskWsSummary riskWsSummary-${tone}`}><div className="riskWsSummaryIcon" aria-hidden="true">{icon}</div><div className="riskWsSummaryCopy"><span>{eyebrow}</span><strong>{value}</strong><p>{description}</p><button type="button" onClick={onClick}>{action} <span aria-hidden="true">→</span></button></div></article>;
}

export function RiskWorkspaceLanding({ onNavigate }: RiskWorkspaceLandingProps) {
  const routerNavigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [riskState, setRiskState] = useState<RiskIntelligenceState | null>(null);
  const [treatmentCount, setTreatmentCount] = useState<number | null>(null);
  const [shell, setShell] = useState<DashboardShellSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [riskResult, shellResult, treatmentResult] = await Promise.allSettled([fetchRiskIntelligenceState(), fetchDashboardShellSummary(), listRiskTreatmentPlans()]);
    if (riskResult.status === 'fulfilled') setRiskState(riskResult.value);
    if (shellResult.status === 'fulfilled') setShell(shellResult.value);
    if (treatmentResult.status === 'fulfilled') setTreatmentCount(treatmentResult.value.length);
    if (riskResult.status === 'rejected' && shellResult.status === 'rejected') setError('Risk management data is currently unavailable.');
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([fetchRiskIntelligenceState(), fetchDashboardShellSummary(), listRiskTreatmentPlans()]).then(([riskResult, shellResult, treatmentResult]) => {
      if (!active) return;
      if (riskResult.status === 'fulfilled') setRiskState(riskResult.value);
      if (shellResult.status === 'fulfilled') setShell(shellResult.value);
      if (treatmentResult.status === 'fulfilled') setTreatmentCount(treatmentResult.value.length);
      if (riskResult.status === 'rejected' && shellResult.status === 'rejected') setError('Risk management data is currently unavailable.');
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const navigate = (routeKey: string) => onNavigate?.(routeKey);
  const workspaceName = currentWorkspace.displayName || currentWorkspace.name || 'Current workspace';
  const assessmentsDue = useMemo(() => riskState?.risks.filter((risk) => Boolean(risk.dueDate) && risk.status !== 'closed').length ?? null, [riskState]);
  const priorityAlerts = shell ? shell.attentionItems.filter((item) => item.count > 0).length : null;
  const workflowReady = Boolean(riskState || shell);
  const outsideAppetiteCount = riskState ? riskState.risks.filter(risk => risk.appetiteStatus !== 'within_appetite').length : null;
  const riskPosture = outsideAppetiteCount !== null
    ? outsideAppetiteCount > 0 ? 'Outside appetite' : 'Within appetite'
    : 'Not available';

  if (loading) return <div className="riskWsPage"><div className="riskWsLoading" role="status">Loading Risk Management…</div></div>;
  if (error) return <EmptyStatePanel eyebrow="Risk Management" title="Unable to load risk operations" description={error} actions={<Button variant="primary" onClick={load}>Retry</Button>} />;

  const metrics = [
    { label: 'Open enterprise risks', value: shell?.counts.openRisks ?? 'Not available', detail: 'Current enterprise register scope', tone: 'danger', icon: <RiskIcon size={20} />, routeKey: 'risks', routePath: '/risks', filterHint: 'status=open', actionLabel: `Open ${shell?.counts.openRisks ?? ''} open risks in the Risk Register` },
    { label: 'Outside appetite', value: outsideAppetiteCount ?? 'Not available', detail: 'Enterprise risks requiring priority review', tone: 'warning', icon: <TargetIcon size={20} />, routeKey: 'risks', routePath: '/risks', filterHint: 'appetite=outside', actionLabel: `View ${outsideAppetiteCount ?? ''} risks outside appetite` },
    { label: 'Assessment records due', value: assessmentsDue ?? 'Not available', detail: 'Risk records with review dates', tone: 'primary', icon: <ReviewIcon size={20} />, routeKey: 'risk-matrix', routePath: '/risk-matrix', filterHint: 'review=due', actionLabel: `Open ${assessmentsDue ?? ''} due risk assessments` },
    { label: 'Treatment records', value: treatmentCount ?? 'Not available', detail: 'Recorded treatment activity', tone: 'success', icon: <TreatmentIcon size={20} />, routeKey: 'risks', routePath: '/risks', filterHint: 'tab=treatment-plans', actionLabel: `Open ${treatmentCount ?? ''} treatment plans` },
    { label: 'Audit blockers', value: shell?.counts.auditBlockers ?? 'Not available', detail: 'Readiness constraints', tone: 'warning', icon: <IssueIcon size={20} />, routeKey: 'audit-readiness', routePath: '/audit-readiness', filterHint: 'type=audit-blocker', actionLabel: `Open ${shell?.counts.auditBlockers ?? ''} audit blockers in Audit Readiness` },
    ...(shell?.counts.expiredEvidence === null || shell?.counts.expiredEvidence === undefined ? [] : [{ label: 'Expired evidence', value: shell.counts.expiredEvidence, detail: 'Outside review tolerance', tone: 'slate', icon: <ClockIcon size={20} />, routeKey: 'evidence', routePath: '/evidence', filterHint: 'status=expired', actionLabel: `Open ${shell.counts.expiredEvidence} expired evidence items` }]),
  ];

  return (
    <main className="riskWsPage" aria-labelledby="risk-workspace-heading">
      <section className="riskWsHero">
        <div className="riskWsHeroArt" aria-hidden="true"><span/><span/><span/></div>
        <div className="riskWsBreadcrumb"><span>Risk Management</span><b aria-hidden="true">›</b><strong>Overview</strong></div>
        <div className="riskWsHeroContent">
          <div className="riskWsHeroIcon" aria-hidden="true"><RiskIcon size={34}/></div>
          <div className="riskWsHeroCopy"><h1 id="risk-workspace-heading">Risk Management</h1><h2>{workspaceName} risk overview</h2><p>Manage enterprise risks, assessments, treatment activity, and operational follow-up.</p></div>
        </div>
        <div className="riskWsHeroSignals" role="group" aria-label="Risk Management signals">
          <div><TargetIcon size={24} aria-hidden="true"/><span>Risk posture</span><strong>{riskPosture}</strong></div>
          <div><IssueIcon size={24} aria-hidden="true"/><span>Priority alerts</span><strong>{priorityAlerts ?? 'Not available'}</strong></div>
          <div><ActivityIcon size={24} aria-hidden="true"/><span>Monitoring</span><strong>{workflowReady ? 'Active' : 'Needs attention'}</strong></div>
          <div><ReviewIcon size={24} aria-hidden="true"/><span>Operating status</span><strong>{workflowReady ? 'Ready' : 'Needs attention'}</strong></div>
        </div>
      </section>

      <section className="riskWsMetrics" aria-label="Risk Management drill-down indicators">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} onClick={() => routerNavigate(buildFilteredPath(metric.routePath, metric.filterHint))}/>)}</section>

      <section className="riskWsSummaries" aria-label="Risk Management status">
        <SummaryCard icon={<MatrixIcon size={24}/>} eyebrow="Risk Areas" value="4" description="Overview, register, assessments, and operations." action="Open Risk Register" onClick={() => navigate('risks')} tone="blue" />
        <SummaryCard icon={<TreatmentIcon size={24}/>} eyebrow="Treatment Flow" value={workflowReady ? 'Active' : 'Needs configuration'} description="Remediation and issue handling are linked across workflows." action="View treatment flow" onClick={() => navigate('issues')} tone="amber" />
        <SummaryCard icon={<ActivityIcon size={24}/>} eyebrow="Operating Status" value={workflowReady ? 'Ready' : 'Needs attention'} description="Risk workflows and live posture signals are available." action="Configure risk methodology" onClick={() => navigate('risk-methodology')} tone="green" />
      </section>

      <section className="riskWsSection">
        <header><div><span className="riskWsSectionIcon" aria-hidden="true"><ActivityIcon size={20}/></span><div><h2>Risk Actions</h2><p>Quick access to key risk management capabilities.</p></div></div></header>
        <div className="riskWsActions">{actions.map((action) => <article className="riskWsActionCard" key={action.title}><div className={`riskWsActionIcon riskWsActionIcon-${action.tone}`} aria-hidden="true">{action.icon}</div><div><h3>{action.title}</h3><p>{action.description}</p></div><button type="button" onClick={() => navigate(action.routeKey)}>{action.button} <span aria-hidden="true">→</span></button></article>)}</div>
      </section>

      <section className="riskWsOperations">
        <article className="riskWsOpsCard"><header><span className="riskWsSectionIcon"><ReviewIcon size={20}/></span><div><h2>Risk Operations</h2><p>Use the register, matrix, and issue workflows together.</p></div><Badge variant="primary" size="sm">Operations</Badge></header><ul><li><ReviewIcon size={16}/>Review enterprise risk register</li><li><MatrixIcon size={16}/>Run heatmap and scoring assessments</li><li><IssueIcon size={16}/>Track remediation through issues and actions</li></ul><footer><Button variant="primary" onClick={() => navigate('issues')}>Open Risk Operations</Button><button onClick={() => navigate('risk-matrix')}>View risk heatmap →</button></footer></article>
        <article className="riskWsOpsCard"><header><span className="riskWsSectionIcon"><TargetIcon size={20}/></span><div><h2>Next Actions</h2><p>Suggested starting points for risk analysis and treatment.</p></div><Badge variant="default" size="sm">Workflow</Badge></header><ul><li><PlusIcon size={16}/>Create a new risk entry</li><li><TargetIcon size={16}/>Assess inherent and residual exposure</li><li><ClockIcon size={16}/>Escalate blocked or overdue treatment items</li></ul><footer><Button variant="primary" onClick={() => navigate('issues')}>Open Risk Operations</Button><button onClick={() => navigate('risks')}>Review risk register →</button></footer></article>
      </section>

      <p className="riskWsCiaNote"><strong>CIA-ready risk model:</strong> risk records support multi-select Confidentiality, Integrity, and Availability impact for future filtering and reporting.</p>
    </main>
  );
}
