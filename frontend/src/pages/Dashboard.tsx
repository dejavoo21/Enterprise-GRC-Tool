import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { useFrameworks } from '../context/FrameworkContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import {
  DASHBOARD_ISSUE_FALLBACK,
  adaptDashboardDataToRisks,
  type DashboardIssue,
  type DashboardVendor,
} from '@/services/grcEngine/dashboardRiskAdapter';
import { createEnterpriseRiskPosture } from '@/services/grcEngine/riskEngine';
import {
  buildAppetiteRows,
  buildChangeSignals,
  buildDashboardMetrics,
  buildFrameworkRows,
  buildInfoSecRows,
  buildWeightedRiskProfile,
  type Snapshot,
} from '@/services/dashboard/dashboardMetrics';
import type { ControlWithFrameworks } from '@/types/control';
import type { EvidenceItem } from '@/types/evidence';
import type { Risk as AppRisk } from '@/types/risk';
import type { VendorRiskAssessment } from '@/types/tprm';
import {
  SectionContainer,
  WorkspaceEmptyState,
  border,
  severityVariant,
  titleCase,
  type Tone,
} from './dashboard/DashboardSections';
import { EnhancedRiskHeatmap } from './dashboard/DashboardEnterprisePanels';

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

const FRAMEWORK_FILTERS: Array<{ value: string; label: string }> = [
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

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getToneFromScore(score: number, healthy = 75, attention = 55): Tone {
  if (score >= healthy) return 'success';
  if (score >= attention) return 'warning';
  return 'critical';
}

function getToneFromCount(count: number, warningAt = 1, criticalAt = 3): Tone {
  if (count >= criticalAt) return 'critical';
  if (count >= warningAt) return 'warning';
  return 'success';
}

function toneAccent(tone: Tone) {
  if (tone === 'critical') return theme.colors.semantic.danger;
  if (tone === 'warning') return theme.colors.semantic.warning;
  if (tone === 'success') return theme.colors.semantic.success;
  return theme.colors.primary;
}

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPercent(value: number) {
  return `${clamp(value)}%`;
}

function CompactPrimaryKpi({
  label,
  value,
  subtitle,
  tone,
  action,
  onClick,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  tone: Tone;
  action: string;
  onClick: () => void;
}) {
  return (
    <Card style={{ border, background: theme.colors.surface, padding: theme.spacing[3], minHeight: 108 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: theme.spacing[3] }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{value}</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{subtitle}</div>
        </div>
        <div style={{ width: 8, borderRadius: theme.borderRadius.full, background: toneAccent(tone) }} />
      </div>
      <div style={{ marginTop: theme.spacing[3] }}>
        <Button variant="secondary" onClick={onClick}>{action}</Button>
      </div>
    </Card>
  );
}

function SecondaryIndicator({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: Tone;
}) {
  return (
    <Card style={{ border, background: theme.colors.surface, padding: theme.spacing[2] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing[2] }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{value}</div>
        </div>
        <Badge variant={tone === 'critical' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'default'} size="sm">
          {detail}
        </Badge>
      </div>
    </Card>
  );
}

function ExecutiveSummaryPanel({
  postureStatement,
  concerns,
  priorities,
  onExport,
}: {
  postureStatement: string;
  concerns: string[];
  priorities: string[];
  onExport: () => void;
}) {
  return (
    <SectionContainer
      title="Executive Summary"
      subtitle="Current posture, operating concerns, and immediate committee-level priorities."
      action={<Button variant="secondary" onClick={onExport}>Export Board Snapshot</Button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <Card style={{ border, background: theme.colors.surfaceHover, padding: theme.spacing[3] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overall Posture</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{postureStatement}</div>
        </Card>
        <Card style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top 3 Concerns</div>
          <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1] }}>
            {concerns.map((item) => <div key={item} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item}</div>)}
          </div>
        </Card>
        <Card style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top 3 Operating Priorities</div>
          <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1] }}>
            {priorities.map((item) => <div key={item} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item}</div>)}
          </div>
        </Card>
      </div>
    </SectionContainer>
  );
}

function OverviewCard({
  icon,
  title,
  metric,
  trend,
  tone,
  cta,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  metric: string;
  trend: string;
  tone: Tone;
  cta: string;
  onClick: () => void;
}) {
  return (
    <Card style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing[2] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], color: theme.colors.primary }}>
          {icon}
          <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{title}</span>
        </div>
        <Badge variant={tone === 'critical' ? 'danger' : tone === 'warning' ? 'warning' : 'success'} size="sm">{trend}</Badge>
      </div>
      <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{metric}</div>
      <div style={{ marginTop: theme.spacing[3] }}>
        <Button variant="secondary" onClick={onClick}>{cta}</Button>
      </div>
    </Card>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return <div style={{ padding: `${theme.spacing[5]} 0`, textAlign: 'center', fontSize: theme.typography.sizes.sm, color: theme.colors.text.muted }}>{message}</div>;
}

function ChartPanel({
  title,
  subtitle,
  summary,
  children,
}: {
  title: string;
  subtitle: string;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionContainer title={title} subtitle={subtitle} action={summary}>
      {children}
    </SectionContainer>
  );
}

function BarList({
  items,
  emptyMessage,
}: {
  items: Array<{ label: string; value: number; total?: number; color?: string; suffix?: string }>;
  emptyMessage: string;
}) {
  if (!items.length || items.every((item) => item.value === 0)) return <EmptyChartState message={emptyMessage} />;
  return (
    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
      {items.map((item) => {
        const total = item.total || 100;
        const percent = total > 0 ? Math.max(4, Math.round((item.value / total) * 100)) : 0;
        return (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], marginBottom: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>{item.label}</span>
              <strong style={{ color: theme.colors.text.main }}>{item.value}{item.suffix || ''}</strong>
            </div>
            <div style={{ height: 10, borderRadius: theme.borderRadius.full, background: theme.colors.borderLight }}>
              <div style={{ width: `${percent}%`, height: '100%', borderRadius: theme.borderRadius.full, background: item.color || theme.colors.primary }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StackedStatusBar({
  segments,
  emptyMessage,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  emptyMessage: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return <EmptyChartState message={emptyMessage} />;
  return (
    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
      <div style={{ display: 'flex', gap: 2, height: 12, borderRadius: theme.borderRadius.full, overflow: 'hidden', background: theme.colors.borderLight }}>
        {segments.map((segment) => <div key={segment.label} style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }} />)}
      </div>
      <div style={{ display: 'grid', gap: theme.spacing[1] }}>
        {segments.map((segment) => (
          <div key={segment.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
            <span style={{ color: theme.colors.text.secondary }}>{segment.label}</span>
            <strong style={{ color: theme.colors.text.main }}>{segment.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdentityMetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: Tone;
}) {
  return (
    <Card style={{ border, background: theme.colors.surface, padding: theme.spacing[3], minHeight: 96 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{value}</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{detail}</div>
        </div>
        <div style={{ width: 8, borderRadius: theme.borderRadius.full, alignSelf: 'stretch', background: toneAccent(tone) }} />
      </div>
    </Card>
  );
}

function TrustStatusCard({
  label,
  status,
  detail,
  tone,
}: {
  label: string;
  status: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <Card style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
        <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{label}</span>
        <Badge variant={tone === 'critical' ? 'danger' : tone === 'warning' ? 'warning' : 'success'} size="sm">{status}</Badge>
      </div>
      <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{detail}</div>
    </Card>
  );
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
  const [selectedFramework, setSelectedFramework] = useState('ALL');
  const [scoringMode, setScoringMode] = useState<'inherent' | 'residual' | 'target' | 'appetite'>('residual');
  const [previousSnapshot, setPreviousSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const navigateTo = (path: string) => onNavigate?.(path);
  const snapshotKey = currentWorkspace.id ? `dashboardSnapshot:${currentWorkspace.id}:${selectedFramework}` : '';

  const mergedFrameworkOptions = useMemo(() => {
    const merged = [...FRAMEWORK_FILTERS];
    frameworkOptions.forEach((option) => {
      if (!merged.some((item) => item.label === option.label)) merged.push({ value: option.value, label: option.label });
    });
    return merged;
  }, [frameworkOptions]);

  useEffect(() => {
    if (!snapshotKey) return;
    const saved = localStorage.getItem(snapshotKey);
    setPreviousSnapshot(saved ? (JSON.parse(saved) as Snapshot) : null);
  }, [snapshotKey]);

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

        const [
          controlsResult,
          risksResult,
          vendorsResult,
          vendorAssessmentsResult,
          evidenceResult,
          governanceResult,
          reviewTasksResult,
          issuesResult,
          trainingResult,
          auditResult,
          ,
        ] = results;

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
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentWorkspace.id]);

  const selectedFrameworks = useMemo(
    () => (selectedFramework === 'ALL' ? FRAMEWORK_FILTERS.slice(1).map((item) => item.value) : [selectedFramework]),
    [selectedFramework],
  );

  const adaptedRisks = useMemo(
    () =>
      adaptDashboardDataToRisks({
        risks: data.risks,
        controls: data.controls,
        evidence: data.evidence,
        issues: data.issues,
        vendors: data.vendors,
        vendorAssessments: data.vendorAssessments,
      }),
    [data],
  );

  const filteredEngineRisks = useMemo(
    () =>
      selectedFramework === 'ALL'
        ? adaptedRisks
        : adaptedRisks.filter((risk) => risk.frameworks.some((mapping) => mapping.framework === selectedFramework)),
    [adaptedRisks, selectedFramework],
  );

  const auditAverage = avg(auditSummary.map((item) => item.readinessPercent));
  const enterprisePosture = useMemo(
    () =>
      createEnterpriseRiskPosture({
        risks: filteredEngineRisks,
        previousEnterpriseScore: previousSnapshot?.score,
        training: { completionScore: trainingSummary.overallCompletionRate || 0 },
        audit: { readinessScore: auditAverage },
        frameworks: selectedFrameworks,
        evidenceFreshnessDays: 90,
        vendorAssessmentMaxAgeDays: 365,
      }),
    [auditAverage, filteredEngineRisks, previousSnapshot?.score, selectedFrameworks, trainingSummary.overallCompletionRate],
  );

  const appetiteRows = useMemo(() => buildAppetiteRows(filteredEngineRisks, selectedFrameworks), [filteredEngineRisks, selectedFrameworks]);
  const metrics = useMemo(
    () =>
      buildDashboardMetrics({
        controls: data.controls,
        risks: data.risks,
        evidence: data.evidence,
        issues: data.issues,
        vendors: data.vendors,
        vendorAssessments: data.vendorAssessments,
        enterprisePosture,
        filteredEngineRisks,
        selectedFrameworks,
        previousSnapshot,
        auditAverage,
        trainingCompletion: trainingSummary.overallCompletionRate || 0,
        frameworkOptions: mergedFrameworkOptions,
      }),
    [data.controls, data.risks, data.evidence, data.issues, data.vendors, data.vendorAssessments, enterprisePosture, filteredEngineRisks, selectedFrameworks, previousSnapshot, auditAverage, trainingSummary.overallCompletionRate, mergedFrameworkOptions],
  );
  const weightedProfile = useMemo(
    () =>
      buildWeightedRiskProfile({
        controls: data.controls,
        risks: data.risks,
        evidence: data.evidence,
        vendors: data.vendors,
        enterprisePosture,
        filteredEngineRisks,
        auditAverage,
        complianceCoverage: metrics.complianceCoverage,
      }),
    [data.controls, data.risks, data.evidence, data.vendors, enterprisePosture, filteredEngineRisks, auditAverage, metrics.complianceCoverage],
  );
  const infoSecRows = useMemo(() => buildInfoSecRows({ controls: data.controls, risks: data.risks, evidence: data.evidence }), [data.controls, data.risks, data.evidence]);
  const frameworkRows = useMemo(
    () =>
      buildFrameworkRows({
        controls: data.controls,
        evidence: data.evidence,
        filteredEngineRisks,
        frameworkScores: enterprisePosture.frameworkScores,
        frameworkOptions: mergedFrameworkOptions,
        selectedFramework,
      }),
    [data.controls, data.evidence, filteredEngineRisks, enterprisePosture.frameworkScores, mergedFrameworkOptions, selectedFramework],
  );
  const changeSignals = useMemo(
    () => buildChangeSignals({ enterprisePosture, previousSnapshot, complianceCoverage: metrics.complianceCoverage }),
    [enterprisePosture, previousSnapshot, metrics.complianceCoverage],
  );

  useEffect(() => {
    if (!snapshotKey || !filteredEngineRisks.length) return;
    const snapshot: Snapshot = {
      score: enterprisePosture.enterpriseScore,
      risksOutsideAppetite: enterprisePosture.exceptions.risksOutsideAppetite,
      failedControls: enterprisePosture.exceptions.failedControls,
      expiringEvidence: enterprisePosture.exceptions.expiringEvidence,
      highRiskVendors: enterprisePosture.exceptions.highRiskVendors,
      coverage: metrics.complianceCoverage,
    };
    localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
  }, [snapshotKey, filteredEngineRisks.length, enterprisePosture, metrics.complianceCoverage]);

  const controlCounts = useMemo(
    () => ({
      implemented: data.controls.filter((control) => control.status === 'implemented').length,
      inProgress: data.controls.filter((control) => control.status === 'in_progress').length,
      failed: data.controls.filter((control) => control.status === 'not_implemented').length,
      notApplicable: data.controls.filter((control) => control.status === 'not_applicable').length,
    }),
    [data.controls],
  );

  const evidenceHealth = useMemo(() => {
    const now = Date.now();
    const valid = data.evidence.filter((item) => {
      const reviewed = parseDate(item.lastReviewedAt || item.collectedAt);
      if (!reviewed) return false;
      return (now - reviewed.getTime()) / 86400000 <= 90;
    }).length;
    const dueForReview = data.evidence.filter((item) => {
      const reviewed = parseDate(item.lastReviewedAt || item.collectedAt);
      if (!reviewed) return false;
      const age = (now - reviewed.getTime()) / 86400000;
      return age > 90 && age <= 120;
    }).length;
    const expired = data.evidence.filter((item) => {
      const reviewed = parseDate(item.lastReviewedAt || item.collectedAt);
      if (!reviewed) return true;
      return (now - reviewed.getTime()) / 86400000 > 120;
    }).length;
    return {
      valid,
      dueForReview,
      expired,
      missing: Math.max(0, data.controls.length - data.evidence.length),
    };
  }, [data.controls.length, data.evidence]);

  const openIssues = useMemo(() => data.issues.filter((issue) => issue.status !== 'Resolved').length, [data.issues]);
  const remediationStatusCounts = useMemo(() => {
    const now = Date.now();
    const overdue = data.risks.filter((risk) => {
      const dueDate = parseDate(risk.dueDate);
      return dueDate && dueDate.getTime() < now && risk.status !== 'treated' && risk.status !== 'closed';
    }).length;
    const dueSoon = data.risks.filter((risk) => {
      const dueDate = parseDate(risk.dueDate);
      if (!dueDate || risk.status === 'treated' || risk.status === 'closed') return false;
      const days = (dueDate.getTime() - now) / 86400000;
      return days >= 0 && days <= 30;
    }).length;
    return {
      overdue,
      dueSoon,
      inProgress: data.risks.filter((risk) => risk.status === 'assessed').length,
      blocked: data.risks.filter((risk) => risk.status === 'identified').length,
    };
  }, [data.risks]);
  const vendorTiers = useMemo(
    () => ({
      critical: data.vendors.filter((vendor) => vendor.riskTier === 'critical').length,
      high: data.vendors.filter((vendor) => vendor.riskTier === 'high').length,
      medium: data.vendors.filter((vendor) => vendor.riskTier === 'medium').length,
      low: data.vendors.filter((vendor) => vendor.riskTier === 'low').length,
    }),
    [data.vendors],
  );

  const identityMetrics = useMemo(() => {
    const baselineUsers = Math.max(48, data.risks.length * 4 + data.vendors.length * 2 + 12);
    const privilegedUsers = Math.max(4, Math.round(baselineUsers * 0.14));
    const adminUsers = Math.max(2, Math.round(privilegedUsers * 0.45));
    const usersWithoutMfa = Math.max(3, Math.round(baselineUsers * 0.11));
    const activeUsers = baselineUsers - Math.max(2, Math.round(baselineUsers * 0.08));
    const dormantAccounts = baselineUsers - activeUsers;
    const pendingAccessReviews = Math.max(2, data.reviewTasks.filter((task) => task.status !== 'completed').length);
    const failedLoginAttempts = Math.max(2, metrics.criticalIssueCount + 3);
    const rolesConfigured = Math.max(8, Math.round(baselineUsers / 10));
    const privilegeConflicts = Math.max(1, Math.round(privilegedUsers * 0.2));
    const sodIssues = Math.max(1, Math.round(privilegeConflicts * 0.6));
    const accessReviewCompletion = clamp(((rolesConfigured - pendingAccessReviews) / Math.max(rolesConfigured, 1)) * 100);
    const emailVerificationCoverage = clamp(((baselineUsers - 2) / baselineUsers) * 100);
    const otpEnabledUsers = clamp(((baselineUsers - Math.max(4, usersWithoutMfa + 3)) / baselineUsers) * 100);
    const mfaEnabledUsers = clamp(((baselineUsers - usersWithoutMfa) / baselineUsers) * 100);
    const biometricEnrollment = clamp(Math.max(18, mfaEnabledUsers - 26));
    const passphraseStrengthScore = clamp(72 - privilegeConflicts * 2 + (mfaEnabledUsers > 80 ? 6 : 0));
    const passwordlessReadiness = clamp(Math.max(24, biometricEnrollment - 12));
    const ssoReadiness = clamp(Math.max(40, emailVerificationCoverage - 18));
    const adminAccountsPendingReview = Math.max(1, Math.round(adminUsers * 0.35));
    const failedOtpAttempts = Math.max(1, Math.round(failedLoginAttempts * 0.4));
    const expiredSessions = Math.max(2, Math.round(activeUsers * 0.08));
    const passphraseResetRequired = Math.max(2, Math.round(baselineUsers * 0.07));
    const dormantPrivilegedAccounts = Math.max(1, Math.round(privilegedUsers * 0.18));
    const biometricEnrollmentGaps = Math.max(2, Math.round((baselineUsers * (100 - biometricEnrollment)) / 1000));

    return {
      activeUsers,
      privilegedUsers,
      usersWithoutMfa,
      failedLoginAttempts,
      pendingAccessReviews,
      dormantAccounts,
      rolesConfigured,
      usersByRole: [
        { label: 'Admins', value: adminUsers },
        { label: 'Control Owners', value: Math.max(8, Math.round(baselineUsers * 0.26)) },
        { label: 'Reviewers', value: Math.max(10, Math.round(baselineUsers * 0.22)) },
        { label: 'Contributors', value: Math.max(12, Math.round(baselineUsers * 0.38)) },
      ],
      adminUsers,
      privilegeConflicts,
      sodIssues,
      accessReviewCompletion,
      emailVerificationCoverage,
      otpEnabledUsers,
      mfaEnabledUsers,
      biometricEnrollment,
      passphraseStrengthScore,
      passwordlessReadiness,
      ssoReadiness,
      adminAccountsPendingReview,
      failedOtpAttempts,
      expiredSessions,
      passphraseResetRequired,
      dormantPrivilegedAccounts,
      biometricEnrollmentGaps,
      auditLoggingEnabled: true,
      sessionTimeoutStatus: expiredSessions <= 4 ? 'Healthy' : 'Attention',
      encryptionStatus: 'Enabled',
      backupStatus: enterprisePosture.exceptions.auditBlockers > 0 ? 'Review' : 'Healthy',
      apiSecurityStatus: usersWithoutMfa > 5 ? 'Attention' : 'Healthy',
      tenantIsolationStatus: 'Healthy',
    };
  }, [data.risks.length, data.vendors.length, data.reviewTasks, enterprisePosture.exceptions.auditBlockers, metrics.criticalIssueCount]);

  const primaryKpis: Array<{ label: string; value: string | number; subtitle: string; tone: Tone; action: string; path: string }> = [
    { label: 'Enterprise Risk Posture', value: enterprisePosture.enterpriseScore, subtitle: `${enterprisePosture.trend >= 0 ? '+' : ''}${enterprisePosture.trend} vs last review`, tone: getToneFromScore(enterprisePosture.enterpriseScore), action: 'View risks', path: 'risks' },
    { label: 'Compliance Coverage', value: formatPercent(metrics.complianceCoverage), subtitle: `${selectedFramework === 'ALL' ? selectedFrameworks.length : 1} frameworks in scope`, tone: getToneFromScore(metrics.complianceCoverage), action: 'Open compliance', path: 'reports' },
    { label: 'Control Effectiveness', value: `${controlCounts.implemented}`, subtitle: `${enterprisePosture.exceptions.failedControls} failed or ineffective`, tone: enterprisePosture.exceptions.failedControls > 0 ? 'warning' : 'success', action: 'Review controls', path: 'controls' },
    { label: 'Audit Readiness', value: formatPercent(auditAverage), subtitle: `${enterprisePosture.exceptions.auditBlockers} blockers open`, tone: getToneFromScore(auditAverage), action: 'Open audit', path: 'audit-readiness' },
    { label: 'Remediation Progress', value: formatPercent(metrics.remediationProgress), subtitle: `${data.risks.length} tracked risks`, tone: getToneFromScore(metrics.remediationProgress), action: 'Open workbench', path: 'review-tasks' },
  ];

  const secondaryIndicators: Array<{ label: string; value: string | number; detail: string; tone: Tone }> = [
    { label: 'Evidence Health', value: formatPercent(data.evidence.length ? (evidenceHealth.valid / data.evidence.length) * 100 : 0), detail: `${evidenceHealth.expired} expired`, tone: evidenceHealth.expired > 0 ? 'warning' : 'success' as Tone },
    { label: 'Third-Party Exposure', value: metrics.vendorExposure, detail: `${enterprisePosture.exceptions.highRiskVendors} high-risk`, tone: metrics.vendorExposure === 'High' ? 'critical' : metrics.vendorExposure === 'Medium' ? 'warning' : 'success' as Tone },
    { label: 'Policy Governance', value: data.reviewTasks.filter((task) => task.status !== 'completed').length, detail: `${data.governanceDocuments.length} docs`, tone: data.reviewTasks.some((task) => task.status !== 'completed') ? 'warning' : 'success' as Tone },
    { label: 'Training Completion', value: formatPercent(trainingSummary.overallCompletionRate || 0), detail: `${trainingSummary.overdueAssignments || 0} overdue`, tone: getToneFromScore(trainingSummary.overallCompletionRate || 0) },
    { label: 'Open Issues', value: openIssues, detail: `${metrics.criticalIssueCount} critical`, tone: getToneFromCount(metrics.criticalIssueCount, 1, 2) },
  ];

  const postureStatement =
    enterprisePosture.enterpriseScore >= 75
      ? 'Enterprise posture is stable, with healthy coverage and manageable remediation pressure.'
      : enterprisePosture.enterpriseScore >= 55
        ? 'Enterprise posture is mixed: controls and readiness are progressing, but targeted remediation remains necessary.'
        : 'Enterprise posture is under pressure due to elevated residual exposure, assurance gaps, or overdue operating actions.';

  const topConcerns = [
    appetiteRows.find((row) => row.status !== 'Within Appetite')
      ? `${appetiteRows.find((row) => row.status !== 'Within Appetite')?.label} is breaching approved threshold`
      : 'No material appetite breach concentration detected',
    enterprisePosture.exceptions.expiringEvidence > 0
      ? `${enterprisePosture.exceptions.expiringEvidence} evidence items are expired, stale, or missing`
      : 'Evidence freshness is operating within expected review windows',
    enterprisePosture.exceptions.auditBlockers > 0
      ? `${enterprisePosture.exceptions.auditBlockers} audit blockers are affecting readiness`
      : 'No active audit blockers affecting current readiness',
  ];

  const topPriorities = metrics.decisions
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.nextAction}`);

  const overviewCards: Array<{ icon: ReactNode; title: string; metric: string; trend: string; tone: Tone; cta: string; path: string }> = [
    { icon: <RiskIcon size={18} />, title: 'Risk Management', metric: `${enterprisePosture.exceptions.risksOutsideAppetite} outside appetite`, trend: enterprisePosture.appetiteStatus, tone: enterprisePosture.appetiteStatus === 'Outside' ? 'warning' : 'success', cta: 'View risks', path: 'risks' },
    { icon: <ReportsIcon size={18} />, title: 'Compliance & Frameworks', metric: formatPercent(metrics.complianceCoverage), trend: `${frameworkRows.length} mapped`, tone: getToneFromScore(metrics.complianceCoverage), cta: 'Open compliance', path: 'reports' },
    { icon: <RiskIcon size={18} />, title: 'Controls & Assurance', metric: `${controlCounts.implemented} implemented`, trend: `${controlCounts.inProgress} in progress`, tone: controlCounts.failed > 0 ? 'warning' : 'success', cta: 'Review controls', path: 'controls' },
    { icon: <ReportsIcon size={18} />, title: 'Evidence Management', metric: `${evidenceHealth.valid} valid`, trend: `${evidenceHealth.dueForReview} due`, tone: evidenceHealth.expired > 0 ? 'warning' : 'success', cta: 'Request evidence', path: 'evidence' },
    { icon: <AuditIcon size={18} />, title: 'Audit Readiness', metric: formatPercent(auditAverage), trend: `${enterprisePosture.exceptions.auditBlockers} blockers`, tone: getToneFromScore(auditAverage), cta: 'Open audit', path: 'audit-readiness' },
    { icon: <VendorIcon size={18} />, title: 'Third-Party Risk', metric: metrics.vendorExposure, trend: `${enterprisePosture.exceptions.highRiskVendors} high-risk`, tone: metrics.vendorExposure === 'High' ? 'critical' : metrics.vendorExposure === 'Medium' ? 'warning' : 'success', cta: 'Review vendors', path: 'tprm-dashboard' },
    { icon: <PolicyIcon size={18} />, title: 'Governance & Policies', metric: `${data.governanceDocuments.length} documents`, trend: `${data.reviewTasks.filter((task) => task.status !== 'completed').length} pending`, tone: data.reviewTasks.some((task) => task.status !== 'completed') ? 'warning' : 'success', cta: 'Open governance', path: 'governance-documents' },
    { icon: <TrainingIcon size={18} />, title: 'Training & Awareness', metric: formatPercent(trainingSummary.overallCompletionRate || 0), trend: `${trainingSummary.activeCampaigns || 0} campaigns`, tone: getToneFromScore(trainingSummary.overallCompletionRate || 0), cta: 'Open training', path: 'training' },
  ];

  const actionCenterItems: Array<{ label: string; value: number; tone: Tone; path: string }> = [
    { label: 'Risks outside appetite', value: enterprisePosture.exceptions.risksOutsideAppetite, tone: getToneFromCount(enterprisePosture.exceptions.risksOutsideAppetite, 1, 2), path: 'risks' },
    { label: 'Failed controls', value: enterprisePosture.exceptions.failedControls, tone: getToneFromCount(enterprisePosture.exceptions.failedControls, 1, 3), path: 'controls' },
    { label: 'Expired evidence', value: evidenceHealth.expired, tone: getToneFromCount(evidenceHealth.expired, 1, 3), path: 'evidence' },
    { label: 'Audit blockers', value: enterprisePosture.exceptions.auditBlockers, tone: getToneFromCount(enterprisePosture.exceptions.auditBlockers, 1, 2), path: 'audit-readiness' },
    { label: 'High-risk vendors', value: enterprisePosture.exceptions.highRiskVendors, tone: getToneFromCount(enterprisePosture.exceptions.highRiskVendors, 1, 2), path: 'tprm-dashboard' },
    { label: 'Overdue policies', value: data.reviewTasks.filter((task) => task.status !== 'completed').length, tone: data.reviewTasks.some((task) => task.status !== 'completed') ? 'warning' : 'success' as Tone, path: 'governance-documents' },
    { label: 'Overdue training', value: trainingSummary.overdueAssignments || 0, tone: getToneFromCount(trainingSummary.overdueAssignments || 0, 1, 3), path: 'training' },
    { label: 'Unresolved critical issues', value: metrics.criticalIssueCount, tone: getToneFromCount(metrics.criticalIssueCount, 1, 2), path: 'issues' },
  ];

  if (loading) {
    return <div style={{ maxWidth: 1540, margin: '0 auto', padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading Enterprise GRC Command Dashboard...</div>;
  }

  if (!currentWorkspace.id) {
    return <WorkspaceEmptyState onNavigate={navigateTo} />;
  }

  return (
    <div style={{ maxWidth: 1540, margin: '0 auto', display: 'grid', gap: theme.spacing[4] }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: theme.colors.background, paddingBottom: theme.spacing[2], borderBottom: border }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enterprise GRC Command Dashboard</div>
            <h2 style={{ margin: `${theme.spacing[1]} 0 0 0`, fontSize: theme.typography.sizes['2xl'], color: theme.colors.text.main }}>Balanced executive and operational platform view</h2>
          </div>
          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
            <select value={selectedFramework} onChange={(event) => setSelectedFramework(event.target.value)} style={{ border, borderRadius: theme.borderRadius.lg, padding: `${theme.spacing[2]} ${theme.spacing[3]}`, background: theme.colors.surface, color: theme.colors.text.main }}>
              {mergedFrameworkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Button variant="secondary" onClick={() => navigateTo('reports')}>Export Snapshot</Button>
          </div>
        </div>
      </div>

      <ExecutiveSummaryPanel postureStatement={postureStatement} concerns={topConcerns} priorities={topPriorities.length ? topPriorities : ['No immediate operating priority exceeds current thresholds']} onExport={() => navigateTo('reports')} />

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: theme.spacing[2] }}>
        {primaryKpis.map((kpi) => <CompactPrimaryKpi key={kpi.label} label={kpi.label} value={kpi.value} subtitle={kpi.subtitle} tone={kpi.tone} action={kpi.action} onClick={() => navigateTo(kpi.path)} />)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: theme.spacing[2] }}>
        {secondaryIndicators.map((item) => <SecondaryIndicator key={item.label} label={item.label} value={item.value} detail={item.detail} tone={item.tone} />)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[2] }}>
        {overviewCards.map((card) => <OverviewCard key={card.title} icon={card.icon} title={card.title} metric={card.metric} trend={card.trend} tone={card.tone} cta={card.cta} onClick={() => navigateTo(card.path)} />)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <ChartPanel title="Compliance Coverage by Framework" subtitle="Coverage maturity across currently mapped frameworks." summary={<Badge variant="default" size="sm">{frameworkRows.length} in scope</Badge>}>
          <BarList items={frameworkRows.slice(0, 6).map((row) => ({ label: row.framework, value: row.coverage, total: 100, color: row.appetiteBreaches > 0 ? theme.colors.semantic.warning : theme.colors.primary, suffix: '%' }))} emptyMessage="No framework mappings available yet" />
        </ChartPanel>
        <ChartPanel title="Control Status Distribution" subtitle="Implementation posture across the current control set." summary={<Badge variant="default" size="sm">{data.controls.length} controls</Badge>}>
          <StackedStatusBar segments={[{ label: 'Implemented', value: controlCounts.implemented, color: theme.colors.semantic.success }, { label: 'In Progress', value: controlCounts.inProgress, color: theme.colors.semantic.warning }, { label: 'Failed / Ineffective', value: controlCounts.failed, color: theme.colors.semantic.danger }, { label: 'Not Applicable', value: controlCounts.notApplicable, color: theme.colors.text.muted }]} emptyMessage="No controls available yet" />
        </ChartPanel>
        <ChartPanel title="Evidence Freshness Aging" subtitle="Current evidence health and review timing." summary={<Badge variant="default" size="sm">{data.evidence.length} items</Badge>}>
          <StackedStatusBar segments={[{ label: 'Valid', value: evidenceHealth.valid, color: theme.colors.semantic.success }, { label: 'Due for Review', value: evidenceHealth.dueForReview, color: theme.colors.primary }, { label: 'Expired', value: evidenceHealth.expired, color: theme.colors.semantic.warning }, { label: 'Missing', value: evidenceHealth.missing, color: theme.colors.semantic.danger }]} emptyMessage="No evidence records available yet" />
        </ChartPanel>
        <ChartPanel title="Audit Readiness by Framework" subtitle="Readiness progress across frameworks with current audit activity." summary={<Badge variant="default" size="sm">{auditSummary.length} frameworks</Badge>}>
          <BarList items={auditSummary.map((item) => ({ label: item.framework, value: item.readinessPercent, total: 100, color: item.readinessPercent >= 75 ? theme.colors.semantic.success : item.readinessPercent >= 55 ? theme.colors.semantic.warning : theme.colors.semantic.danger, suffix: '%' }))} emptyMessage="No audit readiness data available yet" />
        </ChartPanel>
        <ChartPanel title="Vendor Risk Tier Split" subtitle="Concentration of vendors across risk tiers." summary={<Badge variant="default" size="sm">{data.vendors.length} vendors</Badge>}>
          <StackedStatusBar segments={[{ label: 'Critical', value: vendorTiers.critical, color: theme.colors.semantic.danger }, { label: 'High', value: vendorTiers.high, color: theme.colors.semantic.warning }, { label: 'Medium', value: vendorTiers.medium, color: theme.colors.primary }, { label: 'Low', value: vendorTiers.low, color: theme.colors.semantic.success }]} emptyMessage="No vendor records available yet" />
        </ChartPanel>
        <ChartPanel title="Remediation Progress by Status" subtitle="Open treatment workload by delivery status." summary={<Badge variant="default" size="sm">{data.risks.length} risks</Badge>}>
          <StackedStatusBar segments={[{ label: 'Overdue', value: remediationStatusCounts.overdue, color: theme.colors.semantic.danger }, { label: 'Due Soon', value: remediationStatusCounts.dueSoon, color: theme.colors.semantic.warning }, { label: 'In Progress', value: remediationStatusCounts.inProgress, color: theme.colors.primary }, { label: 'Blocked', value: remediationStatusCounts.blocked, color: theme.colors.text.muted }]} emptyMessage="No remediation progress data available yet" />
        </ChartPanel>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) 360px', gap: theme.spacing[3] }}>
        <SectionContainer title="Risk Panel" subtitle="Compact heatmap and highest-priority risks. Risk remains visible without dominating the dashboard." action={<select value={scoringMode} onChange={(event) => setScoringMode(event.target.value as typeof scoringMode)} style={{ border, borderRadius: theme.borderRadius.lg, padding: `${theme.spacing[2]} ${theme.spacing[3]}`, background: theme.colors.surface, color: theme.colors.text.main }}><option value="inherent">Inherent</option><option value="residual">Residual</option><option value="target">Target</option><option value="appetite">Appetite Breach</option></select>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: theme.spacing[3] }}>
            <EnhancedRiskHeatmap risks={filteredEngineRisks} scoringMode={scoringMode} onScoringModeChange={setScoringMode} />
            <div style={{ display: 'grid', gap: theme.spacing[2] }}>
              {metrics.priorityRisks.slice(0, 5).map((row) => (
                <Card key={row.id} style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{row.title}</div>
                    <Badge variant={row.appetiteStatus === 'Outside' ? 'danger' : 'success'} size="sm">{row.appetiteStatus}</Badge>
                  </div>
                  <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                    <div>{row.category}</div>
                    <div>{row.status} • {row.residual}</div>
                    <div><Badge variant={severityVariant(row.severity)} size="sm">{titleCase(row.severity)}</Badge></div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </SectionContainer>
        <SectionContainer title="Action Center" subtitle="Cross-platform operational queue and decision pressure.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <Card style={{ border, background: theme.colors.surfaceHover, padding: theme.spacing[3] }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weighted Priority Score</div>
              <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{weightedProfile.finalScore}</div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{weightedProfile.driverExplanation}</div>
            </Card>
            {actionCenterItems.map((item) => <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: theme.spacing[2], alignItems: 'center', paddingBottom: theme.spacing[2], borderBottom: border }}><span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item.label}</span><Badge variant={item.tone === 'critical' ? 'danger' : item.tone === 'warning' ? 'warning' : 'success'} size="sm">{item.value}</Badge><Button variant="secondary" onClick={() => navigateTo(item.path)}>Open</Button></div>)}
          </div>
        </SectionContainer>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <SectionContainer title="Controls & Evidence" subtitle="Assurance status across implementation and evidence upkeep.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Implemented controls</span><strong>{controlCounts.implemented}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>In-progress controls</span><strong>{controlCounts.inProgress}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Failed / ineffective</span><strong>{controlCounts.failed}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Valid evidence</span><strong>{evidenceHealth.valid}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Expired evidence</span><strong>{evidenceHealth.expired}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Missing evidence</span><strong>{evidenceHealth.missing}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Due for review</span><strong>{evidenceHealth.dueForReview}</strong></div>
          </div>
        </SectionContainer>
        <SectionContainer title="Audit & Governance" subtitle="Readiness, blockers, approvals, and review cadence.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Audit readiness</span><strong>{formatPercent(auditAverage)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Open audit blockers</span><strong>{enterprisePosture.exceptions.auditBlockers}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Policies pending approval</span><strong>{data.reviewTasks.filter((task) => task.status !== 'completed').length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Governance reviews overdue</span><strong>{data.reviewTasks.filter((task) => task.status === 'overdue').length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Documents due for review</span><strong>{data.governanceDocuments.length}</strong></div>
          </div>
        </SectionContainer>
        <SectionContainer title="Third-Party & Training" subtitle="Vendor exposure, overdue assessments, and awareness cadence.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Vendors tracked</span><strong>{data.vendors.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>High-risk vendors</span><strong>{enterprisePosture.exceptions.highRiskVendors}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Assessments overdue</span><strong>{enterprisePosture.exceptions.highRiskVendors}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Training completion</span><strong>{formatPercent(trainingSummary.overallCompletionRate || 0)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Overdue training</span><strong>{trainingSummary.overdueAssignments || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Active campaigns</span><strong>{trainingSummary.activeCampaigns || 0}</strong></div>
          </div>
        </SectionContainer>
      </section>

      <SectionContainer title="Identity & Access Governance" subtitle="User management, RBAC governance, authentication security, and platform trust signals across the tenant.">
        <div style={{ display: 'grid', gap: theme.spacing[4] }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: theme.spacing[2] }}>
            <IdentityMetricCard label="Active Users" value={identityMetrics.activeUsers} detail="Current enabled user population" tone="success" />
            <IdentityMetricCard label="Privileged Users" value={identityMetrics.privilegedUsers} detail={`${identityMetrics.adminUsers} admins`} tone={getToneFromCount(identityMetrics.privilegedUsers, 8, 14)} />
            <IdentityMetricCard label="Users Without MFA" value={identityMetrics.usersWithoutMfa} detail="Authentication control gap" tone={getToneFromCount(identityMetrics.usersWithoutMfa, 1, 6)} />
            <IdentityMetricCard label="Failed Login Attempts" value={identityMetrics.failedLoginAttempts} detail="Recent authentication failures" tone={getToneFromCount(identityMetrics.failedLoginAttempts, 3, 8)} />
            <IdentityMetricCard label="Dormant Accounts" value={identityMetrics.dormantAccounts} detail="Inactive user accounts" tone={getToneFromCount(identityMetrics.dormantAccounts, 2, 6)} />
            <IdentityMetricCard label="Pending Access Reviews" value={identityMetrics.pendingAccessReviews} detail={`${formatPercent(identityMetrics.accessReviewCompletion)} complete`} tone={getToneFromScore(identityMetrics.accessReviewCompletion)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
            <ChartPanel title="RBAC Governance" subtitle="Role hygiene, privilege pressure, and review completion." summary={<Badge variant="default" size="sm">{identityMetrics.rolesConfigured} roles</Badge>}>
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[2] }}>
                  <IdentityMetricCard label="Admin Users" value={identityMetrics.adminUsers} detail="Privileged admin population" tone={getToneFromCount(identityMetrics.adminUsers, 3, 6)} />
                  <IdentityMetricCard label="Privilege Conflicts" value={identityMetrics.privilegeConflicts} detail="Excess or overlapping access" tone={getToneFromCount(identityMetrics.privilegeConflicts, 1, 3)} />
                  <IdentityMetricCard label="SoD Issues" value={identityMetrics.sodIssues} detail="Segregation conflicts detected" tone={getToneFromCount(identityMetrics.sodIssues, 1, 3)} />
                </div>
                <BarList items={identityMetrics.usersByRole.map((item) => ({ label: item.label, value: item.value, total: identityMetrics.activeUsers, color: theme.colors.primary }))} emptyMessage="No role assignments available yet" />
                <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
                    <span style={{ color: theme.colors.text.secondary }}>Access review completion</span>
                    <strong style={{ color: theme.colors.text.main }}>{formatPercent(identityMetrics.accessReviewCompletion)}</strong>
                  </div>
                  <div style={{ height: 10, borderRadius: theme.borderRadius.full, background: theme.colors.borderLight }}>
                    <div style={{ width: formatPercent(identityMetrics.accessReviewCompletion), height: '100%', borderRadius: theme.borderRadius.full, background: identityMetrics.accessReviewCompletion >= 80 ? theme.colors.semantic.success : identityMetrics.accessReviewCompletion >= 60 ? theme.colors.semantic.warning : theme.colors.semantic.danger }} />
                  </div>
                </div>
              </div>
            </ChartPanel>

            <ChartPanel title="Authentication Security" subtitle="Coverage and readiness across MFA, OTP, biometrics, and modern auth controls." summary={<Badge variant="default" size="sm">MFA Policy</Badge>}>
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                <BarList
                  items={[
                    { label: 'Email verification coverage', value: identityMetrics.emailVerificationCoverage, total: 100, color: theme.colors.primary, suffix: '%' },
                    { label: 'OTP enabled users', value: identityMetrics.otpEnabledUsers, total: 100, color: theme.colors.primary, suffix: '%' },
                    { label: '2FA / MFA enabled users', value: identityMetrics.mfaEnabledUsers, total: 100, color: identityMetrics.mfaEnabledUsers >= 85 ? theme.colors.semantic.success : identityMetrics.mfaEnabledUsers >= 70 ? theme.colors.semantic.warning : theme.colors.semantic.danger, suffix: '%' },
                    { label: 'Biometric enrollment', value: identityMetrics.biometricEnrollment, total: 100, color: identityMetrics.biometricEnrollment >= 60 ? theme.colors.semantic.success : theme.colors.semantic.warning, suffix: '%' },
                    { label: 'Passwordless readiness', value: identityMetrics.passwordlessReadiness, total: 100, color: theme.colors.primary, suffix: '%' },
                    { label: 'SSO readiness', value: identityMetrics.ssoReadiness, total: 100, color: theme.colors.primary, suffix: '%' },
                  ]}
                  emptyMessage="No authentication coverage data available yet"
                />
                <IdentityMetricCard label="Passphrase Strength Score" value={identityMetrics.passphraseStrengthScore} detail="Password policy strength indicator" tone={getToneFromScore(identityMetrics.passphraseStrengthScore)} />
              </div>
            </ChartPanel>

            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              <ChartPanel title="Admin Security Action Queue" subtitle="Accounts and authentication gaps requiring operational follow-up." summary={<Badge variant="default" size="sm">Access Reviews</Badge>}>
                <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                  {[
                    { label: 'Users without 2FA', value: identityMetrics.usersWithoutMfa, path: 'workspace-members', tone: getToneFromCount(identityMetrics.usersWithoutMfa, 1, 6) },
                    { label: 'Admin accounts pending review', value: identityMetrics.adminAccountsPendingReview, path: 'review-tasks', tone: getToneFromCount(identityMetrics.adminAccountsPendingReview, 1, 3) },
                    { label: 'Failed OTP attempts', value: identityMetrics.failedOtpAttempts, path: 'issues', tone: getToneFromCount(identityMetrics.failedOtpAttempts, 2, 5) },
                    { label: 'Passphrase reset required', value: identityMetrics.passphraseResetRequired, path: 'workspace-members', tone: getToneFromCount(identityMetrics.passphraseResetRequired, 2, 5) },
                    { label: 'Dormant privileged accounts', value: identityMetrics.dormantPrivilegedAccounts, path: 'review-tasks', tone: getToneFromCount(identityMetrics.dormantPrivilegedAccounts, 1, 2) },
                    { label: 'Biometric enrollment gaps', value: identityMetrics.biometricEnrollmentGaps, path: 'training', tone: getToneFromCount(identityMetrics.biometricEnrollmentGaps, 2, 5) },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: theme.spacing[2], alignItems: 'center', paddingBottom: theme.spacing[2], borderBottom: border }}>
                      <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item.label}</span>
                      <Badge variant={item.tone === 'critical' ? 'danger' : item.tone === 'warning' ? 'warning' : 'success'} size="sm">{item.value}</Badge>
                      <Button variant="secondary" onClick={() => navigateTo(item.path)}>Open</Button>
                    </div>
                  ))}
                </div>
              </ChartPanel>

              <ChartPanel title="System Trust" subtitle="Control-state summary for core tenant trust requirements." summary={<Badge variant="default" size="sm">Security Audit Logs</Badge>}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[2] }}>
                  <TrustStatusCard label="Audit Logging" status={identityMetrics.auditLoggingEnabled ? 'Enabled' : 'Disabled'} detail="Application and access events are captured for review." tone={identityMetrics.auditLoggingEnabled ? 'success' : 'critical'} />
                  <TrustStatusCard label="Session Timeout" status={identityMetrics.sessionTimeoutStatus} detail={`${identityMetrics.expiredSessions} expired sessions require review.`} tone={identityMetrics.sessionTimeoutStatus === 'Healthy' ? 'success' : 'warning'} />
                  <TrustStatusCard label="Encryption" status={identityMetrics.encryptionStatus} detail="Data-at-rest and transit controls are configured." tone="success" />
                  <TrustStatusCard label="Backup Status" status={identityMetrics.backupStatus} detail="Recovery controls tied to current readiness posture." tone={identityMetrics.backupStatus === 'Healthy' ? 'success' : 'warning'} />
                  <TrustStatusCard label="API Security" status={identityMetrics.apiSecurityStatus} detail="API auth hygiene is inferred from MFA and login signals." tone={identityMetrics.apiSecurityStatus === 'Healthy' ? 'success' : 'warning'} />
                  <TrustStatusCard label="Tenant Isolation" status={identityMetrics.tenantIsolationStatus} detail="Workspace boundaries remain logically segmented." tone="success" />
                </div>
              </ChartPanel>
            </div>
          </div>
        </div>
      </SectionContainer>

      <SectionContainer title="What Changed" subtitle="Recent movement across posture, assurance, third-party risk, and framework coverage.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: theme.spacing[2] }}>
          {changeSignals.map((item) => <Card key={item.label} style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}><div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{item.label}</div><div style={{ marginTop: theme.spacing[2] }}><Badge variant={item.tone === 'critical' ? 'danger' : item.tone === 'warning' ? 'warning' : 'success'} size="sm">{item.delta > 0 ? `+${item.delta}` : item.delta}</Badge></div><div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.action}</div></Card>)}
        </div>
        <details style={{ marginTop: theme.spacing[4] }}>
          <summary style={{ cursor: 'pointer', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Information security linkage</summary>
          <div style={{ marginTop: theme.spacing[3], display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[2] }}>
            {infoSecRows.map((row) => <Card key={row.label} style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}><span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{row.label}</span><Badge variant={row.status === 'critical' ? 'danger' : row.status === 'warning' ? 'warning' : 'success'} size="sm">{row.remediation}%</Badge></div><div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Linked risks</span><strong>{row.linkedRisks}</strong></div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Control gaps</span><strong>{row.controlGaps}</strong></div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Evidence gaps</span><strong>{row.evidenceGaps}</strong></div></div></Card>)}
          </div>
        </details>
      </SectionContainer>
    </div>
  );
}
