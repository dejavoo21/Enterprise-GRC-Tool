import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, EmptyStatePanel } from '../components';
import { ActivityIcon, ClockIcon, IssueIcon, MatrixIcon, ReviewIcon, RiskIcon, TargetIcon, TreatmentIcon } from '../components/icons';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall, API_BASE, fetchRiskIntelligenceState, listRiskTreatmentPlans } from '../lib/api';
import { buildFilteredPath } from '../lib/queryFilters';
import { scoreLabel } from '../lib/riskScoreProfile';
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
  const { currentWorkspace } = useWorkspace();
  return <WorkspaceOverview key={currentWorkspace.id} onNavigate={onNavigate} />;
}

function WorkspaceOverview({ onNavigate }: RiskWorkspaceLandingProps) {
  const routerNavigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [riskState, setRiskState] = useState<RiskIntelligenceState | null>(null);
  const [treatmentCount, setTreatmentCount] = useState<number | null>(null);
  const [shell, setShell] = useState<DashboardShellSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [methodologyStatus,setMethodologyStatus] = useState<{workspaceId:string;label:string}|null>(null);
  useEffect(() => {
    let current=true;
    void apiCall<{data:{methodologyMode:string;activeMethodologyVersion:number|null}}>(`${API_BASE}/risk-methodologies/state`).then(({data})=>{
      if(current) setMethodologyStatus({workspaceId:currentWorkspace.id,label:`${data.methodologyMode === 'enforced' ? 'Enforced methodology' : 'Legacy compatibility'} · ${data.activeMethodologyVersion ? `Active version ${data.activeMethodologyVersion}` : 'No active version'}`});
    }).catch(()=>{if(current)setMethodologyStatus({workspaceId:currentWorkspace.id,label:'Methodology status unavailable'});});
    return ()=>{current=false;};
  },[currentWorkspace.id]);

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

  const navigate = (routeKey: string) => onNavigate ? onNavigate(routeKey) : routerNavigate(`/${routeKey}`);
  const workspaceName = currentWorkspace.displayName || currentWorkspace.name || 'Current workspace';
  const assessmentsDue = useMemo(() => riskState?.risks.filter((risk) => Boolean(risk.dueDate) && risk.status !== 'closed').length ?? null, [riskState]);
  const priorityAlerts = shell?.sourceAvailability.complete ? shell.attentionItems.filter((item) => item.count > 0).length : null;
  const workflowReady = Boolean(riskState && shell?.sourceAvailability.complete && treatmentCount !== null);
  const openRisks = shell?.sourceAvailability.risks ? shell.counts.openRisks : null;
  const auditBlockers = shell?.sourceAvailability.audits ? shell.counts.auditBlockers : null;
  const outsideAppetiteCount = riskState ? riskState.risks.filter(risk => risk.appetiteStatus !== 'within_appetite').length : null;
  const riskPosture = outsideAppetiteCount !== null
    ? outsideAppetiteCount > 0 ? 'Outside appetite' : 'Within appetite'
    : 'Not available';
  const priorities = useMemo(() => [...(riskState?.risks || [])]
    .filter(risk => risk.appetiteStatus !== 'within_appetite' || risk.reviewStatus === 'overdue')
    .sort((a,b) => Number(b.reviewStatus === 'overdue') - Number(a.reviewStatus === 'overdue') || b.dynamicScore - a.dynamicScore)
    .slice(0,5), [riskState]);
  const overdueReviews = riskState?.risks.filter(risk => risk.reviewStatus === 'overdue').length;

  if (loading) return <div className="riskWsPage"><div className="riskWsLoading" role="status">Loading Risk Management…</div></div>;
  if (error) return <EmptyStatePanel eyebrow="Risk Management" title="Unable to load risk operations" description={error} actions={<Button variant="primary" onClick={load}>Retry</Button>} />;

  const metrics = [
    { label: 'Open enterprise risks', value: openRisks ?? 'Not available', detail: 'Current enterprise register scope', tone: 'danger', icon: <RiskIcon size={20} />, routeKey: 'risks', routePath: '/risks', filterHint: 'status=open', actionLabel: `Open ${openRisks ?? ''} open risks in the Risk Register` },
    { label: 'Outside appetite', value: outsideAppetiteCount ?? 'Not available', detail: 'Enterprise risks requiring priority review', tone: 'warning', icon: <TargetIcon size={20} />, routeKey: 'risks', routePath: '/risks', filterHint: 'appetite=outside', actionLabel: `View ${outsideAppetiteCount ?? ''} risks outside appetite` },
    { label: 'Assessment records due', value: assessmentsDue ?? 'Not available', detail: 'Review context only; matrix is not filtered', tone: 'primary', icon: <ReviewIcon size={20} />, routeKey: 'risk-matrix', routePath: '/risk-matrix', filterHint: 'review=due', actionLabel: 'Open assessment matrix with review context; no review-date filter is applied' },
    { label: 'Treatment records', value: treatmentCount ?? 'Not available', detail: 'Recorded treatment activity', tone: 'success', icon: <TreatmentIcon size={20} />, routeKey: 'risks', routePath: '/risks', filterHint: 'tab=treatment-plans', actionLabel: `Open ${treatmentCount ?? ''} treatment plans` },
    { label: 'Audit blockers', value: auditBlockers ?? 'Not available', detail: 'Audit context only; blocker filter unavailable', tone: 'warning', icon: <IssueIcon size={20} />, routeKey: 'audit-readiness', routePath: '/audit-readiness', filterHint: 'type=audit-blocker', actionLabel: 'Open Audit Readiness with blocker context; no blocker-level filter is applied' },
    { label: 'Expired evidence', value: shell?.counts.expiredEvidence ?? 'Not available', detail: 'Outside review tolerance', tone: 'slate', icon: <ClockIcon size={20} />, routeKey: 'evidence', routePath: '/evidence', filterHint: 'status=expired', actionLabel: 'Open expired evidence items' },
  ];

  return (
    <section className="riskWsPage" aria-labelledby="risk-workspace-heading">
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
        <p className="riskWsMethodology">{methodologyStatus?.workspaceId === currentWorkspace.id ? methodologyStatus.label : 'Loading methodology status...'}</p>
      </section>

      {!workflowReady && <p role="status">Some overview data is unavailable. Available records remain visible; missing sources are not counted as zero.</p>}
      <section className="riskWsMetrics" aria-label="Risk Management drill-down indicators">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} onClick={() => routerNavigate(buildFilteredPath(metric.routePath, metric.filterHint))}/>)}</section>

      <section className="riskWsSection" aria-labelledby="risk-health-title">
        <header><div><span className="riskWsSectionIcon" aria-hidden="true"><ActivityIcon size={20}/></span><div><h2 id="risk-health-title">Operational Health</h2><p>Recorded treatment, review and evidence signals. No estimated health percentages.</p></div></div></header>
        <div className="riskWsSummaries">
        <SummaryCard icon={<ReviewIcon size={24}/>} eyebrow="Review / Evidence Health" value={overdueReviews === undefined ? 'Not available' : `${overdueReviews} overdue reviews`} description={`${shell?.counts.expiredEvidence ?? 'Unknown'} expired evidence items require follow-up.`} action="Review evidence" onClick={() => routerNavigate('/evidence?status=expired')} tone="blue" />
        <SummaryCard icon={<TreatmentIcon size={24}/>} eyebrow="Treatment Flow" value={treatmentCount === null ? 'Not available' : `${treatmentCount} recorded plans`} description="Review accountable owners, delivery progress, controls and expected outcomes." action="View treatment plans" onClick={() => routerNavigate('/risks?tab=treatment-plans')} tone="amber" />
        <SummaryCard icon={<ActivityIcon size={24}/>} eyebrow="Operating Status" value={workflowReady ? 'Ready' : 'Needs attention'} description={workflowReady ? "Risk workflows and live posture signals are available." : "Some risk or operational sources are unavailable. Missing data is not a healthy state."} action="Configure risk methodology" onClick={() => navigate('risk-methodology')} tone="green" />
        </div>
      </section>

      <section className="riskWsSection">
        <header><div><span className="riskWsSectionIcon" aria-hidden="true"><ActivityIcon size={20}/></span><div><h2>Risk Actions</h2><p>Quick access to key risk management capabilities.</p></div></div></header>
        <div className="riskWsActions">{actions.map((action) => <article className="riskWsActionCard" key={action.title}><div className={`riskWsActionIcon riskWsActionIcon-${action.tone}`} aria-hidden="true">{action.icon}</div><div><h3>{action.title}</h3><p>{action.description}</p></div><button type="button" onClick={() => navigate(action.routeKey)}>{action.button} <span aria-hidden="true">→</span></button></article>)}</div>
      </section>

      <section className="riskWsSection" aria-labelledby="risk-watchlist-title">
        <header><div><span className="riskWsSectionIcon" aria-hidden="true"><TargetIcon size={20}/></span><div><h2 id="risk-watchlist-title">Top Priorities / Watchlist</h2><p>Overdue reviews first, then the recorded intelligence priority. Scores retain each risk's original methodology.</p></div></div></header>
        <div className="riskWsWatchlist" role="region" aria-label="Priority risks" tabIndex={0}><table><thead><tr><th>Risk reference</th><th>Risk</th><th>Owner</th><th>Current residual</th><th>Review status</th><th>Next review</th></tr></thead><tbody>{priorities.map(risk => <tr key={risk.id}><td>{risk.riskRef || 'Not assigned'}</td><th scope="row"><button type="button" aria-label={`Open Risk Register to review ${risk.title}`} onClick={() => routerNavigate(buildFilteredPath('/risks', { riskRef: risk.riskRef }))}>{risk.title}</button></th><td>{risk.owner || 'Not assigned'}</td><td>{scoreLabel(risk,risk.residualScore)}</td><td>{(risk.reviewStatus || 'not_reviewed').replaceAll('_',' ')}</td><td>{risk.nextReviewDate ? new Date(risk.nextReviewDate).toLocaleDateString() : 'Not set'}</td></tr>)}</tbody></table></div>
        {!priorities.length && <p>{riskState ? 'No outside-appetite risks or overdue reviews in the current scope.' : 'Priority data is unavailable.'}</p>}
      </section>

      <section className="riskWsOperations">
        <article className="riskWsOpsCard"><header><span className="riskWsSectionIcon"><ReviewIcon size={20}/></span><div><h2>Risk Operations</h2><p>Use the register, matrix, and issue workflows together.</p></div><Badge variant="primary" size="sm">Operations</Badge></header><ul><li><ReviewIcon size={16}/>Review enterprise risk register</li><li><MatrixIcon size={16}/>Run heatmap and scoring assessments</li><li><IssueIcon size={16}/>Track remediation through issues and actions</li></ul><footer><Button variant="primary" onClick={() => navigate('issues')}>Open Risk Operations</Button><button onClick={() => navigate('risk-matrix')}>View risk heatmap →</button></footer></article>
        <article className="riskWsOpsCard"><header><span className="riskWsSectionIcon"><TargetIcon size={20}/></span><div><h2>Next Actions</h2><p>Suggested starting points for risk analysis and treatment.</p></div><Badge variant="default" size="sm">Workflow</Badge></header><ul><li><TargetIcon size={16}/>{outsideAppetiteCount ?? 'Unknown'} outside-appetite risks: review ownership and treatment decisions.</li><li><ClockIcon size={16}/>{overdueReviews ?? 'Unknown'} overdue reviews: reassess recorded current exposure.</li><li><ReviewIcon size={16}/>{shell?.counts.expiredEvidence ?? 'Unknown'} expired evidence items: verify replacements or exceptions.</li></ul><footer><Button variant="primary" onClick={() => navigate('issues')}>Open Risk Operations</Button><button onClick={() => navigate('risks')}>Review risk register →</button></footer></article>
      </section>

      <p className="riskWsCiaNote"><strong>CIA-ready risk model:</strong> risk records support multi-select Confidentiality, Integrity, and Availability impact for future filtering and reporting.</p>
    </section>
  );
}
