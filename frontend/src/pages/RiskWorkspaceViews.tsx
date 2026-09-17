import type { Dispatch, SetStateAction } from 'react';
import { Badge, Button, Card, DataTableShell, EmptyStatePanel, PageSectionCard, PageToolbar, SummaryMetricStrip } from '../components';
import { getRiskAssuranceImpact } from '../services/continuousAssurance/continuousAssurance';
import { theme } from '../theme';
import type { Risk } from '../types/risk';
import type { RiskIntelligenceRiskSummary, RiskIntelligenceState, RiskToleranceStatus } from '../types/riskIntelligence';
import { TOLERANCE_STATUS_LABELS } from '../types/riskIntelligence';

export type RiskWorkspaceTab = 'overview' | 'register' | 'intelligence' | 'matrix' | 'treatments' | 'reports';

type Props = {
  activeTab: RiskWorkspaceTab;
  state: RiskIntelligenceState;
  metrics: Array<{ label: string; value: string | number; detail?: string; tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' }>;
  filteredRisks: RiskIntelligenceRiskSummary[];
  filteredKris: RiskIntelligenceState['kris'];
  workspaceId?: string | null;
  saving: boolean;
  selectedCategory: string;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  selectedStatus: RiskToleranceStatus | 'all';
  setSelectedStatus: Dispatch<SetStateAction<RiskToleranceStatus | 'all'>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  reportType: string;
  setReportType: (value: 'risk_committee_report' | 'board_risk_report' | 'executive_risk_summary' | 'kri_report' | 'loss_event_report') => void;
  reportFormat: string;
  setReportFormat: (value: 'pdf' | 'word' | 'powerpoint') => void;
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
  onRefresh: () => void;
  onExport: () => void;
  onRebalanceWeights: () => void;
  onTightenTolerance: (profile: RiskIntelligenceState['toleranceProfiles'][number]) => void;
  onAddKri: () => void;
  onAddLossEvent: () => void;
  onAddNearMiss: () => void;
  onAddEmergingRisk: () => void;
};

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

function Matrix({ title, matrix }: { title: string; matrix: number[][] }) {
  return (
    <Card className="riskMatrixCard">
      <h3>{title}</h3>
      <div className="riskMatrixGrid" aria-label={`${title} 5 by 5 heatmap`}>
        {matrix.flatMap((row, rowIndex) => row.map((value, columnIndex) => (
          <div className={`riskMatrixCell riskMatrixCell-${value >= 4 ? 'high' : value >= 2 ? 'medium' : value >= 1 ? 'low' : 'empty'}`} key={`${rowIndex}-${columnIndex}`}>
            {value}
          </div>
        )))}
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

function Register(props: Props) {
  const { state, filteredRisks, selectedCategory, setSelectedCategory, selectedStatus, setSelectedStatus, searchQuery, setSearchQuery, onNewRisk, onRefresh, onSelectRisk, onCreateTreatment, saving } = props;
  return (
    <div className="riskViewStack">
      <PageToolbar actions={<><Button variant="secondary" onClick={onRefresh}>Refresh</Button><Button variant="primary" onClick={onNewRisk}>New Risk</Button></>}>
        <input aria-label="Search risks" placeholder="Search risk, owner, category..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} style={{ ...inputStyle, minWidth: 240 }} />
        <select aria-label="Filter by category" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} style={inputStyle}><option value="all">All categories</option>{state.toleranceProfiles.map((profile) => <option key={profile.id} value={profile.category}>{label(profile.category)}</option>)}</select>
        <select aria-label="Filter by status band" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as RiskToleranceStatus | 'all')} style={inputStyle}><option value="all">All status bands</option><option value="within_appetite">Within Appetite</option><option value="within_tolerance">Within Tolerance</option><option value="outside_tolerance">Outside Tolerance</option><option value="beyond_capacity">Beyond Capacity</option></select>
      </PageToolbar>
      <PageSectionCard title="Dynamic Risk Register" subtitle={`${filteredRisks.length} of ${state.risks.length} risks shown. CIA impact is captured on every new risk.`}>
        <DataTableShell title="Risk register results">
          <table><thead><tr><th>Risk</th><th>Category</th><th>Status Band</th><th>Dynamic</th><th>Residual</th><th>Forecast 90d</th><th>Trend</th><th>Actions</th></tr></thead>
          <tbody>{filteredRisks.map((risk) => <tr key={risk.id}><td><strong>{risk.title}</strong><div className="riskCellMeta">{risk.owner}</div></td><td>{label(risk.category)}</td><td><Badge variant={riskTone(risk.appetiteStatus)} size="sm">{TOLERANCE_STATUS_LABELS[risk.appetiteStatus]}</Badge></td><td>{Math.round(risk.dynamicScore)}</td><td>{Math.round(risk.residualScore)}</td><td>{Math.round(risk.forecast90DayScore)}</td><td>{label(risk.trend)}</td><td><div className="riskTableActions"><Button variant="ghost" onClick={() => onSelectRisk(risk)}>View</Button><Button variant="secondary" disabled={saving} onClick={() => onCreateTreatment(risk)}>Record Treatment</Button></div></td></tr>)}</tbody></table>
        </DataTableShell>
        {filteredRisks.length === 0 ? <EmptyStatePanel title="No risks match these filters" description="Adjust the search, category, or status band to see risk records." /> : null}
      </PageSectionCard>
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

function MatrixView({ state }: Pick<Props, 'state'>) {
  return <div className="riskViewStack"><div className="riskMatrixLayout"><Matrix title="Inherent View" matrix={state.dashboard.heatmap.inherent}/><Matrix title="Residual View" matrix={state.dashboard.heatmap.residual}/><Matrix title="Forecast View" matrix={state.dashboard.heatmap.forecast}/><Matrix title="Future Target Risk" matrix={state.dashboard.heatmap.target}/></div><Card className="riskMatrixLegend"><strong>Scoring guide</strong><span><i className="legendLow"/> Low concentration</span><span><i className="legendMedium"/> Moderate concentration</span><span><i className="legendHigh"/> High concentration</span><p>Cells show the number of risks at each likelihood and impact intersection. Views use existing calculated risk data.</p></Card></div>;
}

function Treatments({ state, onNavigate }: Pick<Props, 'state' | 'onNavigate'>) {
  const overdue = state.treatments.filter((item) => item.status === 'overdue');
  const average = state.treatments.length ? Math.round(state.treatments.reduce((sum, item) => sum + item.treatmentEffectivenessPercent, 0) / state.treatments.length) : 0;
  return <div className="riskViewStack"><div className="riskTreatmentSummary"><Card><span>Open plans</span><strong>{state.dashboard.committeeView.openTreatmentPlans}</strong></Card><Card><span>Recorded treatments</span><strong>{state.treatments.length}</strong></Card><Card><span>Average effectiveness</span><strong>{average}%</strong></Card><Card><span>Overdue actions</span><strong>{overdue.length}</strong></Card></div><PageSectionCard title="Treatment Plans" subtitle="Progress, overdue actions, and status by linked risk.">{state.treatments.length === 0 ? <EmptyStatePanel title="No treatments recorded" description="Record a treatment from the Risk Register to begin tracking remediation." actions={<Button variant="primary" onClick={() => onNavigate('register')}>Open Risk Register</Button>}/> : <DataTableShell title="Treatment plan results"><table><thead><tr><th>Treatment</th><th>Owner</th><th>Status</th><th>Expected</th><th>Actual</th><th>Effectiveness</th><th>Due</th></tr></thead><tbody>{state.treatments.map((item) => <tr key={item.id}><td><strong>{item.treatmentName}</strong><div className="riskCellMeta">Risk {item.riskId}</div></td><td>{item.owner}</td><td><Badge variant={item.status === 'completed' ? 'success' : item.status === 'overdue' ? 'danger' : 'warning'} size="sm">{label(item.status)}</Badge></td><td>{item.expectedRiskReduction}</td><td>{item.actualRiskReduction}</td><td>{Math.round(item.treatmentEffectivenessPercent)}%</td><td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Not set'}</td></tr>)}</tbody></table></DataTableShell>}</PageSectionCard></div>;
}

function Reports(props: Props) {
  const { state, reportType, setReportType, reportFormat, setReportFormat, onExport, saving } = props;
  return <div className="riskViewStack"><PageToolbar actions={<Button variant="primary" onClick={onExport} disabled={saving}>{saving ? 'Preparing...' : 'Export Report Pack'}</Button>}><select aria-label="Report type" value={reportType} onChange={(e) => setReportType(e.target.value as Props['reportType'] & ('risk_committee_report' | 'board_risk_report' | 'executive_risk_summary' | 'kri_report' | 'loss_event_report'))} style={inputStyle}><option value="risk_committee_report">Risk Committee Report</option><option value="board_risk_report">Board Risk Report</option><option value="executive_risk_summary">Executive Risk Summary</option><option value="kri_report">KRI Report</option><option value="loss_event_report">Loss Event Report</option></select><select aria-label="Report format" value={reportFormat} onChange={(e) => setReportFormat(e.target.value as 'pdf' | 'word' | 'powerpoint')} style={inputStyle}><option value="pdf">PDF</option><option value="word">Word</option><option value="powerpoint">PowerPoint</option></select></PageToolbar><div className="riskTwoColumn"><PageSectionCard title="Risk Committee Report" subtitle="Board-ready risk summary using the current intelligence state."><div className="riskNarrative">{state.dashboard.executiveSummary.map((item) => <p key={item}>{item}</p>)}</div></PageSectionCard><PageSectionCard title="Board View" subtitle="Material exposure and governance workload."><div className="riskSummaryStats"><div><span>High-risk vendors</span><strong>{state.dashboard.committeeView.highRiskVendors.length}</strong></div><div><span>Critical assets</span><strong>{state.dashboard.committeeView.criticalAssets.length}</strong></div><div><span>Open treatments</span><strong>{state.dashboard.committeeView.openTreatmentPlans}</strong></div><div><span>Audit findings</span><strong>{state.dashboard.committeeView.auditFindings}</strong></div></div></PageSectionCard></div></div>;
}

export function RiskWorkspaceViews(props: Props) {
  if (props.state.risks.length === 0) return <EmptyStatePanel eyebrow="Risk Platform" title="No risks are in scope yet" description="Create the first risk to activate scoring, forecasting, tolerance monitoring, and intelligence." actions={<Button variant="primary" onClick={props.onNewRisk}>Create First Risk</Button>}/>;
  if (props.activeTab === 'overview') return <Overview {...props}/>;
  if (props.activeTab === 'register') return <Register {...props}/>;
  if (props.activeTab === 'intelligence') return <Intelligence {...props}/>;
  if (props.activeTab === 'matrix') return <MatrixView {...props}/>;
  if (props.activeTab === 'treatments') return <Treatments {...props}/>;
  return <Reports {...props}/>;
}
