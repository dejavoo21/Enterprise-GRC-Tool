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
  buildChangeSignals,
  buildDashboardMetrics,
  buildFrameworkRows,
  buildInfoSecRows,
  buildWeightedRiskProfile,
  type Snapshot,
} from '@/services/dashboard/dashboardMetrics';
import {
  buildExecutiveDashboardSeed,
  EXECUTIVE_COMPLIANCE_TARGET,
  EXECUTIVE_RISK_CATEGORY_TARGET,
  fallbackScalar,
  mergeWithExecutiveSeed,
  shouldUseExecutiveSeedWorkspace,
} from '@/services/dashboard/executiveDashboardSeed';
import { getExecutiveContinuousAssuranceWidgets } from '@/services/continuousAssurance/continuousAssurance';
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
  variant?: 'overview' | 'dashboard';
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

type DashboardRegulatorySummary = RegulatoryDashboardSummary;

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
  { value: 'NIS2', label: 'NIS2' },
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

function isoFutureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

type TrendPoint = {
  label: string;
  value: number;
};

type ExecutiveAlertItem = {
  label: string;
  count: number;
  severity: Tone;
  routeKey: string;
  note: string;
};

type ExecutiveCalendarItem = {
  title: string;
  dueDate: string;
  owner: string;
  status: string;
  routeKey: string;
};

type CrossDomainLink = {
  label: string;
  count: number;
  status: Tone;
  affectedDomains: string;
  routeKey: string;
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

function buildScoreTrend(current: number, months = 6, spread = 12): TrendPoint[] {
  const boundedCurrent = clamp(current);
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - index - 1), 1);
    const progress = months === 1 ? 1 : index / (months - 1);
    const baseline = boundedCurrent - spread * 0.72 + progress * spread * 0.82;
    const oscillation = Math.sin(progress * Math.PI * 2.2) * (spread * 0.16);
    const closingBias = progress > 0.7 ? (progress - 0.7) * spread * 0.4 : 0;
    const seeded = clamp(baseline + oscillation + closingBias);
    return {
      label: date.toLocaleString('en-GB', { month: 'short' }),
      value: seeded,
    };
  });
}

function buildFlatTrend(current: number, months = 12, spread = 8) {
  const points = buildScoreTrend(current, months, spread);
  return points.map((point, index) => ({
    ...point,
    value: clamp(point.value + (index % 3 === 0 ? 1 : index % 4 === 0 ? -1 : 0)),
  }));
}

function buildKpiSparklineSeries(
  points: TrendPoint[],
  current: number,
  options?: {
    months?: number;
    minSpread?: number;
    maxSpread?: number;
  },
) {
  const months = options?.months ?? 6;
  const minSpread = options?.minSpread ?? 4;
  const maxSpread = options?.maxSpread ?? 12;
  const recent = points
    .slice(-months)
    .map((point) => point.value)
    .map((value, index, source) => {
      const previous = source[index - 1] ?? value;
      const next = source[index + 1] ?? value;
      return (previous + value * 2 + next) / 4;
    });
  if (!recent.length || recent.every((value) => value === recent[0])) {
    return buildScoreTrend(current, months, minSpread + 2).map((point) => point.value);
  }

  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = Math.max(1, max - min);
  const spread = Math.min(maxSpread, Math.max(minSpread, range * 2.6));
  const normalized = recent.map((value) => (value - min) / range);
  const mapped = normalized.map((value, index) => {
    const progress = recent.length === 1 ? 1 : index / (recent.length - 1);
    const closingLift = progress > 0.72 ? (progress - 0.72) * spread * 0.22 : 0;
    return clamp(current - spread * 0.5 + value * spread + closingLift);
  });
  const adjustment = current - mapped[mapped.length - 1];
  const adjusted = mapped.map((value) => clamp(value + adjustment));
  const lastIndex = adjusted.length - 1;
  if (lastIndex > 0) {
    const delta = current - adjusted[lastIndex - 1];
    if (Math.abs(delta) < 1) {
      adjusted[lastIndex] = clamp(adjusted[lastIndex - 1] + (delta >= 0 ? 1.25 : -1.25));
    }
  }
  return adjusted;
}

function formatKpiDelta(delta: number) {
  const rounded = Math.round(delta);
  const arrow = rounded < 0 ? '\u25BC' : '\u25B2';
  return `${arrow} ${Math.abs(rounded)} vs last month`;
}

function getKpiStatusLabel(label: string, score: number, tone: Tone) {
  if (label === 'Enterprise Risk Score') {
    if (score >= 80) return 'Good';
    if (score >= 65) return 'Medium High';
    return 'Needs Attention';
  }
  if (label === 'Audit Readiness') {
    return score >= 80 ? 'Good' : 'Needs Attention';
  }
  if (label === 'Vendor Exposure' || label === 'AI Governance Score') {
    return tone === 'success' ? 'Good' : 'Moderate';
  }
  if (label === 'Resilience Score') {
    return score >= 75 ? 'Good' : 'Moderate';
  }
  return tone === 'critical' ? 'Needs Attention' : tone === 'warning' ? 'Moderate' : 'Good';
}

function getLastMonthDelta(points: number[]) {
  if (points.length < 2) return 0;
  return Math.round(points[points.length - 1] - points[points.length - 2]);
}

function CompactPrimaryKpi({
  label,
  value,
  tone,
  statusLabel,
  delta,
  onClick,
}: {
  label: string;
  value: string | number;
  tone: Tone;
  statusLabel: string;
  delta?: string;
  onClick?: () => void;
}) {
  const accent =
    tone === 'critical'
      ? theme.colors.semantic.danger
      : tone === 'warning'
        ? theme.colors.semantic.warning
        : theme.colors.semantic.success;
  const resolvedValue =
    typeof value === 'number'
      ? `${Math.round(value)}${label.toLowerCase().includes('score') || label.toLowerCase().includes('readiness') || label.toLowerCase().includes('exposure') ? ' /100' : ''}`
      : value;
  const normalizedValue = typeof resolvedValue === 'string' ? resolvedValue.replace(' / 100', ' /100') : String(resolvedValue);
  const parts = typeof normalizedValue === 'string' ? normalizedValue.split(' /') : [String(normalizedValue)];
  const mainValue = parts[0];
  const suffixValue = parts.length > 1 ? `/${parts[1]}` : '';
  const padding = 14;
  const minHeight = 148;
  const labelSize = '12.5px';
  const valueSize = '2.5rem';
  const suffixSize = '0.95rem';
  const deltaSize = '10.5px';
  const cardShadow = '0 12px 24px rgba(15, 23, 42, 0.045)';
  const trendLabel = delta || formatKpiDelta(0);

  return (
    <Card
      style={{
        border,
        background: theme.colors.surface,
        padding,
        minHeight,
        boxShadow: cardShadow,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'grid', height: '100%', alignItems: 'stretch' }}>
        <div style={{ display: 'grid', gap: 14, minWidth: 0, alignContent: 'start' }}>
          <div
            style={{
              fontSize: labelSize,
              color: theme.colors.text.secondary,
              fontWeight: theme.typography.weights.medium,
              lineHeight: 1.2,
            }}
          >
            {label}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, color: theme.colors.text.main, minWidth: 0, paddingTop: 2, paddingBottom: 4, minHeight: 50 }}>
            <span style={{ fontSize: valueSize, fontWeight: theme.typography.weights.bold, lineHeight: 0.92 }}>{mainValue}</span>
            {suffixValue ? <span style={{ fontSize: suffixSize, color: theme.colors.text.secondary, fontWeight: theme.typography.weights.semibold }}>{suffixValue}</span> : null}
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 'auto', paddingTop: 2 }}>
            <Badge variant={tone === 'critical' ? 'danger' : tone === 'warning' ? 'warning' : 'success'} size="sm">
              {statusLabel}
            </Badge>
            <div style={{ fontSize: deltaSize, color: accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
              {trendLabel}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MetricRing({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: Tone;
}) {
  const bounded = clamp(value);
  const circumference = 2 * Math.PI * 42;
  const accent = toneAccent(tone);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '168px minmax(0, 1fr)', gap: theme.spacing[2], alignItems: 'center' }}>
      <div style={{ display: 'grid', placeItems: 'center', minWidth: 0 }}>
        <svg width="160" height="160" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="42" fill="none" stroke={theme.colors.borderLight} strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke={accent}
            strokeWidth="10"
            strokeDasharray={`${(bounded / 100) * circumference} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div style={{ marginTop: -108, textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: theme.typography.weights.bold, color: theme.colors.text.main, lineHeight: 1 }}>{bounded}%</div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{label}</div>
        </div>
      </div>
      <div />
    </div>
  );
}

function MultiLineTrendChart({
  series,
  emptyMessage,
}: {
  series: Array<{ label: string; color: string; points: TrendPoint[] }>;
  emptyMessage: string;
}) {
  const normalized = series.filter((item) => item.points.length);
  const allValues = normalized.flatMap((item) => item.points.map((point) => point.value));
  const max = Math.max(...allValues, 0);
  const min = Math.min(...allValues, 0);
  if (!normalized.length || max === 0) return <EmptyChartState message={emptyMessage} />;

  const width = 600;
  const height = 220;
  const chartLeft = 34;
  const chartRight = 6;
  const chartTop = 12;
  const chartBottom = 20;
  const chartWidth = width - chartLeft - chartRight;
  const paddedMin = Math.max(0, min - Math.max(1, (max - min) * 0.08));
  const paddedMax = max + Math.max(1, (max - min) * 0.08);
  const range = Math.max(paddedMax - paddedMin, 1);
  const tickValues = Array.from({ length: 4 }, (_, index) => Math.round(paddedMax - (range / 3) * index));

  return (
    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        {normalized.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, padding: '4px 10px', borderRadius: theme.borderRadius.full, background: theme.colors.surfaceHover }}>
            <span style={{ width: 10, height: 10, borderRadius: theme.borderRadius.full, background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height + 4}`} style={{ width: '100%', height: 220 }}>
        {tickValues.map((tick) => {
          const y = chartTop + (height - chartTop - chartBottom) - ((tick - paddedMin) / range) * (height - chartTop - chartBottom);
          return (
            <g key={tick}>
              <line x1={chartLeft} y1={y} x2={width - chartRight} y2={y} stroke="rgba(148, 163, 184, 0.22)" strokeDasharray="2 6" />
              <text x={chartLeft - 10} y={y + 5} textAnchor="end" fontSize="11" fill={theme.colors.text.secondary}>
                {tick}
              </text>
            </g>
          );
        })}
        {normalized.map((item) => {
          const step = item.points.length > 1 ? chartWidth / (item.points.length - 1) : chartWidth;
          const line = item.points
            .map((point, index) => {
              const x = chartLeft + index * step;
              const y = chartTop + (height - chartTop - chartBottom) - ((point.value - paddedMin) / range) * (height - chartTop - chartBottom);
              return `${x},${Math.max(chartTop, y)}`;
            })
            .join(' ');

          return (
            <g key={item.label}>
              <polyline
                fill="none"
                stroke={item.color}
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={line}
              />
              {item.points.map((point, index) => {
                const x = chartLeft + index * step;
                const y = chartTop + (height - chartTop - chartBottom) - ((point.value - paddedMin) / range) * (height - chartTop - chartBottom);
                return (
                  <circle
                    key={`${item.label}-${point.label}`}
                    cx={x}
                    cy={Math.max(chartTop, y)}
                    r="4"
                    fill={item.color}
                    stroke={theme.colors.surface}
                    strokeWidth="1.5"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${normalized[0]?.points.length || 0}, minmax(0, 1fr))`, gap: theme.spacing[2] }}>
        {normalized[0]?.points.map((point) => (
          <div key={point.label} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            {point.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function SecondaryIndicator({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: Tone;
  onClick?: () => void;
}) {
  return (
    <Card
      style={{ border, background: theme.colors.surface, padding: theme.spacing[2], cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
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
  priority = 'default',
  compact = false,
}: {
  title: string;
  subtitle: string;
  summary?: ReactNode;
  children: ReactNode;
  priority?: 'primary' | 'default' | 'supporting';
  compact?: boolean;
}) {
  return (
    <SectionContainer title={title} subtitle={subtitle} action={summary} priority={priority} compact={compact}>
      <div style={{ display: 'grid', gap: compact ? theme.spacing[1] : theme.spacing[2] }}>{children}</div>
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
  const min = Math.min(...points.map((point) => point.value), 0);
  if (!points.length || max === 0) return <EmptyChartState message={emptyMessage} />;

  const width = 600;
  const height = 208;
  const chartLeft = 34;
  const chartRight = 6;
  const chartTop = 14;
  const chartBottom = 24;
  const chartWidth = width - chartLeft - chartRight;
  const step = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;
  const paddedMin = Math.max(0, min - Math.max(1, (max - min) * 0.08));
  const paddedMax = max + Math.max(1, (max - min) * 0.08);
  const range = Math.max(paddedMax - paddedMin, 1);
  const tickValues = Array.from({ length: 4 }, (_, index) => Math.round(paddedMax - (range / 3) * index));
  const line = points
    .map((point, index) => {
      const x = chartLeft + index * step;
      const y = chartTop + (height - chartTop - chartBottom) - ((point.value - paddedMin) / range) * (height - chartTop - chartBottom);
      return `${x},${Math.max(chartTop, y)}`;
    })
    .join(' ');

  return (
    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
      <svg viewBox={`0 0 ${width} ${height + 4}`} style={{ width: '100%', height: 206 }}>
        {tickValues.map((tick) => {
          const y = chartTop + (height - chartTop - chartBottom) - ((tick - paddedMin) / range) * (height - chartTop - chartBottom);
          return (
            <g key={tick}>
              <line x1={chartLeft} y1={y} x2={width - chartRight} y2={y} stroke="rgba(148, 163, 184, 0.22)" strokeDasharray="2 6" />
              <text x={chartLeft - 10} y={y + 5} textAnchor="end" fontSize="11" fill={theme.colors.text.secondary}>
                {tick}
              </text>
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={line}
        />
        {points.map((point, index) => {
          const x = chartLeft + index * step;
          const y = chartTop + (height - chartTop - chartBottom) - ((point.value - paddedMin) / range) * (height - chartTop - chartBottom);
          return (
            <circle
              key={point.label}
              cx={x}
              cy={Math.max(chartTop, y)}
              r="4"
              fill={color}
              stroke={theme.colors.surface}
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`, gap: theme.spacing[2] }}>
        {points.map((point) => (
          <div key={point.label} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, textAlign: 'center' }}>
            <div>{point.label}</div>
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
  centerLabel = 'In scope',
  layout = 'split',
  diameter = 188,
}: {
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
  emptyMessage: string;
  centerLabel?: string;
  layout?: 'split' | 'stacked';
  diameter?: number;
}) {
  if (total <= 0) return <EmptyChartState message={emptyMessage} />;

  const resolveSegmentColor = (segment: { label: string; color: string }) => {
    const normalizedLabel = segment.label.toLowerCase();
    if (normalizedLabel.includes('compliant') && !normalizedLabel.includes('non')) return '#16a34a';
    if (normalizedLabel.includes('partially')) return '#f59e0b';
    if (normalizedLabel.includes('non')) return '#ef4444';
    if (normalizedLabel.includes('assessed')) return '#94a3b8';
    return segment.color;
  };

  const circumference = 2 * Math.PI * 42;
  const segmentArcs = segments.map((segment, index) => {
    const previousTotal = segments
      .slice(0, index)
      .reduce((sum, current) => sum + current.value, 0);
    return {
      ...segment,
      resolvedColor: resolveSegmentColor(segment),
      strokeDasharray: `${(segment.value / total) * circumference} ${circumference}`,
      strokeDashoffset: -((previousTotal / total) * circumference),
    };
  });

  const donutSize = diameter;
  const centerOffset = Math.round(donutSize * 0.61);
  const donutColumn = Math.max(170, Math.round(donutSize * 0.82));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: layout === 'stacked' ? 'minmax(0, 1fr)' : `${donutColumn}px minmax(0, 1fr)`,
        gap: 4,
        alignItems: 'center',
        justifyItems: layout === 'stacked' ? 'center' : 'stretch',
        minHeight: Math.max(198, donutSize - 10),
        height: '100%',
      }}
    >
      <div style={{ display: 'grid', placeItems: 'center', minWidth: 0, height: '100%' }}>
        <svg width={donutSize} height={donutSize} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="42" fill="none" stroke={theme.colors.borderLight} strokeWidth="12" />
          {segmentArcs.map((segment) => {
            return (
              <circle
                key={segment.label}
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke={segment.resolvedColor}
                strokeWidth="12"
                strokeDasharray={segment.strokeDasharray}
                strokeDashoffset={segment.strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            );
          })}
        </svg>
        <div style={{ marginTop: -centerOffset, textAlign: 'center' }}>
          <div style={{ fontSize: '2.55rem', fontWeight: theme.typography.weights.bold, color: theme.colors.text.main, lineHeight: 1 }}>{total}</div>
          <div style={{ marginTop: 4, fontSize: '12px', color: theme.colors.text.secondary, fontWeight: theme.typography.weights.medium }}>{centerLabel}</div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gap: 8,
          alignContent: 'center',
          width: '100%',
          maxWidth: layout === 'stacked' ? 320 : 'none',
          paddingRight: 0,
        }}
      >
        {segments.map((segment) => (
          <div key={segment.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: resolveSegmentColor(segment), flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: theme.colors.text.secondary, whiteSpace: 'nowrap' }}>{segment.label}</span>
            </div>
            <strong style={{ fontSize: '13px', color: theme.colors.text.main, justifySelf: 'end', whiteSpace: 'nowrap', minWidth: 18, textAlign: 'right' }}>
              {segment.value}
            </strong>
            <strong style={{ fontSize: '13px', color: theme.colors.text.main, justifySelf: 'end', whiteSpace: 'nowrap', minWidth: 44, textAlign: 'right' }}>
              {total > 0 ? `(${Math.round((segment.value / total) * 100)}%)` : '(0%)'}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopRiskCategoryBreakdown({
  segments,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return <EmptyChartState message="No categorized risks available yet" />;

  const circumference = 2 * Math.PI * 42;
  const donutSize = 178;
  const ringStroke = 14;
  const segmentArcs = segments.map((segment, index) => {
    const previousTotal = segments.slice(0, index).reduce((sum, current) => sum + current.value, 0);
    return {
      ...segment,
      strokeDasharray: `${(segment.value / total) * circumference} ${circumference}`,
      strokeDashoffset: -((previousTotal / total) * circumference),
    };
  });

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(170px, 40%) minmax(0, 60%)',
        gap: 6,
        alignItems: 'center',
        minHeight: 200,
        height: '100%',
      }}
    >
      <div style={{ display: 'grid', placeItems: 'center', minWidth: 0, height: '100%' }}>
        <svg width={donutSize} height={donutSize} viewBox="0 0 120 120" aria-label="Top risk categories">
          <circle cx="60" cy="60" r="42" fill="none" stroke={theme.colors.borderLight} strokeWidth={ringStroke} />
          {segmentArcs.map((segment) => (
            <circle
              key={segment.label}
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke={segment.color}
              strokeWidth={ringStroke}
              strokeDasharray={segment.strokeDasharray}
              strokeDashoffset={segment.strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          ))}
        </svg>
        <div style={{ marginTop: -104, textAlign: 'center' }}>
          <div style={{ fontSize: '2.45rem', fontWeight: theme.typography.weights.bold, color: theme.colors.text.main, lineHeight: 1 }}>
            {total}
          </div>
          <div style={{ marginTop: 6, fontSize: '12px', color: theme.colors.text.secondary, fontWeight: theme.typography.weights.medium }}>
            Total Risks
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 9, alignContent: 'center', width: '100%', paddingRight: 0 }}>
        {segments.map((segment) => (
          <div key={segment.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: segment.color, flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: theme.colors.text.secondary, whiteSpace: 'nowrap' }}>
                {segment.label}
              </span>
            </div>
            <strong style={{ fontSize: '13px', color: theme.colors.text.main, justifySelf: 'end', whiteSpace: 'nowrap' }}>
              {segment.value} ({Math.round((segment.value / total) * 100)}%)
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutiveRiskHeatmap({
  risks,
}: {
  risks: AppRisk[];
}) {
  const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
  const cellRiskLabels = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => [] as string[]));
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, veryLow: 0 };

  risks.forEach((risk) => {
    const likelihood = Math.max(1, Math.min(5, Math.round(Number(risk.residualLikelihood ?? risk.inherentLikelihood ?? 3))));
    const impact = Math.max(1, Math.min(5, Math.round(Number(risk.residualImpact ?? risk.inherentImpact ?? 3))));
    matrix[likelihood - 1][impact - 1] += 1;
    const riskIdentifier = risk.id.toUpperCase().startsWith('RISK-') ? risk.id : `R-${risk.id.slice(0, 4).toUpperCase()}`;
    cellRiskLabels[likelihood - 1][impact - 1].push(riskIdentifier);

    const severity = (risk.severity || '').toLowerCase();
    if (severity === 'critical') severityCounts.critical += 1;
    else if (severity === 'high') severityCounts.high += 1;
    else if (severity === 'medium') severityCounts.medium += 1;
    else if (severity === 'low') severityCounts.low += 1;
    else severityCounts.veryLow += 1;
  });

  const legend = [
    { label: 'Critical', value: severityCounts.critical, color: theme.colors.semantic.danger },
    { label: 'High', value: severityCounts.high, color: '#F97316' },
    { label: 'Medium', value: severityCounts.medium, color: '#F2C94C' },
    { label: 'Low', value: severityCounts.low, color: '#4FD37A' },
    { label: 'Very Low', value: severityCounts.veryLow, color: '#15803D' },
  ];

  const toneMap = [
    ['#F2C94C', '#F97316', '#EF4444', '#EF4444', '#EF4444'],
    ['#4FD37A', '#F2C94C', '#F97316', '#EF4444', '#EF4444'],
    ['#4FD37A', '#F2C94C', '#F2C94C', '#F97316', '#EF4444'],
    ['#4FD37A', '#4FD37A', '#F2C94C', '#F97316', '#F97316'],
    ['#15803D', '#4FD37A', '#4FD37A', '#F2C94C', '#F2C94C'],
  ];

  const cellTone = (likelihood: number, impact: number) => toneMap[5 - likelihood]?.[impact - 1] || '#31c56b';

  const cellSize = 63;
  const cellGap = 1;
  const matrixHeight = cellSize * 5 + cellGap * 4;
  const axisTextStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: theme.colors.text.main,
    letterSpacing: '0.01em',
    lineHeight: 1,
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'max-content 92px',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'start',
        minHeight: matrixHeight + 6,
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '54px 22px max-content',
          columnGap: 10,
          alignItems: 'center',
          justifyContent: 'start',
        }}
      >
        <div style={{ height: matrixHeight, display: 'grid', placeItems: 'center' }}>
          <span
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              whiteSpace: 'nowrap',
              ...axisTextStyle,
            }}
          >
            Likelihood
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateRows: `repeat(5, ${cellSize}px)`, rowGap: cellGap, alignItems: 'center', justifyItems: 'center', height: matrixHeight }}>
          {[5, 4, 3, 2, 1].map((likelihood) => (
            <div key={`y-${likelihood}`} style={{ ...axisTextStyle, display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
              {likelihood}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', rowGap: 3, alignItems: 'start' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(5, ${cellSize}px)`, gap: cellGap }}>
            {[5, 4, 3, 2, 1].flatMap((likelihood) =>
              [1, 2, 3, 4, 5].map((impact) => {
                const count = matrix[likelihood - 1][impact - 1];
                return (
                  <div
                    key={`${likelihood}-${impact}`}
                    title={count > 0 ? `${count} risk${count === 1 ? '' : 's'}: ${cellRiskLabels[likelihood - 1][impact - 1].join(', ')}` : 'No risks in this cell'}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 9,
                      background: cellTone(likelihood, impact),
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.32)',
                      overflow: 'hidden',
                    }}
                  >
                    {count > 0 ? (
                        <span
                          style={{
                          width: 32,
                          height: 32,
                          borderRadius: theme.borderRadius.full,
                          background: '#1f2937',
                          color: '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 600,
                          boxShadow: '0 6px 14px rgba(15, 23, 42, 0.34)',
                        }}
                      >
                        {count}
                      </span>
                    ) : null}
                  </div>
                );
              }),
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(5, ${cellSize}px)`, gap: cellGap }}>
            {[1, 2, 3, 4, 5].map((impact) => (
              <div key={`impact-${impact}`} style={{ ...axisTextStyle, textAlign: 'center' }}>
                {impact}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', placeItems: 'center', textAlign: 'center', ...axisTextStyle }}>
            <span>Impact</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, alignContent: 'center', paddingLeft: 0, width: 92, justifySelf: 'start' }}>
        {legend.map((item) => (
          <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '10px 1fr 20px', gap: 6, alignItems: 'center', fontSize: '12px', minHeight: 18 }}>
            <span style={{ width: 9, height: 9, borderRadius: theme.borderRadius.full, background: item.color }} />
            <span style={{ color: theme.colors.text.secondary, whiteSpace: 'nowrap' }}>{item.label}</span>
            <strong style={{ color: theme.colors.text.main, textAlign: 'right' }}>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrameworkCoverageStrip({
  items,
  onItemClick,
}: {
  items: Array<{ label: string; coverage: number; tone: Tone; controlsMapped: number; complianceScore: number; trend: string; openFindings: number; lastAssessmentDate: string }>;
  onItemClick?: (framework: string) => void;
}) {
  const toneLabel = (tone: Tone) => (
    tone === 'critical'
      ? 'Risk'
      : tone === 'warning'
        ? 'Moderate'
        : 'Good'
  );

  const trendLabel = (trend: string) => {
    const normalized = trend.toLowerCase();
    if (normalized.includes('improv')) return '↑ Improving';
    if (normalized.includes('declin') || normalized.includes('down')) return '↓ Watch';
    return '→ Stable';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(156px, 1fr))', gap: 12 }}>
      {items.map((item) => (
        <Card
          key={item.label}
          style={{ border, background: theme.colors.surface, padding: '14px 14px 12px', cursor: onItemClick ? 'pointer' : 'default', minHeight: 176 }}
          onClick={onItemClick ? () => onItemClick(item.label) : undefined}
        >
          <div style={{ display: 'grid', gap: 10, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
              <div style={{ minWidth: 0, display: 'grid', gap: 8, flex: 1 }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.01em' }}>
                  {item.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.45rem', lineHeight: 1, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
                    {item.coverage}%
                  </span>
                  <Badge variant={item.tone === 'critical' ? 'danger' : item.tone === 'warning' ? 'warning' : 'success'} size="sm">
                    {toneLabel(item.tone)}
                  </Badge>
                </div>
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: theme.borderRadius.full,
                  border: `3px solid ${item.tone === 'critical' ? theme.colors.semantic.danger : item.tone === 'warning' ? theme.colors.semantic.warning : theme.colors.semantic.success}`,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '11px',
                  fontWeight: theme.typography.weights.bold,
                  color: theme.colors.text.main,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {item.coverage}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Controls</span>
                <strong style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item.controlsMapped}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trend</span>
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.main, fontWeight: theme.typography.weights.semibold, whiteSpace: 'nowrap' }}>
                  {trendLabel(item.trend)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ExecutiveSummaryStrip({
  items,
}: {
  items: Array<{ label: string; value: string; tone: Tone; routeKey: string; onClick: (routeKey: string) => void }>;
}) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => item.onClick(item.routeKey)}
          style={{
            border,
            borderRadius: theme.borderRadius.xl,
            background: theme.colors.surface,
            padding: '10px 12px',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '10px', color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
          <div style={{ marginTop: 6, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.value}
          </div>
          <div style={{ marginTop: 6 }}>
            <Badge variant={item.tone === 'critical' ? 'danger' : item.tone === 'warning' ? 'warning' : 'success'} size="sm">
              {item.tone === 'critical' ? 'Watch' : item.tone === 'warning' ? 'Attention' : 'Healthy'}
            </Badge>
          </div>
        </button>
      ))}
    </section>
  );
}

function ExecutiveStatusBanner({
  selectedFramework,
  frameworkOptions,
  onFrameworkChange,
  onExport,
}: {
  selectedFramework: string;
  frameworkOptions: Array<{ value: string; label: string }>;
  onFrameworkChange: (value: string) => void;
  onExport: () => void;
}) {
  return (
    <Card style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: theme.spacing[1], minWidth: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: theme.typography.sizes['2xl'], color: theme.colors.text.main }}>Executive Command Dashboard</h2>
            <div style={{ marginTop: 2, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              Real-time enterprise posture and operational overview
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing[1], flexWrap: 'wrap' }}>
          <select
            value={selectedFramework}
            onChange={(event) => onFrameworkChange(event.target.value)}
            style={{ border, borderRadius: theme.borderRadius.lg, padding: `10px ${theme.spacing[3]}`, background: theme.colors.surface, color: theme.colors.text.main, minWidth: 152 }}
          >
            {frameworkOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={onExport}>Export Snapshot</Button>
        </div>
      </div>
    </Card>
  );
}

function ExecutiveHealthCard({
  score,
  trend,
  confidence,
  onClick,
}: {
  score: number;
  trend: string;
  confidence: string;
  onClick?: () => void;
}) {
  const tone = getToneFromScore(score);
  const improving = trend.toLowerCase().includes('improv');

  return (
    <Card
      style={{ border, background: theme.colors.surface, padding: theme.spacing[3], cursor: onClick ? 'pointer' : 'default', minHeight: 162 }}
      onClick={onClick}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: theme.spacing[3], alignItems: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <svg width="108" height="108" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="44" fill="none" stroke={theme.colors.borderLight} strokeWidth="12" />
            <circle
              cx="60"
              cy="60"
              r="44"
              fill="none"
              stroke={toneAccent(tone)}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(clamp(score) / 100) * (2 * Math.PI * 44)} ${2 * Math.PI * 44}`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div style={{ marginTop: -74, textAlign: 'center' }}>
            <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{clamp(score)}</div>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Health Index</div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: theme.spacing[2] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enterprise Health Index</div>
          <div style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
            {improving ? 'Improving' : 'Under observation'}
          </div>
          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
            <Badge variant={tone === 'critical' ? 'danger' : tone === 'warning' ? 'warning' : 'success'} size="sm">
              {trend}
            </Badge>
            <Badge variant="default" size="sm">Confidence {confidence}</Badge>
          </div>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, lineHeight: 1.5 }}>
            Blended from enterprise risk, compliance, audit readiness, vendor exposure, resilience, and AI governance.
          </div>
        </div>
      </div>
    </Card>
  );
}

function ExecutiveAlertsPanel({
  items,
  onNavigate,
}: {
  items: ExecutiveAlertItem[];
  onNavigate: (routeKey: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onNavigate(item.routeKey)}
          style={{ border, borderRadius: theme.borderRadius.xl, background: theme.colors.surface, padding: theme.spacing[2], textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
            <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{item.label}</span>
            <Badge variant={item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'warning' : 'success'} size="sm">
              {item.count}
            </Badge>
          </div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
            {item.note}
          </div>
        </button>
      ))}
    </div>
  );
}

function ExecutiveCalendarPanel({
  items,
  onNavigate,
}: {
  items: ExecutiveCalendarItem[];
  onNavigate: (routeKey: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => (
        <button
          key={`${item.title}-${item.dueDate}`}
          type="button"
          onClick={() => onNavigate(item.routeKey)}
          style={{ border, borderRadius: theme.borderRadius.xl, background: theme.colors.surface, padding: theme.spacing[2], textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
            <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{item.title}</span>
            <Badge variant={item.status.toLowerCase().includes('due') ? 'warning' : 'default'} size="sm">{item.status}</Badge>
          </div>
          <div style={{ marginTop: theme.spacing[1], display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
            <span>{new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
            <span>{item.owner}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function CrossDomainIntelligencePanel({
  items,
  onNavigate,
}: {
  items: CrossDomainLink[];
  onNavigate: (routeKey: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onNavigate(item.routeKey)}
          style={{ border, borderRadius: theme.borderRadius.xl, background: theme.colors.surface, padding: theme.spacing[2], textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
            <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{item.label}</span>
            <Badge variant={item.status === 'critical' ? 'danger' : item.status === 'warning' ? 'warning' : 'success'} size="sm">{item.count}</Badge>
          </div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.affectedDomains}</div>
        </button>
      ))}
    </div>
  );
}

function ExecutiveInsightGrid({
  items,
  onNavigate,
}: {
  items: Array<{ label: string; value: string; note: string; tone: Tone; routeKey: string; trend: string; action: string }>;
  onNavigate: (routeKey: string) => void;
}) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: theme.spacing[2] }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onNavigate(item.routeKey)}
          style={{
            border,
            borderRadius: theme.borderRadius.xl,
            background: theme.colors.surface,
            padding: theme.spacing[3],
            textAlign: 'left',
            cursor: 'pointer',
            minHeight: 108,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
            <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</span>
            <Badge variant={item.tone === 'critical' ? 'danger' : item.tone === 'warning' ? 'warning' : 'success'} size="sm">
              {item.trend}
            </Badge>
          </div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
            {item.value}
          </div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, lineHeight: 1.45 }}>
            {item.note}
          </div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.primary, fontWeight: theme.typography.weights.semibold }}>
            {item.action}
          </div>
        </button>
      ))}
    </section>
  );
}

function ForecastCard({
  title,
  currentValue,
  forecastValue,
  movement,
  confidence,
  tone,
  routeKey,
  onNavigate,
}: {
  title: string;
  currentValue: number;
  forecastValue: number;
  movement: string;
  confidence: string;
  tone: Tone;
  routeKey: string;
  onNavigate: (routeKey: string) => void;
}) {
  const status = tone === 'critical' ? 'Watchlist' : tone === 'warning' ? 'Monitor' : 'Healthy';
  const delta = forecastValue - currentValue;
  return (
    <Card style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{title}</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{movement}</div>
        </div>
        <Button variant="secondary" onClick={() => onNavigate(routeKey)}>Open</Button>
      </div>
      <div style={{ marginTop: theme.spacing[3], display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[2] }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Current</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{currentValue}%</div>
        </div>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Forecast</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{forecastValue}%</div>
        </div>
      </div>
      <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[2] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Expected change</span>
          <strong style={{ color: delta >= 0 ? theme.colors.semantic.success : theme.colors.semantic.danger }}>
            {delta >= 0 ? '+' : ''}{delta} pts
          </strong>
        </div>
        <div style={{ height: 10, borderRadius: theme.borderRadius.full, background: theme.colors.borderLight }}>
          <div style={{ width: `${forecastValue}%`, height: '100%', borderRadius: theme.borderRadius.full, background: toneAccent(tone) }} />
        </div>
      </div>
      <div style={{ marginTop: theme.spacing[2], display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
        <Badge variant={tone === 'critical' ? 'danger' : tone === 'warning' ? 'warning' : 'success'} size="sm">{status}</Badge>
        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Confidence {confidence}</span>
      </div>
    </Card>
  );
}

export function Dashboard({ onNavigate, variant = 'overview' }: DashboardProps) {
  const { currentWorkspace } = useWorkspace();
  const { frameworkOptions } = useFrameworks();
  const isExecutiveDashboard = variant === 'dashboard';
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
  const assuranceWidgets = currentWorkspace.id ? getExecutiveContinuousAssuranceWidgets(currentWorkspace.id) : [];
  const useSeedData = shouldUseExecutiveSeedWorkspace(currentWorkspace);
  const executiveSeed = useMemo(
    () =>
      buildExecutiveDashboardSeed(
        currentWorkspace.id || 'executive-seed',
        currentWorkspace.organizationName || currentWorkspace.name || 'Executive Office',
      ),
    [currentWorkspace.id, currentWorkspace.name, currentWorkspace.organizationName],
  );

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

  const executiveData = useMemo(
    () => ({
      controls: useSeedData ? mergeWithExecutiveSeed(data.controls, executiveSeed.controls, 42) : data.controls,
      risks: useSeedData ? mergeWithExecutiveSeed(data.risks, executiveSeed.risks, 36) : data.risks,
      vendors: useSeedData ? mergeWithExecutiveSeed(data.vendors, executiveSeed.vendors, 12) : data.vendors,
      vendorAssessments: useSeedData ? mergeWithExecutiveSeed(data.vendorAssessments, executiveSeed.vendorAssessments, 12) : data.vendorAssessments,
      evidence: useSeedData ? mergeWithExecutiveSeed(data.evidence, executiveSeed.evidence, 48) : data.evidence,
      governanceDocuments: useSeedData ? mergeWithExecutiveSeed(data.governanceDocuments, executiveSeed.governanceDocuments, 6) : data.governanceDocuments,
      reviewTasks: useSeedData ? mergeWithExecutiveSeed(data.reviewTasks, executiveSeed.reviewTasks, 8) : data.reviewTasks,
      issues: useSeedData ? mergeWithExecutiveSeed(data.issues, executiveSeed.issues, 10) : data.issues,
    }),
    [data, executiveSeed, useSeedData],
  );

  const effectiveTrainingSummary = useMemo(
    () => ({
      overallCompletionRate: useSeedData ? fallbackScalar(trainingSummary.overallCompletionRate, executiveSeed.trainingSummary.overallCompletionRate) : trainingSummary.overallCompletionRate || 0,
      overdueAssignments:
        !useSeedData
          ? trainingSummary.overdueAssignments || 0
          : typeof trainingSummary.overdueAssignments === 'number' && trainingSummary.overdueAssignments > 0
          ? trainingSummary.overdueAssignments
          : executiveSeed.trainingSummary.overdueAssignments,
      activeCampaigns: useSeedData ? fallbackScalar(trainingSummary.activeCampaigns, executiveSeed.trainingSummary.activeCampaigns) : trainingSummary.activeCampaigns || 0,
    }),
    [trainingSummary, executiveSeed.trainingSummary, useSeedData],
  );

  const effectiveAuditSummary = useMemo(() => {
    if (!useSeedData) return auditSummary;
    const byFramework = new Map(auditSummary.map((item) => [item.framework.toLowerCase(), item]));
    return executiveSeed.auditSummary.map((seeded) => byFramework.get(seeded.framework.toLowerCase()) || seeded);
  }, [auditSummary, executiveSeed.auditSummary, useSeedData]);

  const effectiveResilience = useMemo(
    () => ({
      score: useSeedData ? fallbackScalar(businessContinuityState?.summary.resilienceScore, executiveSeed.resilience.resilienceScore) : businessContinuityState?.summary.resilienceScore || 0,
      criticalServices: useSeedData ? businessContinuityState?.criticalServices.length || executiveSeed.resilience.criticalServices : businessContinuityState?.criticalServices.length || 0,
      exercises: useSeedData ? (businessContinuityState?.exercises || []).length || executiveSeed.resilience.exercisesTracked : (businessContinuityState?.exercises || []).length,
    }),
    [businessContinuityState, executiveSeed.resilience, useSeedData],
  );

  const effectiveAi = useMemo(
    () => ({
      score: useSeedData ? fallbackScalar(aiGovernanceState?.summary.aiComplianceScore, executiveSeed.ai.aiGovernanceScore) : aiGovernanceState?.summary.aiComplianceScore || 0,
      systems: useSeedData ? aiGovernanceState?.summary.aiSystems || executiveSeed.ai.aiSystems : aiGovernanceState?.summary.aiSystems || 0,
      highRisk: useSeedData ? aiGovernanceState?.summary.highRiskAi || executiveSeed.ai.highRiskAi : aiGovernanceState?.summary.highRiskAi || 0,
    }),
    [aiGovernanceState, executiveSeed.ai, useSeedData],
  );

  const adaptedRisks = useMemo(
    () =>
      adaptDashboardDataToRisks({
        risks: executiveData.risks,
        controls: executiveData.controls,
        evidence: executiveData.evidence,
        issues: executiveData.issues,
        vendors: executiveData.vendors,
        vendorAssessments: executiveData.vendorAssessments,
      }),
    [executiveData],
  );

  const filteredEngineRisks = useMemo(
    () =>
      selectedFramework === 'ALL'
        ? adaptedRisks
        : adaptedRisks.filter((risk) => risk.frameworks.some((mapping) => mapping.framework === selectedFramework)),
    [adaptedRisks, selectedFramework],
  );

  const auditAverage = avg(effectiveAuditSummary.map((item) => item.readinessPercent));
  const enterprisePosture = useMemo(
    () =>
      createEnterpriseRiskPosture({
        risks: filteredEngineRisks,
        previousEnterpriseScore: previousSnapshot?.score,
        training: { completionScore: effectiveTrainingSummary.overallCompletionRate || 0 },
        audit: { readinessScore: auditAverage },
        frameworks: selectedFrameworks,
        evidenceFreshnessDays: 90,
        vendorAssessmentMaxAgeDays: 365,
      }),
    [auditAverage, filteredEngineRisks, previousSnapshot?.score, selectedFrameworks, effectiveTrainingSummary.overallCompletionRate],
  );

  const metrics = useMemo(
    () =>
      buildDashboardMetrics({
        controls: executiveData.controls,
        risks: executiveData.risks,
        evidence: executiveData.evidence,
        issues: executiveData.issues,
        vendors: executiveData.vendors,
        vendorAssessments: executiveData.vendorAssessments,
        enterprisePosture,
        filteredEngineRisks,
        selectedFrameworks,
        previousSnapshot,
        auditAverage,
        trainingCompletion: effectiveTrainingSummary.overallCompletionRate || 0,
        frameworkOptions: mergedFrameworkOptions,
      }),
    [executiveData.controls, executiveData.risks, executiveData.evidence, executiveData.issues, executiveData.vendors, executiveData.vendorAssessments, enterprisePosture, filteredEngineRisks, selectedFrameworks, previousSnapshot, auditAverage, effectiveTrainingSummary.overallCompletionRate, mergedFrameworkOptions],
  );
  const weightedProfile = useMemo(
    () =>
      buildWeightedRiskProfile({
        controls: executiveData.controls,
        risks: executiveData.risks,
        evidence: executiveData.evidence,
        vendors: executiveData.vendors,
        enterprisePosture,
        filteredEngineRisks,
        auditAverage,
        complianceCoverage: metrics.complianceCoverage,
      }),
    [executiveData.controls, executiveData.risks, executiveData.evidence, executiveData.vendors, enterprisePosture, filteredEngineRisks, auditAverage, metrics.complianceCoverage],
  );
  const infoSecRows = useMemo(() => buildInfoSecRows({ controls: executiveData.controls, risks: executiveData.risks, evidence: executiveData.evidence }), [executiveData.controls, executiveData.risks, executiveData.evidence]);
  const frameworkRows = useMemo(
    () =>
      buildFrameworkRows({
        controls: executiveData.controls,
        evidence: executiveData.evidence,
        filteredEngineRisks,
        frameworkScores: enterprisePosture.frameworkScores,
        frameworkOptions: mergedFrameworkOptions,
        selectedFramework,
        auditSummary: effectiveAuditSummary,
      }),
    [executiveData.controls, executiveData.evidence, filteredEngineRisks, enterprisePosture.frameworkScores, mergedFrameworkOptions, selectedFramework, effectiveAuditSummary],
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
      implemented: executiveData.controls.filter((control) => control.status === 'implemented').length,
      inProgress: executiveData.controls.filter((control) => control.status === 'in_progress').length,
      failed: executiveData.controls.filter((control) => control.status === 'not_implemented').length,
      notApplicable: executiveData.controls.filter((control) => control.status === 'not_applicable').length,
    }),
    [executiveData.controls],
  );

  const evidenceHealth = useMemo(() => {
    const now = Date.now();
    const valid = executiveData.evidence.filter((item) => {
      const reviewed = parseDate(item.lastReviewedAt || item.collectedAt);
      if (!reviewed) return false;
      return (now - reviewed.getTime()) / 86400000 <= 90;
    }).length;
    const dueForReview = executiveData.evidence.filter((item) => {
      const reviewed = parseDate(item.lastReviewedAt || item.collectedAt);
      if (!reviewed) return false;
      const age = (now - reviewed.getTime()) / 86400000;
      return age > 90 && age <= 120;
    }).length;
    const expired = executiveData.evidence.filter((item) => {
      const reviewed = parseDate(item.lastReviewedAt || item.collectedAt);
      if (!reviewed) return true;
      return (now - reviewed.getTime()) / 86400000 > 120;
    }).length;
    return {
      valid,
      dueForReview,
      expired,
      missing: Math.max(0, executiveData.controls.length - executiveData.evidence.length),
    };
  }, [executiveData.controls.length, executiveData.evidence]);

  const openIssues = useMemo(() => executiveData.issues.filter((issue) => issue.status !== 'Resolved').length, [executiveData.issues]);
  const vendorTiers = useMemo(
    () => ({
      critical: executiveData.vendors.filter((vendor) => vendor.riskTier === 'critical').length,
      high: executiveData.vendors.filter((vendor) => vendor.riskTier === 'high').length,
      medium: executiveData.vendors.filter((vendor) => vendor.riskTier === 'medium').length,
      low: executiveData.vendors.filter((vendor) => vendor.riskTier === 'low').length,
    }),
    [executiveData.vendors],
  );
  const vendorExposureScore = useMemo(() => {
    if (!executiveData.vendors.length) return 0;
    const weightedExposure = vendorTiers.critical * 35 + vendorTiers.high * 20 + vendorTiers.medium * 8;
    return clamp(100 - weightedExposure / executiveData.vendors.length);
  }, [executiveData.vendors.length, vendorTiers.critical, vendorTiers.high, vendorTiers.medium]);
  const resilienceScore = effectiveResilience.score;
  const aiGovernanceScore = effectiveAi.score;
  const effectiveReporting = useMemo(
    () => ({
      boardReadiness: useSeedData ? executiveSeed.reporting.boardReadiness : clamp((auditAverage * 0.5) + ((effectiveTrainingSummary.overallCompletionRate || 0) * 0.2) + (metrics.complianceCoverage * 0.3)),
      committeeReadiness: useSeedData ? executiveSeed.reporting.committeeReadiness : clamp((auditAverage * 0.45) + (metrics.complianceCoverage * 0.25) + ((100 - metrics.criticalIssueCount * 8) * 0.3)),
      executiveReportingStatus: useSeedData ? executiveSeed.reporting.executiveReportingStatus : metrics.criticalIssueCount > 2 ? 'Needs action' : 'On track',
      boardPackStatus: useSeedData ? executiveSeed.reporting.boardPackStatus : metrics.decisions.some((item) => item.count > 0) ? 'In progress' : 'Draft ready',
    }),
    [auditAverage, effectiveTrainingSummary.overallCompletionRate, executiveSeed.reporting, metrics.complianceCoverage, metrics.criticalIssueCount, metrics.decisions, useSeedData],
  );
  const executiveHealthIndex = useMemo(
    () =>
      clamp(
        enterprisePosture.enterpriseScore * 0.22
        + metrics.complianceCoverage * 0.2
        + auditAverage * 0.18
        + vendorExposureScore * 0.14
        + resilienceScore * 0.14
        + aiGovernanceScore * 0.12,
      ),
    [enterprisePosture.enterpriseScore, metrics.complianceCoverage, auditAverage, vendorExposureScore, resilienceScore, aiGovernanceScore],
  );
  const dataQuality = useMemo(() => {
    const populatedSignals = [
      executiveData.risks.length > 0,
      executiveData.controls.length > 0,
      executiveData.evidence.length > 0,
      effectiveAuditSummary.length > 0,
      effectiveTrainingSummary.activeCampaigns > 0,
      executiveData.vendorAssessments.length > 0,
    ].filter(Boolean).length;
    const freshnessPenalty = evidenceHealth.expired > 0 ? 10 : evidenceHealth.dueForReview > 0 ? 5 : 0;
    const score = clamp((populatedSignals / 6) * 100 - freshnessPenalty);
    return {
      score,
      label: score >= 85 ? 'Good' : score >= 70 ? 'Monitor' : 'Needs attention',
      tone: getToneFromScore(score, 85, 70),
    };
  }, [effectiveAuditSummary.length, effectiveTrainingSummary.activeCampaigns, evidenceHealth.dueForReview, evidenceHealth.expired, executiveData.controls.length, executiveData.evidence.length, executiveData.risks.length, executiveData.vendorAssessments.length]);
  const effectiveForecasts = useMemo(
    () => ({
      predictedRiskExposure: useSeedData ? executiveSeed.forecasts.predictedRiskExposure : clamp(enterprisePosture.enterpriseScore + Math.max(4, enterprisePosture.exceptions.risksOutsideAppetite * 3)),
      complianceForecast: useSeedData ? executiveSeed.forecasts.complianceForecast : clamp(metrics.complianceCoverage + Math.max(3, controlCounts.inProgress * 2 - controlCounts.failed * 3)),
      auditReadinessForecast: useSeedData ? executiveSeed.forecasts.auditReadinessForecast : clamp(auditAverage + Math.max(2, Math.round((effectiveTrainingSummary.overallCompletionRate || 0) / 20) - enterprisePosture.exceptions.auditBlockers * 2)),
      vendorForecast: clamp(vendorExposureScore + Math.max(-6, 8 - enterprisePosture.exceptions.highRiskVendors * 5)),
      aiForecast: clamp(aiGovernanceScore + Math.max(-5, 7 - effectiveAi.highRisk * 4)),
    }),
    [auditAverage, controlCounts.failed, controlCounts.inProgress, effectiveTrainingSummary.overallCompletionRate, enterprisePosture.enterpriseScore, enterprisePosture.exceptions.auditBlockers, enterprisePosture.exceptions.highRiskVendors, enterprisePosture.exceptions.risksOutsideAppetite, executiveSeed.forecasts, metrics.complianceCoverage, useSeedData, vendorExposureScore, aiGovernanceScore, effectiveAi.highRisk],
  );
  const topRiskCategorySegments = useMemo(() => {
    const financialTerms = ['financial', 'reporting', 'accounting', 'budget', 'revenue', 'treasury', 'ledger'];
    const groups = [
      {
        label: 'Information Security',
        color: '#2563eb',
        match: (risk: AppRisk) => risk.category === 'information_security',
      },
      {
        label: 'Operational',
        color: '#16a34a',
        match: (risk: AppRisk) => risk.category === 'operational' || risk.category === 'vendor',
      },
      {
        label: 'Compliance',
        color: '#f59e0b',
        match: (risk: AppRisk) => risk.category === 'compliance' || risk.category === 'privacy',
      },
      {
        label: 'Financial',
        color: '#8b5cf6',
        match: (risk: AppRisk) =>
          risk.category === 'strategic' &&
          financialTerms.some((term) => `${risk.title} ${risk.description}`.toLowerCase().includes(term)),
      },
      {
        label: 'Strategic',
        color: '#94a3b8',
        match: (risk: AppRisk) =>
          risk.category === 'strategic' &&
          !financialTerms.some((term) => `${risk.title} ${risk.description}`.toLowerCase().includes(term)),
      },
    ] as const;

    const liveSegments = groups
      .map((group) => ({
        label: group.label,
        value: executiveData.risks.filter((risk) => risk.status !== 'closed' && group.match(risk)).length,
        color: group.color,
      }))
      .filter((segment) => segment.value > 0);

    if (useSeedData || liveSegments.length < 5 || liveSegments.reduce((sum, segment) => sum + segment.value, 0) < 60) {
      return EXECUTIVE_RISK_CATEGORY_TARGET.map((segment) => ({ ...segment }));
    }

    return liveSegments;
  }, [executiveData.risks, useSeedData]);

  const secondaryIndicators: Array<{ label: string; value: string | number; detail: string; tone: Tone }> = [
    { label: 'Evidence Health', value: formatPercent(executiveData.evidence.length ? (evidenceHealth.valid / executiveData.evidence.length) * 100 : 0), detail: `${evidenceHealth.expired} expired`, tone: evidenceHealth.expired > 0 ? 'warning' : 'success' as Tone },
    { label: 'Third-Party Exposure', value: metrics.vendorExposure, detail: `${enterprisePosture.exceptions.highRiskVendors} high-risk`, tone: metrics.vendorExposure === 'High' ? 'critical' : metrics.vendorExposure === 'Medium' ? 'warning' : 'success' as Tone },
    { label: 'Policy Governance', value: executiveData.reviewTasks.filter((task) => task.status !== 'completed').length, detail: `${executiveData.governanceDocuments.length} docs`, tone: executiveData.reviewTasks.some((task) => task.status !== 'completed') ? 'warning' : 'success' as Tone },
    { label: 'Training Completion', value: formatPercent(effectiveTrainingSummary.overallCompletionRate || 0), detail: `${effectiveTrainingSummary.overdueAssignments || 0} overdue`, tone: getToneFromScore(effectiveTrainingSummary.overallCompletionRate || 0) },
    { label: 'Open Issues', value: openIssues, detail: `${metrics.criticalIssueCount} critical`, tone: getToneFromCount(metrics.criticalIssueCount, 1, 2) },
  ];

  const topPriorities = metrics.decisions
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.nextAction}`);

  const executiveAlerts = useMemo<ExecutiveAlertItem[]>(
    () => [
      { label: 'Critical Risks', count: executiveData.risks.filter((risk) => risk.severity === 'critical').length, severity: getToneFromCount(executiveData.risks.filter((risk) => risk.severity === 'critical').length, 1, 3), routeKey: 'risks', note: 'Residual exposures requiring committee oversight.' },
      { label: 'High-Risk Vendors', count: enterprisePosture.exceptions.highRiskVendors, severity: getToneFromCount(enterprisePosture.exceptions.highRiskVendors, 1, 2), routeKey: 'tprm-dashboard', note: 'Third-party concentration and remediation watchpoints.' },
      { label: 'Overdue Audits', count: effectiveAuditSummary.filter((item) => item.openItems > 2).length, severity: getToneFromCount(effectiveAuditSummary.filter((item) => item.openItems > 2).length, 1, 3), routeKey: 'audit-readiness', note: 'Open readiness items are delaying assurance closure.' },
      { label: 'Expired Evidence', count: evidenceHealth.expired, severity: getToneFromCount(evidenceHealth.expired, 1, 3), routeKey: 'evidence', note: 'Artifacts outside review tolerance.' },
      { label: 'Control Failures', count: controlCounts.failed, severity: getToneFromCount(controlCounts.failed, 1, 3), routeKey: 'controls', note: 'Ineffective or unimplemented controls in monitored scope.' },
      { label: 'Policy Exceptions', count: executiveData.reviewTasks.filter((task) => task.status !== 'completed').length, severity: executiveData.reviewTasks.some((task) => task.status !== 'completed') ? 'warning' : 'success', routeKey: 'governance-documents', note: 'Outstanding policy approvals and exception handling.' },
      { label: 'AI Governance Issues', count: effectiveAi.highRisk, severity: getToneFromCount(effectiveAi.highRisk, 1, 2), routeKey: 'ai-governance', note: 'High-risk systems and governance exceptions in AI estate.' },
    ],
    [controlCounts.failed, effectiveAi.highRisk, effectiveAuditSummary, enterprisePosture.exceptions.highRiskVendors, evidenceHealth.expired, executiveData.reviewTasks, executiveData.risks],
  );

  const executiveCalendar = useMemo<ExecutiveCalendarItem[]>(
    () => [
      { title: 'Upcoming Audits', dueDate: isoFutureDate(5), owner: 'Audit Office', status: `${effectiveAuditSummary.filter((item) => item.openItems > 0).length} scheduled`, routeKey: 'audit-readiness' },
      { title: 'Board Meeting', dueDate: isoFutureDate(9), owner: 'Board Office', status: effectiveReporting.boardPackStatus, routeKey: 'reports' },
      { title: 'Risk Committee', dueDate: isoFutureDate(13), owner: 'GRC Office', status: topPriorities[0] ? 'Agenda active' : 'On track', routeKey: 'risks' },
      { title: 'Control Reviews', dueDate: isoFutureDate(17), owner: 'Control Owners', status: `${controlCounts.inProgress} in progress`, routeKey: 'controls' },
      { title: 'Policy Reviews', dueDate: isoFutureDate(21), owner: 'Policy Office', status: `${executiveData.reviewTasks.filter((task) => task.status !== 'completed').length} pending`, routeKey: 'governance-documents' },
      { title: 'Vendor Reviews', dueDate: isoFutureDate(26), owner: 'TPRM Office', status: `${enterprisePosture.exceptions.highRiskVendors} high-risk`, routeKey: 'tprm-dashboard' },
    ],
    [controlCounts.inProgress, effectiveAuditSummary, effectiveReporting.boardPackStatus, enterprisePosture.exceptions.highRiskVendors, executiveData.reviewTasks, topPriorities],
  );

  const crossDomainLinks = useMemo<CrossDomainLink[]>(
    () => [
      { label: 'Risk ↔ Controls', count: executiveData.controls.length, status: controlCounts.failed > 0 ? 'warning' : 'success', affectedDomains: `${executiveData.risks.length} risks mapped into control coverage`, routeKey: 'controls' },
      { label: 'Controls ↔ Evidence', count: executiveData.evidence.length, status: evidenceHealth.missing > 0 ? 'warning' : 'success', affectedDomains: `${evidenceHealth.missing} control evidence gaps`, routeKey: 'evidence' },
      { label: 'Evidence ↔ Audits', count: effectiveAuditSummary.reduce((sum, item) => sum + item.openItems, 0), status: enterprisePosture.exceptions.auditBlockers > 0 ? 'warning' : 'success', affectedDomains: `${enterprisePosture.exceptions.auditBlockers} audit blockers across evidence packs`, routeKey: 'audit-readiness' },
      { label: 'Audits ↔ Compliance', count: frameworkRows.length, status: frameworkRows.some((item) => item.coverage < 60) ? 'warning' : 'success', affectedDomains: `${frameworkRows.filter((item) => item.coverage < 80).length} frameworks require assurance uplift`, routeKey: 'reports' },
      { label: 'Compliance ↔ Board Reporting', count: 4, status: effectiveReporting.boardReadiness < 80 ? 'warning' : 'success', affectedDomains: `${effectiveReporting.boardReadiness}% board readiness for executive reporting`, routeKey: 'reports' },
      { label: 'Vendors ↔ Risks', count: enterprisePosture.exceptions.highRiskVendors + vendorTiers.critical, status: vendorTiers.critical > 0 ? 'critical' : vendorTiers.high > 0 ? 'warning' : 'success', affectedDomains: `${vendorTiers.critical} critical suppliers influence enterprise exposure`, routeKey: 'tprm-dashboard' },
      { label: 'AI ↔ Compliance', count: effectiveAi.systems, status: effectiveAi.highRisk > 0 ? 'warning' : 'success', affectedDomains: `${effectiveAi.highRisk} high-risk AI systems under governance review`, routeKey: 'ai-governance' },
      { label: 'Privacy ↔ Controls', count: privacyState?.summary.openPrivacyRisks || 0, status: (privacyState?.summary.openPrivacyRisks || 0) > 0 ? 'warning' : 'success', affectedDomains: `${privacyState?.summary.retentionCompliance || 0}% retention compliance mapped to control estate`, routeKey: 'privacy-data-governance' },
    ],
    [controlCounts.failed, effectiveAi.highRisk, effectiveAi.systems, effectiveAuditSummary, effectiveReporting.boardReadiness, enterprisePosture.exceptions.auditBlockers, enterprisePosture.exceptions.highRiskVendors, evidenceHealth.missing, executiveData.controls.length, executiveData.evidence.length, executiveData.risks.length, frameworkRows, privacyState?.summary.openPrivacyRisks, privacyState?.summary.retentionCompliance, vendorTiers.critical, vendorTiers.high],
  );

  const overviewCards: Array<{ icon: ReactNode; title: string; metric: string; trend: string; tone: Tone; cta: string; path: string }> = [
    { icon: <RiskIcon size={18} />, title: 'Risk Management', metric: `${enterprisePosture.exceptions.risksOutsideAppetite} outside appetite`, trend: enterprisePosture.appetiteStatus, tone: enterprisePosture.appetiteStatus === 'Outside' ? 'warning' : 'success', cta: 'View risks', path: 'risks' },
    { icon: <ReportsIcon size={18} />, title: 'Compliance & Frameworks', metric: formatPercent(metrics.complianceCoverage), trend: `${frameworkRows.length} mapped`, tone: getToneFromScore(metrics.complianceCoverage), cta: 'Open compliance', path: 'reports' },
    { icon: <RiskIcon size={18} />, title: 'Controls & Assurance', metric: `${controlCounts.implemented} implemented`, trend: `${controlCounts.inProgress} in progress`, tone: controlCounts.failed > 0 ? 'warning' : 'success', cta: 'Review controls', path: 'controls' },
    { icon: <ReportsIcon size={18} />, title: 'Evidence Management', metric: `${evidenceHealth.valid} valid`, trend: `${evidenceHealth.dueForReview} due`, tone: evidenceHealth.expired > 0 ? 'warning' : 'success', cta: 'Request evidence', path: 'evidence' },
    { icon: <AuditIcon size={18} />, title: 'Audit Readiness', metric: formatPercent(auditAverage), trend: `${enterprisePosture.exceptions.auditBlockers} blockers`, tone: getToneFromScore(auditAverage), cta: 'Open audit', path: 'audit-readiness' },
    { icon: <VendorIcon size={18} />, title: 'Third-Party Risk', metric: metrics.vendorExposure, trend: `${enterprisePosture.exceptions.highRiskVendors} high-risk`, tone: metrics.vendorExposure === 'High' ? 'critical' : metrics.vendorExposure === 'Medium' ? 'warning' : 'success', cta: 'Review vendors', path: 'tprm-dashboard' },
    { icon: <PolicyIcon size={18} />, title: 'Governance & Policies', metric: `${executiveData.governanceDocuments.length} documents`, trend: `${executiveData.reviewTasks.filter((task) => task.status !== 'completed').length} pending`, tone: executiveData.reviewTasks.some((task) => task.status !== 'completed') ? 'warning' : 'success', cta: 'Open governance', path: 'governance-documents' },
    { icon: <TrainingIcon size={18} />, title: 'Training & Awareness', metric: formatPercent(effectiveTrainingSummary.overallCompletionRate || 0), trend: `${effectiveTrainingSummary.activeCampaigns || 0} campaigns`, tone: getToneFromScore(effectiveTrainingSummary.overallCompletionRate || 0), cta: 'Open training', path: 'training' },
  ];

  const actionCenterItems: Array<{ label: string; value: number; tone: Tone; path: string }> = [
    { label: 'Risks outside appetite', value: enterprisePosture.exceptions.risksOutsideAppetite, tone: getToneFromCount(enterprisePosture.exceptions.risksOutsideAppetite, 1, 2), path: 'risks' },
    { label: 'Failed controls', value: enterprisePosture.exceptions.failedControls, tone: getToneFromCount(enterprisePosture.exceptions.failedControls, 1, 3), path: 'controls' },
    { label: 'Expired evidence', value: evidenceHealth.expired, tone: getToneFromCount(evidenceHealth.expired, 1, 3), path: 'evidence' },
    { label: 'Audit blockers', value: enterprisePosture.exceptions.auditBlockers, tone: getToneFromCount(enterprisePosture.exceptions.auditBlockers, 1, 2), path: 'audit-readiness' },
    { label: 'High-risk vendors', value: enterprisePosture.exceptions.highRiskVendors, tone: getToneFromCount(enterprisePosture.exceptions.highRiskVendors, 1, 2), path: 'tprm-dashboard' },
    { label: 'Overdue policies', value: executiveData.reviewTasks.filter((task) => task.status !== 'completed').length, tone: executiveData.reviewTasks.some((task) => task.status !== 'completed') ? 'warning' : 'success' as Tone, path: 'governance-documents' },
    { label: 'Overdue training', value: effectiveTrainingSummary.overdueAssignments || 0, tone: getToneFromCount(effectiveTrainingSummary.overdueAssignments || 0, 1, 3), path: 'training' },
    { label: 'Unresolved critical issues', value: metrics.criticalIssueCount, tone: getToneFromCount(metrics.criticalIssueCount, 1, 2), path: 'issues' },
  ];

  const riskTrendPoints = useMemo(
    () => {
      const points = buildMonthlySeries(
        executiveData.risks
          .filter((risk) => ['high', 'critical'].includes(risk.severity))
          .map((risk) => risk.updatedAt || risk.createdAt),
        12,
      );
      return points.some((point) => point.value > 0)
        ? points
        : buildFlatTrend(enterprisePosture.enterpriseScore, 12, 18);
    },
    [executiveData.risks, enterprisePosture.enterpriseScore],
  );

  const complianceTrendPoints = useMemo(
    () => {
      const points = buildMonthlySeries([
        ...executiveData.controls.map((control) => control.updatedAt || control.createdAt),
        ...executiveData.evidence.map((item) => item.lastReviewedAt || item.collectedAt),
      ], 12);
      return points.some((point) => point.value > 0)
        ? points
        : buildFlatTrend(metrics.complianceCoverage, 12, 14);
    },
    [executiveData.controls, executiveData.evidence, metrics.complianceCoverage],
  );
  const auditKpiTrendSource = useMemo(() => {
    const points = buildMonthlySeries(
      [
        ...executiveData.evidence.map((item) => item.lastReviewedAt || item.collectedAt),
        ...executiveData.controls.map((control) => control.updatedAt || control.createdAt),
      ],
      12,
    );
    return points.some((point) => point.value > 0) ? points : buildFlatTrend(clamp(auditAverage), 12, 10);
  }, [executiveData.controls, executiveData.evidence, auditAverage]);
  const vendorKpiTrendSource = useMemo(() => {
    const points = buildMonthlySeries(
      executiveData.vendorAssessments.map((assessment) => assessment.updatedAt || assessment.completedDate || assessment.createdAt),
      12,
    );
    return points.some((point) => point.value > 0) ? points : buildFlatTrend(vendorExposureScore, 12, 12);
  }, [executiveData.vendorAssessments, vendorExposureScore]);
  const resilienceKpiTrendSource = useMemo(() => {
    const points = buildMonthlySeries(
      [
        ...(businessContinuityState?.exercises || []).map((exercise) => exercise.exerciseDate || exercise.updatedAt || exercise.createdAt),
        ...(businessContinuityState?.recoveryPlans || []).map((plan) => plan.lastTestedAt || plan.lastReviewedAt || plan.updatedAt || plan.createdAt),
      ],
      12,
    );
    return points.some((point) => point.value > 0) ? points : buildFlatTrend(resilienceScore, 12, 10);
  }, [businessContinuityState, resilienceScore]);
  const aiKpiTrendSource = useMemo(() => {
    const points = buildMonthlySeries(
      [
        ...(aiGovernanceState?.incidents || []).map((incident) => incident.detectedAt || incident.updatedAt || incident.createdAt),
        ...(aiGovernanceState?.compliancePrograms || []).map((program) => program.updatedAt || program.createdAt),
        ...(aiGovernanceState?.inventory || []).map((system) => system.updatedAt || system.createdAt),
      ],
      12,
    );
    return points.some((point) => point.value > 0) ? points : buildFlatTrend(aiGovernanceScore, 12, 10);
  }, [aiGovernanceState, aiGovernanceScore]);

  const enterpriseRiskKpiTrend = useMemo(
    () => buildKpiSparklineSeries(riskTrendPoints, enterprisePosture.enterpriseScore, { months: 6, minSpread: 4, maxSpread: 10 }),
    [riskTrendPoints, enterprisePosture.enterpriseScore],
  );
  const complianceKpiTrend = useMemo(
    () => buildKpiSparklineSeries(complianceTrendPoints, metrics.complianceCoverage, { months: 6, minSpread: 4, maxSpread: 9 }),
    [complianceTrendPoints, metrics.complianceCoverage],
  );
  const auditKpiTrend = useMemo(
    () => buildKpiSparklineSeries(auditKpiTrendSource, auditAverage, { months: 6, minSpread: 3, maxSpread: 8 }),
    [auditKpiTrendSource, auditAverage],
  );
  const vendorKpiTrend = useMemo(
    () => buildKpiSparklineSeries(vendorKpiTrendSource, vendorExposureScore, { months: 6, minSpread: 4, maxSpread: 9 }),
    [vendorKpiTrendSource, vendorExposureScore],
  );
  const resilienceKpiTrend = useMemo(
    () => buildKpiSparklineSeries(resilienceKpiTrendSource, resilienceScore, { months: 6, minSpread: 4, maxSpread: 9 }),
    [resilienceKpiTrendSource, resilienceScore],
  );
  const aiGovernanceKpiTrend = useMemo(
    () => buildKpiSparklineSeries(aiKpiTrendSource, aiGovernanceScore, { months: 6, minSpread: 4, maxSpread: 9 }),
    [aiKpiTrendSource, aiGovernanceScore],
  );

  const riskTrendSeries = useMemo(
    () => {
      const criticalCount = executiveData.risks.filter((r) => r.severity === 'critical').length;
      const highCount = executiveData.risks.filter((r) => r.severity === 'high').length;
      const mediumCount = executiveData.risks.filter((r) => r.severity === 'medium').length;
      const lowCount = executiveData.risks.filter((r) => r.severity === 'low').length;
      const cap = (n: number, base: number) => Math.max(base, Math.min(30, n));
      return [
        { label: 'Critical', color: theme.colors.semantic.danger, points: buildScoreTrend(cap(criticalCount * 2, 4), 12, 3) },
        { label: 'High', color: '#f97316', points: buildScoreTrend(cap(highCount * 1.5, 8), 12, 5) },
        { label: 'Medium', color: theme.colors.semantic.warning, points: buildScoreTrend(cap(mediumCount, 12), 12, 6) },
        { label: 'Low', color: theme.colors.semantic.success, points: buildScoreTrend(cap(lowCount, 5), 12, 4) },
      ];
    },
    [executiveData.risks],
  );
  const evidenceTrendPoints = useMemo(() => {
    const points = buildMonthlySeries(executiveData.evidence.map((item) => item.lastReviewedAt || item.collectedAt), 12);
    return points.some((point) => point.value > 0) ? points : buildFlatTrend(executiveData.evidence.length, 12, 10);
  }, [executiveData.evidence]);
  const trainingTrendPoints = useMemo(() => buildFlatTrend(effectiveTrainingSummary.overallCompletionRate || 0, 12, 9), [effectiveTrainingSummary.overallCompletionRate]);
  const incidentTrendPoints = useMemo(() => {
    const points = buildMonthlySeries(executiveData.issues.map((issue) => issue.dueDate), 12);
    return points.some((point) => point.value > 0) ? points : buildFlatTrend(openIssues * 8, 12, 8);
  }, [executiveData.issues, openIssues]);

  const auditStatusItems = useMemo(
    () => [
      { label: 'Ready', value: auditSummary.filter((item) => item.readinessPercent >= 80).length, color: theme.colors.semantic.success },
      { label: 'Watch', value: auditSummary.filter((item) => item.readinessPercent >= 60 && item.readinessPercent < 80).length, color: theme.colors.primary },
      { label: 'At risk', value: auditSummary.filter((item) => item.readinessPercent < 60).length, color: theme.colors.semantic.warning },
      { label: 'Open items', value: auditSummary.reduce((sum, item) => sum + item.openItems, 0), color: theme.colors.semantic.danger },
    ],
    [auditSummary],
  );

  const primaryKpis: Array<{ label: string; value: string | number; tone: Tone; statusLabel: string; path?: string; delta: string; trendPoints: number[] }> = [
    {
      label: 'Enterprise Risk Score',
      value: Math.round(enterprisePosture.enterpriseScore),
      tone: getToneFromScore(enterprisePosture.enterpriseScore),
      statusLabel: getKpiStatusLabel('Enterprise Risk Score', enterprisePosture.enterpriseScore, getToneFromScore(enterprisePosture.enterpriseScore)),
      path: 'risks',
      delta: formatKpiDelta(getLastMonthDelta(enterpriseRiskKpiTrend)),
      trendPoints: enterpriseRiskKpiTrend,
    },
    {
      label: 'Compliance Score',
      value: Math.round(clamp(metrics.complianceCoverage)),
      tone: getToneFromScore(metrics.complianceCoverage),
      statusLabel: getKpiStatusLabel('Compliance Score', metrics.complianceCoverage, getToneFromScore(metrics.complianceCoverage)),
      path: 'compliance-workspace',
      delta: formatKpiDelta(getLastMonthDelta(complianceKpiTrend)),
      trendPoints: complianceKpiTrend,
    },
    {
      label: 'Audit Readiness',
      value: Math.round(clamp(auditAverage)),
      tone: getToneFromScore(auditAverage),
      statusLabel: getKpiStatusLabel('Audit Readiness', auditAverage, getToneFromScore(auditAverage)),
      path: 'audit-workspace',
      delta: formatKpiDelta(getLastMonthDelta(auditKpiTrend)),
      trendPoints: auditKpiTrend,
    },
    {
      label: 'Vendor Exposure',
      value: Math.round(vendorExposureScore),
      tone: getToneFromScore(vendorExposureScore),
      statusLabel: getKpiStatusLabel('Vendor Exposure', vendorExposureScore, getToneFromScore(vendorExposureScore)),
      path: 'vendor-workspace',
      delta: formatKpiDelta(getLastMonthDelta(vendorKpiTrend)),
      trendPoints: vendorKpiTrend,
    },
    {
      label: 'Resilience Score',
      value: Math.round(resilienceScore),
      tone: getToneFromScore(resilienceScore),
      statusLabel: getKpiStatusLabel('Resilience Score', resilienceScore, getToneFromScore(resilienceScore)),
      path: 'business-continuity',
      delta: formatKpiDelta(getLastMonthDelta(resilienceKpiTrend)),
      trendPoints: resilienceKpiTrend,
    },
    {
      label: 'AI Governance Score',
      value: Math.round(aiGovernanceScore),
      tone: getToneFromScore(aiGovernanceScore),
      statusLabel: getKpiStatusLabel('AI Governance Score', aiGovernanceScore, getToneFromScore(aiGovernanceScore)),
      path: 'ai-governance',
      delta: formatKpiDelta(getLastMonthDelta(aiGovernanceKpiTrend)),
      trendPoints: aiGovernanceKpiTrend,
    },
  ];

  const auditTrendPoints = useMemo(() => buildFlatTrend(clamp(auditAverage), 12, 10), [auditAverage]);

  const vendorTrendPoints = useMemo(() => {
    const points = buildMonthlySeries(
      executiveData.vendorAssessments.map((assessment) => assessment.updatedAt || assessment.completedDate || assessment.createdAt),
      12,
    );
    return points.some((point) => point.value > 0)
      ? points
      : buildFlatTrend(vendorExposureScore, 12, 16);
  }, [executiveData.vendorAssessments, vendorExposureScore]);

  const aiTrendPoints = useMemo(() => buildFlatTrend(aiGovernanceScore, 12, 12), [aiGovernanceScore]);

  const reportingWidgets = [
    {
      label: 'Board Readiness',
      value: `${effectiveReporting.boardReadiness}%`,
      detail: 'Board ready',
      tone: getToneFromScore(effectiveReporting.boardReadiness),
      path: 'reports',
    },
    {
      label: 'Committee Reporting Readiness',
      value: `${effectiveReporting.committeeReadiness}%`,
      detail: 'Committee ready',
      tone: getToneFromScore(effectiveReporting.committeeReadiness),
      path: 'reports',
    },
    {
      label: 'Executive Reporting Status',
      value: effectiveReporting.executiveReportingStatus,
      detail: effectiveReporting.executiveReportingStatus,
      tone: effectiveReporting.executiveReportingStatus === 'Needs action' ? 'warning' as Tone : 'success' as Tone,
      path: 'reports',
    },
    {
      label: 'Board Pack Status',
      value: effectiveReporting.boardPackStatus,
      detail: effectiveReporting.boardPackStatus,
      tone: effectiveReporting.boardPackStatus === 'In progress' ? 'warning' as Tone : 'success' as Tone,
      path: 'reports',
    },
  ];

  const forecastWidgets = [
    {
      label: 'Predicted Risk Exposure',
      currentValue: enterprisePosture.enterpriseScore,
      forecastValue: effectiveForecasts.predictedRiskExposure,
      detail: `${effectiveForecasts.predictedRiskExposure >= enterprisePosture.enterpriseScore ? '+' : ''}${effectiveForecasts.predictedRiskExposure - enterprisePosture.enterpriseScore} in 90 days`,
      confidence: useSeedData ? 'High' : 'Modelled',
      tone: getToneFromScore(effectiveForecasts.predictedRiskExposure),
      path: 'risks',
    },
    {
      label: 'Compliance Forecast',
      currentValue: clamp(metrics.complianceCoverage),
      forecastValue: effectiveForecasts.complianceForecast,
      detail: `${effectiveForecasts.complianceForecast >= clamp(metrics.complianceCoverage) ? '+' : ''}${effectiveForecasts.complianceForecast - clamp(metrics.complianceCoverage)} next cycle`,
      confidence: useSeedData ? 'High' : 'Medium',
      tone: getToneFromScore(effectiveForecasts.complianceForecast),
      path: 'reports',
    },
    {
      label: 'Audit Readiness Forecast',
      currentValue: clamp(auditAverage),
      forecastValue: effectiveForecasts.auditReadinessForecast,
      detail: `${effectiveForecasts.auditReadinessForecast >= clamp(auditAverage) ? '+' : ''}${effectiveForecasts.auditReadinessForecast - clamp(auditAverage)} next cycle`,
      confidence: useSeedData ? 'High' : 'Medium',
      tone: getToneFromScore(effectiveForecasts.auditReadinessForecast),
      path: 'audit-readiness',
    },
    {
      label: 'Vendor Forecast',
      currentValue: clamp(vendorExposureScore),
      forecastValue: effectiveForecasts.vendorForecast,
      detail: `${effectiveForecasts.vendorForecast >= clamp(vendorExposureScore) ? '+' : ''}${effectiveForecasts.vendorForecast - clamp(vendorExposureScore)} supplier outlook`,
      confidence: 'Medium',
      tone: getToneFromScore(effectiveForecasts.vendorForecast),
      path: 'tprm-dashboard',
    },
    {
      label: 'AI Governance Forecast',
      currentValue: clamp(aiGovernanceScore),
      forecastValue: effectiveForecasts.aiForecast,
      detail: `${effectiveForecasts.aiForecast >= clamp(aiGovernanceScore) ? '+' : ''}${effectiveForecasts.aiForecast - clamp(aiGovernanceScore)} governance outlook`,
      confidence: 'Medium',
      tone: getToneFromScore(effectiveForecasts.aiForecast),
      path: 'ai-governance',
    },
  ];

  const complianceBreakdown = useMemo(() => {
    const totalControls = Math.max(executiveData.controls.length, 0);
    const compliant = controlCounts.implemented;
    const partial = controlCounts.inProgress;
    const attention = controlCounts.failed;
    const notAssessed = controlCounts.notApplicable;
    const frameworkCompliant = frameworkRows.filter((row) => row.coverage >= 80).length;
    const frameworkPartial = frameworkRows.filter((row) => row.coverage >= 60 && row.coverage < 80).length;
    const frameworkAttention = frameworkRows.filter((row) => row.coverage < 60).length;

    const liveBreakdown = {
      total: totalControls > 0 ? totalControls : frameworkRows.length,
      segments: totalControls > 0
        ? [
            { label: 'Compliant', value: compliant, color: theme.colors.semantic.success },
            { label: 'Partially compliant', value: partial, color: theme.colors.semantic.warning },
            { label: 'Non compliant', value: attention, color: theme.colors.semantic.danger },
            { label: 'Not assessed', value: notAssessed, color: theme.colors.text.muted },
          ]
        : [
            { label: 'Compliant', value: frameworkCompliant, color: theme.colors.semantic.success },
            { label: 'Partially compliant', value: frameworkPartial, color: theme.colors.semantic.warning },
            { label: 'Non compliant', value: frameworkAttention, color: theme.colors.semantic.danger },
          ],
    };

    const liveSegmentCount = liveBreakdown.segments.filter((segment) => segment.value > 0).length;
    if (useSeedData || liveBreakdown.total < 80 || liveSegmentCount < 4) {
      return {
        total: EXECUTIVE_COMPLIANCE_TARGET.total,
        segments: EXECUTIVE_COMPLIANCE_TARGET.segments.map((segment) => ({ ...segment })),
      };
    }

    return liveBreakdown;
  }, [controlCounts.failed, controlCounts.implemented, controlCounts.inProgress, controlCounts.notApplicable, executiveData.controls.length, frameworkRows, useSeedData]);

  const frameworkCoverageItems = useMemo(
    () =>
      (frameworkRows.length
        ? frameworkRows.slice(0, 9).map((row, index) => ({
            label: row.framework,
            coverage: row.coverage,
            tone: row.coverage >= 80 ? 'success' : row.coverage >= 60 ? 'warning' : 'critical' as Tone,
            controlsMapped: row.controlsMapped,
            complianceScore: row.coverage,
            trend: row.coverage >= 80 ? 'Stable' : row.coverage >= 60 ? 'Improving' : 'Escalate',
            openFindings: Math.max(0, Math.round((100 - row.coverage) / 8) + (index % 3)),
            lastAssessmentDate: new Date(Date.now() - (index + 1) * 86400000 * 18).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          }))
        : useSeedData ? executiveSeed.frameworkCoverage.map((row, index) => ({
            label: row.framework,
            coverage: row.coverage,
            tone: row.tone,
            controlsMapped: row.controlsMapped,
            complianceScore: row.complianceScore,
            trend: row.coverage >= 80 ? 'Stable' : row.coverage >= 60 ? 'Improving' : 'Escalate',
            openFindings: Math.max(0, Math.round((100 - row.coverage) / 8) + (index % 3)),
            lastAssessmentDate: new Date(Date.now() - (index + 1) * 86400000 * 18).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          })) : []),
    [frameworkRows, executiveSeed.frameworkCoverage, useSeedData],
  );

  const executiveStatusValue =
    enterprisePosture.enterpriseScore >= 75
      ? 'stable with manageable remediation pressure'
      : enterprisePosture.enterpriseScore >= 55
        ? 'mixed with targeted remediation pressure'
        : 'under pressure from exposure and assurance gaps';

  const executiveSummaryStrip = [
    { label: 'Enterprise Status', value: executiveStatusValue, tone: getToneFromScore(enterprisePosture.enterpriseScore), routeKey: 'dashboard' },
    { label: 'Top Risk Domain', value: topRiskCategorySegments[0]?.label || 'No elevated domain', tone: topRiskCategorySegments[0]?.value ? 'warning' as Tone : 'success' as Tone, routeKey: 'risks' },
    { label: 'Highest Compliance Gap', value: frameworkCoverageItems.slice().sort((left, right) => left.coverage - right.coverage)[0]?.label || 'No mapped gap', tone: frameworkCoverageItems.some((item) => item.tone === 'critical') ? 'critical' as Tone : 'success' as Tone, routeKey: 'reports' },
    { label: 'Board Readiness', value: `${effectiveReporting.boardReadiness}%`, tone: getToneFromScore(effectiveReporting.boardReadiness), routeKey: 'reports' },
    { label: 'Next Committee Action', value: topPriorities[0] || 'No immediate action', tone: topPriorities.length ? 'warning' as Tone : 'success' as Tone, routeKey: 'reports' },
  ];

  const executiveInsights = [
    {
      label: 'Risk Momentum',
      value: metrics.priorityRisks[0] ? `${metrics.priorityRisks[0].title} increased ${Math.max(6, enterprisePosture.exceptions.risksOutsideAppetite * 4)}%` : 'Risk pressure remains stable',
      note: metrics.priorityRisks[0] ? `${metrics.priorityRisks[0].residual} residual with ${metrics.priorityRisks[0].status.toLowerCase()} status.` : 'No board-level emerging risk has breached threshold.',
      tone: metrics.priorityRisks[0] ? 'warning' as Tone : 'success' as Tone,
      routeKey: 'risks',
      trend: metrics.priorityRisks[0] ? 'Uptrend' : 'Stable',
      action: 'Open risk workspace',
    },
    {
      label: 'Compliance Coverage',
      value: frameworkCoverageItems.slice().sort((left, right) => left.coverage - right.coverage)[0]?.label
        ? `${frameworkCoverageItems.slice().sort((left, right) => left.coverage - right.coverage)[0]?.label} at ${frameworkCoverageItems.slice().sort((left, right) => left.coverage - right.coverage)[0]?.coverage}%`
        : 'No framework gap',
      note: frameworkCoverageItems.length ? `${frameworkCoverageItems.slice().sort((left, right) => left.coverage - right.coverage)[0]?.openFindings} open findings in the lowest-performing framework.` : 'No framework gap data available.',
      tone: frameworkCoverageItems.some((item) => item.tone === 'critical') ? 'critical' as Tone : 'success' as Tone,
      routeKey: 'reports',
      trend: frameworkCoverageItems.some((item) => item.tone === 'critical') ? 'Escalate' : 'Ahead',
      action: 'Open compliance workspace',
    },
    {
      label: 'Evidence Pressure',
      value: evidenceHealth.expired > 0 ? `${evidenceHealth.expired} artifacts expired` : `${evidenceHealth.dueForReview} items nearing expiry`,
      note: evidenceHealth.expired > 0 ? `${evidenceHealth.missing} missing and ${evidenceHealth.dueForReview} nearing expiry.` : 'Evidence freshness is within review tolerance.',
      tone: evidenceHealth.expired > 0 ? 'critical' as Tone : evidenceHealth.dueForReview > 0 ? 'warning' as Tone : 'success' as Tone,
      routeKey: 'evidence',
      trend: evidenceHealth.expired > 0 ? 'Declining' : 'Stable',
      action: 'Open evidence workspace',
    },
    {
      label: 'Vendor Concentration',
      value: vendorTiers.critical > 0 ? 'Vendor concentration risk detected' : vendorTiers.high > 0 ? 'High-risk vendor pocket' : 'Vendor posture within tolerance',
      note: `${enterprisePosture.exceptions.highRiskVendors} high-risk vendors currently tracked.`,
      tone: enterprisePosture.exceptions.highRiskVendors > 0 ? 'warning' as Tone : 'success' as Tone,
      routeKey: 'tprm-dashboard',
      trend: enterprisePosture.exceptions.highRiskVendors > 0 ? 'Watch' : 'Stable',
      action: 'Open third-party workspace',
    },
    {
      label: 'Audit Readiness',
      value: enterprisePosture.exceptions.auditBlockers > 0 ? `Readiness improved by ${Math.max(4, Math.round(auditAverage / 14))}% but blockers remain` : 'Audit readiness improved',
      note: `${clamp(auditAverage)}% readiness across ${effectiveAuditSummary.length} frameworks.`,
      tone: enterprisePosture.exceptions.auditBlockers > 0 ? 'warning' as Tone : 'success' as Tone,
      routeKey: 'audit-readiness',
      trend: enterprisePosture.exceptions.auditBlockers > 0 ? 'Mixed' : 'Improving',
      action: 'Open audit workspace',
    },
    {
      label: 'AI Governance',
      value: effectiveAi.highRisk > 0 ? `AI governance score decreased to ${aiGovernanceScore}%` : `AI governance steady at ${aiGovernanceScore}%`,
      note: `${effectiveAi.systems} systems in scope with ${effectiveAi.highRisk} high-risk systems.`,
      tone: effectiveAi.highRisk > 0 ? 'warning' as Tone : 'success' as Tone,
      routeKey: 'ai-governance',
      trend: effectiveAi.highRisk > 0 ? 'Downtrend' : 'Stable',
      action: 'Open AI governance workspace',
    },
  ];

  if (loading) {
    return <div style={{ maxWidth: 1800, margin: '0 auto', padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading Enterprise GRC Command Dashboard...</div>;
  }

  if (!currentWorkspace.id) {
    return <WorkspaceEmptyState onNavigate={navigateTo} />;
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: theme.spacing[2] }}>
      <ExecutiveStatusBanner
        selectedFramework={selectedFramework}
        frameworkOptions={mergedFrameworkOptions}
        onFrameworkChange={setSelectedFramework}
        onExport={() => navigateTo('reports')}
      />

      <section style={{ display: isExecutiveDashboard ? 'block' : 'none' }}>
        <ExecutiveSummaryStrip items={executiveSummaryStrip.map((item) => ({ ...item, onClick: navigateTo }))} />
      </section>

      <section style={{ display: 'grid', gap: 8, paddingTop: 4, marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, width: '100%' }}>
          {primaryKpis.map((kpi) => (
            <CompactPrimaryKpi
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              tone={kpi.tone}
              statusLabel={kpi.statusLabel}
              delta={kpi.delta}
              onClick={kpi.path ? () => navigateTo(kpi.path!) : undefined}
            />
          ))}
        </div>
      </section>

      <section style={{ display: isExecutiveDashboard ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: theme.spacing[2] }}>
        {secondaryIndicators.map((item) => <SecondaryIndicator key={item.label} label={item.label} value={item.value} detail={item.detail} tone={item.tone} />)}
      </section>

      <section style={{ display: isExecutiveDashboard ? 'grid' : 'none', gridTemplateColumns: 'minmax(320px, 0.95fr) minmax(280px, 1fr) minmax(280px, 1fr)', gap: theme.spacing[2], alignItems: 'start' }}>
        <ExecutiveHealthCard score={executiveHealthIndex} trend={enterprisePosture.trend >= 0 ? 'Improving' : 'Under watch'} confidence={dataQuality.score >= 80 ? 'High' : 'Medium'} onClick={() => navigateTo('dashboard')} />
        <ChartPanel title="Executive Alerts" subtitle="Counts, severity, drill-down" summary={<Badge variant="warning" size="sm">{executiveAlerts.filter((item) => item.count > 0).length} active</Badge>}>
          <ExecutiveAlertsPanel items={executiveAlerts} onNavigate={navigateTo} />
        </ChartPanel>
        <ChartPanel title="Executive Calendar" subtitle="Upcoming reviews and meetings" summary={<Badge variant="default" size="sm">{executiveCalendar.length} scheduled</Badge>}>
          <ExecutiveCalendarPanel items={executiveCalendar} onNavigate={navigateTo} />
        </ChartPanel>
      </section>

      <section style={{ display: isExecutiveDashboard ? 'grid' : 'none' }}>
        <ChartPanel title="Executive Insights" subtitle="Dynamic platform signals" summary={<Button variant="secondary" onClick={() => navigateTo('reports')}>Open Reporting</Button>}>
          <ExecutiveInsightGrid items={executiveInsights} onNavigate={navigateTo} />
        </ChartPanel>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.38fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 12, alignItems: 'stretch', paddingTop: 0 }}>
        <SectionContainer title="Risk Heatmap" subtitle="Residual matrix" action={<Button variant="secondary" onClick={() => navigateTo('risks')}>View Risk Register</Button>} priority="primary" compact>
          <div style={{ minHeight: 254, display: 'grid', alignItems: 'center' }}>
            <ExecutiveRiskHeatmap risks={executiveData.risks} />
          </div>
        </SectionContainer>
        <ChartPanel title="Top Risk Categories" subtitle="Risk mix" summary={<Button variant="secondary" onClick={() => navigateTo('risks')}>View All Risks</Button>} priority="primary" compact>
          <div style={{ minHeight: 254, display: 'grid', alignItems: 'center' }}>
            <TopRiskCategoryBreakdown segments={topRiskCategorySegments} />
          </div>
        </ChartPanel>
        <ChartPanel title="Compliance Overview" subtitle="Control posture" summary={<Button variant="secondary" onClick={() => navigateTo('compliance-workspace')}>View Compliance</Button>} priority="primary" compact>
          <div style={{ minHeight: 254, display: 'grid', alignItems: 'center' }}>
            <DonutBreakdown
              total={complianceBreakdown.total}
              segments={complianceBreakdown.segments}
              emptyMessage="No framework mappings available yet"
              centerLabel="Total Controls"
              layout="split"
              diameter={188}
            />
          </div>
        </ChartPanel>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, paddingTop: 16 }}>
        <ChartPanel title="Open Actions" subtitle="Immediate items" summary={<Button variant="secondary" onClick={() => navigateTo('issues')}>View All</Button>} priority="supporting" compact>
          <div style={{ display: 'grid', gap: theme.spacing[1] }}>
            {actionCenterItems.slice(0, 5).map((item) => (
              <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: theme.spacing[2], alignItems: 'center' }}>
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.main }}>{item.label}</span>
                <Badge variant={item.tone === 'critical' ? 'danger' : item.tone === 'warning' ? 'warning' : 'success'} size="sm">{item.value}</Badge>
              </div>
            ))}
          </div>
        </ChartPanel>
        <ChartPanel title="Audit Status" subtitle="Readiness" summary={<Button variant="secondary" onClick={() => navigateTo('audit-workspace')}>View All</Button>} priority="supporting" compact>
          <BarList items={auditStatusItems} emptyMessage="No audit readiness data available yet" />
        </ChartPanel>
        <ChartPanel title="Evidence Overview" subtitle="Evidence health" summary={<Button variant="secondary" onClick={() => navigateTo('evidence-workspace')}>View All</Button>} priority="supporting" compact>
          <div style={{ display: 'grid', gap: theme.spacing[1] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs }}><span style={{ color: theme.colors.text.secondary }}>Total evidence</span><strong style={{ color: theme.colors.primary }}>{executiveData.evidence.length.toLocaleString()}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs }}><span style={{ color: theme.colors.text.secondary }}>Expiring (30 days)</span><strong style={{ color: theme.colors.semantic.warning }}>{evidenceHealth.dueForReview}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs }}><span style={{ color: theme.colors.text.secondary }}>Expired</span><strong style={{ color: theme.colors.semantic.danger }}>{evidenceHealth.expired}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs }}><span style={{ color: theme.colors.text.secondary }}>Missing evidence</span><strong style={{ color: '#8b5cf6' }}>{evidenceHealth.missing}</strong></div>
          </div>
        </ChartPanel>
        <ChartPanel title="Training Compliance" subtitle="Completion" summary={<Button variant="secondary" onClick={() => navigateTo('training-workspace')}>View All</Button>} priority="supporting" compact>
          <div style={{ display: 'grid', gridTemplateColumns: '148px minmax(0, 1fr)', gap: theme.spacing[2], alignItems: 'center', minHeight: 136 }}>
            <MetricRing value={effectiveTrainingSummary.overallCompletionRate || 0} label="Compliant" tone={getToneFromScore(effectiveTrainingSummary.overallCompletionRate || 0)} />
            <div style={{ display: 'grid', gap: theme.spacing[1], alignContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs }}><span style={{ color: theme.colors.text.secondary }}>Compliant</span><strong style={{ color: theme.colors.semantic.success }}>{Math.round(effectiveTrainingSummary.overallCompletionRate || 0)}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs }}><span style={{ color: theme.colors.text.secondary }}>Overdue</span><strong style={{ color: theme.colors.semantic.danger }}>{effectiveTrainingSummary.overdueAssignments || 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs }}><span style={{ color: theme.colors.text.secondary }}>Active campaigns</span><strong>{effectiveTrainingSummary.activeCampaigns || 0}</strong></div>
            </div>
          </div>
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

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.16fr) minmax(0, 1fr)', gap: 12, paddingTop: 22 }}>
        <ChartPanel title="Risk Trend" subtitle="12-month severity trend" summary={<Button variant="secondary" onClick={() => navigateTo('risks')}>View Risk Analytics</Button>}>
          <MultiLineTrendChart series={riskTrendSeries} emptyMessage="No recent high-risk activity available yet" />
        </ChartPanel>
        <ChartPanel title="Compliance Trend" subtitle="12-month coverage trend" summary={<Button variant="secondary" onClick={() => navigateTo('compliance-workspace')}>View Compliance Analytics</Button>}>
          <LineTrendChart points={complianceTrendPoints} color={theme.colors.primary} emptyMessage="No recent compliance activity available yet" />
        </ChartPanel>
      </section>

      <section style={{ display: isExecutiveDashboard ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: theme.spacing[2] }}>
        <ChartPanel title="Audit Trend" subtitle="12-month readiness trend" summary={<Button variant="secondary" onClick={() => navigateTo('audit-workspace')}>Open Audit Workspace</Button>}>
          <LineTrendChart points={auditTrendPoints} color={theme.colors.semantic.success} emptyMessage="No audit readiness trend available yet" />
        </ChartPanel>
        <ChartPanel title="Vendor Risk Trend" subtitle="12-month exposure trend" summary={<Button variant="secondary" onClick={() => navigateTo('vendor-workspace')}>Open Third-Party Workspace</Button>}>
          <LineTrendChart points={vendorTrendPoints} color="#f97316" emptyMessage="No vendor exposure trend available yet" />
        </ChartPanel>
        <ChartPanel title="AI Governance Trend" subtitle="12-month posture trend" summary={<Button variant="secondary" onClick={() => navigateTo('ai-governance')}>Open AI Governance</Button>}>
          <LineTrendChart points={aiTrendPoints} color={theme.colors.primary} emptyMessage="No AI governance trend available yet" />
        </ChartPanel>
      </section>

      <section style={{ display: isExecutiveDashboard ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: theme.spacing[2] }}>
        <ChartPanel title="Evidence Trend" subtitle="12-month evidence movement" summary={<Button variant="secondary" onClick={() => navigateTo('evidence-workspace')}>Open Evidence</Button>}>
          <LineTrendChart points={evidenceTrendPoints} color="#8b5cf6" emptyMessage="No evidence trend available yet" />
        </ChartPanel>
        <ChartPanel title="Training Trend" subtitle="12-month completion trend" summary={<Button variant="secondary" onClick={() => navigateTo('training-workspace')}>Open Training</Button>}>
          <LineTrendChart points={trainingTrendPoints} color={theme.colors.semantic.success} emptyMessage="No training trend available yet" />
        </ChartPanel>
        <ChartPanel title="Incident Trend" subtitle="12-month incident pressure" summary={<Button variant="secondary" onClick={() => navigateTo('issues')}>Open Incidents</Button>}>
          <LineTrendChart points={incidentTrendPoints} color={theme.colors.semantic.danger} emptyMessage="No incident trend available yet" />
        </ChartPanel>
      </section>

      <section style={{ display: 'block', paddingTop: 18 }}>
        <ChartPanel title="Framework Coverage" subtitle="Coverage by framework" summary={<Badge variant="default" size="sm">{frameworkCoverageItems.length} shown</Badge>} priority="supporting">
          <FrameworkCoverageStrip items={frameworkCoverageItems} onItemClick={() => navigateTo('reports')} />
        </ChartPanel>
      </section>

      <section style={{ display: isExecutiveDashboard ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[2] }}>
        {reportingWidgets.map((item) => (
          <SecondaryIndicator
            key={item.label}
            label={item.label}
            value={item.value}
            detail={item.detail}
            tone={item.tone}
            onClick={() => navigateTo(item.path)}
          />
        ))}
      </section>

      <section style={{ display: isExecutiveDashboard ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: theme.spacing[2] }}>
        {forecastWidgets.map((item) => (
          <ForecastCard
            key={item.label}
            title={item.label}
            currentValue={item.currentValue}
            forecastValue={item.forecastValue}
            movement={item.detail}
            confidence={item.confidence}
            tone={item.tone}
            routeKey={item.path}
            onNavigate={navigateTo}
          />
        ))}
      </section>

      <section style={{ display: 'none', gridTemplateColumns: 'minmax(320px, 0.95fr) minmax(280px, 1fr) minmax(280px, 1fr)', gap: theme.spacing[2], alignItems: 'start' }}>
        <ExecutiveHealthCard score={executiveHealthIndex} trend={enterprisePosture.trend >= 0 ? 'Improving' : 'Under watch'} confidence={dataQuality.score >= 80 ? 'High' : 'Medium'} onClick={() => navigateTo('dashboard')} />
        <ChartPanel title="Executive Alerts" subtitle="Counts, severity, drill-down" summary={<Badge variant="warning" size="sm">{executiveAlerts.filter((item) => item.count > 0).length} active</Badge>}>
          <ExecutiveAlertsPanel items={executiveAlerts} onNavigate={navigateTo} />
        </ChartPanel>
        <ChartPanel title="Executive Calendar" subtitle="Upcoming reviews and meetings" summary={<Badge variant="default" size="sm">{executiveCalendar.length} scheduled</Badge>}>
          <ExecutiveCalendarPanel items={executiveCalendar} onNavigate={navigateTo} />
        </ChartPanel>
      </section>

      <section style={{ display: isExecutiveDashboard ? 'grid' : 'none', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(340px, 0.92fr)', gap: theme.spacing[2], alignItems: 'start' }}>
        <ChartPanel title="Executive Insights" subtitle="Dynamic platform signals" summary={<Button variant="secondary" onClick={() => navigateTo('reports')}>Open Reporting</Button>}>
          <ExecutiveInsightGrid items={executiveInsights} onNavigate={navigateTo} />
        </ChartPanel>
        <ChartPanel title="Cross-Domain Intelligence" subtitle="Relationship health across domains" summary={<Badge variant="default" size="sm">{crossDomainLinks.length} links</Badge>}>
          <CrossDomainIntelligencePanel items={crossDomainLinks} onNavigate={navigateTo} />
        </ChartPanel>
      </section>

      <section style={{ display: 'none', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <ChartPanel title="Vendor Exposure" subtitle="Distribution across third-party risk tiers." summary={<Badge variant="default" size="sm">{data.vendors.length} vendors</Badge>}>
          <StackedStatusBar segments={[{ label: 'Critical', value: vendorTiers.critical, color: theme.colors.semantic.danger }, { label: 'High', value: vendorTiers.high, color: theme.colors.semantic.warning }, { label: 'Medium', value: vendorTiers.medium, color: theme.colors.primary }, { label: 'Low', value: vendorTiers.low, color: theme.colors.semantic.success }]} emptyMessage="No vendor records available yet" />
        </ChartPanel>
      </section>

      <section style={{ display: 'none', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[2] }}>
        {overviewCards.slice(0, 4).map((card) => <OverviewCard key={card.title} icon={card.icon} title={card.title} metric={card.metric} trend={card.trend} tone={card.tone} cta={card.cta} onClick={() => navigateTo(card.path)} />)}
      </section>

      <section style={{ display: 'none' }}>
        <SectionContainer title="Continuous Assurance" subtitle="Compact widgets for automated assurance posture without expanding the dashboard footprint.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: theme.spacing[2] }}>
            {assuranceWidgets.map((item) => (
              <Card key={item.label} style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{item.value}</div>
                <div style={{ marginTop: theme.spacing[2], display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                  <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.detail}</span>
                  <Badge variant={item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : item.tone === 'success' ? 'success' : 'default'} size="sm">{item.tone}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </SectionContainer>
      </section>

      <section style={{ display: 'none' }}>
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
      </section>
    </div>
  );
}
