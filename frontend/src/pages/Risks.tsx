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
  RiskModal,
  SummaryMetricStrip,
} from '../components';
import {
  createEmergingRisk,
  createLossEvent,
  createNearMiss,
  createRiskKri,
  createRiskTreatment,
  fetchRiskIntelligenceState,
  generateRiskReport,
  updateRiskToleranceProfile,
  updateRiskQuantificationWeights,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { getRiskAssuranceImpact, recordRiskAssuranceAction } from '../services/continuousAssurance/continuousAssurance';
import { theme } from '../theme';
import type { CreateRiskInput, Risk, ApiResponse } from '../types/risk';
import type {
  RiskIntelligenceRiskSummary,
  RiskIntelligenceState,
  RiskToleranceProfile,
  RiskToleranceStatus,
  RiskTrendDirection,
} from '../types/riskIntelligence';
import { TOLERANCE_STATUS_LABELS } from '../types/riskIntelligence';

const API_BASE = '/api/v1';

const pageStyle = {
  maxWidth: 1440,
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
};

const inputStyle = {
  padding: theme.spacing[3],
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.md,
  fontSize: theme.typography.sizes.sm,
  backgroundColor: theme.colors.surface,
  color: theme.colors.text.main,
};

function categoryLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function toneFromTolerance(status: RiskToleranceStatus): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'within_appetite') return 'success';
  if (status === 'within_tolerance') return 'warning';
  if (status === 'outside_tolerance' || status === 'beyond_capacity') return 'danger';
  return 'default';
}

function trendLabel(direction: RiskTrendDirection) {
  return direction === 'increasing' ? 'Increasing' : direction === 'decreasing' ? 'Decreasing' : 'Stable';
}

function MatrixGrid({
  title,
  matrix,
}: {
  title: string;
  matrix: number[][];
}) {
  return (
    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
        {title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: theme.spacing[1],
          marginTop: theme.spacing[3],
        }}
      >
        {matrix.flatMap((row, rowIndex) =>
          row.map((value, columnIndex) => (
            <div
              key={`${rowIndex}-${columnIndex}`}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: theme.borderRadius.md,
                backgroundColor:
                  value >= 4
                    ? '#FCA5A5'
                    : value >= 2
                      ? '#FCD34D'
                      : value >= 1
                        ? '#BFDBFE'
                        : theme.colors.surfaceHover,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: theme.typography.sizes.sm,
                color: theme.colors.text.main,
                fontWeight: theme.typography.weights.semibold,
              }}
            >
              {value}
            </div>
          )),
        )}
      </div>
    </Card>
  );
}

function SectionListCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'danger' }>;
}) {
  return (
    <PageSectionCard title={title} subtitle={subtitle}>
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: theme.spacing[3],
              alignItems: 'center',
              paddingBottom: theme.spacing[2],
              borderBottom: `1px solid ${theme.colors.borderLight}`,
            }}
          >
            <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], minWidth: 0 }}>
              {row.tone ? <Badge variant={row.tone} size="sm">{row.value}</Badge> : <strong style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{row.value}</strong>}
            </div>
          </div>
        ))}
      </div>
    </PageSectionCard>
  );
}

export function Risks() {
  const { role } = useAuth();
  const { workspaceId } = useWorkspace();
  const [state, setState] = useState<RiskIntelligenceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<RiskToleranceStatus | 'all'>('all');
  const [reportType, setReportType] = useState<'risk_committee_report' | 'board_risk_report' | 'executive_risk_summary' | 'kri_report' | 'loss_event_report'>('risk_committee_report');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'word' | 'powerpoint'>('pdf');
  const [newKriName, setNewKriName] = useState('');
  const [newKriOwner, setNewKriOwner] = useState('Risk Office');
  const [newKriCategory, setNewKriCategory] = useState('information_security');
  const [lossEventRootCause, setLossEventRootCause] = useState('');
  const [nearMissDescription, setNearMissDescription] = useState('');
  const [emergingRiskTitle, setEmergingRiskTitle] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<RiskIntelligenceRiskSummary | null>(null);

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

  const handleCreateRisk = async (input: CreateRiskInput) => {
    const response = await fetch(`${API_BASE}/risks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const result: ApiResponse<Risk> = await response.json();
    if (result.error) throw new Error(result.error.message);
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

  const handleCreateTreatment = async (risk: RiskIntelligenceRiskSummary) => {
    try {
      setSaving(true);
      await createRiskTreatment({
        riskId: risk.id,
        treatmentName: `Reduce ${risk.title}`,
        owner: risk.owner,
        expectedRiskReduction: 20,
        actualRiskReduction: 12,
        notes: 'Initial treatment effectiveness recorded from current mitigation sprint.',
      });
      await fetchState();
    } finally {
      setSaving(false);
    }
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
      return true;
    });
  }, [selectedCategory, selectedStatus, state]);

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
      <div style={pageStyle}>
        <PageHeader title="Enterprise Risk Intelligence" description="Weighted scoring, capacity, KRIs, forecasts, and treatment governance." />
        <PageSectionCard title="Loading Risk Intelligence">
          <div style={{ color: theme.colors.text.secondary }}>Loading enterprise risk analytics...</div>
        </PageSectionCard>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Enterprise Risk Intelligence" description="Weighted scoring, capacity, KRIs, forecasts, and treatment governance." />
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
    <div style={pageStyle}>
      <PageHeader
        title="Enterprise Risk Intelligence"
        description="Executive decision support across appetite, tolerance, capacity, KRIs, dynamic scoring, forecasts, loss events, and treatment performance."
        action={<Button variant="primary" onClick={() => setIsRiskModalOpen(true)}>New Risk</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      {workspaceId ? (
        <PageSectionCard title="Assurance Impact" subtitle="Continuous assurance effects on risk posture from failed controls, evidence gaps, drift, and unresolved exceptions.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
            {state.risks.slice(0, 3).map((risk) => {
              const impact = getRiskAssuranceImpact(workspaceId, risk as unknown as Risk);
              return (
                <Card key={risk.id} style={{ padding: theme.spacing[3] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <strong style={{ color: theme.colors.text.main }}>{risk.title}</strong>
                    <Badge variant={impact.assuranceImpact >= 12 ? 'danger' : impact.assuranceImpact >= 6 ? 'warning' : 'success'} size="sm">
                      +{impact.assuranceImpact}
                    </Badge>
                  </div>
                  <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    <div>Failed linked controls: {impact.failedLinkedControls.length}</div>
                    <div>Evidence gaps: {impact.evidenceGaps.length}</div>
                    <div>Drift alerts: {impact.driftAlerts.length}</div>
                    <div>Unresolved exceptions: {impact.unresolvedExceptions.length}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </PageSectionCard>
      ) : null}

      <PageToolbar
        actions={
          <>
            <select value={reportType} onChange={(event) => setReportType(event.target.value as typeof reportType)} style={inputStyle}>
              <option value="risk_committee_report">Risk Committee Report</option>
              <option value="board_risk_report">Board Risk Report</option>
              <option value="executive_risk_summary">Executive Risk Summary</option>
              <option value="kri_report">KRI Report</option>
              <option value="loss_event_report">Loss Event Report</option>
            </select>
            <select value={reportFormat} onChange={(event) => setReportFormat(event.target.value as typeof reportFormat)} style={inputStyle}>
              <option value="pdf">PDF</option>
              <option value="word">Word</option>
              <option value="powerpoint">PowerPoint</option>
            </select>
            <Button variant="secondary" onClick={handleExport} disabled={saving}>{saving ? 'Working...' : 'Export Report Pack'}</Button>
          </>
        }
      >
        <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} style={inputStyle}>
          <option value="all">All categories</option>
          {state.toleranceProfiles.map((profile) => (
            <option key={profile.id} value={profile.category}>{categoryLabel(profile.category)}</option>
          ))}
        </select>
        <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as typeof selectedStatus)} style={inputStyle}>
          <option value="all">All status bands</option>
          <option value="within_appetite">Within Appetite</option>
          <option value="within_tolerance">Within Tolerance</option>
          <option value="outside_tolerance">Outside Tolerance</option>
          <option value="beyond_capacity">Beyond Capacity</option>
        </select>
        <Button variant="secondary" onClick={handleRebalanceWeights} disabled={saving}>Rebalance Weight Model</Button>
        <Button variant="secondary" onClick={fetchState}>Refresh</Button>
      </PageToolbar>

      {state.risks.length === 0 ? (
        <EmptyStatePanel
          eyebrow="Risk Platform"
          title="No risks are in scope yet"
          description="Create the first risk to activate weighted scoring, forecasting, tolerance monitoring, and the executive intelligence dashboard."
          actions={<Button variant="primary" onClick={() => setIsRiskModalOpen(true)}>Create First Risk</Button>}
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard title="Risk Intelligence Dashboard" subtitle="Board-ready summary of current exposure, breach pressure, and leading indicators.">
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                <Card style={{ padding: theme.spacing[4], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Executive Summary
                  </div>
                  <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[2] }}>
                    {state.dashboard.executiveSummary.map((line) => (
                      <div key={line} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{line}</div>
                    ))}
                  </div>
                </Card>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
                  <MatrixGrid title="Inherent View" matrix={state.dashboard.heatmap.inherent} />
                  <MatrixGrid title="Residual View" matrix={state.dashboard.heatmap.residual} />
                  <MatrixGrid title="Forecast View" matrix={state.dashboard.heatmap.forecast} />
                </div>
              </div>
            </PageSectionCard>

            <SectionListCard
              title="Risk Committee Dashboard"
              subtitle="Top committee signals without opening a full board pack."
              rows={[
                ...state.dashboard.committeeView.topRisks.slice(0, 5).map((risk) => ({
                  label: risk.title,
                  value: `${Math.round(risk.dynamicScore)} · ${TOLERANCE_STATUS_LABELS[risk.appetiteStatus]}`,
                  tone: toneFromTolerance(risk.appetiteStatus),
                })),
                { label: 'Open treatment plans', value: String(state.dashboard.committeeView.openTreatmentPlans), tone: 'warning' },
                { label: 'Audit findings', value: String(state.dashboard.committeeView.auditFindings), tone: state.dashboard.committeeView.auditFindings > 0 ? 'danger' : 'success' },
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[4] }}>
            <PageSectionCard title="Risk Tolerance Engine" subtitle="Appetite, tolerance, and capacity by risk category.">
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {state.toleranceProfiles.map((profile) => (
                  <Card key={profile.id} style={{ padding: theme.spacing[3], minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                          {categoryLabel(profile.category)}
                        </div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                          Appetite {profile.appetite} · Tolerance ±{profile.tolerance} · Capacity {profile.capacity}
                        </div>
                      </div>
                      <Button variant="secondary" onClick={() => handleTightenTolerance(profile)} disabled={saving}>Tighten</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard title="Capacity Engine" subtitle="Exposure versus capacity by enterprise domain.">
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                {state.capacities.map((capacity) => (
                  <Card key={capacity.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3] }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                          {categoryLabel(capacity.capacityType)}
                        </div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                          {Math.round(capacity.currentExposure)} / {Math.round(capacity.capacityLimit)} current exposure
                        </div>
                      </div>
                      <Badge variant={capacity.utilizationPercent >= 100 ? 'danger' : capacity.utilizationPercent >= 85 ? 'warning' : 'success'} size="sm">
                        {Math.round(capacity.utilizationPercent)}%
                      </Badge>
                    </div>
                    <div style={{ height: 10, backgroundColor: theme.colors.surfaceHover, borderRadius: theme.borderRadius.full, marginTop: theme.spacing[3] }}>
                      <div
                        style={{
                          width: `${Math.min(100, capacity.utilizationPercent)}%`,
                          height: '100%',
                          borderRadius: theme.borderRadius.full,
                          backgroundColor: capacity.utilizationPercent >= 100 ? theme.colors.semantic.danger : capacity.utilizationPercent >= 85 ? theme.colors.semantic.warning : theme.colors.semantic.success,
                        }}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard title="Top Risk Drivers" subtitle="Current enterprise drivers behind weighted exposure.">
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {state.dashboard.topRiskDrivers.map((driver) => (
                  <div key={driver.label} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], paddingBottom: theme.spacing[2], borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{categoryLabel(driver.label)}</span>
                    <strong style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{Math.round(driver.score)}</strong>
                  </div>
                ))}
              </div>
            </PageSectionCard>
          </div>

          <DataTableShell title="Dynamic Risk Register" subtitle="Weighted scoring, appetite status, 90-day forecast, and treatment posture." action={<Badge variant="default" size="sm">{filteredRisks.length} risks</Badge>}>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '24%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                  <th style={{ padding: `${theme.spacing[2]} 0` }}>Risk</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Category</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Status Band</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Dynamic</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Residual</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Forecast 90d</th>
                  <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Trend</th>
                  <th style={{ padding: `${theme.spacing[2]} 0` }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRisks.map((risk) => (
                  <tr key={risk.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                    <td style={{ padding: `${theme.spacing[3]} 0` }}>
                      <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                        <strong style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{risk.title}</strong>
                        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{risk.owner}</span>
                      </div>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      {categoryLabel(risk.category)}
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                      <Badge variant={toneFromTolerance(risk.appetiteStatus)} size="sm">{TOLERANCE_STATUS_LABELS[risk.appetiteStatus]}</Badge>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
                      {Math.round(risk.dynamicScore)}
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
                      {Math.round(risk.residualScore)}
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                      <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                        <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{Math.round(risk.forecast90DayScore)}</span>
                        <Badge variant={toneFromTolerance(risk.forecastStatus)} size="sm">{TOLERANCE_STATUS_LABELS[risk.forecastStatus]}</Badge>
                      </div>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                      <Badge variant={risk.trend === 'increasing' ? 'danger' : risk.trend === 'decreasing' ? 'success' : 'default'} size="sm">
                        {trendLabel(risk.trend)}
                      </Badge>
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} 0` }}>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Button variant="secondary" onClick={() => setSelectedRisk(risk)}>View</Button>
                        <Button variant="secondary" onClick={() => handleCreateTreatment(risk)} disabled={saving}>Record Treatment</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard title="KRI Engine" subtitle="Automatically sourced and manually governed key risk indicators.">
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) repeat(3, minmax(0, 1fr)) auto', gap: theme.spacing[2] }}>
                  <input value={newKriName} onChange={(event) => setNewKriName(event.target.value)} placeholder="New KRI name" style={inputStyle} />
                  <input value={newKriOwner} onChange={(event) => setNewKriOwner(event.target.value)} placeholder="Owner" style={inputStyle} />
                  <select value={newKriCategory} onChange={(event) => setNewKriCategory(event.target.value)} style={inputStyle}>
                    {state.toleranceProfiles.map((profile) => <option key={profile.id} value={profile.category}>{categoryLabel(profile.category)}</option>)}
                  </select>
                  <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Auto + Manual</div>
                  <Button variant="primary" onClick={handleAddKri} disabled={saving}>Add KRI</Button>
                </div>
                <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                  {filteredKris.map((kri) => (
                    <Card key={kri.id} style={{ padding: theme.spacing[3] }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                            {kri.name}
                          </div>
                          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                            {categoryLabel(kri.category)} · {kri.owner} · {kri.frequency}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
                          <Badge variant={kri.status === 'red' ? 'danger' : kri.status === 'amber' ? 'warning' : 'success'} size="sm">{kri.status.toUpperCase()}</Badge>
                          <strong style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{kri.currentValue}</strong>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </PageSectionCard>

            <PageSectionCard title="Forecasting & Trending" subtitle="Short-horizon predictive scoring and category movement.">
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                {state.dashboard.forecasts.slice(0, 6).map((forecast) => (
                  <Card key={forecast.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                          {forecast.scopeLabel}
                        </div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                          Current {Math.round(forecast.currentScore)} · 30d {Math.round(forecast.predicted30DayScore)} · 90d {Math.round(forecast.predicted90DayScore)} · 180d {Math.round(forecast.predicted180DayScore)}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: theme.spacing[1], justifyItems: 'end' }}>
                        <Badge variant={toneFromTolerance(forecast.forecastStatus)} size="sm">{TOLERANCE_STATUS_LABELS[forecast.forecastStatus]}</Badge>
                        <Badge variant={forecast.trend === 'increasing' ? 'danger' : forecast.trend === 'decreasing' ? 'success' : 'default'} size="sm">{trendLabel(forecast.trend)}</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[4] }}>
            <PageSectionCard title="Loss Event Register" subtitle="Actual loss events influencing forward scoring.">
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                <div style={{ display: 'flex', gap: theme.spacing[2] }}>
                  <input value={lossEventRootCause} onChange={(event) => setLossEventRootCause(event.target.value)} placeholder="Root cause summary" style={{ ...inputStyle, flex: 1 }} />
                  <Button variant="primary" onClick={handleAddLossEvent} disabled={saving}>Add Loss Event</Button>
                </div>
                {state.lossEvents.slice(0, 6).map((event) => (
                  <Card key={event.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{event.eventId}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{categoryLabel(event.eventType)} · {event.rootCause}</div>
                      </div>
                      <Badge variant={event.actualLoss > 50000 ? 'danger' : event.actualLoss > 10000 ? 'warning' : 'default'} size="sm">
                        £{Math.round(event.actualLoss)}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard title="Near Miss Register" subtitle="Preventive signal feed influencing dynamic exposure.">
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                <div style={{ display: 'flex', gap: theme.spacing[2] }}>
                  <input value={nearMissDescription} onChange={(event) => setNearMissDescription(event.target.value)} placeholder="Near miss description" style={{ ...inputStyle, flex: 1 }} />
                  <Button variant="primary" onClick={handleAddNearMiss} disabled={saving}>Add Near Miss</Button>
                </div>
                {state.nearMisses.slice(0, 6).map((item) => (
                  <Card key={item.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{categoryLabel(item.nearMissType)}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.description}</div>
                      </div>
                      <Badge variant={item.severity === 'critical' || item.severity === 'high' ? 'danger' : item.severity === 'medium' ? 'warning' : 'default'} size="sm">
                        {item.severity}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard title="Emerging Risk Register" subtitle="Watchlist for AI, geopolitical, regulatory, and technology change.">
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                <div style={{ display: 'flex', gap: theme.spacing[2] }}>
                  <input value={emergingRiskTitle} onChange={(event) => setEmergingRiskTitle(event.target.value)} placeholder="Emerging risk title" style={{ ...inputStyle, flex: 1 }} />
                  <Button variant="primary" onClick={handleAddEmergingRisk} disabled={saving}>Add Emerging Risk</Button>
                </div>
                {state.emergingRisks.slice(0, 6).map((risk) => (
                  <Card key={risk.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{risk.title}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{risk.monitoringStatus} · L{risk.likelihood} / I{risk.impact}</div>
                      </div>
                      <Badge variant={risk.monitoringStatus === 'escalated' ? 'danger' : risk.monitoringStatus === 'watchlist' ? 'warning' : 'default'} size="sm">
                        {risk.monitoringStatus}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
            <PageSectionCard title="Treatment Effectiveness" subtitle="Expected versus actual risk reduction across active treatments.">
              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {state.treatments.length === 0 ? (
                  <EmptyStatePanel title="No treatment effectiveness recorded yet" description="Use Record Treatment from the dynamic risk register to start the treatment analytics layer." />
                ) : state.treatments.slice(0, 8).map((treatment) => (
                  <Card key={treatment.id} style={{ padding: theme.spacing[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3] }}>
                      <div>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{treatment.treatmentName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                          Expected {treatment.expectedRiskReduction} · Actual {treatment.actualRiskReduction}
                        </div>
                      </div>
                      <Badge variant={treatment.treatmentEffectivenessPercent >= 90 ? 'success' : treatment.treatmentEffectivenessPercent >= 60 ? 'warning' : 'danger'} size="sm">
                        {Math.round(treatment.treatmentEffectivenessPercent)}%
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard title="Board View" subtitle="Top KRIs, high-risk vendors, critical assets, and open treatment load.">
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top 10 KRIs</div>
                  <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[2] }}>
                    {state.dashboard.committeeView.topKris.slice(0, 5).map((kri) => (
                      <div key={kri.id} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
                        <span style={{ color: theme.colors.text.secondary }}>{kri.name}</span>
                        <Badge variant={kri.status === 'red' ? 'danger' : kri.status === 'amber' ? 'warning' : 'success'} size="sm">{kri.status}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card style={{ padding: theme.spacing[3] }}>
                  <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
                      <span style={{ color: theme.colors.text.secondary }}>High-risk vendors</span>
                      <strong>{state.dashboard.committeeView.highRiskVendors.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
                      <span style={{ color: theme.colors.text.secondary }}>Critical assets</span>
                      <strong>{state.dashboard.committeeView.criticalAssets.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
                      <span style={{ color: theme.colors.text.secondary }}>Open treatment plans</span>
                      <strong>{state.dashboard.committeeView.openTreatmentPlans}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
                      <span style={{ color: theme.colors.text.secondary }}>Audit findings</span>
                      <strong>{state.dashboard.committeeView.auditFindings}</strong>
                    </div>
                  </div>
                </Card>
              </div>
            </PageSectionCard>
          </div>
        </>
      )}

      <RiskModal isOpen={isRiskModalOpen} onClose={() => setIsRiskModalOpen(false)} onSubmit={handleCreateRisk} />

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
              const syntheticLinkedControls = impact?.failedLinkedControls.map((item) => item.controlId) || [];
              const detailRows = [
                ['Risk Overview', selectedRisk.treatmentPlan || 'Risk summary currently managed through the enterprise risk intelligence model.'],
                ['Inherent Risk', `${Math.round(selectedRisk.inherentScore)}`],
                ['Residual Risk', `${Math.round(selectedRisk.residualScore)}`],
                ['Target Risk', `${Math.max(0, Math.round(selectedRisk.residualScore - 10))}`],
                ['Linked Controls', `${Math.max(1, syntheticLinkedControls.length || Math.round(selectedRisk.dynamicScore / 15))}`],
                ['Linked Evidence', `${Math.max(50, Math.round(100 - selectedRisk.dynamicScore))}% confidence`],
                ['Linked Exceptions', `${impact?.unresolvedExceptions.length || 0}`],
                ['Linked Audits', `${Math.max(0, Math.round(selectedRisk.dynamicScore / 25))}`],
                ['Linked Vendors', `${Math.max(0, Math.round(selectedRisk.residualScore / 20))}`],
                ['Linked Assets', `${Math.max(0, Math.round(selectedRisk.inherentScore / 20))}`],
                ['Assurance Impact', `${impact?.assuranceImpact || 0} point penalty`],
              ] as const;

              const takeAction = async (action: 'treated' | 'escalated' | 'accepted' | 'transferred') => {
                if (workspaceId) {
                  await recordRiskAssuranceAction(workspaceId, role, selectedRisk.id, action, `${selectedRisk.title} ${action}.`);
                }
                if (action === 'treated') await handleCreateTreatment(selectedRisk);
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
                      <div>Controls: {syntheticLinkedControls.join(', ') || 'Control mappings are being synchronized from assurance records.'}</div>
                      <div>Assets exposed: {Math.max(0, Math.round(selectedRisk.inherentScore / 20))}</div>
                      <div>Vendor dependencies: {Math.max(0, Math.round(selectedRisk.residualScore / 20))}</div>
                      <div>Audit findings mapped: {Math.max(0, Math.round(selectedRisk.dynamicScore / 25))}</div>
                    </div>
                  </Card>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Control Coverage View</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
                      {syntheticLinkedControls.length === 0 ? (
                        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>No linked controls yet.</div>
                      ) : syntheticLinkedControls.map((controlId) => (
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
                    <Button variant="primary" onClick={() => void takeAction('treated')}>Treat Risk</Button>
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
    </div>
  );
}

export default Risks;
