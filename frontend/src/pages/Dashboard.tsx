import { useEffect, useMemo, useState } from 'react';
import {
  AuditIcon,
  Badge,
  Button,
  Card,
  PolicyIcon,
  ReportsIcon,
  RiskIcon,
  TrainingIcon,
  VendorIcon,
} from '../components';
import {
  KPIBox,
  SectionContainer,
  WorkspaceEmptyState,
  border,
  severityVariant,
  titleCase,
  type Tone,
} from './dashboard/DashboardSections';
import {
  AppetiteThresholdTable,
  EnhancedRiskHeatmap,
  FrameworkAlignmentPanel,
  getFrameworkDisplayName,
  InfoSecRiskLinkage,
  RemediationCenter,
  RiskFoundationFlow,
  WeightedRiskProfile,
  type AppetiteRow,
  type FrameworkRow,
  type InfoSecRow,
  type RemediationRow,
  type ScoringMode,
  type WeightedFactor,
} from './dashboard/DashboardEnterprisePanels';
import { useFrameworks } from '../context/FrameworkContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import {
  adaptDashboardDataToRisks,
  DASHBOARD_ISSUE_FALLBACK,
  type DashboardIssue,
  type DashboardVendor,
} from '@/services/grcEngine/dashboardRiskAdapter';
import {
  createEnterpriseRiskPosture,
  evaluateRiskAppetiteStatus,
} from '@/services/grcEngine/riskEngine';
import type { ControlWithFrameworks } from '@/types/control';
import type { EvidenceItem } from '@/types/evidence';
import {
  RISK_CATEGORY_LABELS,
  RISK_STATUS_LABELS,
  type Risk as AppRisk,
} from '@/types/risk';
import type { VendorRiskAssessment } from '@/types/tprm';

interface DashboardProps {
  onNavigate?: (path: string) => void;
}

interface TrainingDashboardSummary {
  overallCompletionRate?: number;
  overdueAssignments?: number;
  activeCampaigns?: number;
}

interface AuditSummaryItem {
  framework: string;
  readinessPercent: number;
  openItems: number;
}

interface DataProtectionOverview {
  totalRelevantControls?: number;
  totalEvidenceItems?: number;
  totalRelatedRisks?: number;
}

type DashboardState = {
  controls: ControlWithFrameworks[];
  risks: AppRisk[];
  vendors: DashboardVendor[];
  vendorAssessments: VendorRiskAssessment[];
  evidence: EvidenceItem[];
  governanceDocuments: Array<{ id: string }>;
  reviewTasks: Array<{ id: string; status?: string }>;
  issues: DashboardIssue[];
};

const frameworkFilters: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All Frameworks' },
  { value: 'CIS Controls', label: 'CIS Controls' },
  { value: 'COBIT', label: 'COBIT' },
  { value: 'Custom', label: 'Custom' },
  { value: 'EU AI Act', label: 'EU AI Act' },
  { value: 'GDPR', label: 'GDPR' },
  { value: 'HIPAA', label: 'HIPAA' },
  { value: 'HITRUST CSF', label: 'HITRUST CSF' },
  { value: 'ISO 27001', label: 'ISO 27001' },
  { value: 'ISO 27701', label: 'ISO 27701' },
  { value: 'ISO 42001 (AI)', label: 'ISO 42001 (AI)' },
  { value: 'NIST 800-53', label: 'NIST 800-53' },
  { value: 'NIST CSF', label: 'NIST CSF' },
  { value: 'PCI DSS', label: 'PCI DSS' },
  { value: 'SOC 1', label: 'SOC 1' },
  { value: 'SOC 2', label: 'SOC 2' },
];

const appetiteCategories = [
  { key: 'information_security', label: 'Information Security', threshold: 40 },
  { key: 'privacy', label: 'Privacy', threshold: 38 },
  { key: 'vendor', label: 'Third Party', threshold: 42 },
  { key: 'compliance', label: 'Compliance', threshold: 40 },
  { key: 'operational', label: 'Operational', threshold: 48 },
  { key: 'ai_governance', label: 'AI Governance', threshold: 35 },
  { key: 'financial', label: 'Financial / Reporting', threshold: 42 },
];

const infoSecAreas = [
  { label: 'Access Control', terms: ['access', 'identity', 'privileged', 'authentication'] },
  { label: 'Asset Management', terms: ['asset', 'inventory', 'device', 'endpoint'] },
  { label: 'Vulnerability Management', terms: ['vulnerability', 'patch', 'configuration', 'exposure'] },
  { label: 'Incident Management', terms: ['incident', 'detection', 'response', 'monitor'] },
  { label: 'Supplier Security', terms: ['vendor', 'supplier', 'third', 'subprocessor'] },
  { label: 'Data Protection', terms: ['privacy', 'data', 'gdpr', 'classification'] },
  { label: 'Business Continuity', terms: ['continuity', 'recovery', 'resilience', 'availability'] },
  { label: 'Awareness & Training', terms: ['training', 'awareness', 'phishing', 'human'] },
];

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreFromLikelihoodImpact(likelihood: number, impact: number) {
  return Math.max(1, Math.min(25, Math.round(likelihood) * Math.round(impact)));
}

function normalizeRiskScore(score: number) {
  return Math.round((score / 25) * 100);
}

function matchesArea(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { currentWorkspace } = useWorkspace();
  const { frameworkOptions } = useFrameworks();
  const [data, setData] = useState<DashboardState>({
    controls: [],
    risks: [],
    vendors: [],
    vendorAssessments: [],
    evidence: [],
    governanceDocuments: [],
    reviewTasks: [],
    issues: DASHBOARD_ISSUE_FALLBACK,
  });
  const [trainingSummary, setTrainingSummary] = useState<TrainingDashboardSummary>({});
  const [auditSummary, setAuditSummary] = useState<AuditSummaryItem[]>([]);
  const [dataProtectionSummary, setDataProtectionSummary] = useState<DataProtectionOverview | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<string>('ALL');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('residual');
  const [previousEnterpriseScore, setPreviousEnterpriseScore] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);

  const navigateTo = (path: string) => onNavigate?.(path);

  const mergedFrameworkOptions = useMemo(() => {
    const merged = [...frameworkFilters];
    frameworkOptions.forEach((option) => {
      if (!merged.some((item) => item.label === option.label)) {
        merged.push({ value: option.value, label: option.label });
      }
    });
    return merged;
  }, [frameworkOptions]);

  useEffect(() => {
    if (!currentWorkspace.id) return;
    const scoreKey = `dashboardEnterpriseScore:${currentWorkspace.id}:${selectedFramework}`;
    const saved = localStorage.getItem(scoreKey);
    setPreviousEnterpriseScore(saved ? Number(saved) : undefined);
  }, [currentWorkspace.id, selectedFramework]);

  useEffect(() => {
    async function fetchData() {
      if (!currentWorkspace.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const results = await Promise.allSettled([
          apiCall<{ data: ControlWithFrameworks[] }>('/api/v1/controls'),
          apiCall<{ data: AppRisk[] }>('/api/v1/risks'),
          apiCall<{ data: DashboardVendor[] }>('/api/v1/vendors'),
          apiCall<{ data: VendorRiskAssessment[] }>('/api/v1/tprm/assessments'),
          apiCall<{ data: EvidenceItem[] }>('/api/v1/evidence'),
          apiCall<{ data: Array<{ id: string }> }>('/api/v1/governance-documents'),
          apiCall<{ data: Array<{ id: string; status?: string }> }>('/api/v1/review-tasks'),
          apiCall<{ data: DashboardIssue[] }>('/api/v1/issues'),
          apiCall<{ data: TrainingDashboardSummary }>('/api/v1/training/dashboard'),
          apiCall<{ data: AuditSummaryItem[] }>('/api/v1/audit-readiness/summary'),
          apiCall<{ data: DataProtectionOverview }>('/api/v1/reports/data-protection/overview'),
        ]);

        const [controlsResult, risksResult, vendorsResult, vendorAssessmentsResult, evidenceResult, governanceResult, reviewTasksResult, issuesResult, trainingResult, auditResult, dataProtectionResult] = results;

        setData({
          controls: controlsResult.status === 'fulfilled' ? controlsResult.value.data || [] : [],
          risks: risksResult.status === 'fulfilled' ? risksResult.value.data || [] : [],
          vendors: vendorsResult.status === 'fulfilled' ? vendorsResult.value.data || [] : [],
          vendorAssessments: vendorAssessmentsResult.status === 'fulfilled' ? vendorAssessmentsResult.value.data || [] : [],
          evidence: evidenceResult.status === 'fulfilled' ? evidenceResult.value.data || [] : [],
          governanceDocuments: governanceResult.status === 'fulfilled' ? governanceResult.value.data || [] : [],
          reviewTasks: reviewTasksResult.status === 'fulfilled' ? reviewTasksResult.value.data || [] : [],
          issues: issuesResult.status === 'fulfilled' && issuesResult.value.data && issuesResult.value.data.length > 0 ? issuesResult.value.data : DASHBOARD_ISSUE_FALLBACK,
        });
        setTrainingSummary(trainingResult.status === 'fulfilled' ? trainingResult.value.data || {} : {});
        setAuditSummary(auditResult.status === 'fulfilled' ? auditResult.value.data || [] : []);
        setDataProtectionSummary(dataProtectionResult.status === 'fulfilled' ? dataProtectionResult.value.data || null : null);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentWorkspace.id]);

  const selectedFrameworks = useMemo(() => (selectedFramework === 'ALL' ? frameworkFilters.slice(1).map((item) => item.value) : [selectedFramework]), [selectedFramework]);

  const adaptedRisks = useMemo(() => adaptDashboardDataToRisks({
    risks: data.risks,
    controls: data.controls,
    evidence: data.evidence,
    issues: data.issues,
    vendors: data.vendors,
    vendorAssessments: data.vendorAssessments,
  }), [data.controls, data.evidence, data.issues, data.risks, data.vendorAssessments, data.vendors]);

  const filteredEngineRisks = useMemo(() => selectedFramework === 'ALL' ? adaptedRisks : adaptedRisks.filter((risk) => risk.frameworks.some((mapping) => mapping.framework === selectedFramework)), [adaptedRisks, selectedFramework]);

  const controlStatus = useMemo(() => ({
    implemented: data.controls.filter((control) => control.status === 'implemented').length,
    inProgress: data.controls.filter((control) => control.status === 'in_progress').length,
    notImplemented: data.controls.filter((control) => control.status === 'not_implemented').length,
    notApplicable: data.controls.filter((control) => control.status === 'not_applicable').length,
  }), [data.controls]);

  const auditAverage = useMemo(() => avg(auditSummary.map((item) => item.readinessPercent)), [auditSummary]);
  const remediationProgress = useMemo(() => clamp(data.risks.length ? (data.risks.filter((risk) => risk.status === 'treated' || risk.status === 'accepted' || risk.status === 'closed').length / data.risks.length) * 100 : 0), [data.risks]);

  const enterprisePosture = useMemo(() => createEnterpriseRiskPosture({
    risks: filteredEngineRisks,
    previousEnterpriseScore,
    training: { completionScore: trainingSummary.overallCompletionRate || 0 },
    audit: { readinessScore: auditAverage },
    frameworks: selectedFrameworks,
    evidenceFreshnessDays: 90,
    vendorAssessmentMaxAgeDays: 365,
  }), [auditAverage, filteredEngineRisks, previousEnterpriseScore, selectedFrameworks, trainingSummary.overallCompletionRate]);

  useEffect(() => {
    if (!currentWorkspace.id || filteredEngineRisks.length === 0) return;
    const scoreKey = `dashboardEnterpriseScore:${currentWorkspace.id}:${selectedFramework}`;
    localStorage.setItem(scoreKey, String(enterprisePosture.enterpriseScore));
  }, [currentWorkspace.id, enterprisePosture.enterpriseScore, filteredEngineRisks.length, selectedFramework]);

  const criticalIssueCount = data.issues.filter((issue) => issue.priority === 'Critical' && issue.status !== 'Resolved').length;
  const complianceCoverage = useMemo(() => {
    const values = Object.values(enterprisePosture.frameworkScores).filter((value) => value > 0);
    return clamp(values.length > 0 ? avg(values) : 0);
  }, [enterprisePosture.frameworkScores]);

  const inherentAverage = avg(filteredEngineRisks.map((risk) => normalizeRiskScore(scoreFromLikelihoodImpact(risk.inherent.likelihood, risk.inherent.impact))));
  const residualAverage = avg(filteredEngineRisks.map((risk) => normalizeRiskScore(scoreFromLikelihoodImpact(risk.residual.likelihood, risk.residual.impact))));
  const targetAverage = avg(filteredEngineRisks.map((risk) => normalizeRiskScore(scoreFromLikelihoodImpact((risk.target || risk.residual).likelihood, (risk.target || risk.residual).impact))));
  const appetiteThresholdAverage = avg(appetiteCategories.map((category) => category.threshold));

  const kpis: Array<{ title: string; value: string | number; subtitle: string; tone: Tone }> = [
    { title: 'Enterprise Risk Posture Score', value: enterprisePosture.enterpriseScore, subtitle: `${enterprisePosture.trend >= 0 ? '+' : ''}${enterprisePosture.trend} vs last review`, tone: enterprisePosture.enterpriseScore >= 75 ? 'success' : enterprisePosture.enterpriseScore >= 55 ? 'warning' : 'critical' },
    { title: 'Risk Appetite Status', value: enterprisePosture.appetiteStatus, subtitle: enterprisePosture.appetiteStatus === 'Outside' ? 'Residual risk exceeds appetite' : 'Operating within approved appetite', tone: enterprisePosture.appetiteStatus === 'Outside' ? 'critical' : 'success' },
    { title: 'Risks Outside Appetite', value: enterprisePosture.exceptions.risksOutsideAppetite, subtitle: 'Residual scores requiring treatment', tone: enterprisePosture.exceptions.risksOutsideAppetite > 0 ? 'critical' : 'success' },
    { title: 'Compliance Coverage', value: `${complianceCoverage}%`, subtitle: `${selectedFramework === 'ALL' ? selectedFrameworks.length : 1} frameworks in scope`, tone: complianceCoverage >= 75 ? 'success' : complianceCoverage >= 55 ? 'warning' : 'critical' },
    { title: 'Critical Issues', value: criticalIssueCount, subtitle: 'Immediate management attention', tone: criticalIssueCount > 0 ? 'critical' : 'success' },
    { title: 'Remediation Progress', value: `${remediationProgress}%`, subtitle: 'Treatment plan completion', tone: remediationProgress >= 75 ? 'success' : remediationProgress >= 50 ? 'warning' : 'critical' },
  ];

  const appetiteRows: AppetiteRow[] = appetiteCategories.map((category) => {
    const categoryRisks = filteredEngineRisks.filter((risk) => category.key === 'ai_governance'
      ? risk.frameworks.some((mapping) => mapping.framework === 'EU AI Act' || mapping.framework === 'ISO 42001 (AI)')
      : category.key === 'financial'
        ? risk.category === 'strategic' || risk.category === 'compliance'
        : risk.category === category.key);
    const residualScore = avg(categoryRisks.map((risk) => evaluateRiskAppetiteStatus(risk, { frameworks: selectedFrameworks }).residualScore));
    const status = residualScore > category.threshold + 10 ? 'Exceeded' : residualScore > category.threshold ? 'Breaching' : 'Within Appetite';
    return {
      label: category.label,
      threshold: category.threshold,
      appetiteLevel: category.threshold <= 38 ? 'Conservative' : category.threshold <= 42 ? 'Moderate' : 'Measured',
      residualScore,
      status,
      action: status === 'Exceeded' ? 'Immediate remediation and leadership review' : status === 'Breaching' ? 'Treatment plan and control uplift' : 'Maintain monitoring cadence',
    };
  });

  const weightedFactors: WeightedFactor[] = [
    { label: 'Likelihood weight', weight: 0.18, score: avg(filteredEngineRisks.map((risk) => Math.round((risk.residual.likelihood / 5) * 100))) },
    { label: 'Impact weight', weight: 0.2, score: avg(filteredEngineRisks.map((risk) => Math.round((risk.residual.impact / 5) * 100))) },
    { label: 'Asset criticality weight', weight: 0.15, score: clamp(data.risks.length ? (data.risks.filter((risk) => risk.severity === 'critical' || risk.severity === 'high').length / data.risks.length) * 100 : 0) },
    { label: 'Control weakness weight', weight: 0.15, score: clamp(data.controls.length ? ((controlStatus.notImplemented + controlStatus.inProgress) / data.controls.length) * 100 : 0) },
    { label: 'Evidence confidence weight', weight: 0.1, score: clamp((enterprisePosture.exceptions.expiringEvidence / Math.max(1, data.evidence.length || 1)) * 100) },
    { label: 'Vendor exposure weight', weight: 0.1, score: clamp(data.vendors.length ? (enterprisePosture.exceptions.highRiskVendors / data.vendors.length) * 100 : 0) },
    { label: 'Regulatory impact weight', weight: 0.12, score: clamp(100 - avg([complianceCoverage, auditAverage])) },
  ];
  const weightedPriorityScore = Math.round(weightedFactors.reduce((sum, factor) => sum + factor.score * factor.weight, 0));

  const infoSecRows: InfoSecRow[] = infoSecAreas.map((area) => {
    const linkedRisks = data.risks.filter((risk) => matchesArea(`${risk.title} ${risk.description} ${risk.category}`, area.terms));
    const linkedControls = data.controls.filter((control) => matchesArea(`${control.title} ${control.description} ${control.domain || ''}`, area.terms));
    const relatedEvidence = data.evidence.filter((item) => matchesArea(`${item.name} ${item.description || ''} ${item.type}`, area.terms));
    const treated = linkedRisks.filter((risk) => risk.status === 'treated' || risk.status === 'accepted' || risk.status === 'closed').length;
    return {
      label: area.label,
      linkedRisks: linkedRisks.length,
      controlGaps: linkedControls.filter((control) => control.status !== 'implemented').length,
      evidenceGaps: Math.max(0, linkedControls.length - relatedEvidence.length),
      remediation: clamp(linkedRisks.length ? (treated / linkedRisks.length) * 100 : 100),
    };
  });

  const remediationRows: RemediationRow[] = data.risks.map((risk) => {
    const engineRisk = filteredEngineRisks.find((item) => item.id === risk.id);
    if (!engineRisk) return null;
    const residualScore = normalizeRiskScore(scoreFromLikelihoodImpact(engineRisk.residual.likelihood, engineRisk.residual.impact));
    const targetScore = normalizeRiskScore(scoreFromLikelihoodImpact((engineRisk.target || engineRisk.residual).likelihood, (engineRisk.target || engineRisk.residual).impact));
    const inherentScore = normalizeRiskScore(scoreFromLikelihoodImpact(engineRisk.inherent.likelihood, engineRisk.inherent.impact));
    const progress = clamp(inherentScore === targetScore ? 100 : ((inherentScore - residualScore) / Math.max(1, inherentScore - targetScore)) * 100);
    const dueDate = risk.dueDate ? new Date(risk.dueDate) : null;
    const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
    return {
      id: risk.id,
      owner: risk.owner,
      linkedRisk: risk.title,
      dueBucket: daysUntilDue === null ? 'No due date' : daysUntilDue < 0 ? 'Overdue' : daysUntilDue <= 30 ? 'Due in 30 days' : 'Planned',
      targetScore,
      residualScore,
      progress,
    };
  }).filter((row): row is RemediationRow => Boolean(row)).sort((left, right) => right.residualScore - left.residualScore).slice(0, 8);

  const frameworkRows: FrameworkRow[] = (selectedFramework === 'ALL' ? frameworkFilters.slice(1).map((item) => item.label) : [selectedFramework]).map((framework) => {
    const controlsMapped = data.controls.filter((control) => control.frameworks?.includes(framework)).length;
    const linkedRiskIds = new Set(filteredEngineRisks.filter((risk) => risk.frameworks.some((mapping) => mapping.framework === framework)).map((risk) => risk.id));
    const evidenceAvailable = data.evidence.filter((item) => (item.controlId && data.controls.some((control) => control.id === item.controlId && control.frameworks?.includes(framework))) || (item.riskId && linkedRiskIds.has(item.riskId))).length;
    const appetiteBreaches = filteredEngineRisks.filter((risk) => risk.frameworks.some((mapping) => mapping.framework === framework) && evaluateRiskAppetiteStatus(risk, { frameworks: [framework] }).appetiteStatus === 'Outside').length;
    const scoreKey = Object.keys(enterprisePosture.frameworkScores).find((key) => getFrameworkDisplayName(key, mergedFrameworkOptions) === framework);
    return { framework, coverage: scoreKey ? enterprisePosture.frameworkScores[scoreKey] : 0, controlsMapped, evidenceAvailable, risksLinked: linkedRiskIds.size, appetiteBreaches };
  }).sort((left, right) => right.coverage - left.coverage);

  const vendorRiskExposure = enterprisePosture.exceptions.highRiskVendors >= 3 ? 'High' : enterprisePosture.exceptions.highRiskVendors >= 1 ? 'Medium' : 'Low';
  const modules = [
    { title: 'Risk & Controls', metric: `${enterprisePosture.exceptions.risksOutsideAppetite} outside appetite`, supporting: [`${controlStatus.implemented} implemented controls`, `${enterprisePosture.exceptions.failedControls} control failures`], cta: 'Open Risks', path: 'risks', icon: <RiskIcon size={18} /> },
    { title: 'Governance', metric: `${data.governanceDocuments.length} documents`, supporting: [`${data.reviewTasks.filter((task) => task.status !== 'completed').length} review tasks`, `${criticalIssueCount} critical issues`], cta: 'Open Governance', path: 'governance-documents', icon: <PolicyIcon size={18} /> },
    { title: 'Third-Party Risk', metric: `${vendorRiskExposure} exposure`, supporting: [`${data.vendors.length} vendors tracked`, `${enterprisePosture.exceptions.highRiskVendors} high-risk vendors`], cta: 'Open TPRM', path: 'tprm-dashboard', icon: <VendorIcon size={18} /> },
    { title: 'Audit Readiness', metric: `${auditAverage}% readiness`, supporting: [`${enterprisePosture.exceptions.auditBlockers} blockers`, `${selectedFramework === 'ALL' ? selectedFrameworks.length : 1} frameworks`], cta: 'Open Audit', path: 'audit-readiness', icon: <AuditIcon size={18} /> },
    { title: 'Data Protection', metric: `${dataProtectionSummary?.totalRelevantControls || 0} privacy controls`, supporting: [`${dataProtectionSummary?.totalEvidenceItems || 0} evidence`, `${dataProtectionSummary?.totalRelatedRisks || 0} related risks`], cta: 'Open Data Protection', path: 'data-protection', icon: <ReportsIcon size={18} /> },
    { title: 'Training', metric: `${trainingSummary.overallCompletionRate || 0}% completion`, supporting: [`${trainingSummary.activeCampaigns || 0} campaigns`, `${trainingSummary.overdueAssignments || 0} overdue`], cta: 'Open Training', path: 'training', icon: <TrainingIcon size={18} /> },
  ];

  if (loading) return <div style={{ maxWidth: 1540, margin: '0 auto', padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading Enterprise Risk Command Center...</div>;
  if (!currentWorkspace.id) return <WorkspaceEmptyState onNavigate={navigateTo} />;

  return (
    <div style={{ maxWidth: 1540, margin: '0 auto', display: 'grid', gap: theme.spacing[5] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[4], alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enterprise Risk Command Center</div>
          <h2 style={{ margin: `${theme.spacing[2]} 0 0 0`, fontSize: theme.typography.sizes['3xl'], color: theme.colors.text.main }}>Enterprise risk operating system for appetite, remediation, and framework alignment</h2>
        </div>
        <select value={selectedFramework} onChange={(event) => setSelectedFramework(event.target.value)} style={{ border, borderRadius: theme.borderRadius.lg, padding: `${theme.spacing[2]} ${theme.spacing[3]}`, background: theme.colors.surface, color: theme.colors.text.main, minWidth: 220 }}>
          {mergedFrameworkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: theme.spacing[3] }}>
        {kpis.map((kpi) => <KPIBox key={kpi.title} title={kpi.title} value={kpi.value} subtitle={kpi.subtitle} tone={kpi.tone} />)}
      </section>

      <RiskFoundationFlow inherentScore={inherentAverage} residualScore={residualAverage} targetScore={targetAverage} appetiteThreshold={appetiteThresholdAverage} thresholdBand={appetiteThresholdAverage + 10} />

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(420px, 0.9fr)', gap: theme.spacing[4] }}>
        <AppetiteThresholdTable rows={appetiteRows} />
        <WeightedRiskProfile factors={weightedFactors} finalScore={weightedPriorityScore} />
      </section>

      <EnhancedRiskHeatmap risks={filteredEngineRisks} scoringMode={scoringMode} onScoringModeChange={setScoringMode} />
      <InfoSecRiskLinkage rows={infoSecRows} />
      <RemediationCenter rows={remediationRows} openActions={remediationRows.length} overdueActions={remediationRows.filter((row) => row.dueBucket === 'Overdue').length} dueIn30Days={remediationRows.filter((row) => row.dueBucket === 'Due in 30 days').length} />
      <FrameworkAlignmentPanel selectedFramework={selectedFramework} rows={frameworkRows} />

      <SectionContainer title="Immediate Attention Required" subtitle="Critical exceptions that require escalation or leadership review.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}>
          {[
            ['Risks Outside Appetite', enterprisePosture.exceptions.risksOutsideAppetite, 'risks', enterprisePosture.appetiteStatus === 'Outside' ? 'critical' : 'success'],
            ['Failed / Ineffective Controls', enterprisePosture.exceptions.failedControls, 'controls', enterprisePosture.exceptions.failedControls > 0 ? 'critical' : 'success'],
            ['Evidence Gaps', enterprisePosture.exceptions.expiringEvidence, 'evidence', enterprisePosture.exceptions.expiringEvidence > 0 ? 'warning' : 'success'],
            ['Critical Issues', criticalIssueCount, 'issues', criticalIssueCount > 0 ? 'critical' : 'success'],
          ].map(([title, count, path, tone]) => (
            <Card key={String(title)} style={{ border, background: theme.colors.surface }}>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, fontWeight: theme.typography.weights.semibold }}>{title}</div>
              <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{count}</div>
              <div style={{ marginTop: theme.spacing[3] }}><Button variant="secondary" onClick={() => navigateTo(String(path))}>{String(tone) === 'critical' ? 'Escalate' : 'Review'}</Button></div>
            </Card>
          ))}
        </div>
      </SectionContainer>

      <section>
        <div style={{ marginBottom: theme.spacing[4] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Operating Modules</div>
          <h3 style={{ margin: `${theme.spacing[2]} 0 0 0`, fontSize: theme.typography.sizes.xl, color: theme.colors.text.main }}>Decision support paths into the underlying GRC workflows</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: theme.spacing[3] }}>
          {modules.map((module) => (
            <Card key={module.title} style={{ border, background: theme.colors.surface, boxShadow: theme.shadows.card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[3], color: theme.colors.primary }}>{module.icon}<span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{module.title}</span></div>
              <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{module.metric}</div>
              <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[1] }}>{module.supporting.map((item) => <div key={item} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item}</div>)}</div>
              <div style={{ marginTop: theme.spacing[4] }}><Button variant="secondary" onClick={() => navigateTo(module.path)}>{module.cta}</Button></div>
            </Card>
          ))}
        </div>
      </section>

      <SectionContainer title="Priority Risk Register" subtitle="Residual risk, severity, and appetite status for the highest-priority risks in scope.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Risk</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Category</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Status</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Severity</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Residual</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Appetite</th>
              </tr>
            </thead>
            <tbody>
              {data.risks.filter((risk) => filteredEngineRisks.some((item) => item.id === risk.id)).map((risk) => {
                const engineRisk = filteredEngineRisks.find((item) => item.id === risk.id);
                const evaluation = engineRisk ? evaluateRiskAppetiteStatus(engineRisk, { frameworks: selectedFrameworks }) : null;
                return { id: risk.id, title: risk.title, category: RISK_CATEGORY_LABELS[risk.category] || titleCase(risk.category), status: RISK_STATUS_LABELS[risk.status] || titleCase(risk.status), severity: risk.severity, residual: `${risk.residualLikelihood} x ${risk.residualImpact}`, appetiteStatus: evaluation?.appetiteStatus || 'Within', residualScore: evaluation?.residualScore || 0 };
              }).sort((left, right) => right.residualScore - left.residualScore).slice(0, 10).map((row) => (
                <tr key={row.id} style={{ borderTop: border }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, minWidth: 260 }}><div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}><span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{row.title}</span>{row.appetiteStatus === 'Outside' ? <Badge variant="danger" size="sm">Outside Appetite</Badge> : null}</div></td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.category}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.status}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={severityVariant(row.severity)} size="sm">{titleCase(row.severity)}</Badge></td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.residual}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={row.appetiteStatus === 'Outside' ? 'danger' : 'success'} size="sm">{row.appetiteStatus}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionContainer>
    </div>
  );
}
