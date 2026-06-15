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
import { apiCall, fetchAiGovernanceState, fetchBusinessContinuityState, fetchEsgState, fetchPrivacyState, fetchReportingCenterState } from '../lib/api';
import { theme } from '../theme';
import {
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
import type { RegulatoryDashboardSummary } from '@/types/regulatory';
import type { ReportingCenterState } from '@/types/reportingCenter';
import type { BusinessContinuityState } from '@/types/resilience';
import type { AiGovernanceState } from '@/types/aiGovernance';
import type { EsgState } from '@/types/esg';
import type { PrivacyState } from '@/types/privacy';
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

interface DashboardRegulatorySummary extends RegulatoryDashboardSummary {}

interface DashboardRiskIntelligenceSummary {
  summary: {
    appetiteBreaches: number;
    capacityBreaches: number;
    criticalKris: number;
  };
  executiveSummary: string[];
  topRisk?: { title: string; dynamicScore: number };
  topForecast?: { scopeLabel: string; predicted90DayScore: number };
}

interface DashboardRiskIntelligenceResponse {
  dashboard: {
    summary: {
      appetiteBreaches: number;
      capacityBreaches: number;
      criticalKris: number;
    };
    executiveSummary: string[];
    committeeView?: {
      topRisks?: Array<{ title: string; dynamicScore: number }>;
    };
    forecasts?: Array<{ scopeLabel: string; predicted90DayScore: number }>;
  };
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

type TrendPoint = {
  label: string;
  value: number;
};

function buildMonthlySeries(
  values: Array<string | Date | null | undefined>,
  months = 6,
  accessor?: (date: Date) => number,
): TrendPoint[] {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - index - 1), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleString('en-GB', { month: 'short' }),
      value: 0,
    };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  values.forEach((value) => {
    const parsed = parseDate(value);
    if (!parsed) return;
    const key = `${parsed.getFullYear()}-${parsed.getMonth()}`;
    const bucket = byKey.get(key);
    if (!bucket) return;
    bucket.value += accessor ? accessor(parsed) : 1;
  });

  return buckets;
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

function LineTrendChart({
  points,
  color,
  emptyMessage,
}: {
  points: TrendPoint[];
  color: string;
  emptyMessage: string;
}) {
  const max = Math.max(...points.map((point) => point.value), 0);
  if (!points.length || max === 0) return <EmptyChartState message={emptyMessage} />;

  const width = 100;
  const height = 42;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const line = points
    .map((point, index) => {
      const x = index * step;
      const y = height - (point.value / max) * height;
      return `${x},${Math.max(4, y)}`;
    })
    .join(' ');

  return (
    <div style={{ display: 'grid', gap: theme.spacing[3] }}>
      <svg viewBox={`0 0 ${width} ${height + 4}`} preserveAspectRatio="none" style={{ width: '100%', height: 108 }}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={line}
        />
        {points.map((point, index) => {
          const x = index * step;
          const y = height - (point.value / max) * height;
          return <circle key={point.label} cx={x} cy={Math.max(4, y)} r="2.5" fill={color} />;
        })}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`, gap: theme.spacing[2] }}>
        {points.map((point) => (
          <div key={point.label} style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
            <div>{point.label}</div>
            <strong style={{ display: 'block', marginTop: 4, color: theme.colors.text.main }}>{point.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutBreakdown({
  total,
  segments,
  emptyMessage,
}: {
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
  emptyMessage: string;
}) {
  if (total <= 0) return <EmptyChartState message={emptyMessage} />;

  let offset = 0;
  const circumference = 2 * Math.PI * 42;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', gap: theme.spacing[3], alignItems: 'center' }}>
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <svg width="140" height="140" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="42" fill="none" stroke={theme.colors.borderLight} strokeWidth="14" />
          {segments.map((segment) => {
            const strokeDasharray = `${(segment.value / total) * circumference} ${circumference}`;
            const strokeDashoffset = -offset;
            offset += (segment.value / total) * circumference;
            return (
              <circle
                key={segment.label}
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke={segment.color}
                strokeWidth="14"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            );
          })}
        </svg>
        <div style={{ marginTop: -84, textAlign: 'center' }}>
          <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{total}</div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>In scope</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        {segments.map((segment) => (
          <div key={segment.label} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
              <span style={{ width: 10, height: 10, borderRadius: theme.borderRadius.full, background: segment.color }} />
              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{segment.label}</span>
            </div>
            <strong style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{segment.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrameworkCoverageStrip({
  items,
}: {
  items: Array<{ label: string; coverage: number; tone: Tone }>;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: theme.spacing[2] }}>
      {items.map((item) => (
        <Card key={item.label} style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: theme.borderRadius.full,
                border: `4px solid ${item.tone === 'critical' ? theme.colors.semantic.danger : item.tone === 'warning' ? theme.colors.semantic.warning : theme.colors.semantic.success}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: theme.typography.sizes.xs,
                fontWeight: theme.typography.weights.bold,
                color: theme.colors.text.main,
              }}
            >
              {item.coverage}%
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                {item.tone === 'critical' ? 'Needs attention' : item.tone === 'warning' ? 'Moderate' : 'Good'}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
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
    issues: [],
  });
  const [trainingSummary, setTrainingSummary] = useState<TrainingDashboardSummary>({});
  const [auditSummary, setAuditSummary] = useState<AuditSummaryItem[]>([]);
  const [regulatorySummary, setRegulatorySummary] = useState<DashboardRegulatorySummary | null>(null);
  const [riskIntelligenceSummary, setRiskIntelligenceSummary] = useState<DashboardRiskIntelligenceSummary | null>(null);
  const [reportingCenterState, setReportingCenterState] = useState<ReportingCenterState | null>(null);
  const [businessContinuityState, setBusinessContinuityState] = useState<BusinessContinuityState | null>(null);
  const [aiGovernanceState, setAiGovernanceState] = useState<AiGovernanceState | null>(null);
  const [esgState, setEsgState] = useState<EsgState | null>(null);
  const [privacyState, setPrivacyState] = useState<PrivacyState | null>(null);
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
          apiCall<{ data: DashboardRegulatorySummary }>('/api/v1/regulatory/dashboard'),
          apiCall<{ data: DashboardRiskIntelligenceResponse }>('/api/v1/risk-intelligence/state'),
          fetchReportingCenterState(),
          fetchBusinessContinuityState(),
          fetchAiGovernanceState(),
          fetchEsgState(),
          fetchPrivacyState(),
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
          regulatoryResult,
          riskIntelligenceResult,
          reportingCenterResult,
          businessContinuityResult,
          aiGovernanceResult,
          esgResult,
          privacyResult,
        ] = results;

        setData({
          controls: controlsResult.status === 'fulfilled' ? controlsResult.value.data || [] : [],
          risks: risksResult.status === 'fulfilled' ? risksResult.value.data || [] : [],
          vendors: vendorsResult.status === 'fulfilled' ? vendorsResult.value.data || [] : [],
          vendorAssessments: vendorAssessmentsResult.status === 'fulfilled' ? vendorAssessmentsResult.value.data || [] : [],
          evidence: evidenceResult.status === 'fulfilled' ? evidenceResult.value.data || [] : [],
          governanceDocuments: governanceResult.status === 'fulfilled' ? governanceResult.value.data || [] : [],
          reviewTasks: reviewTasksResult.status === 'fulfilled' ? reviewTasksResult.value.data || [] : [],
          issues: issuesResult.status === 'fulfilled' ? issuesResult.value.data || [] : [],
        });
        setTrainingSummary(trainingResult.status === 'fulfilled' ? trainingResult.value.data || {} : {});
        setAuditSummary(auditResult.status === 'fulfilled' ? auditResult.value.data || [] : []);
        setRegulatorySummary(regulatoryResult.status === 'fulfilled' ? regulatoryResult.value.data || null : null);
        setRiskIntelligenceSummary(
          riskIntelligenceResult.status === 'fulfilled' && riskIntelligenceResult.value.data
            ? {
                summary: riskIntelligenceResult.value.data.dashboard.summary,
                executiveSummary: riskIntelligenceResult.value.data.dashboard.executiveSummary || [],
                topRisk: riskIntelligenceResult.value.data.dashboard.committeeView?.topRisks?.[0],
                topForecast: riskIntelligenceResult.value.data.dashboard.forecasts?.[0],
              }
            : null,
        );
        setReportingCenterState(reportingCenterResult.status === 'fulfilled' ? reportingCenterResult.value || null : null);
        setBusinessContinuityState(businessContinuityResult.status === 'fulfilled' ? businessContinuityResult.value || null : null);
        setAiGovernanceState(aiGovernanceResult.status === 'fulfilled' ? aiGovernanceResult.value || null : null);
        setEsgState(esgResult.status === 'fulfilled' ? esgResult.value || null : null);
        setPrivacyState(privacyResult.status === 'fulfilled' ? privacyResult.value || null : null);
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
  const vendorTiers = useMemo(
    () => ({
      critical: data.vendors.filter((vendor) => vendor.riskTier === 'critical').length,
      high: data.vendors.filter((vendor) => vendor.riskTier === 'high').length,
      medium: data.vendors.filter((vendor) => vendor.riskTier === 'medium').length,
      low: data.vendors.filter((vendor) => vendor.riskTier === 'low').length,
    }),
    [data.vendors],
  );

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

  const riskTrendPoints = useMemo(
    () =>
      buildMonthlySeries(
        data.risks
          .filter((risk) => ['high', 'critical'].includes(risk.severity))
          .map((risk) => risk.updatedAt || risk.createdAt),
      ),
    [data.risks],
  );

  const auditTrendPoints = useMemo(
    () =>
      buildMonthlySeries([
        ...data.evidence.map((item) => item.lastReviewedAt || item.collectedAt),
        ...(reportingCenterState?.recentReports || []).map((report) => report.createdAt),
      ]),
    [data.evidence, reportingCenterState],
  );

  const complianceBreakdown = useMemo(() => {
    const compliant = frameworkRows.filter((row) => row.coverage >= 80).length;
    const partial = frameworkRows.filter((row) => row.coverage >= 60 && row.coverage < 80).length;
    const attention = frameworkRows.filter((row) => row.coverage < 60).length;
    return {
      total: frameworkRows.length,
      segments: [
        { label: 'Compliant', value: compliant, color: theme.colors.semantic.success },
        { label: 'Partially compliant', value: partial, color: theme.colors.semantic.warning },
        { label: 'Needs attention', value: attention, color: theme.colors.semantic.danger },
      ],
    };
  }, [frameworkRows]);

  const frameworkCoverageItems = useMemo(
    () =>
      frameworkRows
        .slice(0, 8)
        .map((row) => ({
          label: row.framework,
          coverage: row.coverage,
          tone: row.coverage >= 80 ? 'success' : row.coverage >= 60 ? 'warning' : 'critical' as Tone,
        })),
    [frameworkRows],
  );

  const quickActionItems: Array<{ label: string; path: string; variant: 'primary' | 'secondary' }> = [
    { label: 'Create Risk', path: 'risks', variant: 'primary' },
    { label: 'Open Audit', path: 'audit-readiness', variant: 'secondary' },
    { label: 'Upload Evidence', path: 'evidence', variant: 'secondary' },
    { label: 'Review Controls', path: 'controls', variant: 'secondary' },
    { label: 'Invite Team Member', path: 'workspace-members', variant: 'secondary' },
    { label: 'Export Snapshot', path: 'reports', variant: 'secondary' },
  ];

  const aiNarrative = useMemo(() => {
    const lines = [
      enterprisePosture.enterpriseScore >= 70
        ? 'Operating posture is stable, but the committee should keep attention on residual exposure concentration and overdue operating evidence.'
        : 'Operating posture remains under pressure, driven by residual exposure, assurance gaps, and outstanding actions that require executive follow-through.',
      riskIntelligenceSummary?.executiveSummary?.[0] ||
        `Residual risk averages ${metrics.residualAverage} against an appetite baseline of ${metrics.appetiteThresholdAverage}.`,
      aiGovernanceState
        ? `AI governance is at ${aiGovernanceState.summary.aiComplianceScore}% readiness with ${aiGovernanceState.summary.highRiskAi} high-risk systems in active oversight.`
        : `Framework coverage is ${metrics.complianceCoverage}% with ${enterprisePosture.exceptions.auditBlockers} audit blockers still open.`,
    ];
    return lines;
  }, [aiGovernanceState, enterprisePosture.enterpriseScore, enterprisePosture.exceptions.auditBlockers, metrics.appetiteThresholdAverage, metrics.complianceCoverage, metrics.residualAverage, riskIntelligenceSummary]);

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

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[2] }}>
        {primaryKpis.map((kpi) => <CompactPrimaryKpi key={kpi.label} label={kpi.label} value={kpi.value} subtitle={kpi.subtitle} tone={kpi.tone} action={kpi.action} onClick={() => navigateTo(kpi.path)} />)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: theme.spacing[2] }}>
        {secondaryIndicators.map((item) => <SecondaryIndicator key={item.label} label={item.label} value={item.value} detail={item.detail} tone={item.tone} />)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.9fr)', gap: theme.spacing[3], alignItems: 'start' }}>
        <SectionContainer title="Risk Heatmap" subtitle="Residual concentration, top exposure, and appetite pressure in one compact executive panel." action={<Badge variant="default" size="sm">{metrics.priorityRisks.length} priority risks</Badge>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)', gap: theme.spacing[3] }}>
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
                    <div>{row.status} | {row.residual}</div>
                    <div><Badge variant={severityVariant(row.severity)} size="sm">{titleCase(row.severity)}</Badge></div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </SectionContainer>

        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          <SectionContainer title="Quick Actions" subtitle="Start the next governance workflow without leaving the dashboard.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[2] }}>
              {quickActionItems.map((item) => (
                <Button key={item.label} variant={item.variant} onClick={() => navigateTo(item.path)}>
                  {item.label}
                </Button>
              ))}
            </div>
          </SectionContainer>
          <SectionContainer title="AI Executive Narrative" subtitle="A concise board-facing narrative stitched from posture, exposure, and AI oversight signals.">
            <div style={{ display: 'grid', gap: theme.spacing[2] }}>
              <Card style={{ border, background: theme.colors.surfaceHover, padding: theme.spacing[3] }}>
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weighted Priority Score</div>
                <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{weightedProfile.finalScore}</div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{weightedProfile.driverExplanation}</div>
              </Card>
              {aiNarrative.map((line) => (
                <div key={line} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, lineHeight: 1.6 }}>
                  {line}
                </div>
              ))}
            </div>
          </SectionContainer>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <ChartPanel title="Compliance Overview" subtitle="Mapped framework posture grouped into executive-ready buckets." summary={<Badge variant="default" size="sm">{frameworkRows.length} frameworks</Badge>}>
          <DonutBreakdown total={complianceBreakdown.total} segments={complianceBreakdown.segments} emptyMessage="No framework mappings available yet" />
        </ChartPanel>
        <ChartPanel title="Open Actions" subtitle="Current treatment and assurance workload requiring direct attention." summary={<Badge variant="warning" size="sm">{actionCenterItems.filter((item) => item.value > 0).length} active</Badge>}>
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {actionCenterItems.slice(0, 5).map((item) => (
              <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: theme.spacing[2], alignItems: 'center' }}>
                <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item.label}</span>
                <Badge variant={item.tone === 'critical' ? 'danger' : item.tone === 'warning' ? 'warning' : 'success'} size="sm">{item.value}</Badge>
                <Button variant="secondary" onClick={() => navigateTo(item.path)}>Open</Button>
              </div>
            ))}
          </div>
        </ChartPanel>
        <ChartPanel title="Framework Coverage" subtitle="Top frameworks with current mapped coverage and operating health." summary={<Badge variant="default" size="sm">{frameworkCoverageItems.length} shown</Badge>}>
          <FrameworkCoverageStrip items={frameworkCoverageItems} />
        </ChartPanel>
      </section>

      <section style={{ display: 'none' }}>
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

      <section style={{ display: 'none' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>New regulations</span><strong>{regulatorySummary?.newRegulatoryChanges || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Open obligations</span><strong>{regulatorySummary?.activeObligations || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Upcoming reviews</span><strong>{regulatorySummary?.pendingReviews || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>High impact changes</span><strong>{regulatorySummary?.highImpactChanges || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Compliance exposure</span><strong>{regulatorySummary ? `${regulatorySummary.complianceExposure}%` : '0%'}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Policy updates</span><strong>{regulatorySummary?.pendingReviews || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Control updates</span><strong>{regulatorySummary?.overdueActions || 0}</strong></div>
            <div style={{ marginTop: theme.spacing[2] }}>
              <Button variant="secondary" onClick={() => navigateTo('regulatory-change')}>Open Regulatory Change</Button>
            </div>
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
        <SectionContainer title="Risk Intelligence" subtitle="Compact feed from the weighted scoring and forecasting engine.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Appetite breaches</span><strong>{riskIntelligenceSummary?.summary.appetiteBreaches || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Capacity breaches</span><strong>{riskIntelligenceSummary?.summary.capacityBreaches || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Critical KRIs</span><strong>{riskIntelligenceSummary?.summary.criticalKris || 0}</strong></div>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {riskIntelligenceSummary?.executiveSummary?.[0] || 'Open Risk Intelligence for weighted scoring, forecasts, KRIs, and capacity analytics.'}
            </div>
            {riskIntelligenceSummary?.topRisk ? (
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
                Top risk: <strong>{riskIntelligenceSummary.topRisk.title}</strong> ({Math.round(riskIntelligenceSummary.topRisk.dynamicScore)})
              </div>
            ) : null}
            {riskIntelligenceSummary?.topForecast ? (
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
                Forecast watch: <strong>{riskIntelligenceSummary.topForecast.scopeLabel}</strong> ({Math.round(riskIntelligenceSummary.topForecast.predicted90DayScore)} in 90 days)
              </div>
            ) : null}
            <div style={{ marginTop: theme.spacing[2] }}>
              <Button variant="secondary" onClick={() => navigateTo('risks')}>Open Risk Intelligence</Button>
            </div>
          </div>
        </SectionContainer>
        <SectionContainer title="AI Governance" subtitle="Compact posture view for AI inventory, model risk, incidents, and compliance readiness.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>AI systems</span>
              <strong>{aiGovernanceState?.summary.aiSystems || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>High-risk AI</span>
              <strong>{aiGovernanceState?.summary.highRiskAi || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Compliance score</span>
              <strong>{aiGovernanceState ? `${aiGovernanceState.summary.aiComplianceScore}%` : '0%'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Open AI incidents</span>
              <strong>{aiGovernanceState?.incidents.filter((incident) => incident.status !== 'resolved').length || 0}</strong>
            </div>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {aiGovernanceState?.compliancePrograms.find((program) => program.frameworkCode === 'EU_AI_ACT')
                ? `EU AI Act score ${aiGovernanceState.compliancePrograms.find((program) => program.frameworkCode === 'EU_AI_ACT')?.score}% with ${aiGovernanceState.compliancePrograms.find((program) => program.frameworkCode === 'EU_AI_ACT')?.gapCount} gaps.`
                : 'Open AI Governance for inventory, model validation, incidents, and regulatory readiness.'}
            </div>
            <div style={{ marginTop: theme.spacing[2] }}>
              <Button variant="secondary" onClick={() => navigateTo('ai-governance')}>Open AI Governance</Button>
            </div>
          </div>
        </SectionContainer>
        <SectionContainer title="ESG Management" subtitle="Compact sustainability posture across score, carbon, supplier ESG, compliance, and board readiness.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Overall ESG score</span>
              <strong>{esgState ? `${esgState.summary.overallScore}%` : '0%'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Carbon footprint</span>
              <strong>{esgState ? `${esgState.summary.carbonFootprint} tCO2e` : '0 tCO2e'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Supplier ESG rating</span>
              <strong>{esgState ? `${esgState.summary.supplierEsgRating}%` : '0%'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>ESG compliance</span>
              <strong>{esgState ? `${esgState.summary.complianceStatus}%` : '0%'}</strong>
            </div>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {esgState
                ? `${esgState.maturity.level} maturity with board readiness at ${esgState.summary.boardReadiness}% and ${esgState.boardView.openFindings} open findings.`
                : 'Open ESG Management for sustainability reporting, carbon accounting, supplier ESG, and board readiness.'}
            </div>
            <div style={{ marginTop: theme.spacing[2] }}>
              <Button variant="secondary" onClick={() => navigateTo('esg-management')}>Open ESG Management</Button>
            </div>
          </div>
        </SectionContainer>
        <SectionContainer title="Privacy Governance" subtitle="Compact privacy posture across inventory, DSARs, DPIAs, incidents, and retention compliance.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Privacy score</span>
              <strong>{privacyState ? `${privacyState.summary.complianceScore}%` : '0%'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>PII assets</span>
              <strong>{privacyState?.summary.piiAssets || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Open privacy risks</span>
              <strong>{privacyState?.summary.openPrivacyRisks || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>DSAR requests</span>
              <strong>{privacyState?.summary.dsarRequests || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Retention compliance</span>
              <strong>{privacyState ? `${privacyState.summary.retentionCompliance}%` : '0%'}</strong>
            </div>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {privacyState
                ? `${privacyState.executiveView.thirdPartyExposure} with ${privacyState.summary.dataBreaches} active incidents and ${privacyState.summary.openDpias} open DPIAs.`
                : 'Open Privacy Governance for data inventory, RoPA, DSAR, breach, and transfer oversight.'}
            </div>
            <div style={{ marginTop: theme.spacing[2] }}>
              <Button variant="secondary" onClick={() => navigateTo('privacy-data-governance')}>Open Privacy Governance</Button>
            </div>
          </div>
        </SectionContainer>
        <SectionContainer title="Recent Reporting Activity" subtitle="Latest board and committee reporting output without expanding the dashboard footprint.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Generated this month</span>
              <strong>{reportingCenterState?.summary.generatedThisMonth || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Awaiting attestation</span>
              <strong>{reportingCenterState?.summary.awaitingAttestation || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Scheduled reports</span>
              <strong>{reportingCenterState?.summary.scheduledReports || 0}</strong>
            </div>
            {(reportingCenterState?.recentReports || []).slice(0, 3).map((report) => (
              <Card key={report.id} style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                  {report.title}
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {report.scopeValue} · {report.status} · {new Date(report.createdAt).toLocaleDateString()}
                </div>
              </Card>
            ))}
            <div style={{ marginTop: theme.spacing[2] }}>
              <Button variant="secondary" onClick={() => navigateTo('reports')}>Open Reporting Center</Button>
            </div>
          </div>
        </SectionContainer>
        <SectionContainer title="Resilience & Recovery" subtitle="Compact BCM and operational resilience posture for continuity oversight.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Recovery readiness</span>
              <strong>{businessContinuityState ? `${businessContinuityState.summary.recoveryReadiness}%` : '0%'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Critical services</span>
              <strong>{businessContinuityState?.criticalServices.length || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Upcoming exercises</span>
              <strong>{(businessContinuityState?.exercises || []).filter((exercise) => new Date(exercise.exerciseDate).getTime() > Date.now()).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Plans due review</span>
              <strong>{(businessContinuityState?.recoveryPlans || []).filter((plan) => plan.nextReviewAt && new Date(plan.nextReviewAt).getTime() < Date.now() + 30 * 86400000).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>Resilience score</span>
              <strong>{businessContinuityState?.summary.resilienceScore || 0}</strong>
            </div>
            <div style={{ marginTop: theme.spacing[2] }}>
              <Button variant="secondary" onClick={() => navigateTo('business-continuity')}>Open BCM Dashboard</Button>
            </div>
          </div>
        </SectionContainer>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <ChartPanel title="Risk Trend" subtitle="Monthly movement in high and critical risk activity." summary={<Badge variant="default" size="sm">6 months</Badge>}>
          <LineTrendChart points={riskTrendPoints} color={theme.colors.primary} emptyMessage="No recent high-risk activity available yet" />
        </ChartPanel>
        <ChartPanel title="Audit Trend" subtitle="Monthly assurance activity from evidence review and reporting output." summary={<Badge variant="default" size="sm">6 months</Badge>}>
          <LineTrendChart points={auditTrendPoints} color={theme.colors.semantic.success} emptyMessage="No recent audit activity available yet" />
        </ChartPanel>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <ChartPanel title="Audit Status" subtitle="Readiness by framework and blocker pressure." summary={<Badge variant="default" size="sm">{auditSummary.length} frameworks</Badge>}>
          <BarList items={auditSummary.map((item) => ({ label: item.framework, value: item.readinessPercent, total: 100, color: item.readinessPercent >= 75 ? theme.colors.semantic.success : item.readinessPercent >= 55 ? theme.colors.semantic.warning : theme.colors.semantic.danger, suffix: '%' }))} emptyMessage="No audit readiness data available yet" />
        </ChartPanel>
        <ChartPanel title="Evidence Overview" subtitle="Freshness, missing evidence, and review pressure." summary={<Badge variant="default" size="sm">{data.evidence.length} items</Badge>}>
          <StackedStatusBar segments={[{ label: 'Valid', value: evidenceHealth.valid, color: theme.colors.semantic.success }, { label: 'Due for Review', value: evidenceHealth.dueForReview, color: theme.colors.primary }, { label: 'Expired', value: evidenceHealth.expired, color: theme.colors.semantic.warning }, { label: 'Missing', value: evidenceHealth.missing, color: theme.colors.semantic.danger }]} emptyMessage="No evidence records available yet" />
        </ChartPanel>
        <ChartPanel title="Training Compliance" subtitle="Completion, overdue assignments, and active campaigns." summary={<Badge variant="default" size="sm">{trainingSummary.activeCampaigns || 0} campaigns</Badge>}>
          <StackedStatusBar segments={[{ label: 'Compliant', value: Math.round(trainingSummary.overallCompletionRate || 0), color: theme.colors.semantic.success }, { label: 'Overdue', value: trainingSummary.overdueAssignments || 0, color: theme.colors.semantic.danger }, { label: 'In Progress', value: Math.max(0, 100 - Math.round(trainingSummary.overallCompletionRate || 0)), color: theme.colors.primary }]} emptyMessage="No training data available yet" />
        </ChartPanel>
        <ChartPanel title="Vendor Exposure" subtitle="Distribution across third-party risk tiers." summary={<Badge variant="default" size="sm">{data.vendors.length} vendors</Badge>}>
          <StackedStatusBar segments={[{ label: 'Critical', value: vendorTiers.critical, color: theme.colors.semantic.danger }, { label: 'High', value: vendorTiers.high, color: theme.colors.semantic.warning }, { label: 'Medium', value: vendorTiers.medium, color: theme.colors.primary }, { label: 'Low', value: vendorTiers.low, color: theme.colors.semantic.success }]} emptyMessage="No vendor records available yet" />
        </ChartPanel>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[2] }}>
        {overviewCards.slice(0, 4).map((card) => <OverviewCard key={card.title} icon={card.icon} title={card.title} metric={card.metric} trend={card.trend} tone={card.tone} cta={card.cta} onClick={() => navigateTo(card.path)} />)}
      </section>

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
