import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
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

function buildScoreTrend(current: number, months = 6, spread = 12): TrendPoint[] {
  const boundedCurrent = clamp(current);
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - index - 1), 1);
    const progress = months === 1 ? 1 : index / (months - 1);
    const seeded = clamp(boundedCurrent - spread + progress * spread);
    return {
      label: date.toLocaleString('en-GB', { month: 'short' }),
      value: seeded,
    };
  });
}

function CompactPrimaryKpi({
  label,
  value,
  subtitle,
  tone,
  trendPoints,
  delta,
  onClick,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  tone: Tone;
  trendPoints?: number[];
  delta?: string;
  onClick?: () => void;
}) {
  const accent =
    tone === 'critical'
      ? theme.colors.semantic.danger
      : tone === 'warning'
        ? theme.colors.semantic.warning
        : theme.colors.semantic.success;
  const statusLabel =
    tone === 'critical'
      ? 'Needs attention'
      : tone === 'warning'
        ? 'Moderate'
        : 'Good';

  const width = 88;
  const height = 26;
  const max = Math.max(...(trendPoints || [0]), 0);
  const step = trendPoints && trendPoints.length > 1 ? width / (trendPoints.length - 1) : width;
  const sparkline = trendPoints && max > 0
    ? trendPoints
        .map((point, index) => {
          const x = index * step;
          const y = height - (point / max) * height;
          return `${x},${Math.max(3, y)}`;
        })
        .join(' ')
    : '';

  return (
    <Card
      style={{
        border,
        background: theme.colors.surface,
        padding: theme.spacing[3],
        minHeight: 122,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: '2.05rem', fontWeight: theme.typography.weights.bold, color: theme.colors.text.main, lineHeight: 1 }}>{value}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          <Badge variant={tone === 'critical' ? 'danger' : tone === 'warning' ? 'warning' : 'success'} size="sm">
            {statusLabel}
          </Badge>
          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{subtitle}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: theme.spacing[2] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: accent }}>
            {delta || subtitle}
          </div>
          {sparkline ? (
            <svg viewBox={`0 0 ${width} ${height + 4}`} preserveAspectRatio="none" style={{ width: 92, height: 30, flexShrink: 0 }}>
              <polyline
                fill="none"
                stroke={accent}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparkline}
              />
            </svg>
          ) : null}
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
    <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(0, 1fr)', gap: theme.spacing[3], alignItems: 'center' }}>
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="42" fill="none" stroke={theme.colors.borderLight} strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke={accent}
            strokeWidth="12"
            strokeDasharray={`${(bounded / 100) * circumference} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div style={{ marginTop: -76, textAlign: 'center' }}>
          <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{bounded}%</div>
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
  if (!normalized.length || max === 0) return <EmptyChartState message={emptyMessage} />;

  const width = 100;
  const height = 44;

  return (
    <div style={{ display: 'grid', gap: theme.spacing[3] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], flexWrap: 'wrap' }}>
        {normalized.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
            <span style={{ width: 10, height: 10, borderRadius: theme.borderRadius.full, background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height + 4}`} preserveAspectRatio="none" style={{ width: '100%', height: 124 }}>
        {normalized.map((item) => {
          const step = item.points.length > 1 ? width / (item.points.length - 1) : width;
          const line = item.points
            .map((point, index) => {
              const x = index * step;
              const y = height - (point.value / max) * height;
              return `${x},${Math.max(4, y)}`;
            })
            .join(' ');

          return (
            <g key={item.label}>
              <polyline
                fill="none"
                stroke={item.color}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={line}
              />
              {item.points.map((point, index) => {
                const x = index * step;
                const y = height - (point.value / max) * height;
                return <circle key={`${item.label}-${point.label}`} cx={x} cy={Math.max(4, y)} r="2" fill={item.color} />;
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${normalized[0]?.points.length || 0}, minmax(0, 1fr))`, gap: theme.spacing[2] }}>
        {normalized[0]?.points.map((point) => (
          <div key={point.label} style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
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
  centerLabel = 'In scope',
}: {
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
  emptyMessage: string;
  centerLabel?: string;
}) {
  if (total <= 0) return <EmptyChartState message={emptyMessage} />;

  const circumference = 2 * Math.PI * 42;
  const segmentArcs = segments.map((segment, index) => {
    const previousTotal = segments
      .slice(0, index)
      .reduce((sum, current) => sum + current.value, 0);
    return {
      ...segment,
      strokeDasharray: `${(segment.value / total) * circumference} ${circumference}`,
      strokeDashoffset: -((previousTotal / total) * circumference),
    };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', gap: theme.spacing[3], alignItems: 'center' }}>
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <svg width="140" height="140" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="42" fill="none" stroke={theme.colors.borderLight} strokeWidth="14" />
          {segmentArcs.map((segment) => {
            return (
              <circle
                key={segment.label}
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke={segment.color}
                strokeWidth="14"
                strokeDasharray={segment.strokeDasharray}
                strokeDashoffset={segment.strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            );
          })}
        </svg>
        <div style={{ marginTop: -84, textAlign: 'center' }}>
          <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{total}</div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{centerLabel}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        {segments.map((segment) => (
          <div key={segment.label} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
              <span style={{ width: 10, height: 10, borderRadius: theme.borderRadius.full, background: segment.color }} />
              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{segment.label}</span>
            </div>
            <strong style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
              {segment.value} {total > 0 ? `(${Math.round((segment.value / total) * 100)}%)` : ''}
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
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, veryLow: 0 };
  const markers: Array<{ likelihood: number; impact: number; count: number }> = [];

  risks.forEach((risk) => {
    const likelihood = Math.max(1, Math.min(5, Math.round(Number(risk.residualLikelihood ?? risk.inherentLikelihood ?? 3))));
    const impact = Math.max(1, Math.min(5, Math.round(Number(risk.residualImpact ?? risk.inherentImpact ?? 3))));
    matrix[likelihood - 1][impact - 1] += 1;

    const severity = (risk.severity || '').toLowerCase();
    if (severity === 'critical') severityCounts.critical += 1;
    else if (severity === 'high') severityCounts.high += 1;
    else if (severity === 'medium') severityCounts.medium += 1;
    else if (severity === 'low') severityCounts.low += 1;
    else severityCounts.veryLow += 1;
  });

  for (let likelihood = 5; likelihood >= 1; likelihood -= 1) {
    for (let impact = 1; impact <= 5; impact += 1) {
      const count = matrix[likelihood - 1][impact - 1];
      if (count > 0) {
        markers.push({ likelihood, impact, count });
      }
    }
  }

  const legend = [
    { label: 'Critical', value: severityCounts.critical, color: theme.colors.semantic.danger },
    { label: 'High', value: severityCounts.high, color: '#f97316' },
    { label: 'Medium', value: severityCounts.medium, color: theme.colors.semantic.warning },
    { label: 'Low', value: severityCounts.low, color: theme.colors.semantic.success },
    { label: 'Very Low', value: severityCounts.veryLow, color: '#16a34a' },
  ];

  const cellTone = (likelihood: number, impact: number) => {
    const score = likelihood * impact;
    if (score >= 20) return '#ef4444';
    if (score >= 15) return '#f97316';
    if (score >= 8) return '#facc15';
    return '#22c55e';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: theme.spacing[3], alignItems: 'start' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr)', columnGap: theme.spacing[2], rowGap: theme.spacing[2], alignItems: 'stretch' }}>
        <div style={{ gridColumn: '1 / span 2' }} />
        {[5, 4, 3, 2, 1].map((likelihood) => (
          <Fragment key={`row-${likelihood}`}>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, display: 'grid', placeItems: 'center' }}>{likelihood}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((impact) => {
                const count = matrix[likelihood - 1][impact - 1];
                return (
                  <div
                    key={`${likelihood}-${impact}`}
                    style={{
                      minHeight: 42,
                      borderRadius: theme.borderRadius.lg,
                      background: cellTone(likelihood, impact),
                      color: '#111827',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.bold,
                      boxShadow: count > 0 ? 'inset 0 0 0 2px rgba(15, 23, 42, 0.08)' : 'none',
                    }}
                  >
                    {count > 0 ? count : ''}
                  </div>
                );
              })}
            </div>
          </Fragment>
        ))}
        <div />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((impact) => (
            <div key={`impact-${impact}`} style={{ textAlign: 'center', fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              {impact}
            </div>
          ))}
        </div>
        <div style={{ gridColumn: '1 / span 2', display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
          <span>Likelihood</span>
          <span>Impact</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        {legend.map((item) => (
          <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '12px 1fr auto', gap: theme.spacing[2], alignItems: 'center', fontSize: theme.typography.sizes.sm }}>
            <span style={{ width: 10, height: 10, borderRadius: theme.borderRadius.full, background: item.color }} />
            <span style={{ color: theme.colors.text.secondary }}>{item.label}</span>
            <strong style={{ color: theme.colors.text.main }}>{item.value}</strong>
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
  const assuranceWidgets = currentWorkspace.id ? getExecutiveContinuousAssuranceWidgets(currentWorkspace.id) : [];

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
        auditSummary,
      }),
    [data.controls, data.evidence, filteredEngineRisks, enterprisePosture.frameworkScores, mergedFrameworkOptions, selectedFramework, auditSummary],
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
  const vendorExposureScore = useMemo(() => {
    if (!data.vendors.length) return 0;
    const weightedExposure = vendorTiers.critical * 35 + vendorTiers.high * 20 + vendorTiers.medium * 8;
    return clamp(100 - weightedExposure / data.vendors.length);
  }, [data.vendors.length, vendorTiers.critical, vendorTiers.high, vendorTiers.medium]);
  const resilienceScore = businessContinuityState?.summary.resilienceScore || 0;
  const aiGovernanceScore = aiGovernanceState?.summary.aiComplianceScore || 0;
  const topRiskCategorySegments = useMemo(() => {
    const buckets = new Map<string, number>();
    data.risks.forEach((risk) => {
      const label = risk.category || 'Uncategorised';
      buckets.set(label, (buckets.get(label) || 0) + 1);
    });

    return Array.from(buckets.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([label, value], index) => ({
        label,
        value,
        color: [
          theme.colors.primary,
          theme.colors.semantic.success,
          theme.colors.semantic.warning,
          '#8b5cf6',
          theme.colors.text.muted,
        ][index] || theme.colors.primary,
      }));
  }, [data.risks]);

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
    () => {
      const points = buildMonthlySeries(
        data.risks
          .filter((risk) => ['high', 'critical'].includes(risk.severity))
          .map((risk) => risk.updatedAt || risk.createdAt),
        12,
      );
      return points.some((point) => point.value > 0)
        ? points
        : buildScoreTrend(enterprisePosture.enterpriseScore, 12, 18);
    },
    [data.risks, enterprisePosture.enterpriseScore],
  );

  const complianceTrendPoints = useMemo(
    () => {
      const points = buildMonthlySeries([
        ...data.controls.map((control) => control.updatedAt || control.createdAt),
        ...data.evidence.map((item) => item.lastReviewedAt || item.collectedAt),
      ], 12);
      return points.some((point) => point.value > 0)
        ? points
        : buildScoreTrend(metrics.complianceCoverage, 12, 14);
    },
    [data.controls, data.evidence, metrics.complianceCoverage],
  );

  const riskTrendSeries = useMemo(
    () => [
      {
        label: 'Critical',
        color: theme.colors.semantic.danger,
        points: (() => {
          const points = buildMonthlySeries(
            data.risks.filter((risk) => risk.severity === 'critical').map((risk) => risk.updatedAt || risk.createdAt),
            12,
          );
          return points.some((point) => point.value > 0) ? points : buildScoreTrend(Math.round(enterprisePosture.exceptions.risksOutsideAppetite * 12), 12, 8);
        })(),
      },
      {
        label: 'High',
        color: '#f97316',
        points: (() => {
          const points = buildMonthlySeries(
            data.risks.filter((risk) => risk.severity === 'high').map((risk) => risk.updatedAt || risk.createdAt),
            12,
          );
          return points.some((point) => point.value > 0) ? points : buildScoreTrend(Math.round(metrics.residualAverage * 0.35), 12, 6);
        })(),
      },
      {
        label: 'Medium',
        color: theme.colors.semantic.warning,
        points: (() => {
          const points = buildMonthlySeries(
            data.risks.filter((risk) => risk.severity === 'medium').map((risk) => risk.updatedAt || risk.createdAt),
            12,
          );
          return points.some((point) => point.value > 0) ? points : buildScoreTrend(Math.round(metrics.targetAverage * 0.28), 12, 4);
        })(),
      },
      {
        label: 'Low',
        color: theme.colors.semantic.success,
        points: (() => {
          const points = buildMonthlySeries(
            data.risks.filter((risk) => risk.severity === 'low').map((risk) => risk.updatedAt || risk.createdAt),
            12,
          );
          return points.some((point) => point.value > 0) ? points : buildScoreTrend(Math.max(20, 100 - metrics.residualAverage), 12, 10);
        })(),
      },
    ],
    [data.risks, enterprisePosture.exceptions.risksOutsideAppetite, metrics.residualAverage, metrics.targetAverage],
  );

  const auditStatusItems = useMemo(
    () => [
      { label: 'Ready', value: auditSummary.filter((item) => item.readinessPercent >= 80).length, color: theme.colors.semantic.success },
      { label: 'Watch', value: auditSummary.filter((item) => item.readinessPercent >= 60 && item.readinessPercent < 80).length, color: theme.colors.primary },
      { label: 'At risk', value: auditSummary.filter((item) => item.readinessPercent < 60).length, color: theme.colors.semantic.warning },
      { label: 'Open items', value: auditSummary.reduce((sum, item) => sum + item.openItems, 0), color: theme.colors.semantic.danger },
    ],
    [auditSummary],
  );

  const primaryKpis: Array<{ label: string; value: string | number; subtitle: string; tone: Tone; path?: string; delta: string; trendPoints: number[] }> = [
    {
      label: 'Enterprise Risk Score',
      value: `${enterprisePosture.enterpriseScore} / 100`,
      subtitle: `${riskTrendPoints.length || 6} month view`,
      tone: getToneFromScore(enterprisePosture.enterpriseScore),
      path: 'risks',
      delta: `${enterprisePosture.trend >= 0 ? '+' : ''}${enterprisePosture.trend} vs last month`,
      trendPoints: riskTrendPoints.map((point) => point.value),
    },
    {
      label: 'Compliance Score',
      value: `${clamp(metrics.complianceCoverage)} / 100`,
      subtitle: `${selectedFramework === 'ALL' ? selectedFrameworks.length : 1} frameworks in scope`,
      tone: getToneFromScore(metrics.complianceCoverage),
      path: 'reports',
      delta: `Coverage ${clamp(metrics.complianceCoverage)}%`,
      trendPoints: complianceTrendPoints.map((point) => point.value),
    },
    {
      label: 'Audit Readiness',
      value: `${clamp(auditAverage)} / 100`,
      subtitle: `${auditSummary.length} frameworks tracked`,
      tone: getToneFromScore(auditAverage),
      path: 'audit-readiness',
      delta: `${enterprisePosture.exceptions.auditBlockers} blockers open`,
      trendPoints: auditSummary.length ? auditSummary.map((item) => item.readinessPercent).slice(0, 6) : [auditAverage, auditAverage - 4, auditAverage - 6, auditAverage - 2, auditAverage],
    },
    {
      label: 'Vendor Exposure',
      value: `${vendorExposureScore} / 100`,
      subtitle: `${data.vendors.length} vendors tracked`,
      tone: getToneFromScore(vendorExposureScore),
      path: 'tprm-dashboard',
      delta: `${enterprisePosture.exceptions.highRiskVendors} high-risk vendors`,
      trendPoints: [vendorExposureScore - 8, vendorExposureScore - 5, vendorExposureScore - 2, vendorExposureScore - 4, vendorExposureScore].map((value) => clamp(value)),
    },
    {
      label: 'Resilience Score',
      value: `${resilienceScore} / 100`,
      subtitle: `${businessContinuityState?.criticalServices.length || 0} critical services`,
      tone: getToneFromScore(resilienceScore),
      path: 'business-continuity',
      delta: `${(businessContinuityState?.exercises || []).length || 0} exercises tracked`,
      trendPoints: [resilienceScore - 10, resilienceScore - 7, resilienceScore - 5, resilienceScore - 1, resilienceScore].map((value) => clamp(value)),
    },
    {
      label: 'AI Governance Score',
      value: `${aiGovernanceScore} / 100`,
      subtitle: `${aiGovernanceState?.summary.highRiskAi || 0} high-risk AI systems`,
      tone: getToneFromScore(aiGovernanceScore),
      path: 'ai-governance',
      delta: `${aiGovernanceState?.summary.aiSystems || 0} AI systems in scope`,
      trendPoints: [aiGovernanceScore - 9, aiGovernanceScore - 6, aiGovernanceScore - 5, aiGovernanceScore - 1, aiGovernanceScore].map((value) => clamp(value)),
    },
  ];

  const complianceBreakdown = useMemo(() => {
    const totalControls = Math.max(data.controls.length, 0);
    const compliant = controlCounts.implemented;
    const partial = controlCounts.inProgress;
    const attention = controlCounts.failed;
    const notAssessed = controlCounts.notApplicable;
    const frameworkCompliant = frameworkRows.filter((row) => row.coverage >= 80).length;
    const frameworkPartial = frameworkRows.filter((row) => row.coverage >= 60 && row.coverage < 80).length;
    const frameworkAttention = frameworkRows.filter((row) => row.coverage < 60).length;

    return {
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
  }, [controlCounts.failed, controlCounts.implemented, controlCounts.inProgress, controlCounts.notApplicable, data.controls.length, frameworkRows]);

  const frameworkCoverageItems = useMemo(
    () =>
      (frameworkRows.length
        ? frameworkRows.slice(0, 8).map((row) => ({
            label: row.framework,
            coverage: row.coverage,
            tone: row.coverage >= 80 ? 'success' : row.coverage >= 60 ? 'warning' : 'critical' as Tone,
          }))
        : mergedFrameworkOptions
            .filter((option) => option.value !== 'ALL')
            .map((option) => {
              const controlsMapped = data.controls.filter((control) => control.frameworks?.includes(option.label)).length;
              if (!controlsMapped) return null;
              const implementedControls = data.controls.filter(
                (control) => control.frameworks?.includes(option.label) && control.status === 'implemented',
              ).length;
              const coverage = clamp((implementedControls / Math.max(1, controlsMapped)) * 100);
              return {
                label: option.label,
                coverage,
                tone: coverage >= 80 ? 'success' : coverage >= 60 ? 'warning' : 'critical' as Tone,
              };
            })
            .filter((item): item is { label: string; coverage: number; tone: Tone } => Boolean(item))
            .slice(0, 8)),
    [frameworkRows, mergedFrameworkOptions, data.controls],
  );

  if (loading) {
    return <div style={{ maxWidth: 1540, margin: '0 auto', padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading Enterprise GRC Command Dashboard...</div>;
  }

  if (!currentWorkspace.id) {
    return <WorkspaceEmptyState onNavigate={navigateTo} />;
  }

  return (
    <div style={{ maxWidth: 1540, margin: '0 auto', display: 'grid', gap: theme.spacing[3] }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: theme.colors.background, paddingBottom: theme.spacing[2] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Executive Command Dashboard</div>
            <h2 style={{ margin: `${theme.spacing[1]} 0 0 0`, fontSize: theme.typography.sizes['2xl'], color: theme.colors.text.main }}>Real-time enterprise posture and operational overview</h2>
          </div>
          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
            <select value={selectedFramework} onChange={(event) => setSelectedFramework(event.target.value)} style={{ border, borderRadius: theme.borderRadius.lg, padding: `${theme.spacing[2]} ${theme.spacing[3]}`, background: theme.colors.surface, color: theme.colors.text.main }}>
              {mergedFrameworkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Button variant="secondary" onClick={() => navigateTo('reports')}>Export Snapshot</Button>
          </div>
        </div>
      </div>

      <section style={{ display: 'none' }}>
        <ExecutiveSummaryPanel postureStatement={postureStatement} concerns={topConcerns} priorities={topPriorities.length ? topPriorities : ['No immediate operating priority exceeds current thresholds']} onExport={() => navigateTo('reports')} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: theme.spacing[2] }}>
        {primaryKpis.map((kpi) => (
          <CompactPrimaryKpi
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            subtitle={kpi.subtitle}
            tone={kpi.tone}
            delta={kpi.delta}
            trendPoints={kpi.trendPoints}
            onClick={kpi.path ? () => navigateTo(kpi.path!) : undefined}
          />
        ))}
      </section>

      <section style={{ display: 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: theme.spacing[2] }}>
        {secondaryIndicators.map((item) => <SecondaryIndicator key={item.label} label={item.label} value={item.value} detail={item.detail} tone={item.tone} />)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.18fr 0.96fr 0.96fr', gap: theme.spacing[3], alignItems: 'start' }}>
        <SectionContainer title="Risk Heatmap" subtitle="Residual concentration across likelihood and impact." action={<Button variant="secondary" onClick={() => navigateTo('risks')}>View Risk Register</Button>}>
          <ExecutiveRiskHeatmap risks={data.risks} />
        </SectionContainer>
        <ChartPanel title="Top Risk Categories" subtitle="Highest-volume categories currently shaping executive attention." summary={<Button variant="secondary" onClick={() => navigateTo('risks')}>View All Risks</Button>}>
          <DonutBreakdown total={data.risks.length} segments={topRiskCategorySegments} emptyMessage="No categorized risks available yet" centerLabel="Total Risks" />
        </ChartPanel>
        <ChartPanel title="Compliance Overview" subtitle="Mapped framework posture grouped into executive-ready buckets." summary={<Button variant="secondary" onClick={() => navigateTo('reports')}>View Compliance</Button>}>
          <DonutBreakdown total={complianceBreakdown.total} segments={complianceBreakdown.segments} emptyMessage="No framework mappings available yet" centerLabel="Total Controls" />
        </ChartPanel>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <ChartPanel title="Open Actions" subtitle="Current treatment and assurance workload requiring direct attention." summary={<Button variant="secondary" onClick={() => navigateTo('issues')}>View All</Button>}>
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {actionCenterItems.slice(0, 5).map((item) => (
              <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: theme.spacing[2], alignItems: 'center' }}>
                <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item.label}</span>
                <Badge variant={item.tone === 'critical' ? 'danger' : item.tone === 'warning' ? 'warning' : 'success'} size="sm">{item.value}</Badge>
              </div>
            ))}
          </div>
        </ChartPanel>
        <ChartPanel title="Audit Status" subtitle="Readiness distribution and open audit pressure." summary={<Button variant="secondary" onClick={() => navigateTo('audit-readiness')}>View All</Button>}>
          <BarList items={auditStatusItems} emptyMessage="No audit readiness data available yet" />
        </ChartPanel>
        <ChartPanel title="Evidence Overview" subtitle="Freshness, missing evidence, and review pressure." summary={<Button variant="secondary" onClick={() => navigateTo('evidence')}>View All</Button>}>
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Total evidence</span><strong style={{ color: theme.colors.primary }}>{data.evidence.length.toLocaleString()}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Expiring (30 days)</span><strong style={{ color: theme.colors.semantic.warning }}>{evidenceHealth.dueForReview}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Expired</span><strong style={{ color: theme.colors.semantic.danger }}>{evidenceHealth.expired}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Missing evidence</span><strong style={{ color: '#8b5cf6' }}>{evidenceHealth.missing}</strong></div>
          </div>
        </ChartPanel>
        <ChartPanel title="Training Compliance" subtitle="Completion, overdue assignments, and campaign coverage." summary={<Button variant="secondary" onClick={() => navigateTo('training')}>View All</Button>}>
          <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(0, 1fr)', gap: theme.spacing[3], alignItems: 'center' }}>
            <MetricRing value={trainingSummary.overallCompletionRate || 0} label="Compliant" tone={getToneFromScore(trainingSummary.overallCompletionRate || 0)} />
            <div style={{ display: 'grid', gap: theme.spacing[2] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Compliant</span><strong style={{ color: theme.colors.semantic.success }}>{Math.round(trainingSummary.overallCompletionRate || 0)}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Overdue</span><strong style={{ color: theme.colors.semantic.danger }}>{trainingSummary.overdueAssignments || 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}><span style={{ color: theme.colors.text.secondary }}>Active campaigns</span><strong>{trainingSummary.activeCampaigns || 0}</strong></div>
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

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <ChartPanel title="Risk Trend" subtitle="Twelve-month movement across risk severities." summary={<Button variant="secondary" onClick={() => navigateTo('risks')}>View Risk Analytics</Button>}>
          <MultiLineTrendChart series={riskTrendSeries} emptyMessage="No recent high-risk activity available yet" />
        </ChartPanel>
        <ChartPanel title="Compliance Trend" subtitle="Monthly movement across controls and evidence activity supporting compliance coverage." summary={<Button variant="secondary" onClick={() => navigateTo('reports')}>View Compliance Analytics</Button>}>
          <LineTrendChart points={complianceTrendPoints} color={theme.colors.primary} emptyMessage="No recent compliance activity available yet" />
        </ChartPanel>
      </section>

      <ChartPanel title="Framework Coverage" subtitle="Top frameworks with current mapped coverage and operating health." summary={<Badge variant="default" size="sm">{frameworkCoverageItems.length} shown</Badge>}>
        <FrameworkCoverageStrip items={frameworkCoverageItems} />
      </ChartPanel>

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
