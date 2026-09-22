import { useState, type Dispatch, type SetStateAction } from 'react';
import { Badge, Button, Card, DataTableShell, EmptyStatePanel, PageSectionCard, PageToolbar, SummaryMetricStrip } from '../components';
import { getRiskAssuranceImpact } from '../services/continuousAssurance/continuousAssurance';
import { theme } from '../theme';
import type { CiaImpact, Risk, RiskReviewStatus, RiskSeverity, RiskStatus, RiskTreatmentStatus, RiskTreatmentStrategy } from '../types/risk';
import { RiskRegisterView } from './RiskRegisterView';
import type { RiskIntelligenceRiskSummary, RiskIntelligenceState, RiskToleranceStatus } from '../types/riskIntelligence';
import type { RiskTreatmentPlan, RiskTreatmentSummary } from '../types/riskTreatment';

export type RiskWorkspaceTab = 'overview' | 'register' | 'intelligence' | 'matrix' | 'treatments' | 'reports';

export type RiskWorkspaceViewProps = {
  activeTab: RiskWorkspaceTab;
  outsideAppetite: boolean;
  onResetRegisterFilters: () => void;
  onApplyRegisterQuery: (status: string, appetite: string) => void;
  state: RiskIntelligenceState;
  metrics: Array<{ label: string; value: string | number; detail?: string; tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' }>;
  filteredRisks: RiskIntelligenceRiskSummary[];
  filteredKris: RiskIntelligenceState['kris'];
  workspaceId?: string | null;
  saving: boolean;
  selectedCategory: string;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  selectedStatus: RiskToleranceStatus | 'all';
  setSelectedStatus: (value: RiskToleranceStatus | 'all') => void;
  selectedCiaImpact: CiaImpact | 'all';
  setSelectedCiaImpact: Dispatch<SetStateAction<CiaImpact | 'all'>>;
  selectedOwner: string;
  setSelectedOwner: Dispatch<SetStateAction<string>>;
  selectedRating: RiskSeverity | 'all';
  setSelectedRating: Dispatch<SetStateAction<RiskSeverity | 'all'>>;
  selectedRiskStatus: RiskStatus | 'all';
  setSelectedRiskStatus: (value: RiskStatus | 'all') => void;
  selectedTreatmentStatus: RiskTreatmentStatus | 'all'; setSelectedTreatmentStatus: Dispatch<SetStateAction<RiskTreatmentStatus | 'all'>>;
  selectedTreatmentStrategy: RiskTreatmentStrategy | 'all'; setSelectedTreatmentStrategy: Dispatch<SetStateAction<RiskTreatmentStrategy | 'all'>>;
  selectedReviewStatus: RiskReviewStatus | 'all'; setSelectedReviewStatus: Dispatch<SetStateAction<RiskReviewStatus | 'all'>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  reportType: string;
  setReportType: (value: 'risk_committee_report' | 'board_risk_report' | 'executive_risk_summary' | 'kri_report' | 'loss_event_report') => void;
  newKriName: string;
  setNewKriName: Dispatch<SetStateAction<string>>;
  newKriOwner: string;
  setNewKriOwner: Dispatch<SetStateAction<string>>;
  newKriCategory: string;
  setNewKriCategory: Dispatch<SetStateAction<string>>;
  lossEventRootCause: string;
  setLossEventRootCause: Dispatch<SetStateAction<string>>;
  nearMissDescription: string;
  setNearMissDescription: Dispatch<SetStateAction<string>>;
  emergingRiskTitle: string;
  setEmergingRiskTitle: Dispatch<SetStateAction<string>>;
  onNavigate: (tab: RiskWorkspaceTab) => void;
  onNewRisk: () => void;
  onSelectRisk: (risk: RiskIntelligenceRiskSummary) => void;
  onCreateTreatment: (risk: RiskIntelligenceRiskSummary) => void;
  onEditRisk: (risk: RiskIntelligenceRiskSummary) => void;
  treatments: RiskTreatmentPlan[];
  treatmentSummary: RiskTreatmentSummary;
  onEditTreatment: (treatment: RiskTreatmentPlan) => void;
  onRefresh: () => void;
  onExport: () => void;
  onRebalanceWeights: () => void;
  onTightenTolerance: (profile: RiskIntelligenceState['toleranceProfiles'][number]) => void;
  onAddKri: () => void;
  onAddLossEvent: () => void;
  onAddNearMiss: () => void;
  onAddEmergingRisk: () => void;
};

type Props = RiskWorkspaceViewProps;

const inputStyle = {
  padding: theme.spacing[3],
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.md,
  fontSize: theme.typography.sizes.sm,
  backgroundColor: theme.colors.surface,
  color: theme.colors.text.main,
};

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function riskTone(status: RiskToleranceStatus): 'success' | 'warning' | 'danger' {
  if (status === 'within_appetite') return 'success';
  if (status === 'within_tolerance') return 'warning';
  return 'danger';
}

function Matrix({ title, matrix, onDrillDown }: { title: string; matrix: number[][]; onDrillDown: () => void }) {
  const severityClass = (rowIndex: number, columnIndex: number) => {
    const score = (5 - rowIndex) * (columnIndex + 1);
    if (score >= 20) return 'critical';
    if (score >= 12) return 'high';
    if (score >= 6) return 'medium';
    if (score >= 3) return 'low';
    return 'veryLow';
  };

  return (
    <Card className="riskMatrixCard">
      <h3>{title}</h3>
      <div className="riskMatrixBody">
        <span className="riskMatrixYAxis">Likelihood</span>
        <div className="riskMatrixYTicks" aria-hidden="true">{[5, 4, 3, 2, 1].map((tick) => <span key={tick}>{tick}</span>)}</div>
        <div>
          <div className="riskMatrixGrid" role="group" aria-label={`${title} 5 by 5 heatmap. Select a cell to open the Risk Register.`}>
            {matrix.flatMap((row, rowIndex) => row.map((value, columnIndex) => (
              <button type="button" className={`riskMatrixCell riskMatrixCell-${severityClass(rowIndex, columnIndex)}`} key={`${rowIndex}-${columnIndex}`} aria-label={`Open Risk Register for likelihood ${5 - rowIndex}, impact ${columnIndex + 1}: ${value} risks`} title="Open Risk Register" onClick={onDrillDown}>
                {value}
              </button>
            )))}
          </div>
          <div className="riskMatrixXTicks" aria-hidden="true">{[1, 2, 3, 4, 5].map((tick) => <span key={tick}>{tick}</span>)}</div>
          <div className="riskMatrixXAxis">Impact</div>
        </div>
      </div>
    </Card>
  );
}

function Overview({ state, metrics, workspaceId, onNavigate }: Pick<Props, 'state' | 'metrics' | 'workspaceId' | 'onNavigate'>) {
  return (
    <div className="riskViewStack">
      <SummaryMetricStrip metrics={metrics} />
      <div className="riskOverviewGrid">
        <PageSectionCard title="Assurance Impact" subtitle="Control failures, evidence gaps, drift, and unresolved exceptions affecting the leading risks.">
          <div className="riskCompactList">
            {state.risks.slice(0, 3).map((risk) => {
              const impact = workspaceId ? getRiskAssuranceImpact(workspaceId, risk as unknown as Risk) : null;
              return <button className="riskSummaryRow" key={risk.id} onClick={() => onNavigate('register')}><span>{risk.title}</span><Badge variant={(impact?.assuranceImpact || 0) >= 12 ? 'danger' : (impact?.assuranceImpact || 0) >= 6 ? 'warning' : 'success'} size="sm">+{impact?.assuranceImpact || 0}</Badge></button>;
            })}
          </div>
        </PageSectionCard>
        <PageSectionCard title="Risk Committee Dashboard" subtitle="Current escalation and treatment workload.">
          <div className="riskSummaryStats">
            <div><span>Top risks</span><strong>{state.dashboard.committeeView.topRisks.length}</strong></div>
            <div><span>Critical KRIs</span><strong>{state.dashboard.summary.criticalKris}</strong></div>
            <div><span>Open treatments</span><strong>{state.dashboard.committeeView.openTreatmentPlans}</strong></div>
            <div><span>Audit findings</span><strong>{state.dashboard.committeeView.auditFindings}</strong></div>
          </div>
        </PageSectionCard>
        <PageSectionCard title="Top Risk Drivers" subtitle="Highest-weighted contributors to enterprise exposure.">
          <div className="riskCompactList">{state.dashboard.topRiskDrivers.slice(0, 5).map((driver) => <div className="riskSummaryRow" key={driver.label}><span>{driver.label}</span><strong>{Math.round(driver.score)}</strong></div>)}</div>
        </PageSectionCard>
      </div>
      <div className="riskQuickLinks" aria-label="Risk workspace shortcuts">
        {(['register', 'intelligence', 'matrix', 'treatments', 'reports'] as RiskWorkspaceTab[]).map((tab) => <Button key={tab} variant="secondary" onClick={() => onNavigate(tab)}>Open {label(tab)}</Button>)}
      </div>
    </div>
  );
}

function Intelligence(props: Props) {
  const { state, filteredKris, saving, newKriName, setNewKriName, newKriOwner, setNewKriOwner, newKriCategory, setNewKriCategory, lossEventRootCause, setLossEventRootCause, nearMissDescription, setNearMissDescription, emergingRiskTitle, setEmergingRiskTitle, onAddKri, onAddLossEvent, onAddNearMiss, onAddEmergingRisk, onRebalanceWeights, onTightenTolerance } = props;
  return <div className="riskViewStack">
    <div className="riskTwoColumn">
      <PageSectionCard title="Risk Intelligence Dashboard" subtitle="Executive interpretation of exposure, breach pressure, and leading indicators."><div className="riskNarrative">{state.dashboard.executiveSummary.map((item) => <p key={item}>{item}</p>)}</div></PageSectionCard>
      <PageSectionCard title="Forecasting & Trending" subtitle="Forward-looking 90-day risk movement."><div className="riskCompactList">{state.forecasts.slice(0, 8).map((forecast) => <div className="riskSummaryRow" key={forecast.id}><span>{forecast.scopeLabel}</span><Badge variant={riskTone(forecast.forecastStatus)} size="sm">{Math.round(forecast.predicted90DayScore)}</Badge></div>)}</div></PageSectionCard>
    </div>
    <PageSectionCard title="KRI Engine" subtitle="Threshold monitoring and dynamic scoring signals."><div className="riskInlineForm"><input value={newKriName} onChange={(e) => setNewKriName(e.target.value)} placeholder="KRI name" style={inputStyle}/><input value={newKriOwner} onChange={(e) => setNewKriOwner(e.target.value)} placeholder="Owner" style={inputStyle}/><select value={newKriCategory} onChange={(e) => setNewKriCategory(e.target.value)} style={inputStyle}>{state.toleranceProfiles.map((profile) => <option key={profile.id} value={profile.category}>{label(profile.category)}</option>)}</select><Button variant="primary" disabled={saving} onClick={onAddKri}>Add KRI</Button></div><div className="riskCardGrid">{filteredKris.slice(0, 8).map((kri) => <Card key={kri.id} className="riskDataCard"><strong>{kri.name}</strong><Badge variant={kri.status === 'red' ? 'danger' : kri.status === 'amber' ? 'warning' : 'success'} size="sm">{kri.status}</Badge><span>{kri.currentValue} {kri.measurementUnit}</span></Card>)}</div></PageSectionCard>
    <div className="riskTwoColumn"><PageSectionCard title="Appetite & Tolerance" subtitle="Category thresholds and current breach posture."><div className="riskCompactList">{state.toleranceProfiles.map((profile) => <div className="riskSummaryRow" key={profile.id}><span>{label(profile.category)} · {profile.appetite}/{profile.tolerance}/{profile.capacity}</span><Button variant="ghost" disabled={saving} onClick={() => onTightenTolerance(profile)}>Tighten</Button></div>)}</div></PageSectionCard><PageSectionCard title="Capacity Intelligence" subtitle="Current utilization against enterprise capacity."><div className="riskCompactList">{state.capacities.map((capacity) => <div className="riskSummaryRow" key={capacity.id}><span>{label(capacity.capacityType)}</span><strong>{Math.round(capacity.utilizationPercent)}%</strong></div>)}</div><Button variant="secondary" disabled={saving} onClick={onRebalanceWeights}>Rebalance Weight Model</Button></PageSectionCard></div>
    <div className="riskThreeColumn">
      <PageSectionCard title="Loss Events"><div className="riskInlineForm"><input value={lossEventRootCause} onChange={(e) => setLossEventRootCause(e.target.value)} placeholder="Root cause" style={inputStyle}/><Button variant="primary" disabled={saving} onClick={onAddLossEvent}>Add</Button></div><div className="riskCompactList">{state.lossEvents.slice(0, 4).map((item) => <div className="riskSummaryRow" key={item.id}><span>{label(item.eventType)}</span><strong>{item.actualLoss.toLocaleString()}</strong></div>)}</div></PageSectionCard>
      <PageSectionCard title="Near Misses"><div className="riskInlineForm"><input value={nearMissDescription} onChange={(e) => setNearMissDescription(e.target.value)} placeholder="Description" style={inputStyle}/><Button variant="primary" disabled={saving} onClick={onAddNearMiss}>Add</Button></div><div className="riskCompactList">{state.nearMisses.slice(0, 4).map((item) => <div className="riskSummaryRow" key={item.id}><span>{item.description}</span><Badge variant={item.severity === 'high' || item.severity === 'critical' ? 'danger' : 'warning'} size="sm">{item.severity}</Badge></div>)}</div></PageSectionCard>
      <PageSectionCard title="Emerging Risks"><div className="riskInlineForm"><input value={emergingRiskTitle} onChange={(e) => setEmergingRiskTitle(e.target.value)} placeholder="Risk title" style={inputStyle}/><Button variant="primary" disabled={saving} onClick={onAddEmergingRisk}>Add</Button></div><div className="riskCompactList">{state.emergingRisks.slice(0, 4).map((risk) => <div className="riskSummaryRow" key={risk.id}><span>{risk.title}</span><Badge variant={risk.monitoringStatus === 'escalated' ? 'danger' : 'warning'} size="sm">{risk.monitoringStatus}</Badge></div>)}</div></PageSectionCard>
    </div>
  </div>;
}

function MatrixView({ state, onNavigate }: Pick<Props, 'state' | 'onNavigate'>) {
  const openRegister = () => onNavigate('register');
  return <div className="riskViewStack"><div className="riskMatrixLayout"><Matrix title="Inherent View" matrix={state.dashboard.heatmap.inherent} onDrillDown={openRegister}/><Matrix title="Residual View" matrix={state.dashboard.heatmap.residual} onDrillDown={openRegister}/><Matrix title="Forecast View" matrix={state.dashboard.heatmap.forecast} onDrillDown={openRegister}/><Matrix title="Future Target Risk" matrix={state.dashboard.heatmap.target} onDrillDown={openRegister}/></div><Card className="riskMatrixLegend" aria-label="Risk matrix scoring guide"><strong>Scoring guide</strong><span><i className="legendVeryLow"/> Very Low</span><span><i className="legendLow"/> Low</span><span><i className="legendMedium"/> Medium</span><span><i className="legendHigh"/> High</span><span><i className="legendCritical"/> Critical</span><p>Cells show the number of risks at each likelihood and impact intersection. Select any cell to continue to the Risk Register.</p></Card></div>;
}

function Treatments({ treatments, treatmentSummary, onNavigate, onEditTreatment }: Pick<Props, 'treatments'|'treatmentSummary'|'onNavigate'|'onEditTreatment'>) {
  const [status,setStatus]=useState('all'); const [strategy,setStrategy]=useState('all');
  const visible=treatments.filter((item)=>(status==='all'||item.status===status)&&(strategy==='all'||item.strategy===strategy));
  return <div className="riskViewStack"><div className="riskTreatmentSummary"><Card><span>Open plans</span><strong>{treatmentSummary.open}</strong></Card><Card><span>Recorded treatments</span><strong>{treatmentSummary.total}</strong></Card><Card><span>Average progress</span><strong>{treatmentSummary.averageProgress}%</strong></Card><Card><span>Overdue actions</span><strong>{treatmentSummary.overdue}</strong></Card></div><PageToolbar><select aria-label="Filter treatment plans by status" value={status} onChange={(event)=>setStatus(event.target.value)} style={inputStyle}><option value="all">All statuses</option>{['draft','planned','in_progress','awaiting_evidence','under_review','completed','accepted','deferred','cancelled','overdue'].map((value)=><option key={value} value={value}>{label(value)}</option>)}</select><select aria-label="Filter treatment plans by strategy" value={strategy} onChange={(event)=>setStrategy(event.target.value)} style={inputStyle}><option value="all">All strategies</option>{['mitigate','accept','transfer','avoid','monitor'].map((value)=><option key={value} value={value}>{label(value)}</option>)}</select></PageToolbar><PageSectionCard title="Treatment Plans" subtitle={`${visible.length} of ${treatments.length} plans shown. Live ownership, progress, priority, and due-date posture.`}>{treatments.length===0?<EmptyStatePanel title="No treatment plans recorded" description="Record a treatment from a risk to begin tracking delivery." actions={<Button variant="primary" onClick={()=>onNavigate('register')}>Open Risk Register</Button>}/>:visible.length===0?<EmptyStatePanel title="No treatment plans match these filters" description="Change the status or strategy filter to see treatment plans."/>:<DataTableShell title="Treatment plan results"><div className="riskTreatmentTableViewport" tabIndex={0} aria-label="Treatment plans, scroll to review more records"><table><thead><tr><th>Treatment</th><th>Linked Risk</th><th>Strategy</th><th>Owner</th><th>Status</th><th>Progress</th><th>Due Date</th><th>Priority</th><th>Last Updated</th><th>Actions</th></tr></thead><tbody>{visible.map((item)=><tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.riskTitle||item.riskId}</td><td>{label(item.strategy)}</td><td>{item.owner}</td><td><Badge variant={item.status==='completed'?'success':item.status==='overdue'?'danger':'warning'} size="sm">{label(item.status)}</Badge></td><td><span aria-label={`${item.progressPercent} percent complete`}>{item.progressPercent}%</span></td><td>{new Date(item.dueDate).toLocaleDateString()}</td><td><Badge variant={item.priority==='critical'?'danger':item.priority==='high'?'warning':'default'} size="sm">{label(item.priority)}</Badge></td><td>{new Date(item.updatedAt).toLocaleDateString()}</td><td><Button variant="secondary" onClick={()=>onEditTreatment(item)}>View / Edit</Button></td></tr>)}</tbody></table></div></DataTableShell>}</PageSectionCard></div>;
}

function Reports(props: Props) {
  const { state, reportType, setReportType, onExport, saving } = props;
  return <div className="riskViewStack"><PageToolbar actions={<Button variant="primary" onClick={onExport} disabled={saving}>{saving ? 'Preparing JSON...' : 'Download JSON Report Data'}</Button>}><select aria-label="Report type" value={reportType} onChange={(e) => setReportType(e.target.value as Props['reportType'] & ('risk_committee_report' | 'board_risk_report' | 'executive_risk_summary' | 'kri_report' | 'loss_event_report'))} style={inputStyle}><option value="risk_committee_report">Risk Committee Report</option><option value="board_risk_report">Board Risk Report</option><option value="executive_risk_summary">Executive Risk Summary</option><option value="kri_report">KRI Report</option><option value="loss_event_report">Loss Event Report</option></select><select aria-label="Report format" value="json" disabled style={inputStyle}><option value="json">JSON data</option></select></PageToolbar><div className="riskTwoColumn"><PageSectionCard title="Risk Committee Report" subtitle="Board-ready risk summary using the current intelligence state."><div className="riskNarrative">{state.dashboard.executiveSummary.map((item) => <p key={item}>{item}</p>)}</div></PageSectionCard><PageSectionCard title="Board View" subtitle="Material exposure and governance workload."><div className="riskSummaryStats"><div><span>High-risk vendors</span><strong>{state.dashboard.committeeView.highRiskVendors.length}</strong></div><div><span>Critical assets</span><strong>{state.dashboard.committeeView.criticalAssets.length}</strong></div><div><span>Open treatments</span><strong>{state.dashboard.committeeView.openTreatmentPlans}</strong></div><div><span>Audit findings</span><strong>{state.dashboard.committeeView.auditFindings}</strong></div></div></PageSectionCard></div></div>;
}

export function RiskWorkspaceViews(props: Props) {
  if (props.state.risks.length === 0) return <EmptyStatePanel eyebrow="Risk Platform" title="No risks are in scope yet" description="Create the first risk to activate scoring, forecasting, tolerance monitoring, and intelligence." actions={<Button variant="primary" onClick={props.onNewRisk}>Create First Risk</Button>}/>;
  if (props.activeTab === 'overview') return <Overview {...props}/>;
  if (props.activeTab === 'register') return <RiskRegisterView key={props.workspaceId} {...props}/>;
  if (props.activeTab === 'intelligence') return <Intelligence {...props}/>;
  if (props.activeTab === 'matrix') return <MatrixView {...props}/>;
  if (props.activeTab === 'treatments') return <Treatments {...props}/>;
  return <Reports {...props}/>;
}
