import { useState, useEffect, type ReactNode } from 'react';
import { theme } from '../theme';
import { Card, Badge, PlusIcon, EvidenceIcon, ReportsIcon } from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../lib/api';

// Types for API data
interface DashboardStats {
  totalRisks: number;
  activeRisks: number;
  criticalRisks: number;
  highRisks: number;
  controls: number;
  controlEffectiveness: number;
  vendors: number;
  criticalVendors: number;
  openIssues: number;
  pendingIssues: number;
  criticalIssues: number;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  controlStatus: {
    effective: number;
    partial: number;
    ineffective: number;
    notTested: number;
  };
}

interface TopRisk {
  id: string;
  title: string;
  severity: string;
  category: string;
}

// Navigation card data
const quickNavCards = [
  {
    title: 'Risks',
    description: 'View and manage risk register',
    icon: '⚠️',
    path: 'risks',
    color: theme.colors.risk.high,
  },
  {
    title: 'Controls',
    description: 'Monitor control effectiveness',
    icon: '🛡️',
    path: 'controls',
    color: theme.colors.primary,
  },
  {
    title: 'Reports',
    description: 'Generate compliance reports',
    icon: '📊',
    path: 'reports',
    color: theme.colors.semantic.info,
  },
  {
    title: 'Training',
    description: 'Security awareness status',
    icon: '📚',
    path: 'training',
    color: theme.colors.semantic.success,
  },
];

function HeroSection({
  stats,
  onNavigate,
}: {
  stats: DashboardStats;
  onNavigate: (path: string) => void;
}) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  // Calculate health score based on control effectiveness and risk metrics
  const healthScore = Math.round(
    (stats.controlEffectiveness * 0.6) +
    ((100 - (stats.criticalRisks * 10 + stats.highRisks * 5)) * 0.4)
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.fullName?.split(' ')[0] || 'there';

  return (
    <div
      style={{
        background: theme.colors.gradients.hero,
        borderRadius: theme.borderRadius['2xl'],
        padding: theme.spacing[8],
        marginBottom: theme.spacing[6],
        boxShadow: theme.shadows.lg,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: theme.spacing[6] }}>
        {/* Left: Welcome + Stats */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h1
            style={{
              color: 'white',
              fontSize: theme.typography.sizes['3xl'],
              fontWeight: theme.typography.weights.bold,
              margin: 0,
              marginBottom: theme.spacing[2],
            }}
          >
            {getGreeting()}, {firstName}
          </h1>
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: theme.typography.sizes.lg,
              margin: 0,
              marginBottom: theme.spacing[2],
            }}
          >
            {currentWorkspace.name} - Security & Compliance Overview
          </p>
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: theme.typography.sizes.sm,
              margin: 0,
              marginBottom: theme.spacing[6],
            }}
          >
            {stats.controls} controls monitored · {stats.totalRisks} risks tracked · {stats.vendors} vendors managed
          </p>

          {/* Quick Navigation Cards */}
          <div style={{ display: 'flex', gap: theme.spacing[3], flexWrap: 'wrap' }}>
            {quickNavCards.map((card) => (
              <button
                key={card.path}
                onClick={() => onNavigate(card.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[3],
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: theme.borderRadius.lg,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '140px',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '20px' }}>{card.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div
                    style={{
                      color: 'white',
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.semibold,
                    }}
                  >
                    {card.title}
                  </div>
                  <div
                    style={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: theme.typography.sizes.xs,
                    }}
                  >
                    {card.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Health Score Circle */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: `4px solid ${healthScore >= 70 ? 'rgba(34, 197, 94, 0.7)' : healthScore >= 50 ? 'rgba(234, 179, 8, 0.7)' : 'rgba(239, 68, 68, 0.7)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: '48px',
                fontWeight: theme.typography.weights.bold,
                color: 'white',
                lineHeight: 1,
              }}
            >
              {Math.min(100, Math.max(0, healthScore))}
            </span>
            <span
              style={{
                fontSize: theme.typography.sizes.xs,
                color: 'rgba(255, 255, 255, 0.8)',
                marginTop: theme.spacing[1],
              }}
            >
              / 100
            </span>
          </div>
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: theme.typography.sizes.sm,
              fontWeight: theme.typography.weights.medium,
              marginTop: theme.spacing[3],
              margin: 0,
            }}
          >
            Health Score
          </p>
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: theme.typography.sizes.xs,
              marginTop: theme.spacing[1],
              margin: 0,
            }}
          >
            {healthScore >= 70 ? 'Good standing' : healthScore >= 50 ? 'Needs attention' : 'Critical issues'}
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  accentColor,
  icon,
  onClick,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  accentColor: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card
      hover
      style={{ flex: 1, minWidth: '180px', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.text.muted,
              marginBottom: theme.spacing[2],
            }}
          >
            {title}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: theme.typography.sizes['3xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.text.main,
            }}
          >
            {value}
          </p>
          <p
            style={{
              margin: 0,
              marginTop: theme.spacing[2],
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.text.secondary,
            }}
          >
            {subtitle}
          </p>
        </div>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: theme.borderRadius.lg,
            backgroundColor: accentColor + '15',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
          }}
        >
          {icon || (
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: accentColor,
                opacity: 0.8,
              }}
            />
          )}
        </div>
      </div>
      {/* Mini sparkline placeholder */}
      <div
        style={{
          marginTop: theme.spacing[4],
          height: '24px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
        }}
      >
        {[40, 65, 45, 70, 55, 80, 60, 75, 85, 70].map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              backgroundColor: accentColor,
              borderRadius: '2px',
              opacity: 0.3 + (i / 10) * 0.5,
            }}
          />
        ))}
      </div>
    </Card>
  );
}

function HealthScoreCard({ stats }: { stats: DashboardStats }) {
  const riskScore = Math.min(100, stats.criticalRisks * 15 + stats.highRisks * 8 + Math.round(stats.activeRisks / Math.max(1, stats.totalRisks) * 30));
  const controlEffectiveness = stats.controlEffectiveness;
  const healthScore = Math.round((controlEffectiveness * 0.6) + ((100 - riskScore) * 0.4));

  return (
    <Card style={{ flex: 1 }}>
      <h3
        style={{
          margin: 0,
          marginBottom: theme.spacing[6],
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}
      >
        GRC Health Score
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[8] }}>
        {/* Circular gauge */}
        <div style={{ position: 'relative', width: '120px', height: '120px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle cx="60" cy="60" r="50" fill="none" stroke={theme.colors.border} strokeWidth="12" />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={healthScore >= 70 ? theme.colors.semantic.success : healthScore >= 50 ? theme.colors.semantic.warning : theme.colors.semantic.danger}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${healthScore * 3.14} ${100 * 3.14}`}
              transform="rotate(-90 60 60)"
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
            <span
              style={{
                fontSize: theme.typography.sizes['2xl'],
                fontWeight: theme.typography.weights.bold,
                color: theme.colors.text.main,
              }}
            >
              {healthScore}
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: theme.spacing[4] }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: theme.spacing[1],
              }}
            >
              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                Risk Score
              </span>
              <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                {riskScore}
              </span>
            </div>
            <div
              style={{
                height: '8px',
                backgroundColor: theme.colors.borderLight,
                borderRadius: theme.borderRadius.full,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, riskScore)}%`,
                  backgroundColor: riskScore > 50 ? theme.colors.semantic.danger : theme.colors.semantic.warning,
                  borderRadius: theme.borderRadius.full,
                }}
              />
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: theme.spacing[1],
              }}
            >
              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                Control Effectiveness
              </span>
              <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                {controlEffectiveness}%
              </span>
            </div>
            <div
              style={{
                height: '8px',
                backgroundColor: theme.colors.borderLight,
                borderRadius: theme.borderRadius.full,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${controlEffectiveness}%`,
                  backgroundColor: theme.colors.semantic.success,
                  borderRadius: theme.borderRadius.full,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RiskDistributionCard({ distribution }: { distribution: DashboardStats['riskDistribution'] }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const segments = [
    { label: 'Critical', value: distribution.critical, color: theme.colors.heatmap.critical },
    { label: 'High', value: distribution.high, color: theme.colors.heatmap.high },
    { label: 'Medium', value: distribution.medium, color: theme.colors.heatmap.medium },
    { label: 'Low', value: distribution.low, color: theme.colors.heatmap.low },
  ];

  return (
    <Card style={{ flex: 1 }}>
      <h3
        style={{
          margin: 0,
          marginBottom: theme.spacing[6],
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}
      >
        Risk Distribution
      </h3>

      {total === 0 ? (
        <p style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.sm }}>
          No risks recorded yet
        </p>
      ) : (
        <>
          {/* Stacked bar */}
          <div
            style={{
              display: 'flex',
              height: '32px',
              borderRadius: theme.borderRadius.lg,
              overflow: 'hidden',
              marginBottom: theme.spacing[6],
            }}
          >
            {segments.map((seg, i) => (
              <div
                key={i}
                style={{
                  width: `${(seg.value / total) * 100}%`,
                  backgroundColor: seg.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {seg.value > 0 && (
                  <span style={{ color: 'white', fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold }}>
                    {seg.value}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[4] }}>
            {segments.map((seg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '3px',
                    backgroundColor: seg.color,
                  }}
                />
                <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {seg.label}: {seg.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function ControlStatusCard({ status }: { status: DashboardStats['controlStatus'] }) {
  const total = Object.values(status).reduce((a, b) => a + b, 0);
  const segments = [
    { label: 'Implemented', value: status.effective, color: theme.colors.semantic.success },
    { label: 'In Progress', value: status.partial, color: theme.colors.semantic.warning },
    { label: 'Not Implemented', value: status.ineffective, color: theme.colors.semantic.danger },
    { label: 'Not Applicable', value: status.notTested, color: theme.colors.text.muted },
  ];

  return (
    <Card>
      <h3
        style={{
          margin: 0,
          marginBottom: theme.spacing[6],
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}
      >
        Control Status
      </h3>

      {total === 0 ? (
        <p style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.sm }}>
          No controls recorded yet
        </p>
      ) : (
        <>
          {/* Horizontal stacked bar */}
          <div
            style={{
              display: 'flex',
              height: '40px',
              borderRadius: theme.borderRadius.lg,
              overflow: 'hidden',
              marginBottom: theme.spacing[4],
            }}
          >
            {segments.map((seg, i) => (
              <div
                key={i}
                style={{
                  width: `${(seg.value / total) * 100}%`,
                  backgroundColor: seg.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {seg.value > 0 && (
                  <span
                    style={{
                      color: 'white',
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.semibold,
                    }}
                  >
                    {seg.value}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.spacing[2] }}>
            {segments.map((seg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    backgroundColor: seg.color,
                  }}
                />
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {seg.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function TopRisksCard({ risks }: { risks: TopRisk[] }) {
  return (
    <Card style={{ flex: 1 }}>
      <h3
        style={{
          margin: 0,
          marginBottom: theme.spacing[4],
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}
      >
        Top Risks
      </h3>

      {risks.length === 0 ? (
        <p style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.sm }}>
          No risks recorded yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[3] }}>
          {risks.slice(0, 7).map((risk) => (
            <div
              key={risk.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[3],
                padding: theme.spacing[3],
                backgroundColor: theme.colors.background,
                borderRadius: theme.borderRadius.lg,
              }}
            >
              <Badge
                variant={risk.severity as 'critical' | 'high' | 'medium' | 'low'}
                size="sm"
                style={{ minWidth: '60px', justifyContent: 'center' }}
              >
                {risk.severity}
              </Badge>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: theme.typography.sizes.sm,
                    fontWeight: theme.typography.weights.medium,
                    color: theme.colors.text.main,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {risk.title}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: theme.typography.sizes.xs,
                    color: theme.colors.text.muted,
                  }}
                >
                  {risk.id} · {risk.category}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function QuickActionsCard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const actions = [
    { label: 'Add Risk', icon: <PlusIcon size={16} />, color: theme.colors.risk.high, path: 'risks' },
    { label: 'Add Control', icon: <PlusIcon size={16} />, color: theme.colors.primary, path: 'controls' },
    { label: 'Upload Evidence', icon: <EvidenceIcon size={16} />, color: theme.colors.semantic.success, path: 'evidence' },
    { label: 'Generate Report', icon: <ReportsIcon size={16} />, color: theme.colors.semantic.info, path: 'reports' },
  ];

  return (
    <Card style={{ flex: 1 }}>
      <h3
        style={{
          margin: 0,
          marginBottom: theme.spacing[4],
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}
      >
        Quick Actions
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: theme.spacing[3] }}>
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => onNavigate(action.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              padding: theme.spacing[3],
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              color: theme.colors.text.main,
              fontSize: theme.typography.sizes.sm,
              fontWeight: theme.typography.weights.medium,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = action.color;
              e.currentTarget.style.backgroundColor = theme.colors.surface;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.backgroundColor = theme.colors.background;
            }}
          >
            <span style={{ color: action.color }}>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

interface DashboardProps {
  onNavigate?: (path: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { currentWorkspace } = useWorkspace();
  const [stats, setStats] = useState<DashboardStats>({
    totalRisks: 0,
    activeRisks: 0,
    criticalRisks: 0,
    highRisks: 0,
    controls: 0,
    controlEffectiveness: 0,
    vendors: 0,
    criticalVendors: 0,
    openIssues: 0,
    pendingIssues: 0,
    criticalIssues: 0,
    riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
    controlStatus: { effective: 0, partial: 0, ineffective: 0, notTested: 0 },
  });
  const [topRisks, setTopRisks] = useState<TopRisk[]>([]);
  const [loading, setLoading] = useState(true);

  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);

        // Fetch controls, risks, vendors in parallel
        const [controlsRes, risksRes, vendorsRes] = await Promise.all([
          apiCall<{ data: any[] }>('/api/v1/controls'),
          apiCall<{ data: any[] }>('/api/v1/risks'),
          apiCall<{ data: any[] }>('/api/v1/vendors'),
        ]);

        const controls = controlsRes.data || [];
        const risks = risksRes.data || [];
        const vendors = vendorsRes.data || [];

        // Calculate control stats
        const implemented = controls.filter((c: any) => c.status === 'implemented').length;
        const inProgress = controls.filter((c: any) => c.status === 'in_progress').length;
        const notImplemented = controls.filter((c: any) => c.status === 'not_implemented').length;
        const notApplicable = controls.filter((c: any) => c.status === 'not_applicable').length;
        const controlEffectiveness = controls.length > 0
          ? Math.round((implemented / controls.length) * 100)
          : 0;

        // Calculate risk stats
        const critical = risks.filter((r: any) => r.severity === 'critical').length;
        const high = risks.filter((r: any) => r.severity === 'high').length;
        const medium = risks.filter((r: any) => r.severity === 'medium').length;
        const low = risks.filter((r: any) => r.severity === 'low').length;
        const activeRisks = risks.filter((r: any) => r.status === 'open' || r.status === 'in_treatment').length;

        // Sort risks by severity for top risks list
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const sortedRisks = [...risks].sort((a: any, b: any) => {
          return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        });

        setTopRisks(
          sortedRisks.slice(0, 7).map((r: any) => ({
            id: r.id,
            title: r.title,
            severity: r.severity,
            category: r.category || 'General',
          }))
        );

        setStats({
          totalRisks: risks.length,
          activeRisks,
          criticalRisks: critical,
          highRisks: high,
          controls: controls.length,
          controlEffectiveness,
          vendors: vendors.length,
          criticalVendors: vendors.filter((v: any) => v.riskTier === 'critical' || v.riskTier === 'high').length,
          openIssues: 0,
          pendingIssues: 0,
          criticalIssues: 0,
          riskDistribution: { critical, high, medium, low },
          controlStatus: {
            effective: implemented,
            partial: inProgress,
            ineffective: notImplemented,
            notTested: notApplicable,
          },
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [currentWorkspace.id]);

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', textAlign: 'center', padding: theme.spacing[12] }}>
        <p style={{ color: theme.colors.text.secondary }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Hero Section */}
      <HeroSection stats={stats} onNavigate={handleNavigate} />

      {/* Metric Cards Row */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[6],
          flexWrap: 'wrap',
        }}
      >
        <MetricCard
          title="Total Risks"
          value={stats.totalRisks}
          subtitle={`${stats.activeRisks} active risks`}
          accentColor={theme.colors.risk.high}
          onClick={() => handleNavigate('risks')}
        />
        <MetricCard
          title="Active Risks"
          value={stats.activeRisks}
          subtitle={`${stats.criticalRisks} critical, ${stats.highRisks} high`}
          accentColor={theme.colors.risk.critical}
          onClick={() => handleNavigate('risks')}
        />
        <MetricCard
          title="Controls"
          value={stats.controls}
          subtitle={`${stats.controlEffectiveness}% effective`}
          accentColor={theme.colors.primary}
          onClick={() => handleNavigate('controls')}
        />
        <MetricCard
          title="Vendors"
          value={stats.vendors}
          subtitle={`${stats.criticalVendors} critical vendors`}
          accentColor={theme.colors.semantic.info}
          onClick={() => handleNavigate('vendors')}
        />
      </div>

      {/* Health Score & Risk Distribution Row */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing[6],
          marginBottom: theme.spacing[6],
          flexWrap: 'wrap',
        }}
      >
        <HealthScoreCard stats={stats} />
        <RiskDistributionCard distribution={stats.riskDistribution} />
      </div>

      {/* Control Status */}
      <div style={{ marginBottom: theme.spacing[6] }}>
        <ControlStatusCard status={stats.controlStatus} />
      </div>

      {/* Bottom Row: Top Risks, Quick Actions */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing[6],
          flexWrap: 'wrap',
        }}
      >
        <TopRisksCard risks={topRisks} />
        <QuickActionsCard onNavigate={handleNavigate} />
      </div>
    </div>
  );
}
