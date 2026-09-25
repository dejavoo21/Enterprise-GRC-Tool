import type { Dispatch, SetStateAction } from 'react';
import { Badge, Button, EmptyStatePanel, PageSectionCard, SummaryMetricStrip } from '../components';
import { getRiskAssuranceImpact } from '../services/continuousAssurance/continuousAssurance';

import type { CiaImpact, Risk, RiskReviewStatus, RiskSeverity, RiskStatus, RiskTreatmentStatus, RiskTreatmentStrategy } from '../types/risk';
import { RiskRegisterView } from './RiskRegisterView';
import { RiskMatrix } from './RiskMatrix';
import { RiskTreatmentWorkspace } from './RiskTreatmentWorkspace';
import { RiskReportsWorkspace } from './RiskReportsWorkspace';
import { RiskIntelligenceWorkspace } from './RiskIntelligenceWorkspace';
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
  preparedReport?: { url: string; filename: string; json: string } | null;
  setReportType: (value: 'risk_committee_report' | 'board_risk_report' | 'executive_risk_summary' | 'kri_report' | 'loss_event_report') => void;
  onNavigate: (tab: RiskWorkspaceTab) => void;
  onNewRisk: () => void;
  onSelectRisk: (risk: RiskIntelligenceRiskSummary) => void;
  onCreateTreatment: (risk: RiskIntelligenceRiskSummary) => void;
  onEditRisk: (risk: RiskIntelligenceRiskSummary) => void;
  treatments: RiskTreatmentPlan[];
  treatmentSummary: RiskTreatmentSummary;
  onEditTreatment: (treatment: RiskTreatmentPlan, focusProgress?: boolean) => void;
  onRefresh: () => void;
  onExport: (format?: 'json' | 'csv' | 'pdf', delivery?: 'download' | 'email') => void;
  onRebalanceWeights: () => void;
  onTightenTolerance: (profile: RiskIntelligenceState['toleranceProfiles'][number]) => void;
};

type Props = RiskWorkspaceViewProps;

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
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

export function RiskWorkspaceViews(props: Props) {
  if (props.state.risks.length === 0 && props.activeTab === 'overview') return <EmptyStatePanel eyebrow="Risk Platform" title="No risks are in scope yet" description="Create the first risk to activate scoring, forecasting, tolerance monitoring, and intelligence." actions={<Button variant="primary" onClick={props.onNewRisk}>Create First Risk</Button>}/>;
  if (props.activeTab === 'overview') return <Overview {...props}/>;
  if (props.activeTab === 'register') return <RiskRegisterView key={props.workspaceId} {...props}/>;
  if (props.activeTab === 'intelligence') return <RiskIntelligenceWorkspace {...props}/>;
  if (props.activeTab === 'matrix') return <RiskMatrix/>;
  if (props.activeTab === 'treatments') return <RiskTreatmentWorkspace {...props}/>;
  return <RiskReportsWorkspace key={props.workspaceId} {...props}/>;
}
