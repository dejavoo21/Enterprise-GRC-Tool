import { residualRating, targetRiskScore } from '../lib/riskScoreProfile';
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
  RiskTreatmentModal,
} from '../components';
import { Modal } from '../components/Modal';
import { RiskScoreProfile } from '../components/RiskScoreProfile';
import { AppliedQueryFilter } from '../components/AppliedQueryFilter';
import {
  apiCall,
  fetchRiskIntelligenceState,
  updateRiskToleranceProfile,
  updateRiskQuantificationWeights,
  createRiskTreatmentPlan,
  listRiskTreatmentPlans,
  updateRiskTreatmentPlan,
  getRiskTreatmentSummary,
} from '../lib/api';
import { readAllowedFilter, updateQueryFilters } from '../lib/queryFilters';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { getRiskAssuranceImpact, recordRiskAssuranceAction } from '../services/continuousAssurance/continuousAssurance';
import { theme } from '../theme';
import type { CiaImpact, CreateRiskInput, Risk, RiskReviewStatus, RiskSeverity, RiskStatus, RiskTreatmentStatus, RiskTreatmentStrategy, ApiResponse } from '../types/risk';
import { normalizeCiaImpacts, RISK_STATUS_LABELS } from '../types/risk';
import { matchesRiskReference, matchesRiskStatus } from '../lib/riskStatusFilter';
import type {
  RiskIntelligenceRiskSummary,
  RiskIntelligenceState,
  RiskToleranceProfile,
  RiskToleranceStatus,
  RiskTrendDirection,
} from '../types/riskIntelligence';
import { TOLERANCE_STATUS_LABELS } from '../types/riskIntelligence';
import type { RiskTreatmentPlan, RiskTreatmentPlanInput, RiskTreatmentSummary } from '../types/riskTreatment';
import { RiskWorkspaceViews } from './RiskWorkspaceViews';
import { RiskRegisterKpis } from './RiskRegisterView';
import './Risks.css';
import './RiskWorkspaceShared.css';
import './RiskRegisterView.css';
import './RiskVisualSystem.css';

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
  const [treatments, setTreatments] = useState<RiskTreatmentPlan[]>([]);
  const [treatmentSummary, setTreatmentSummary] = useState<RiskTreatmentSummary>({ total:0, open:0, overdue:0, completed:0, averageProgress:0, byStatus:{}, byStrategy:{} });
  const [treatmentRisk, setTreatmentRisk] = useState<RiskIntelligenceRiskSummary | null>(null);
  const [treatmentProgressFocus, setTreatmentProgressFocus] = useState(false);
  const [treatmentPickerOpen, setTreatmentPickerOpen] = useState(false);
  const [treatmentPickerRiskId, setTreatmentPickerRiskId] = useState('');
  const [editingTreatment, setEditingTreatment] = useState<RiskTreatmentPlan | null>(null);
  const [treatmentError, setTreatmentError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCiaImpact, setSelectedCiaImpact] = useState<CiaImpact | 'all'>('all');
  const [selectedOwner, setSelectedOwner] = useState('all');
  const [selectedRating, setSelectedRating] = useState<RiskSeverity | 'all'>('all');
  const [selectedTreatmentStatus, setSelectedTreatmentStatus] = useState<RiskTreatmentStatus | 'all'>('all');
  const [selectedTreatmentStrategy, setSelectedTreatmentStrategy] = useState<RiskTreatmentStrategy | 'all'>('all');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<RiskReviewStatus | 'all'>('all');
  const [reportType, setReportType] = useState<'risk_committee_report' | 'board_risk_report' | 'executive_risk_summary' | 'kri_report' | 'loss_event_report'>('risk_committee_report');
  const [actionFeedback, setActionFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [preparedReport, setPreparedReport] = useState<{ url: string; filename: string; json: string; workspaceId: typeof workspaceId } | null>(null);
  const reportRequest = useRef(0);
  useEffect(() => () => { if (preparedReport) URL.revokeObjectURL(preparedReport.url); }, [preparedReport]);
  useEffect(() => {
    const requestRef = reportRequest;
    setPreparedReport(null);
    setActionFeedback(null);
    setSaving(false);
    return () => { requestRef.current++; };
  }, [workspaceId]);
  const [selectedRisk, setSelectedRisk] = useState<RiskIntelligenceRiskSummary | null>(null);
  const [editingRisk, setEditingRisk] = useState<RiskIntelligenceRiskSummary | null>(null);
  const [activeTab, setActiveTabState] = useState<RiskWorkspaceTab>(() => searchParams.get('tab') === 'treatment-plans' ? 'treatments' : 'register');
  const [searchQuery, setSearchQuery] = useState('');
  const tabListRef = useRef<HTMLDivElement>(null);
  const riskStatuses = Object.keys(RISK_STATUS_LABELS) as RiskStatus[];
  const toleranceStatuses: RiskToleranceStatus[] = ['within_appetite', 'within_tolerance', 'outside_tolerance', 'beyond_capacity'];
  const queryRiskStatus = readAllowedFilter(searchParams, 'status', riskStatuses);
  const queryAppetite = searchParams.get('appetite');
  const queryRiskRef = searchParams.get('riskRef');
  const selectedRiskStatus: RiskStatus | 'all' = queryRiskStatus ?? 'all';
  const selectedStatus: RiskToleranceStatus | 'all' = readAllowedFilter(searchParams, 'appetite', toleranceStatuses) ?? 'all';
  const outsideAppetite = queryAppetite === 'outside';
  const setQueryFilter = (key: string, value: string | null) => setSearchParams(updateQueryFilters(searchParams, { [key]: value }));
  const setSelectedRiskStatus = (value: RiskStatus | 'all') => setQueryFilter('status', value === 'all' ? null : value);
  const setSelectedStatus = (value: RiskToleranceStatus | 'all') => setQueryFilter('appetite', value === 'all' ? null : value);
  const setActiveTab = useCallback((tab: RiskWorkspaceTab) => {
    setActiveTabState(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'treatments') next.set('tab', 'treatment-plans');
    else if (tab === 'overview') next.set('tab', 'overview');
    else if (tab === 'register') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const requested = searchParams.get('tab');
    const nextTab: RiskWorkspaceTab = requested === 'treatment-plans'
      ? 'treatments'
      : RISK_WORKSPACE_TABS.some((tab) => tab.id === requested)
        ? requested as RiskWorkspaceTab
        : 'register';
    setActiveTabState(nextTab);
  }, [searchParams]);

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

  const requestSequence = useRef(0);
  const fetchState = useCallback(async (preserveView = false) => {
    const sequence = ++requestSequence.current;
    try {
      if (!preserveView) setLoading(true);
      setError(null);
      const [nextState, nextTreatments, nextSummary] = await Promise.all([
        fetchRiskIntelligenceState(),
        listRiskTreatmentPlans(),
        getRiskTreatmentSummary(),
      ]);
      if (sequence !== requestSequence.current) return;
      setState(nextState);
      setTreatments(nextTreatments);
      setTreatmentSummary(nextSummary);
    } catch (err) {
      if (sequence === requestSequence.current) setError(err instanceof Error ? err.message : 'Failed to load enterprise risk intelligence');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sequenceRef = requestSequence;
    setState(null); setSelectedRisk(null); setEditingRisk(null); setIsRiskModalOpen(false);
    setTreatmentRisk(null); setEditingTreatment(null); setTreatments([]);
    setTreatmentPickerOpen(false); setTreatmentPickerRiskId('');
    fetchState();
    return () => { sequenceRef.current++; };
  }, [fetchState, workspaceId]);

  const handleSaveRisk = async (input: CreateRiskInput) => {
    const result = await apiCall<ApiResponse<Risk>>(editingRisk ? `${API_BASE}/risks/${editingRisk.id}` : `${API_BASE}/risks`, {
      method: editingRisk ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (result.error) throw new Error(result.error.message);
    setEditingRisk(null);
    await fetchState();
  };

  const handleExport = async (format: 'json' | 'csv' | 'pdf' = 'json', delivery: 'download' | 'email' = 'download') => {
    const request = ++reportRequest.current;
    try {
      setSaving(true);
      setActionFeedback(null);
      const { data: result } = await apiCall<{ data: { filename: string; contentType: string; base64: string; pack: unknown; message?: string } }>(`${API_BASE}/risk-intelligence/reports/${reportType}/deliver`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format, delivery, confirmed: delivery === 'email' }) });
      if (request !== reportRequest.current) return;
      if (delivery === 'email') {
        setActionFeedback({ tone: 'success', message: result.message || 'Mail server accepted the report.' });
        return;
      }
      const json = JSON.stringify(result.pack, null, 2);
      const blob = new Blob([Uint8Array.from(atob(result.base64), character => character.charCodeAt(0))], { type: result.contentType });
      const link = document.createElement('a');
      const downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = result.filename;
      setPreparedReport({ url: downloadUrl, filename: link.download, json, workspaceId });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setActionFeedback({ tone: 'success', message: `${format.toUpperCase()} report prepared. Check browser downloads, or use the prepared report link below.` });
    } catch (error) {
      if (request === reportRequest.current) setActionFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to download report data.' });
    } finally {
      if (request === reportRequest.current) setSaving(false);
    }
  };

  const handleEditRisk = (risk: RiskIntelligenceRiskSummary) => { setEditingRisk(risk); setSelectedRisk(null); setIsRiskModalOpen(true); };
  const handleCreateTreatment = (risk: RiskIntelligenceRiskSummary, treatment?: RiskTreatmentPlan) => { setTreatmentProgressFocus(false); setSelectedRisk(null); setTreatmentRisk(risk); setEditingTreatment(treatment || null); setTreatmentError(null); };
  const handleSaveTreatment = async (input: RiskTreatmentPlanInput) => {
    if (!treatmentRisk) return;
    try { setSaving(true); setTreatmentError(null); if (editingTreatment) await updateRiskTreatmentPlan(editingTreatment.id,input); else await createRiskTreatmentPlan(treatmentRisk.id,input); await fetchState(true); setTreatmentRisk(null); setEditingTreatment(null); setActionFeedback({tone:'success',message:editingTreatment?'Treatment plan updated.':'Treatment plan created.'}); }
    catch(error){ setTreatmentError(error instanceof Error?error.message:'Unable to save treatment plan.'); }
    finally{ setSaving(false); }
  };

  const handleTightenTolerance = async (profile: RiskToleranceProfile) => {
    try {
      setSaving(true);
      setActionFeedback(null);
      await updateRiskToleranceProfile(profile.category, {
        appetite: Math.max(10, profile.appetite - 2),
        tolerance: Math.max(4, profile.tolerance),
        capacity: profile.capacity,
      });
      await fetchState();
      setActionFeedback({ tone: 'success', message: `${profile.category.replaceAll('_', ' ')} tolerance updated.` });
    } catch (error) {
      setActionFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to update tolerance.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRebalanceWeights = async () => {
    if (!state) return;
    try {
      setSaving(true);
      setActionFeedback(null);
      await updateRiskQuantificationWeights({
        ...state.weights,
        kriWeight: Number((state.weights.kriWeight + 0.02).toFixed(4)),
        lossEventsWeight: Number((state.weights.lossEventsWeight + 0.01).toFixed(4)),
        nearMissEventsWeight: Number((state.weights.nearMissEventsWeight + 0.01).toFixed(4)),
        impactWeight: Number((state.weights.impactWeight - 0.02).toFixed(4)),
        evidenceConfidenceWeight: Number((state.weights.evidenceConfidenceWeight - 0.02).toFixed(4)),
      });
      await fetchState();
      setActionFeedback({ tone: 'success', message: 'Risk quantification weights rebalanced.' });
    } catch (error) {
      setActionFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to rebalance risk weights.' });
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
      if (selectedCiaImpact !== 'all' && !normalizeCiaImpacts(risk.ciaImpacts).includes(selectedCiaImpact)) return false;
      if (selectedOwner !== 'all' && risk.owner !== selectedOwner) return false;
      if (selectedRating !== 'all' && residualRating(risk).toLowerCase() !== selectedRating) return false;
      if (!matchesRiskReference(risk.riskRef, queryRiskRef)) return false;
      if (!matchesRiskStatus(risk.status, selectedRiskStatus)) return false;
      if (selectedTreatmentStatus !== 'all' && (risk.treatmentStatus || 'not_started') !== selectedTreatmentStatus) return false;
      if (selectedTreatmentStrategy !== 'all' && risk.treatmentStrategy !== selectedTreatmentStrategy) return false;
      if (selectedReviewStatus !== 'all' && (risk.reviewStatus || 'not_reviewed') !== selectedReviewStatus) return false;
      const query = searchQuery.trim().toLowerCase();
      if (query && ![risk.riskRef, risk.title, risk.owner, risk.category, risk.status, risk.description].some((value) => typeof value === 'string' && value.toLowerCase().includes(query))) return false;
      return true;
    });
  }, [queryRiskRef, outsideAppetite, searchQuery, selectedCategory, selectedCiaImpact, selectedOwner, selectedRating, selectedReviewStatus, selectedRiskStatus, selectedStatus, selectedTreatmentStatus, selectedTreatmentStrategy, state]);

  const filteredKris = useMemo(() => {
    if (!state) return [];
    return state.kris.filter((kri) => selectedCategory === 'all' || kri.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase());
  }, [selectedCategory, state]);

  const metrics = useMemo(() => {
    if (!state) return [];
    return [
      { label: 'Total Risks', value: state.dashboard.summary.totalRisks, detail: 'Risks in the intelligence model', tone: 'primary' as const },
      { label: 'Appetite Breaches', value: state.dashboard.summary.appetiteBreaches, detail: 'Require committee attention', tone: 'danger' as const },
      { label: 'Capacity Breaches', value: state.dashboard.summary.capacityBreaches, detail: 'Beyond stated capacity', tone: 'danger' as const },
      { label: 'Critical KRI signals', value: state.dashboard.summary.criticalKris, detail: 'Active threshold breaches across monitored KRIs', tone: 'warning' as const },
      { label: 'Loss + Near Misses', value: state.dashboard.summary.totalLossEvents + state.dashboard.summary.totalNearMisses, detail: 'Operational signal volume', tone: 'default' as const },
    ];
  }, [state]);

  if (loading) {
    return (
      <div className="riskWorkspacePage riskRegisterPage" style={pageStyle}>
        <PageHeader breadcrumb="Risk Management / Risk Register" title="Enterprise Risk Intelligence" description="Weighted scoring, capacity, KRIs, forecasts, and treatment governance." />
        <PageSectionCard title="Loading Risk Intelligence">
          <div role="status" style={{ color: theme.colors.text.secondary }}>Loading enterprise risk analytics...</div>
        </PageSectionCard>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="riskWorkspacePage riskRegisterPage" style={pageStyle}>
        <PageHeader breadcrumb="Risk Management / Risk Register" title="Enterprise Risk Intelligence" description="Weighted scoring, capacity, KRIs, forecasts, and treatment governance." />
        <EmptyStatePanel
          eyebrow="Risk Intelligence"
          title="Unable to load the risk intelligence platform"
          description={error || 'The platform could not load the risk intelligence state.'}
          actions={<Button variant="primary" onClick={() => fetchState()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <>
    <section aria-label="Enterprise Risk Intelligence" className="riskWorkspacePage riskRegisterPage" style={pageStyle}>
      <section className="riskRegisterHero">
      <PageHeader
        breadcrumb="Risk Management / Risk Register"
        title="Enterprise Risk Intelligence"
        description="Manage enterprise risks, appetite position, treatment progress, and review readiness."
        action={activeTab === 'treatments' ? <Button variant="primary" onClick={() => { setTreatmentPickerRiskId(''); setTreatmentPickerOpen(true); }}>New Treatment Plan</Button> : <Button variant="primary" onClick={() => { setEditingRisk(null); setActiveTab('register'); setIsRiskModalOpen(true); }}>New Risk</Button>}
      />
      {activeTab === 'register' ? <RiskRegisterKpis risks={state.risks} openPlans={treatmentSummary.open} /> : null}
      </section>

      {actionFeedback ? (
        <div className={`riskActionFeedback riskActionFeedback-${actionFeedback.tone}`} role={actionFeedback.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
          {actionFeedback.message}
        </div>
      ) : null}

      <nav className="riskSubnav" aria-label="Risk Management sections">
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

      {activeTab !== 'register' && (queryRiskStatus || outsideAppetite) ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Applied Risk Register filters">
          {queryRiskStatus ? <AppliedQueryFilter label={`Register only: ${RISK_STATUS_LABELS[queryRiskStatus]} risks`} onRemove={() => setQueryFilter('status', null)} /> : null}
          {outsideAppetite ? <AppliedQueryFilter label="Register only: Outside appetite" onRemove={() => setQueryFilter('appetite', null)} /> : null}
        </div>
      ) : null}

      <section id={`risk-panel-${activeTab}`} role="tabpanel" aria-labelledby={`risk-tab-${activeTab}`}>
        <>{queryRiskRef && <AppliedQueryFilter label={`${activeTab === 'register' ? 'Risk' : 'Register only: Risk'} ${queryRiskRef}`} onRemove={() => setQueryFilter('riskRef', null)} />}<RiskWorkspaceViews
          outsideAppetite={outsideAppetite}
          onResetRegisterFilters={() => {
            setSelectedCategory('all'); setSelectedOwner('all'); setSelectedRating('all');
            setSelectedCiaImpact('all'); setSelectedTreatmentStatus('all');
            setSelectedTreatmentStrategy('all'); setSelectedReviewStatus('all'); setSearchQuery('');
            setSearchParams(updateQueryFilters(searchParams, { status: null, appetite: null, riskRef: null }));
          }}
          onApplyRegisterQuery={(status, appetite) => setSearchParams(updateQueryFilters(searchParams, {
            status: status === 'all' ? null : status,
            appetite: appetite === 'all' ? null : appetite,
          }))}
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
          preparedReport={preparedReport?.workspaceId === workspaceId ? preparedReport : null}
          setReportType={setReportType}
          onNavigate={setActiveTab}
          onNewRisk={() => { setEditingRisk(null); setIsRiskModalOpen(true); }}
          onSelectRisk={setSelectedRisk}
          onCreateTreatment={handleCreateTreatment}
          onEditRisk={handleEditRisk}
          treatments={treatments}
          treatmentSummary={treatmentSummary}
          onEditTreatment={(plan, focusProgress = false) => { const risk=state.risks.find((item)=>item.id===plan.riskId); if(risk) { handleCreateTreatment(risk,plan); setTreatmentProgressFocus(focusProgress); } else setActionFeedback({tone:'error',message:'The linked risk is unavailable in this workspace. Refresh the register before editing this treatment.'}); }}
          onRefresh={fetchState}
          onExport={handleExport}
          onRebalanceWeights={handleRebalanceWeights}
          onTightenTolerance={handleTightenTolerance}
        /></>
      </section>
    </section>
      <RiskModal isOpen={isRiskModalOpen} initialRisk={editingRisk} onClose={() => { setIsRiskModalOpen(false); setEditingRisk(null); }} onSubmit={handleSaveRisk} />
      <Modal accessibleDialog isOpen={treatmentPickerOpen} title="New Treatment Plan" onClose={() => setTreatmentPickerOpen(false)} footer={<><Button variant="ghost" onClick={() => setTreatmentPickerOpen(false)}>Cancel</Button><Button variant="primary" disabled={!state.risks.some(risk => risk.id === treatmentPickerRiskId)} onClick={() => { const risk = state.risks.find(item => item.id === treatmentPickerRiskId); if (risk) { setTreatmentPickerOpen(false); handleCreateTreatment(risk); } }}>Continue to treatment</Button></>}>
        <div className="rdWorkspace"><p>Select the risk this plan will treat. Its pinned methodology will be used for the expected residual outcome.</p><label className="treatmentField"><span>Linked risk</span><select value={treatmentPickerRiskId} onChange={event => setTreatmentPickerRiskId(event.target.value)}><option value="">Select a risk</option>{state.risks.map(risk => <option key={risk.id} value={risk.id}>{risk.riskRef || 'Reference not assigned'} · {risk.title}</option>)}</select></label>{!state.risks.length && <p>No risks are available. Create a risk in the register first.</p>}</div>
      </Modal>
      <RiskTreatmentModal focusProgress={treatmentProgressFocus} key={`${treatmentRisk?.id || 'closed'}-${editingTreatment?.id || 'new'}`} isOpen={Boolean(treatmentRisk)} risk={treatmentRisk} treatment={editingTreatment} saving={saving} error={treatmentError} onClose={()=>{setTreatmentRisk(null);setEditingTreatment(null);setTreatmentError(null);}} onSubmit={handleSaveTreatment}/>

      {selectedRisk ? (
        <Modal accessibleDialog isOpen onClose={() => setSelectedRisk(null)} title="Risk Detail" width="720px">
          <div className="rdWorkspace">
            {(() => {
              const impact = workspaceId ? getRiskAssuranceImpact(workspaceId, selectedRisk as unknown as Risk) : null;
              const linkedFailedControls = impact?.failedLinkedControls.map((item) => item.controlId) || [];
              const selectedPlans = treatments.filter(plan => plan.riskId === selectedRisk.id);
              const detailRows = [
                ['Description', selectedRisk.description || 'No description recorded.'],
                ['Category', selectedRisk.category.replace(/_/g, ' ')],
                ['Owner', selectedRisk.owner],
                ['Inherent Risk', `${Math.round(selectedRisk.inherentScore)}`],
                ['Residual Risk', `${Math.round(selectedRisk.residualScore)}`],
                ['Target Risk', String(targetRiskScore(selectedRisk) ?? 'Not set')],
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

              const takeAction = async (action: 'escalated' | 'accepted' | 'transferred') => {
                try {
                  setActionFeedback(null);
                  if (!workspaceId) throw new Error('Select a workspace before updating this risk.');
                  await recordRiskAssuranceAction(workspaceId, role, selectedRisk.id, action, `${selectedRisk.riskRef || 'Reference not assigned'} | ${selectedRisk.title} ${action}.`);
                  setActionFeedback({ tone: 'success', message: `${selectedRisk.riskRef || 'Reference not assigned'} | ${selectedRisk.title} marked as ${action}.` });
                } catch (error) {
                  setActionFeedback({ tone: 'error', message: error instanceof Error ? error.message : `Unable to mark this risk as ${action}.` });
                }
              };

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.colors.text.muted }}>
                        Risk Detail
                      </div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
                        {selectedRisk.riskRef || 'Reference not assigned'} | {selectedRisk.title}
                      </div>
                      <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Badge variant={toneFromTolerance(selectedRisk.appetiteStatus)} size="sm">{TOLERANCE_STATUS_LABELS[selectedRisk.appetiteStatus]}</Badge>
                        <Badge variant={selectedRisk.trend === 'increasing' ? 'danger' : selectedRisk.trend === 'decreasing' ? 'success' : 'default'} size="sm">{trendLabel(selectedRisk.trend)}</Badge>
                        {normalizeCiaImpacts(selectedRisk.ciaImpacts).length > 0
                          ? normalizeCiaImpacts(selectedRisk.ciaImpacts).map((impact) => <Badge key={impact} variant="primary" size="sm">{impact}</Badge>)
                          : <Badge variant="default" size="sm">CIA impact not set</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => setSelectedRisk(null)}>Close</Button>
                  </div>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <RiskScoreProfile risk={selectedRisk} />
                    <div className="riskTreatmentDetailHeader"><div><strong>Treatment Plans</strong><span>{treatments.filter((plan)=>plan.riskId===selectedRisk.id).length} linked plan(s)</span></div><Button variant="primary" onClick={()=>handleCreateTreatment(selectedRisk)}>Record Treatment</Button></div>
                    {treatments.filter((plan)=>plan.riskId===selectedRisk.id).length===0 ? <div className="riskTreatmentEmpty">No treatment plans recorded for this risk.</div> : <div className="riskTreatmentDetailList">{treatments.filter((plan)=>plan.riskId===selectedRisk.id).map((plan)=><button type="button" key={plan.id} className="riskTreatmentDetailItem" onClick={()=>handleCreateTreatment(selectedRisk,plan)}><span><strong>{plan.title}</strong><small>{plan.strategy.replaceAll('_',' ')} · {plan.owner}</small></span><span><Badge variant={plan.status==='overdue'?'danger':plan.status==='completed'?'success':'warning'} size="sm">{plan.status.replaceAll('_',' ')}</Badge><small>{plan.progressPercent}% · {new Date(plan.dueDate).toLocaleDateString()}</small></span></button>)}</div>}
                  </Card>

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
                    <h3>Linked Treatment Controls / Expected Outcomes</h3>
                    {selectedPlans.length ? selectedPlans.map(plan => <div key={plan.id}>
                      <strong>{plan.id} | {plan.title}</strong>
                      <p>Expected residual after treatment: {plan.expectedResidualScore ?? 'Not set'}. This does not replace current residual risk.</p>
                      {plan.linkedControls?.length ? <ul>{plan.linkedControls.map(control => <li key={control.controlId}>{control.controlId}: {control.title || 'Untitled control'} ({control.role})</li>)}</ul> : <p>No controls linked.</p>}
                    </div>) : <p>No treatment controls or forecasts recorded.</p>}
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
                    <Button variant="secondary" onClick={() => handleCreateTreatment(selectedRisk)}>Record Treatment</Button>
                    <Button variant="secondary" onClick={() => void takeAction('escalated')}>Escalate</Button>
                    <Button variant="secondary" onClick={() => void takeAction('accepted')}>Accept</Button>
                    <Button variant="secondary" onClick={() => void takeAction('transferred')}>Transfer</Button>
                    <Button variant="secondary" onClick={() => handleCreateTreatment(selectedRisk, selectedPlans[0])}>Link Controls via Treatment</Button>
                    <Button variant="secondary" disabled title="Evidence relationship linking is not yet implemented">Link Evidence — coming soon</Button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export default Risks;
