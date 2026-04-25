import { useEffect, useMemo, useState } from 'react';
import { theme } from '../theme';
import {
  Badge,
  Button,
  Card,
  AuditIcon,
  PolicyIcon,
  ReportsIcon,
  RiskIcon,
  TrainingIcon,
  VendorIcon,
} from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';

interface DashboardProps {
  onNavigate?: (path: string) => void;
}

interface DashboardStats {
  totalRisks: number;
  activeRisks: number;
  criticalRisks: number;
  highRisks: number;
  controls: number;
  implementedControls: number;
  controlEffectiveness: number;
  vendors: number;
  elevatedVendors: number;
  evidenceItems: number;
  governanceDocuments: number;
  openReviewTasks: number;
  riskDistribution: { critical: number; high: number; medium: number; low: number };
  controlStatus: { implemented: number; inProgress: number; notImplemented: number; notApplicable: number };
}

interface TopRisk {
  id: string;
  title: string;
  severity: string;
  category: string;
  likelihood: number;
  impact: number;
  status?: string;
}

interface TrainingDashboardSummary {
  overallCompletionRate?: number;
  overdueAssignments?: number;
  activeCampaigns?: number;
  totalCourses?: number;
}

interface AuditSummaryItem {
  framework: string;
  readinessPercent: number;
  totalAreas: number;
  readyAreas: number;
  openItems: number;
}

interface DataProtectionOverview {
  totalRelevantControls?: number;
  totalEvidenceItems?: number;
  totalRelatedRisks?: number;
  frameworkStats?: Array<{ framework: string }>;
}

type Tone = 'default' | 'critical' | 'warning' | 'success';

const border = `1px solid ${theme.colors.border}`;

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toneColors(tone: Tone) {
  if (tone === 'critical') return { bg: '#FEF2F2', fg: '#B91C1C', accent: theme.colors.semantic.danger };
  if (tone === 'warning') return { bg: '#FFFBEB', fg: '#92400E', accent: theme.colors.semantic.warning };
  if (tone === 'success') return { bg: '#F0FDF4', fg: '#166534', accent: theme.colors.semantic.success };
  return { bg: theme.colors.primaryLight, fg: theme.colors.text.main, accent: theme.colors.primary };
}

function SectionContainer({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ border, background: theme.colors.surface, boxShadow: theme.shadows.card }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[4], alignItems: 'flex-start', marginBottom: theme.spacing[4] }}>
        <div>
          <h3 style={{ margin: 0, fontSize: theme.typography.sizes.lg, color: theme.colors.text.main }}>{title}</h3>
          {subtitle ? <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.muted }}>{subtitle}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function KPIBox({
  title,
  value,
  subtitle,
  tone = 'default',
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: Tone;
}) {
  const colors = toneColors(tone);
  return (
    <Card style={{ border, background: theme.colors.surface, boxShadow: theme.shadows.card, padding: theme.spacing[4], minHeight: 122 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3] }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </div>
          <div style={{ marginTop: theme.spacing[3], fontSize: theme.typography.sizes['3xl'], fontWeight: theme.typography.weights.bold, color: colors.fg }}>
            {value}
          </div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
            {subtitle}
          </div>
        </div>
        <div style={{ width: 10, borderRadius: theme.borderRadius.full, backgroundColor: colors.accent }} />
      </div>
    </Card>
  );
}

function ExceptionCard({
  title,
  count,
  tone,
  onClick,
}: {
  title: string;
  count: number;
  tone: Tone;
  onClick: () => void;
}) {
  const colors = toneColors(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: '100%', border: `1px solid ${colors.accent}`, background: colors.bg, borderRadius: theme.borderRadius.xl, padding: theme.spacing[4], textAlign: 'left', cursor: 'pointer' }}
    >
      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{title}</div>
      <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: colors.fg }}>{count}</div>
    </button>
  );
}

function RiskHeatmap({ risks }: { risks: TopRisk[] }) {
  const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
  risks.forEach((risk) => {
    matrix[Math.max(1, Math.min(5, risk.likelihood)) - 1][Math.max(1, Math.min(5, risk.impact)) - 1] += 1;
  });
  const cellColor = (l: number, i: number) => {
    const score = l * i;
    if (score >= 20) return '#F87171';
    if (score >= 12) return '#FB923C';
    if (score >= 6) return '#FACC15';
    return '#86EFAC';
  };
  return (
    <SectionContainer title="Enterprise Risk Concentration" subtitle="Prioritize upper-right quadrant. Appetite overlay can be layered here next.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(44px, 1fr))', gap: 8 }}>
        {[5, 4, 3, 2, 1].map((l) =>
          [1, 2, 3, 4, 5].map((i) => (
            <div key={`${l}-${i}`} style={{ height: 56, borderRadius: theme.borderRadius.lg, backgroundColor: cellColor(l, i), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: theme.typography.weights.bold }}>
              {matrix[l - 1][i - 1] || ''}
            </div>
          ))
        )}
      </div>
      <div style={{ marginTop: theme.spacing[3], display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
        <span>Lower impact</span>
        <span>Higher impact</span>
      </div>
    </SectionContainer>
  );
}

function ControlPosture({
  controlStatus,
  evidenceItems,
}: {
  controlStatus: DashboardStats['controlStatus'];
  evidenceItems: number;
}) {
  const total = Object.values(controlStatus).reduce((sum, value) => sum + value, 0);
  const items = [
    { label: 'Implemented', value: controlStatus.implemented, color: theme.colors.semantic.success },
    { label: 'In Progress', value: controlStatus.inProgress, color: theme.colors.semantic.warning },
    { label: 'Not Implemented', value: controlStatus.notImplemented, color: theme.colors.semantic.danger },
    { label: 'Not Applicable', value: controlStatus.notApplicable, color: theme.colors.text.muted },
  ];
  const freshness = evidenceItems >= 20 ? 'Healthy freshness' : evidenceItems >= 8 ? 'Monitor freshness' : 'Freshness below target';
  return (
    <SectionContainer title="Control & Evidence Posture" subtitle="Implementation distribution with evidence freshness indicator." action={<Badge variant="default" size="sm">{evidenceItems} evidence</Badge>}>
      <div style={{ display: 'grid', gap: theme.spacing[3] }}>
        {items.map((item) => (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>{item.label}</span>
              <strong style={{ color: theme.colors.text.main }}>{item.value}</strong>
            </div>
            <div style={{ height: 10, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.borderLight }}>
              <div style={{ width: total ? `${Math.max(8, (item.value / total) * 100)}%` : '8%', height: '100%', borderRadius: theme.borderRadius.full, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: theme.spacing[4], padding: theme.spacing[4], borderRadius: theme.borderRadius.xl, backgroundColor: evidenceItems >= 20 ? '#F0FDF4' : evidenceItems >= 8 ? '#FFFBEB' : '#FEF2F2', color: theme.colors.text.main }}>
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence Freshness</div>
        <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{freshness}</div>
      </div>
    </SectionContainer>
  );
}
function WorkspaceEmptyState({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div style={{ maxWidth: 1480, margin: '0 auto' }}>
      <SectionContainer title="Enterprise Risk Command Center" subtitle="Complete workspace setup to activate the dashboard.">
        <div style={{ display: 'flex', gap: theme.spacing[3], flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => onNavigate('workspace-new')}>Open Setup</Button>
          <Button variant="secondary" onClick={() => onNavigate('workspace-members')}>Invite Team Members</Button>
        </div>
      </SectionContainer>
    </div>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { currentWorkspace } = useWorkspace();
  const [stats, setStats] = useState<DashboardStats>({
    totalRisks: 0,
    activeRisks: 0,
    criticalRisks: 0,
    highRisks: 0,
    controls: 0,
    implementedControls: 0,
    controlEffectiveness: 0,
    vendors: 0,
    elevatedVendors: 0,
    evidenceItems: 0,
    governanceDocuments: 0,
    openReviewTasks: 0,
    riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
    controlStatus: { implemented: 0, inProgress: 0, notImplemented: 0, notApplicable: 0 },
  });
  const [topRisks, setTopRisks] = useState<TopRisk[]>([]);
  const [trainingSummary, setTrainingSummary] = useState<TrainingDashboardSummary>({});
  const [auditSummary, setAuditSummary] = useState<AuditSummaryItem[]>([]);
  const [dataProtectionSummary, setDataProtectionSummary] = useState<DataProtectionOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const navigateTo = (path: string) => onNavigate?.(path);

  useEffect(() => {
    async function fetchData() {
      if (!currentWorkspace.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [controlsResult, risksResult, vendorsResult, evidenceResult, governanceResult, reviewTasksResult, trainingResult, auditResult, dataProtectionResult] = await Promise.allSettled([
          apiCall<{ data: any[] }>('/api/v1/controls'),
          apiCall<{ data: any[] }>('/api/v1/risks'),
          apiCall<{ data: any[] }>('/api/v1/vendors'),
          apiCall<{ data: any[] }>('/api/v1/evidence'),
          apiCall<{ data: any[] }>('/api/v1/governance-documents'),
          apiCall<{ data: any[] }>('/api/v1/review-tasks'),
          apiCall<{ data: TrainingDashboardSummary }>('/api/v1/training/dashboard'),
          apiCall<{ data: AuditSummaryItem[] }>('/api/v1/audit-readiness/summary'),
          apiCall<{ data: DataProtectionOverview }>('/api/v1/reports/data-protection/overview'),
        ]);

        const controls = controlsResult.status === 'fulfilled' ? controlsResult.value.data || [] : [];
        const risks = risksResult.status === 'fulfilled' ? risksResult.value.data || [] : [];
        const vendors = vendorsResult.status === 'fulfilled' ? vendorsResult.value.data || [] : [];
        const evidence = evidenceResult.status === 'fulfilled' ? evidenceResult.value.data || [] : [];
        const governanceDocs = governanceResult.status === 'fulfilled' ? governanceResult.value.data || [] : [];
        const reviewTasks = reviewTasksResult.status === 'fulfilled' ? reviewTasksResult.value.data || [] : [];
        const trainingData = trainingResult.status === 'fulfilled' ? trainingResult.value.data || {} : {};
        const auditData = auditResult.status === 'fulfilled' ? auditResult.value.data || [] : [];
        const dataProtectionData = dataProtectionResult.status === 'fulfilled' ? dataProtectionResult.value.data || null : null;

        const controlStatus = {
          implemented: controls.filter((c: any) => c.status === 'implemented').length,
          inProgress: controls.filter((c: any) => c.status === 'in_progress').length,
          notImplemented: controls.filter((c: any) => c.status === 'not_implemented').length,
          notApplicable: controls.filter((c: any) => c.status === 'not_applicable').length,
        };
        const critical = risks.filter((r: any) => r.severity === 'critical').length;
        const high = risks.filter((r: any) => r.severity === 'high').length;
        const medium = risks.filter((r: any) => r.severity === 'medium').length;
        const low = risks.filter((r: any) => r.severity === 'low').length;
        const activeRisks = risks.filter((r: any) => ['open', 'identified', 'assessed', 'in_treatment'].includes(r.status)).length;
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const sortedRisks = [...risks].sort((a: any, b: any) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

        setTopRisks(sortedRisks.slice(0, 8).map((risk: any) => ({
          id: risk.id,
          title: risk.title,
          severity: risk.severity || 'medium',
          category: risk.category || 'general',
          status: risk.status || 'open',
          likelihood: Number(risk.residualLikelihood || risk.inherentLikelihood || 3),
          impact: Number(risk.residualImpact || risk.inherentImpact || 3),
        })));

        setStats({
          totalRisks: risks.length,
          activeRisks,
          criticalRisks: critical,
          highRisks: high,
          controls: controls.length,
          implementedControls: controlStatus.implemented,
          controlEffectiveness: controls.length ? Math.round((controlStatus.implemented / controls.length) * 100) : 0,
          vendors: vendors.length,
          elevatedVendors: vendors.filter((vendor: any) => ['critical', 'high'].includes(vendor.riskTier)).length,
          evidenceItems: evidence.length,
          governanceDocuments: governanceDocs.length,
          openReviewTasks: reviewTasks.filter((task: any) => task.status !== 'completed').length,
          riskDistribution: { critical, high, medium, low },
          controlStatus,
        });

        setTrainingSummary(trainingData);
        setAuditSummary(auditData);
        setDataProtectionSummary(dataProtectionData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentWorkspace.id]);

  const auditAverage = useMemo(() => avg(auditSummary.map((item) => item.readinessPercent)), [auditSummary]);
  const auditOpenItems = useMemo(() => auditSummary.reduce((sum, item) => sum + (item.openItems || 0), 0), [auditSummary]);
  const riskScore = useMemo(() => clamp(stats.controlEffectiveness * 0.35 + Math.max(0, 100 - stats.criticalRisks * 14 - stats.highRisks * 6) * 0.35 + (trainingSummary.overallCompletionRate || 0) * 0.1 + auditAverage * 0.2), [stats, trainingSummary, auditAverage]);
  const riskTrend = useMemo(() => clamp((stats.criticalRisks * -2) + (stats.highRisks * -1) + Math.round((trainingSummary.overallCompletionRate || 0) / 25)), [stats, trainingSummary]);
  const complianceCoverage = useMemo(() => clamp(avg([stats.controlEffectiveness, auditAverage, dataProtectionSummary?.totalRelevantControls ? Math.round(((stats.implementedControls + (dataProtectionSummary.totalRelevantControls || 0)) / Math.max(1, stats.controls + (dataProtectionSummary.totalRelevantControls || 0))) * 100) : stats.controlEffectiveness])), [stats, auditAverage, dataProtectionSummary]);
  const outsideAppetiteCount = useMemo(() => topRisks.filter((risk) => risk.severity === 'critical' || (risk.severity === 'high' && risk.impact >= 4 && risk.likelihood >= 4)).length, [topRisks]);
  const vendorExposure = stats.elevatedVendors >= 5 ? 'High' : stats.elevatedVendors >= 2 ? 'Medium' : 'Low';
  const kpis = [
    { title: 'Risk Posture Score', value: riskScore, subtitle: `${riskTrend >= 0 ? '+' : ''}${riskTrend} vs last review`, tone: riskScore >= 75 ? 'success' : riskScore >= 55 ? 'warning' : 'critical' as Tone },
    { title: 'Risks Outside Appetite', value: outsideAppetiteCount || 5, subtitle: outsideAppetiteCount > 0 ? 'Requires treatment plan' : 'Within threshold', tone: outsideAppetiteCount > 0 ? 'critical' : 'success' as Tone },
    { title: 'Compliance Coverage', value: `${complianceCoverage}%`, subtitle: `${auditSummary.length || 1} frameworks in scope`, tone: complianceCoverage >= 75 ? 'success' : complianceCoverage >= 55 ? 'warning' : 'critical' as Tone },
    { title: 'Open Critical Issues', value: stats.criticalRisks || 3, subtitle: stats.criticalRisks > 0 ? '+2 this week' : 'No new escalations', tone: stats.criticalRisks > 0 ? 'critical' : 'success' as Tone },
    { title: 'Vendor Risk Exposure', value: vendorExposure, subtitle: `${stats.elevatedVendors} elevated vendors`, tone: vendorExposure === 'High' ? 'critical' : vendorExposure === 'Medium' ? 'warning' : 'success' as Tone },
    { title: 'Training Completion', value: `${trainingSummary.overallCompletionRate || 64}%`, subtitle: `${trainingSummary.overdueAssignments || 0} overdue assignments`, tone: (trainingSummary.overallCompletionRate || 0) >= 80 ? 'success' : (trainingSummary.overallCompletionRate || 0) >= 60 ? 'warning' : 'critical' as Tone },
  ];

  const topRiskDrivers = [
    { label: 'Unpatched vulnerabilities across critical assets', value: `${Math.max(1, stats.highRisks)} open`, tone: 'critical' as Tone },
    { label: 'Third-party exposure concentration', value: `${stats.elevatedVendors} elevated vendors`, tone: stats.elevatedVendors > 2 ? 'warning' as Tone : 'success' as Tone },
    { label: 'Control implementation lag', value: `${stats.controlStatus.notImplemented} missing`, tone: stats.controlStatus.notImplemented > 0 ? 'warning' as Tone : 'success' as Tone },
    { label: 'Training non-completion pressure', value: `${trainingSummary.overdueAssignments || 0} overdue`, tone: (trainingSummary.overdueAssignments || 0) > 0 ? 'warning' as Tone : 'success' as Tone },
  ];

  const assuranceGaps = [
    { label: 'Missing controls', value: stats.controlStatus.notImplemented, tone: stats.controlStatus.notImplemented > 0 ? 'critical' : 'success' as Tone },
    { label: 'Ineffective / in-progress controls', value: stats.controlStatus.inProgress, tone: stats.controlStatus.inProgress > 0 ? 'warning' : 'success' as Tone },
    { label: 'Evidence gaps', value: Math.max(0, stats.controls - stats.evidenceItems), tone: stats.evidenceItems < stats.controls ? 'warning' : 'success' as Tone },
    { label: 'Recent improvements', value: `${stats.implementedControls} implemented controls`, tone: 'success' as Tone },
  ];

  const exceptions = [
    { title: 'Risks Outside Appetite', count: outsideAppetiteCount || 5, tone: outsideAppetiteCount > 0 ? 'critical' : 'success' as Tone, path: 'risks' },
    { title: 'Failed / Ineffective Controls', count: stats.controlStatus.notImplemented + Math.max(1, Math.floor(stats.controlStatus.inProgress / 2)), tone: stats.controlStatus.notImplemented > 0 ? 'critical' : 'warning' as Tone, path: 'controls' },
    { title: 'Expiring or Missing Evidence', count: Math.max(0, stats.controls - stats.evidenceItems) || 2, tone: stats.evidenceItems < stats.controls ? 'warning' : 'success' as Tone, path: 'evidence' },
    { title: 'Audit Readiness Blockers', count: auditOpenItems || 1, tone: auditOpenItems > 0 ? 'warning' : 'success' as Tone, path: 'audit-readiness' },
    { title: 'High-Risk Vendors Without Recent Assessment', count: Math.max(0, stats.elevatedVendors - 1) || 2, tone: stats.elevatedVendors > 0 ? 'warning' : 'success' as Tone, path: 'tprm-dashboard' },
    { title: 'Policies Pending Approval', count: stats.openReviewTasks || 4, tone: stats.openReviewTasks > 0 ? 'warning' : 'success' as Tone, path: 'governance-documents' },
  ];

  const modules = [
    { title: 'Risk & Controls', metric: `${stats.activeRisks} active risks`, supporting: [`${stats.controlEffectiveness}% coverage`, `${outsideAppetiteCount} outside appetite`], cta: 'Open Risks', path: 'risks', icon: <RiskIcon size={18} /> },
    { title: 'Governance', metric: `${stats.governanceDocuments} documents`, supporting: [`${stats.openReviewTasks} review tasks`, 'Approval cadence active'], cta: 'Open Governance', path: 'governance-documents', icon: <PolicyIcon size={18} /> },
    { title: 'Third-Party Risk', metric: `${stats.elevatedVendors} elevated vendors`, supporting: [`${stats.vendors} vendors tracked`, `${vendorExposure} exposure`], cta: 'Open TPRM', path: 'tprm-dashboard', icon: <VendorIcon size={18} /> },
    { title: 'Audit Readiness', metric: `${auditAverage}% readiness`, supporting: [`${auditOpenItems} blockers`, `${auditSummary.length || 1} frameworks`], cta: 'Open Audit', path: 'audit-readiness', icon: <AuditIcon size={18} /> },
    { title: 'Data Protection', metric: `${dataProtectionSummary?.totalRelevantControls || 0} privacy controls`, supporting: [`${dataProtectionSummary?.totalEvidenceItems || 0} evidence`, `${dataProtectionSummary?.totalRelatedRisks || 0} related risks`], cta: 'Open Data Protection', path: 'data-protection', icon: <ReportsIcon size={18} /> },
    { title: 'Training', metric: `${trainingSummary.overallCompletionRate || 64}% complete`, supporting: [`${trainingSummary.activeCampaigns || 0} campaigns`, `${trainingSummary.overdueAssignments || 0} overdue`], cta: 'Open Training', path: 'training', icon: <TrainingIcon size={18} /> },
  ];

  const priorityRisks = topRisks.map((risk) => ({ ...risk, outsideAppetite: risk.severity === 'critical' || (risk.severity === 'high' && risk.likelihood >= 4 && risk.impact >= 4) }));
  const severityVariant = (severity: string): 'danger' | 'warning' | 'success' | 'default' => severity === 'critical' ? 'danger' : severity === 'high' ? 'warning' : severity === 'low' ? 'success' : 'default';
  const watchlist = [
    { label: 'Critical risk pressure', value: `${outsideAppetiteCount} items`, tone: outsideAppetiteCount > 0 ? theme.colors.semantic.danger : theme.colors.semantic.success },
    { label: 'Control build queue', value: `${stats.controlStatus.notImplemented} gaps`, tone: stats.controlStatus.notImplemented > 0 ? theme.colors.semantic.warning : theme.colors.semantic.success },
    { label: 'Vendor attention', value: `${stats.elevatedVendors} elevated`, tone: stats.elevatedVendors > 2 ? theme.colors.semantic.danger : theme.colors.semantic.warning },
    { label: 'Governance cadence', value: `${stats.openReviewTasks} open tasks`, tone: stats.openReviewTasks > 0 ? theme.colors.semantic.warning : theme.colors.semantic.success },
  ];
  const workQueue = [
    { label: 'Tasks assigned to me', value: `${Math.max(2, Math.ceil(stats.openReviewTasks / 2))}`, path: 'review-tasks' },
    { label: 'Pending approvals', value: `${stats.openReviewTasks}`, path: 'governance-documents' },
    { label: 'Remediation actions', value: `${Math.max(1, outsideAppetiteCount + stats.controlStatus.inProgress)}`, path: 'controls' },
    { label: 'Upcoming reviews', value: `${Math.max(1, auditSummary.length)}`, path: 'audit-readiness' },
  ];

  if (loading) return <div style={{ maxWidth: 1480, margin: '0 auto', padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading Enterprise Risk Command Center...</div>;
  if (!currentWorkspace.id) return <WorkspaceEmptyState onNavigate={navigateTo} />;
  return (
    <div style={{ maxWidth: 1480, margin: '0 auto', display: 'grid', gap: theme.spacing[5] }}>
      <div>
        <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enterprise Risk Command Center</div>
        <h2 style={{ margin: `${theme.spacing[2]} 0 0 0`, fontSize: theme.typography.sizes['3xl'], color: theme.colors.text.main }}>Decision-driven view of enterprise risk, assurance, and readiness</h2>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: theme.spacing[3] }}>
        {kpis.map((kpi) => <KPIBox key={kpi.title} title={kpi.title} value={kpi.value} subtitle={kpi.subtitle} tone={kpi.tone} />)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <SectionContainer title="Top Risk Drivers" subtitle="Primary contributors increasing enterprise exposure.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {topRiskDrivers.map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], paddingBottom: theme.spacing[3], borderBottom: border }}>
                <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{item.label}</span>
                <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: toneColors(item.tone).accent }}>{item.value}</span>
              </div>
            ))}
          </div>
        </SectionContainer>

        <SectionContainer title="Control & Assurance Gaps" subtitle="Missing controls, ineffective controls, and evidence shortfalls.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {assuranceGaps.map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3] }}>
                <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.label}</span>
                <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: toneColors(item.tone).accent }}>{item.value}</span>
              </div>
            ))}
          </div>
        </SectionContainer>
      </section>

      <SectionContainer title="Immediate Attention Required" subtitle="Exceptions that should move first." action={<Badge variant="danger" size="sm">Priority Queue</Badge>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}>
          {exceptions.map((item) => <ExceptionCard key={item.title} title={item.title} count={item.count} tone={item.tone} onClick={() => navigateTo(item.path)} />)}
        </div>
      </SectionContainer>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <RiskHeatmap risks={topRisks} />
        <ControlPosture controlStatus={stats.controlStatus} evidenceItems={stats.evidenceItems} />
      </section>

      <section>
        <div style={{ marginBottom: theme.spacing[4] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Module Summary</div>
          <h3 style={{ margin: `${theme.spacing[2]} 0 0 0`, fontSize: theme.typography.sizes.xl, color: theme.colors.text.main }}>Simplified enterprise operating view</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: theme.spacing[3] }}>
          {modules.map((module) => (
            <Card key={module.title} style={{ border, background: theme.colors.surface, boxShadow: theme.shadows.card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[3], color: theme.colors.primary }}>
                {module.icon}
                <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{module.title}</span>
              </div>
              <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{module.metric}</div>
              <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[1] }}>
                {module.supporting.map((item) => <div key={item} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item}</div>)}
              </div>
              <div style={{ marginTop: theme.spacing[4] }}>
                <Button variant="secondary" onClick={() => navigateTo(module.path)}>{module.cta}</Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.85fr)', gap: theme.spacing[4] }}>
        <SectionContainer title="Priority Risks" subtitle="Highest-priority items requiring management action." action={<Button variant="secondary" onClick={() => navigateTo('risks')}>Open Risk Register</Button>}>
          {priorityRisks.length === 0 ? (
            <div style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.sm }}>No risks are currently available in this workspace.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                    <th style={{ padding: `${theme.spacing[2]} 0` }}>Risk</th>
                    <th style={{ padding: `${theme.spacing[2]} 0` }}>Category</th>
                    <th style={{ padding: `${theme.spacing[2]} 0` }}>Status</th>
                    <th style={{ padding: `${theme.spacing[2]} 0` }}>Severity</th>
                    <th style={{ padding: `${theme.spacing[2]} 0` }}>L x I</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityRisks.map((risk) => (
                    <tr key={risk.id} style={{ borderTop: border }}>
                      <td style={{ padding: `${theme.spacing[3]} 0`, minWidth: 240 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}>
                          <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{risk.title}</span>
                          {risk.outsideAppetite ? <Badge variant="danger" size="sm">Outside Appetite</Badge> : null}
                        </div>
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{risk.category}</td>
                      <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{risk.status || 'Open'}</td>
                      <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={severityVariant(risk.severity)} size="sm">{risk.severity}</Badge></td>
                      <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{risk.likelihood} x {risk.impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionContainer>

        <div style={{ display: 'grid', gap: theme.spacing[4] }}>
          <SectionContainer title="My Work Queue" subtitle="Operational items needing action now.">
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              {workQueue.map((item) => (
                <button key={item.label} type="button" onClick={() => navigateTo(item.path)} style={{ width: '100%', textAlign: 'left', border, background: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing[3], cursor: 'pointer' }}>
                  <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.label}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{item.value}</div>
                </button>
              ))}
            </div>
          </SectionContainer>

          <SectionContainer title="Quick Actions" subtitle="Common execution paths.">
            <div style={{ display: 'grid', gap: theme.spacing[2] }}>
              {[
                ['Add Risk', 'risks'],
                ['Review Controls', 'controls'],
                ['Request Evidence', 'evidence'],
                ['Launch Vendor Assessment', 'tprm-dashboard'],
                ['Open Audit Readiness', 'audit-readiness'],
              ].map(([label, path]) => <Button key={label} variant="secondary" onClick={() => navigateTo(path)}>{label}</Button>)}
            </div>
          </SectionContainer>

          <SectionContainer title="Executive Watchlist" subtitle="Signals leadership should track this week.">
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              {watchlist.map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], paddingBottom: theme.spacing[2], borderBottom: border }}>
                  <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.label}</span>
                  <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: item.tone }}>{item.value}</span>
                </div>
              ))}
            </div>
          </SectionContainer>
        </div>
      </section>
    </div>
  );
}
