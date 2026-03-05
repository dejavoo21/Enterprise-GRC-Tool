import { useState, useEffect } from 'react';
import { theme } from '../theme';
import { Card, Button } from '../components';
import {
  fetchBoardReportOverview,
  generateBoardReportNarrative,
  downloadBoardReportMarkdown,
  downloadBoardReportHtml,
  downloadBoardReportPdf,
  fetchTPRMSummary,
  fetchActivityLog,
} from '../lib/api';
import type { TPRMSummary } from '../types/tprm';
import type {
  BoardReportData,
  BoardReportAudience,
} from '../types/boardReport';
import type { ActivityLogEntry } from '../types/activity';
import { AUDIENCE_OPTIONS } from '../types/boardReport';
import { useAuth } from '../context/AuthContext';

// ============================================
// Health Score Ring Component
// ============================================

function HealthScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return '#10b981';
    if (s >= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '32px', fontWeight: 700, color: getColor(score) }}>
          {score}
        </div>
        <div style={{ fontSize: '12px', color: theme.colors.text.muted, marginTop: '-4px' }}>
          Health Score
        </div>
      </div>
    </div>
  );
}

// ============================================
// KPI Tile Component with Empty State
// ============================================

function KPITile({
  title,
  value,
  subtext,
  color,
  emptyMessage,
  ctaText,
  onCtaClick,
  trend,
}: {
  title: string;
  value: number | string;
  subtext?: string;
  color: string;
  emptyMessage?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  trend?: { value: number; label: string };
}) {
  const isEmpty = value === 0 || value === '0' || value === '0%';

  return (
    <Card>
      <div style={{ padding: '20px' }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: theme.colors.text.secondary,
            marginBottom: '12px',
            letterSpacing: '0.3px',
          }}
        >
          {title}
        </div>

        {isEmpty && emptyMessage ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '14px', color: theme.colors.text.muted, marginBottom: '12px' }}>
              {emptyMessage}
            </div>
            {ctaText && onCtaClick && (
              <Button variant="ghost" size="sm" onClick={onCtaClick}>
                {ctaText}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '32px', fontWeight: 700, color, lineHeight: 1 }}>
                {value}
              </span>
              {trend && (
                <span
                  style={{
                    fontSize: '12px',
                    color: trend.value >= 0 ? '#10b981' : '#ef4444',
                    fontWeight: 500,
                  }}
                >
                  {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
                </span>
              )}
            </div>
            {subtext && (
              <div style={{ fontSize: '13px', color: theme.colors.text.muted, marginTop: '6px' }}>
                {subtext}
              </div>
            )}
            {/* Mini bar placeholder */}
            <div
              style={{
                display: 'flex',
                gap: '2px',
                marginTop: '12px',
                height: '4px',
              }}
            >
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    backgroundColor: i < 3 ? color : '#e5e7eb',
                    borderRadius: '2px',
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

// ============================================
// Risk Distribution Bar
// ============================================

function RiskDistributionBar({
  critical,
  high,
  medium,
  low,
  total,
}: {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}) {
  if (total === 0) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
        {critical > 0 && (
          <div
            style={{
              width: `${(critical / total) * 100}%`,
              backgroundColor: '#dc2626',
              minWidth: critical > 0 ? '24px' : 0,
            }}
            title={`Critical: ${critical}`}
          />
        )}
        {high > 0 && (
          <div
            style={{
              width: `${(high / total) * 100}%`,
              backgroundColor: '#f59e0b',
              minWidth: high > 0 ? '24px' : 0,
            }}
            title={`High: ${high}`}
          />
        )}
        {medium > 0 && (
          <div
            style={{
              width: `${(medium / total) * 100}%`,
              backgroundColor: '#3b82f6',
              minWidth: medium > 0 ? '24px' : 0,
            }}
            title={`Medium: ${medium}`}
          />
        )}
        {low > 0 && (
          <div
            style={{
              width: `${(low / total) * 100}%`,
              backgroundColor: '#10b981',
              minWidth: low > 0 ? '24px' : 0,
            }}
            title={`Low: ${low}`}
          />
        )}
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
        <LegendItem color="#dc2626" label="Critical" value={critical} />
        <LegendItem color="#f59e0b" label="High" value={high} />
        <LegendItem color="#3b82f6" label="Medium" value={medium} />
        <LegendItem color="#10b981" label="Low" value={low} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '10px', height: '10px', backgroundColor: color, borderRadius: '2px' }} />
      <span style={{ fontSize: '13px', color: theme.colors.text.secondary }}>
        {label} ({value})
      </span>
    </div>
  );
}

// ============================================
// Empty State Card
// ============================================

function EmptyStateCard({
  icon,
  title,
  message,
  ctaText,
  onCtaClick,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  ctaText?: string;
  onCtaClick?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          color: theme.colors.text.muted,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: theme.colors.text.main, marginBottom: '4px' }}>
        {title}
      </div>
      <div style={{ fontSize: '13px', color: theme.colors.text.muted, marginBottom: ctaText ? '16px' : 0, maxWidth: '240px' }}>
        {message}
      </div>
      {ctaText && onCtaClick && (
        <Button variant="primary" size="sm" onClick={onCtaClick}>
          {ctaText}
        </Button>
      )}
    </div>
  );
}

// ============================================
// Attention Item Row
// ============================================

function AttentionItem({
  type,
  title,
  meta,
  severity,
}: {
  type: 'risk' | 'policy' | 'vendor' | 'training';
  title: string;
  meta: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}) {
  const typeColors = {
    risk: '#ef4444',
    policy: '#8b5cf6',
    vendor: '#f59e0b',
    training: '#3b82f6',
  };
  const typeLabels = {
    risk: 'Risk',
    policy: 'Policy',
    vendor: 'Vendor',
    training: 'Training',
  };
  const severityColors = {
    critical: { bg: '#fee2e2', text: '#dc2626' },
    high: { bg: '#fef3c7', text: '#d97706' },
    medium: { bg: '#dbeafe', text: '#2563eb' },
    low: { bg: '#d1fae5', text: '#059669' },
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 0',
        borderBottom: `1px solid ${theme.colors.borderLight}`,
      }}
    >
      <div
        style={{
          width: '4px',
          height: '32px',
          backgroundColor: typeColors[type],
          borderRadius: '2px',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: theme.colors.text.main,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: '12px', color: theme.colors.text.muted }}>{meta}</div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        <span
          style={{
            padding: '2px 8px',
            backgroundColor: severityColors[severity].bg,
            color: severityColors[severity].text,
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'capitalize',
          }}
        >
          {severity}
        </span>
        <span
          style={{
            padding: '2px 6px',
            backgroundColor: '#f3f4f6',
            color: theme.colors.text.secondary,
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          {typeLabels[type]}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Activity Item Row
// ============================================

function ActivityItem({
  summary,
  user,
  time,
}: {
  summary: string;
  user: string;
  time: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '10px 0',
        borderBottom: `1px solid ${theme.colors.borderLight}`,
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2563eb',
          fontSize: '12px',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {user.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            color: theme.colors.text.main,
            lineHeight: 1.4,
          }}
        >
          {summary}
        </div>
        <div style={{ fontSize: '12px', color: theme.colors.text.muted, marginTop: '2px' }}>
          {user} • {time}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Loading Skeleton
// ============================================

function Skeleton({ width, height }: { width: string | number; height: string | number }) {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#e5e7eb',
        borderRadius: '6px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

function LoadingState() {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>
      {/* Hero skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingTop: '24px' }}>
        <div>
          <Skeleton width={300} height={32} />
          <div style={{ marginTop: '8px' }}><Skeleton width={400} height={20} /></div>
          <div style={{ marginTop: '8px' }}><Skeleton width={250} height={16} /></div>
        </div>
        <Skeleton width={140} height={140} />
      </div>
      {/* KPI tiles skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><div style={{ padding: '20px' }}><Skeleton width="100%" height={80} /></div></Card>
        ))}
      </div>
      {/* Content skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <Card><div style={{ padding: '20px' }}><Skeleton width="100%" height={200} /></div></Card>
        <Card><div style={{ padding: '20px' }}><Skeleton width="100%" height={200} /></div></Card>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Main Executive Overview Component
// ============================================

export function ExecutiveOverview() {
  const { workspaceId } = useAuth();
  const [boardData, setBoardData] = useState<BoardReportData | null>(null);
  const [tprmData, setTprmData] = useState<TPRMSummary | null>(null);
  const [activityData, setActivityData] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI report state
  const [audience, setAudience] = useState<BoardReportAudience>('board');
  const [narrative, setNarrative] = useState('');
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState<'md' | 'html' | 'pdf' | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [boardResult, tprmResult, activityResult] = await Promise.all([
          fetchBoardReportOverview(),
          fetchTPRMSummary().catch(() => null),
          fetchActivityLog({ limit: 8 }).catch(() => []),
        ]);
        setBoardData(boardResult);
        setTprmData(tprmResult);
        setActivityData(activityResult || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load executive overview');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleGenerateReport = async () => {
    try {
      setNarrativeLoading(true);
      const result = await generateBoardReportNarrative(audience);
      setNarrative(result.narrative);
    } catch (err) {
      console.error('Failed to generate narrative:', err);
    } finally {
      setNarrativeLoading(false);
    }
  };

  const handleDownload = async (format: 'md' | 'html' | 'pdf') => {
    try {
      setDownloadLoading(format);
      if (format === 'md') {
        const content = await downloadBoardReportMarkdown(audience);
        const blob = new Blob([content], { type: 'text/markdown' });
        downloadBlob(blob, 'executive-overview.md');
      } else if (format === 'html') {
        const content = await downloadBoardReportHtml(audience);
        const blob = new Blob([content], { type: 'text/html' });
        downloadBlob(blob, 'executive-overview.html');
      } else {
        const blob = await downloadBoardReportPdf(audience);
        downloadBlob(blob, 'executive-overview.pdf');
      }
    } catch (err) {
      console.error(`Failed to download ${format}:`, err);
    } finally {
      setDownloadLoading(null);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        <Card>
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 16px',
                backgroundColor: '#fee2e2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="32" height="32" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>Unable to load overview</h2>
            <p style={{ margin: '0 0 20px', color: theme.colors.text.muted }}>{error}</p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!boardData) return null;

  // Calculate metrics
  const totalControls = boardData.frameworks.reduce((sum, f) => sum + f.totalControls, 0);
  const totalImplemented = boardData.frameworks.reduce((sum, f) => sum + f.implemented, 0);
  const controlsImplRate = totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0;

  // Calculate health score (weighted average)
  const riskScore = boardData.riskSummary.highRisks === 0 ? 100 : Math.max(0, 100 - boardData.riskSummary.highRisks * 10);
  const controlScore = controlsImplRate;
  const policyScore = boardData.policySummary.overdueReviews === 0 ? 100 : Math.max(0, 100 - boardData.policySummary.overdueReviews * 5);
  const trainingScore = boardData.trainingSummary.overallCompletionRate;
  const healthScore = Math.round((riskScore * 0.3 + controlScore * 0.3 + policyScore * 0.2 + trainingScore * 0.2));

  // Driver bullets for health score
  const drivers: string[] = [];
  if (boardData.riskSummary.highRisks > 0) {
    drivers.push(`${boardData.riskSummary.highRisks} high-severity risks`);
  } else {
    drivers.push('No high-severity risks');
  }
  if (boardData.policySummary.overdueReviews > 0) {
    drivers.push(`${boardData.policySummary.overdueReviews} overdue policy reviews`);
  }
  if (tprmData && tprmData.vendorsByRiskTier.critical > 0) {
    drivers.push(`${tprmData.vendorsByRiskTier.critical} critical vendors`);
  }
  if (drivers.length === 0) {
    drivers.push('All systems operating normally');
  }

  // Calculate total overdue items
  const overdueItems =
    boardData.policySummary.overdueReviews +
    boardData.trainingSummary.overdueAssignments +
    (tprmData?.overdueAssessments || 0);

  // Build attention items
  const attentionItems: Array<{ type: 'risk' | 'policy' | 'vendor' | 'training'; title: string; meta: string; severity: 'critical' | 'high' | 'medium' | 'low' }> = [];

  boardData.riskSummary.topRisks.slice(0, 3).forEach(risk => {
    attentionItems.push({
      type: 'risk',
      title: risk.title,
      meta: `Score: ${risk.severityScore}`,
      severity: risk.severityScore >= 12 ? 'critical' : risk.severityScore >= 6 ? 'high' : 'medium',
    });
  });

  if (boardData.policySummary.overdueReviews > 0) {
    attentionItems.push({
      type: 'policy',
      title: `${boardData.policySummary.overdueReviews} policies need review`,
      meta: 'Overdue for annual review',
      severity: boardData.policySummary.overdueReviews > 3 ? 'high' : 'medium',
    });
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>
      {/* ======== HERO SECTION ======== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingTop: '24px',
          paddingBottom: '32px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 700,
              color: theme.colors.text.main,
              letterSpacing: '-0.5px',
            }}
          >
            Executive Overview
          </h1>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '16px',
              color: theme.colors.text.secondary,
              fontWeight: 400,
            }}
          >
            Security & compliance posture for {workspaceId || 'your organization'}
          </p>
          <div
            style={{
              marginTop: '12px',
              fontSize: '13px',
              color: theme.colors.text.muted,
            }}
          >
            Last updated {new Date().toLocaleString()} • Workspace: {workspaceId || 'Default'}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <HealthScoreRing score={healthScore} />
          <div style={{ marginTop: '12px', textAlign: 'left' }}>
            {drivers.slice(0, 3).map((d, i) => (
              <div
                key={i}
                style={{
                  fontSize: '12px',
                  color: theme.colors.text.secondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px',
                }}
              >
                <span style={{ color: d.includes('No ') || d.includes('normally') ? '#10b981' : '#f59e0b' }}>•</span>
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======== KPI TILES ROW ======== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KPITile
          title="Open Risks"
          value={boardData.riskSummary.openRisks}
          subtext={`${boardData.riskSummary.highRisks} critical/high`}
          color={boardData.riskSummary.highRisks > 0 ? '#ef4444' : '#10b981'}
          emptyMessage="No risks added yet"
          ctaText="Add a risk"
        />
        <KPITile
          title="Controls Implemented"
          value={`${controlsImplRate}%`}
          subtext={`${totalImplemented} of ${totalControls} controls`}
          color={controlsImplRate >= 80 ? '#10b981' : controlsImplRate >= 60 ? '#f59e0b' : '#ef4444'}
          emptyMessage="No controls mapped"
          ctaText="Map controls"
        />
        <KPITile
          title="Overdue Reviews"
          value={overdueItems}
          subtext="Policies + vendor reviews + assessments"
          color={overdueItems > 0 ? '#ef4444' : '#10b981'}
          emptyMessage="All reviews current"
        />
        <KPITile
          title="Third-Party Risk"
          value={tprmData ? tprmData.vendorsByRiskTier.critical + tprmData.vendorsByRiskTier.high : 0}
          subtext={tprmData ? `${tprmData.contractsExpiringSoon} contracts expiring soon` : 'No vendor data'}
          color={tprmData && (tprmData.vendorsByRiskTier.critical > 0) ? '#ef4444' : '#10b981'}
          emptyMessage="No vendor assessments"
          ctaText="Add vendor"
        />
      </div>

      {/* ======== TWO-PANEL ROW: Risk & TPRM Distribution ======== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '24px',
        }}
      >
        {/* Risk Distribution */}
        <Card>
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>
              Risk Distribution
            </h3>
            {boardData.riskSummary.totalRisks === 0 ? (
              <EmptyStateCard
                icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
                title="No risks recorded"
                message="Start by adding risks to your register to see distribution here."
                ctaText="Add first risk"
              />
            ) : (
              <RiskDistributionBar
                critical={boardData.riskSummary.highRisks}
                high={Math.floor(boardData.riskSummary.openRisks * 0.3)}
                medium={Math.floor(boardData.riskSummary.openRisks * 0.4)}
                low={boardData.riskSummary.totalRisks - boardData.riskSummary.openRisks}
                total={boardData.riskSummary.totalRisks}
              />
            )}
          </div>
        </Card>

        {/* TPRM Distribution */}
        <Card>
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>
              Third-Party Risk Distribution
            </h3>
            {!tprmData || tprmData.totalVendors === 0 ? (
              <EmptyStateCard
                icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
                title="No vendor assessments yet"
                message="Add vendors and complete risk assessments to see distribution."
                ctaText="Create first assessment"
              />
            ) : (
              <RiskDistributionBar
                critical={tprmData.vendorsByRiskTier.critical}
                high={tprmData.vendorsByRiskTier.high}
                medium={tprmData.vendorsByRiskTier.medium}
                low={tprmData.vendorsByRiskTier.low}
                total={tprmData.totalVendors}
              />
            )}
          </div>
        </Card>
      </div>

      {/* ======== BOTTOM ROW: Attention Items & Activity ======== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '24px',
        }}
      >
        {/* Items Needing Attention */}
        <Card>
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>
              Items Needing Attention
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: theme.colors.text.muted }}>
              High-priority items requiring action
            </p>
            {attentionItems.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: theme.colors.text.muted,
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: theme.colors.text.secondary }}>
                  You're all caught up
                </div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  No urgent items requiring attention
                </div>
              </div>
            ) : (
              <div>
                {attentionItems.slice(0, 5).map((item, i) => (
                  <AttentionItem key={i} {...item} />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>
              Recent Activity
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: theme.colors.text.muted }}>
              Latest changes across the workspace
            </p>
            {activityData.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: theme.colors.text.muted,
                }}
              >
                <div style={{ fontSize: '14px' }}>No recent activity</div>
              </div>
            ) : (
              <div>
                {activityData.slice(0, 8).map((activity, i) => (
                  <ActivityItem
                    key={i}
                    summary={activity.summary}
                    user={activity.userEmail || 'System'}
                    time={formatTime(activity.createdAt)}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ======== AI REPORT & DOWNLOADS ======== */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>
                Generate Executive Report
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: theme.colors.text.muted }}>
                Create AI-powered narrative summaries for stakeholder presentations
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as BoardReportAudience)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  fontSize: '13px',
                  backgroundColor: 'white',
                }}
              >
                {AUDIENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Button variant="primary" onClick={handleGenerateReport} disabled={narrativeLoading}>
                {narrativeLoading ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>

          {narrative && (
            <div
              style={{
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '14px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                marginBottom: '16px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {narrative}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', borderTop: `1px solid ${theme.colors.borderLight}`, paddingTop: '16px' }}>
            <Button variant="secondary" size="sm" onClick={() => handleDownload('md')} disabled={downloadLoading !== null}>
              {downloadLoading === 'md' ? 'Downloading...' : 'Download Markdown'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleDownload('html')} disabled={downloadLoading !== null}>
              {downloadLoading === 'html' ? 'Downloading...' : 'Download HTML'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleDownload('pdf')} disabled={downloadLoading !== null}>
              {downloadLoading === 'pdf' ? 'Downloading...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default ExecutiveOverview;
