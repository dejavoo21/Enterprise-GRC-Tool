import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  RiskModal,
} from '../components';
import { AppliedQueryFilter } from '../components/AppliedQueryFilter';
import {
  createEmergingRisk,
  createLossEvent,
  createNearMiss,
  createRiskKri,
  fetchRiskIntelligenceState,
  generateRiskReport,
  updateRiskToleranceProfile,
  updateRiskQuantificationWeights,
} from '../lib/api';
import { readAllowedFilter, updateQueryFilters } from '../lib/queryFilters';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { getRiskAssuranceImpact, recordRiskAssuranceAction } from '../services/continuousAssurance/continuousAssurance';
import { theme } from '../theme';
import type { CiaImpact, CreateRiskInput, Risk, RiskReviewStatus, RiskSeverity, RiskStatus, RiskTreatmentStatus, RiskTreatmentStrategy, ApiResponse } from '../types/risk';
import { getRiskSeverity, RISK_STATUS_LABELS } from '../types/risk';
import type {
  RiskIntelligenceRiskSummary,
  RiskIntelligenceState,
  RiskToleranceProfile,
  RiskToleranceStatus,
  RiskTrendDirection,
} from '../types/riskIntelligence';
import { TOLERANCE_STATUS_LABELS } from '../types/riskIntelligence';
import { RiskWorkspaceViews } from './RiskWorkspaceViews';
import './Risks.css';
import './RiskWorkspaceShared.css';

const API_BASE = '/api/v1';

type RiskWorkspaceTab = 'overview' | 'register' | 'intelligence' | 'matrix' | 'treatments' | 'reports';

const RISK_WORKSPACE_TABS: Array<{ id: RiskWorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'register', label: 'Risk Register' },
  { id: 'intelligence', label: 'Risk Intelligence' },
  { id: 'matrix', label: 'Risk Matrix' },
  { id: 'treatments', label: 'Treatment Plans' },
  { id: 'reports', label: 'Reports' },
];

const pageStyle = {
  maxWidth: 1440,
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
};

function toneFromTolerance(status: RiskToleranceStatus): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'within_appetite') return 'success';
  if (status === 'within_tolerance') return 'warning';
  if (status === 'outside_tolerance' || status === 'beyond_capacity') return 'danger';
  return 'default';
}

function trendLabel(direction: RiskTrendDirection) {
  return direction === 'increasing' ? 'Increasing' : direction === 'decreasing' ? 'Decreasing' : 'Stable';
}

export function Risks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const { workspaceId } = useWorkspace();
  const [state, setState] = useState<RiskIntelligenceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCiaImpact, setSelectedCiaImpact] = useState<CiaImpact | 'all'>('all');
  const [selectedOwner, setSelectedOwner] = useState('all');
  const [selectedRating, setSelectedRating] = useState<RiskSeverity | 'all'>('all');
  const [selectedTreatmentStatus, setSelectedTreatmentStatus] = useState<RiskTreatmentStatus | 'all'>('all');
  const [selectedTreatmentStrategy, setSelectedTreatmentStrategy] = useState<RiskTreatmentStrategy | 'all'>('all');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<RiskReviewStatus | 'all'>('all');
  const [reportType, setReportType] = useState<'risk_committee_report' | 'board_risk_report' | 'executive_risk_summary' | 'kri_report' | 'loss_event_report'>('risk_committee_report');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'word' | 'powerpoint'>('pdf');
  const [newKriName, setNewKriName] = useState('');
  const [newKriOwner, setNewKriOwner] = useState('Risk Office');
  const [newKriCategory, setNewKriCategory] = useState('information_security');
  const [lossEventRootCause, setLossEventRootCause] = useState('');
  const [nearMissDescription, setNearMissDescription] = useState('');
  const [emergingRiskTitle, setEmergingRiskTitle] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<RiskIntelligenceRiskSummary | null>(null);
  const [editingRisk, setEditingRisk] = useState<RiskIntelligenceRiskSummary | null>(null);
  const [activeTab, setActiveTab] = useState<RiskWorkspaceTab>(() => searchParams.has('status') || searchParams.has('appetite') ? 'register' : 'overview');
  const [searchQuery, setSearchQuery] = useState('');
  const tabListRef = useRef<HTMLDivElement>(null);
  const riskStatuses = Object.keys(RISK_STATUS_LABELS) as RiskStatus[];
  const toleranceStatuses: RiskToleranceStatus[] = ['within_appetite', 'within_tolerance', 'outside_tolerance', 'beyond_capacity'];
  const queryRiskStatus = readAllowedFilter(searchParams, 'status', riskStatuses);
  const queryAppetite = searchParams.get('appetite');
  const selectedRiskStatus: RiskStatus | 'all' = queryRiskStatus ?? 'all';
  const selectedStatus: RiskToleranceStatus | 'all' = readAllowedFilter(searchParams, 'appetite', toleranceStatuses) ?? 'all';
  const outsideAppetite = queryAppetite === 'outside';
  const setQueryFilter = (key: string, value: string | null) => setSearchParams(updateQueryFilters(searchParams, { [key]: value }));
  const setSelectedRiskStatus = (value: RiskStatus | 'all') => setQueryFilter('status', value === 'all' ? null : value);
  const setSelectedStatus = (value: RiskToleranceStatus | 'all') => setQueryFilter('appetite', value === 'all' ? null : value);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % RISK_WORKSPACE_TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + RISK_WORKSPACE_TABS.length) % RISK_WORKSPACE_TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = RISK_WORKSPACE_TABS.length - 1;
    else return;

    event.preventDefault();
    setActiveTab(RISK_WORKSPACE_TABS[nextIndex].id);
    tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  };

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const nextState = await fetchRiskIntelligenceState();
      setState(nextState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enterprise risk intelligence');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleSaveRisk = async (input: CreateRiskInput) => {
    const response = await fetch(editingRisk ? `${API_BASE}/risks/${editingRisk.id}` : `${API_BASE}/risks`, {
      method: editingRisk ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const result: ApiResponse<Risk> = await response.json();
    if (result.error) throw new Error(result.error.message);
    setEditingRisk(null);
    await fetchState();
  };

  const handleExport = async () => {
    try {
      setSaving(true);
      const pack = await generateRiskReport(reportType, reportFormat);
      const extension = reportFormat === 'powerpoint' ? 'pptx.json' : reportFormat === 'word' ? 'docx.json' : 'pdf.json';
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${pack.title.toLowerCase().replace(/\s+/g, '-')}.${extension}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setSaving(false);
    }
  };

  const handleAddKri = async () => {
    if (!newKriName.trim()) return;
    try {
      setSaving(true);
      await createRiskKri({
        name: newKriName.trim(),
        category: newKriCategory,
        owner: newKriOwner,
        measurementUnit: 'count',
        frequency: 'weekly',
        currentValue: 0,
        targetValue: 0,
        greenThreshold: 0,
        amberThreshold: 1,
        redThreshold: 3,
        sourceModule: 'manual',
        autoCalculated: false,
      });
      setNewKriName('');
      await fetchState();
    } finally {
      setSaving(false);
    }
  };

  const handleAddLossEvent = async () => {
    if (!lossEventRootCause.trim()) return;
    try {
      setSaving(true);
      await createLossEvent({
        eventType: 'operational_failure',
        rootCause: lossEventRootCause,
        impact: 'Operational control degradation',
        eventDate: new Date().toISOString(),
        actualLoss: 15000,
        estimatedLoss: 25000,
        recoveryCost: 5000,
        businessImpact: 'Temporary service disruption',
        lessonsLearned: 'Improve preventive monitoring and control assurance cadence.',
      });
      setLossEventRootCause('');
      await fetchState();
    } finally {
      setSaving(false);
    }
  };

  const handleAddNearMiss = async () => {
    if (!nearMissDescription.trim()) return;
    try {
      setSaving(true);
      await createNearMiss({
        nearMissType: 'unauthorized_access_attempt',
        description: nearMissDescription,
        severity: 'medium',
        rootCause: 'Control bypass attempt',
        potentialImpact: 'Privileged access misuse',
        mitigation: 'Step-up controls and monitoring increased.',
      });
      setNearMissDescription('');
      await fetchState();
    } finally {
      setSaving(false);
    }
  };

  const handleAddEmergingRisk = async () => {
    if (!emergingRiskTitle.trim()) return;
    try {
      setSaving(true);
      await createEmergingRisk({
        title: emergingRiskTitle,
        category: 'ai_governance',
        description: 'New emerging exposure requiring watchlist treatment and trigger monitoring.',
        likelihood: 3,
        impact: 4,
        monitoringStatus: 'watchlist',
        triggerEvents: ['Executive committee request', 'Regulatory development'],
      });
      setEmergingRiskTitle('');
      await fetchState();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTreatment = (risk: RiskIntelligenceRiskSummary) => {
    setEditingRisk(risk);
    setSelectedRisk(null);
    setIsRiskModalOpen(true);
  };

  const handleTightenTolerance = async (profile: RiskToleranceProfile) => {
    try {
      setSaving(true);
      await updateRiskToleranceProfile(profile.category, {
        appetite: Math.max(10, profile.appetite - 2),
        tolerance: Math.max(4, profile.tolerance),
        capacity: profile.capacity,
      });
      await fetchState();
    } finally {
      setSaving(false);
    }
  };

  const handleRebalanceWeights = async () => {
    if (!state) return;
    try {
      setSaving(true);
      await updateRiskQuantificationWeights({
        ...state.weights,
        kriWeight: Number((state.weights.kriWeight + 0.02).toFixed(4)),
        lossEventsWeight: Number((state.weights.lossEventsWeight + 0.01).toFixed(4)),
        nearMissEventsWeight: Number((state.weights.nearMissEventsWeight + 0.01).toFixed(4)),
        impactWeight: Number((state.weights.impactWeight - 0.02).toFixed(4)),
        evidenceConfidenceWeight: Number((state.weights.evidenceConfidenceWeight - 0.02).toFixed(4)),
      });
      await fetchState();
    } finally {
      setSaving(false);
    }
  };

  const filteredRisks = useMemo(() => {
    if (!state) return [];
    return state.risks.filter((risk) => {
      if (selectedCategory !== 'all' && risk.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && risk.appetiteStatus !== selectedStatus) return false;
      if (outsideAppetite && risk.appetiteStatus === 'within_appetite') return false;
      if (selectedCiaImpact !== 'all' && !risk.ciaImpacts.includes(selectedCiaImpact)) return false;
      if (selectedOwner !== 'all' && risk.owner !== selectedOwner) return false;
      if (selectedRating !== 'all' && getRiskSeverity(risk.residualScore) !== selectedRating) return false;
      if (selectedRiskStatus !== 'all' && risk.status !== selectedRiskStatus) return false;
      if (selectedTreatmentStatus !== 'all' && (risk.treatmentStatus || 'not_started') !== selectedTreatmentStatus) return false;
      if (selectedTreatmentStrategy !== 'all' && risk.treatmentStrategy !== selectedTreatmentStrategy) return false;
      if (selectedReviewStatus !== 'all' && (risk.reviewStatus || 'not_reviewed') !== selectedReviewStatus) return false;
      const query = searchQuery.trim().toLowerCase();
      if (query && ![risk.title, risk.owner, risk.category, risk.status].some((value) => String(value).toLowerCase().includes(query))) return false;
      return true;
    });
  }, [outsideAppetite, searchQuery, selectedCategory, selectedCiaImpact, selectedOwner, selectedRating, selectedReviewStatus, selectedRiskStatus, selectedStatus, selectedTreatmentStatus, selectedTreatmentStrategy, state]);

  const filteredKris = useMemo(() => {
    if (!state) return [];
    return state.kris.filter((kri) => selectedCategory === 'all' || kri.category === selectedCategory);
  }, [selectedCategory, state]);

  const metrics = useMemo(() => {
    if (!state) return [];
    return [
      { label: 'Total Risks', value: state.dashboard.summary.totalRisks, detail: 'Risks in the intelligence model', tone: 'primary' as const },
      { label: 'Appetite Breaches', value: state.dashboard.summary.appetiteBreaches, detail: 'Require committee attention', tone: 'danger' as const },
      { label: 'Capacity Breaches', value: state.dashboard.summary.capacityBreaches, detail: 'Beyond stated capacity', tone: 'danger' as const },
      { label: 'Critical KRIs', value: state.dashboard.summary.criticalKris, detail: 'Thresholds in red', tone: 'warning' as const },
      { label: 'Loss + Near Misses', value: state.dashboard.summary.totalLossEvents + state.dashboard.summary.totalNearMisses, detail: 'Operational signal volume', tone: 'default' as const },
    ];
  }, [state]);

  if (loading) {
    return (
      <div className="riskWorkspacePage riskRegisterPage" style={pageStyle}>
        <PageHeader breadcrumb="Risk Workspace / Risk Register" title="Enterprise Risk Intelligence" description="Weighted scoring, capacity, KRIs, forecasts, and treatment governance." />
        <PageSectionCard title="Loading Risk Intelligence">
          <div style={{ color: theme.colors.text.secondary }}>Loading enterprise risk analytics...</div>
        </PageSectionCard>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="riskWorkspacePage riskRegisterPage" style={pageStyle}>
        <PageHeader breadcrumb="Risk Workspace / Risk Register" title="Enterprise Risk Intelligence" description="Weighted scoring, capacity, KRIs, forecasts, and treatment governance." />
        <EmptyStatePanel
          eyebrow="Risk Intelligence"
          title="Unable to load the risk intelligence platform"
          description={error || 'The platform could not load the risk intelligence state.'}
          actions={<Button variant="primary" onClick={fetchState}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <main className="riskWorkspacePage riskRegisterPage" style={pageStyle}>
      <PageHeader
        breadcrumb="Risk Workspace / Risk Register"
        title="Enterprise Risk Intelligence"
        description="Executive decision support across enterprise risk, treatment, appetite, capacity, and reporting."
        action={<Button variant="primary" onClick={() => { setEditingRisk(null); setActiveTab('register'); setIsRiskModalOpen(true); }}>New Risk</Button>}
      />

      <nav className="riskSubnav" aria-label="Risk workspace sections">
        <div className="riskSubnavScroll" role="tablist" ref={tabListRef}>
          {RISK_WORKSPACE_TABS.map((tab, index) => (
            <button
              key={tab.id}
              id={`risk-tab-${tab.id}`}
              className={activeTab === tab.id ? 'riskSubnavTab riskSubnavTab-active' : 'riskSubnavTab'}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`risk-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {queryRiskStatus || outsideAppetite ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Applied Risk Register filters">
          {queryRiskStatus ? <AppliedQueryFilter label={`${RISK_STATUS_LABELS[queryRiskStatus]} risks`} onRemove={() => setQueryFilter('status', null)} /> : null}
          {outsideAppetite ? <AppliedQueryFilter label="Outside appetite" onRemove={() => setQueryFilter('appetite', null)} /> : null}
        </div>
      ) : null}

      <section id={`risk-panel-${activeTab}`} role="tabpanel" aria-labelledby={`risk-tab-${activeTab}`}>
        <RiskWorkspaceViews
          activeTab={activeTab}
          state={state}
          metrics={metrics}
          filteredRisks={filteredRisks}
          filteredKris={filteredKris}
          workspaceId={workspaceId}
          saving={saving}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          selectedCiaImpact={selectedCiaImpact}
          setSelectedCiaImpact={setSelectedCiaImpact}
          selectedOwner={selectedOwner}
          setSelectedOwner={setSelectedOwner}
          selectedRating={selectedRating}
          setSelectedRating={setSelectedRating}
          selectedRiskStatus={selectedRiskStatus}
          setSelectedRiskStatus={setSelectedRiskStatus}
          selectedTreatmentStatus={selectedTreatmentStatus}
          setSelectedTreatmentStatus={setSelectedTreatmentStatus}
          selectedTreatmentStrategy={selectedTreatmentStrategy}
          setSelectedTreatmentStrategy={setSelectedTreatmentStrategy}
          selectedReviewStatus={selectedReviewStatus}
          setSelectedReviewStatus={setSelectedReviewStatus}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          reportType={reportType}
          setReportType={setReportType}
          reportFormat={reportFormat}
          setReportFormat={setReportFormat}
          newKriName={newKriName}
          setNewKriName={setNewKriName}
          newKriOwner={newKriOwner}
          setNewKriOwner={setNewKriOwner}
          newKriCategory={newKriCategory}
          setNewKriCategory={setNewKriCategory}
          lossEventRootCause={lossEventRootCause}
          setLossEventRootCause={setLossEventRootCause}
          nearMissDescription={nearMissDescription}
          setNearMissDescription={setNearMissDescription}
          emergingRiskTitle={emergingRiskTitle}
          setEmergingRiskTitle={setEmergingRiskTitle}
          onNavigate={setActiveTab}
          onNewRisk={() => { setEditingRisk(null); setIsRiskModalOpen(true); }}
          onSelectRisk={setSelectedRisk}
          onCreateTreatment={handleCreateTreatment}
          onRefresh={fetchState}
          onExport={handleExport}
          onRebalanceWeights={handleRebalanceWeights}
          onTightenTolerance={handleTightenTolerance}
          onAddKri={handleAddKri}
          onAddLossEvent={handleAddLossEvent}
          onAddNearMiss={handleAddNearMiss}
          onAddEmergingRisk={handleAddEmergingRisk}
        />
      </section>
      <RiskModal isOpen={isRiskModalOpen} initialRisk={editingRisk} onClose={() => { setIsRiskModalOpen(false); setEditingRisk(null); }} onSubmit={handleSaveRisk} />

      {selectedRisk ? (
        <>
          <div
            onClick={() => setSelectedRisk(null)}
            style={{ position: 'fixed', inset: 0, background: theme.colors.overlay, zIndex: 40 }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 'min(620px, 100vw)',
              height: '100vh',
              overflowY: 'auto',
              background: theme.colors.surface,
              borderLeft: `1px solid ${theme.colors.border}`,
              boxShadow: theme.shadows.xl,
              zIndex: 41,
              padding: theme.spacing[5],
              display: 'grid',
              gap: theme.spacing[4],
            }}
          >
            {(() => {
              const impact = workspaceId ? getRiskAssuranceImpact(workspaceId, selectedRisk as unknown as Risk) : null;
              const linkedFailedControls = impact?.failedLinkedControls.map((item) => item.controlId) || [];
              const detailRows = [
                ['Description', selectedRisk.description || 'No description recorded.'],
                ['Category', selectedRisk.category.replace(/_/g, ' ')],
                ['Owner', selectedRisk.owner],
                ['Inherent Risk', `${Math.round(selectedRisk.inherentScore)}`],
                ['Residual Risk', `${Math.round(selectedRisk.residualScore)}`],
                ['Target Risk', selectedRisk.targetLikelihood && selectedRisk.targetImpact ? `${selectedRisk.targetLikelihood * selectedRisk.targetImpact}` : 'Not yet recorded'],
                ['Treatment Strategy', selectedRisk.treatmentStrategy?.replace(/_/g, ' ') || 'Not set'],
                ['Treatment Status', selectedRisk.treatmentStatus?.replace(/_/g, ' ') || 'Not started'],
                ['Treatment Owner', selectedRisk.treatmentOwner || 'Not assigned'],
                ['Treatment Progress', `${selectedRisk.treatmentProgress || 0}%`],
                ['Treatment Due', selectedRisk.treatmentDueDate ? new Date(selectedRisk.treatmentDueDate).toLocaleDateString() : 'Not set'],
                ['Treatment Plan', selectedRisk.treatmentPlan || 'No treatment plan recorded.'],
                ['Acceptance Rationale', selectedRisk.acceptanceRationale || 'Not applicable'],
                ['Review Status', selectedRisk.reviewStatus?.replace(/_/g, ' ') || 'Not reviewed'],
                ['Next Review', selectedRisk.nextReviewDate ? new Date(selectedRisk.nextReviewDate).toLocaleDateString() : 'Not set'],
                ['Review Owner', selectedRisk.reviewOwner || 'Not assigned'],
                ['Review Notes', selectedRisk.reviewNotes || 'No review notes recorded.'],
                ['Risk Status', selectedRisk.status.replace(/_/g, ' ')],
                ['Assurance Impact', `${impact?.assuranceImpact || 0} point penalty`],
              ] as const;

              const takeAction = async (action: 'treated' | 'escalated' | 'accepted' | 'transferred') => {
                if (workspaceId) {
                  await recordRiskAssuranceAction(workspaceId, role, selectedRisk.id, action, `${selectedRisk.title} ${action}.`);
                }
                if (action === 'treated') handleCreateTreatment(selectedRisk);
              };

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.colors.text.muted }}>
                        Risk Detail
                      </div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
                        {selectedRisk.title}
                      </div>
                      <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Badge variant={toneFromTolerance(selectedRisk.appetiteStatus)} size="sm">{TOLERANCE_STATUS_LABELS[selectedRisk.appetiteStatus]}</Badge>
                        <Badge variant={selectedRisk.trend === 'increasing' ? 'danger' : selectedRisk.trend === 'decreasing' ? 'success' : 'default'} size="sm">{trendLabel(selectedRisk.trend)}</Badge>
                        {selectedRisk.ciaImpacts.map((impact) => <Badge key={impact} variant="primary" size="sm">{impact}</Badge>)}
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => setSelectedRisk(null)}>Close</Button>
                  </div>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
                      {detailRows.map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{label}</div>
                          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Risk Relationship Map</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      <div>Controls: {linkedFailedControls.join(', ') || 'No linked control failures recorded.'}</div>
                      <div>Evidence and action relationships will appear only when explicitly linked to this risk.</div>
                    </div>
                  </Card>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Control Coverage View</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
                      {linkedFailedControls.length === 0 ? (
                        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>No linked controls yet.</div>
                      ) : linkedFailedControls.map((controlId) => (
                        <div key={controlId} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
                          <span style={{ color: theme.colors.text.secondary }}>{controlId}</span>
                          <Badge variant={impact?.failedLinkedControls.some((item) => item.controlId === controlId) ? 'danger' : 'success'} size="sm">
                            {impact?.failedLinkedControls.some((item) => item.controlId === controlId) ? 'degraded' : 'covered'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Assurance Impact Panel</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      <div>Failed linked controls: {impact?.failedLinkedControls.length || 0}</div>
                      <div>Evidence gaps: {impact?.evidenceGaps.length || 0}</div>
                      <div>Drift alerts: {impact?.driftAlerts.length || 0}</div>
                      <div>Unresolved exceptions: {impact?.unresolvedExceptions.length || 0}</div>
                    </div>
                  </Card>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Drift Impact Panel</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      {(impact?.driftAlerts.length || 0) === 0 ? 'No active drift pressure is mapped to this risk.' : impact?.driftAlerts.map((alert) => `${alert.driftType}: ${alert.affectedObject}`).join(' | ')}
                    </div>
                  </Card>

                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    <Button variant="primary" onClick={() => { setEditingRisk(selectedRisk); setSelectedRisk(null); setIsRiskModalOpen(true); }}>Edit Risk</Button>
                    <Button variant="secondary" onClick={() => void takeAction('treated')}>Treat Risk</Button>
                    <Button variant="secondary" onClick={() => void takeAction('escalated')}>Escalate</Button>
                    <Button variant="secondary" onClick={() => void takeAction('accepted')}>Accept</Button>
                    <Button variant="secondary" onClick={() => void takeAction('transferred')}>Transfer</Button>
                    <Button variant="secondary" onClick={() => void takeAction('treated')}>Link Control</Button>
                    <Button variant="secondary" onClick={() => void takeAction('treated')}>Link Evidence</Button>
                  </div>
                </>
              );
            })()}
          </aside>
        </>
      ) : null}
    </main>
  );
}

export default Risks;
