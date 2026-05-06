import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTableShell,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  SummaryMetricStrip,
} from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import { theme } from '../theme';

interface OverviewReport {
  risks: {
    total: number;
    bySeverity: { low: number; medium: number; high: number; critical: number };
    open: number;
    accepted: number;
  };
  controls: {
    total: number;
    implemented: number;
    inProgress: number;
    notImplemented: number;
    notApplicable: number;
  };
  evidence: {
    total: number;
    withControlLink: number;
    withRiskLink: number;
  };
  vendors: {
    total: number;
    byRisk: { low: number; medium: number; high: number; critical: number };
    withoutDpa: boolean;
    overdueReviews: number;
  };
  assets: {
    total: number;
    byCriticality: { low: number; medium: number; high: number; critical: number };
    saasCount: number;
  };
}

interface RiskProfileEntry {
  id: string;
  title: string;
  owner: string;
  category: string;
  status: string;
  severity: string;
  dueDate?: string;
}

interface ControlCoverageEntry {
  id: string;
  title: string;
  owner: string;
  domain?: string;
  status: string;
  frameworks: string[];
  evidenceCount: number;
  lastEvidenceAt?: string;
}

interface VendorReportEntry {
  id: string;
  name: string;
  category: string;
  owner: string;
  riskLevel: string;
  status: string;
  nextReviewDate?: string;
}

const severityColors = {
  low: { bg: '#dcfce7', text: '#166534' },
  medium: { bg: '#fef3c7', text: '#92400e' },
  high: { bg: '#fed7aa', text: '#b45309' },
  critical: { bg: '#fee2e2', text: '#991b1b' },
};

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

const fallbackTemplates = [
  {
    title: 'Board Risk Pack',
    audience: 'Board / ExCo',
    description: 'Executive summary of risk concentration, control execution, and top remediation items.',
  },
  {
    title: 'Audit Readiness Pack',
    audience: 'Internal Audit',
    description: 'Control coverage, evidence depth, and open audit-prep gaps.',
  },
  {
    title: 'Vendor Oversight Pack',
    audience: 'TPRM',
    description: 'Third-party exposure, due reviews, and contracts requiring follow-through.',
  },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: theme.colors.semantic.warning,
    accepted: theme.colors.border,
    implemented: theme.colors.semantic.success,
    in_progress: theme.colors.semantic.warning,
    not_implemented: theme.colors.semantic.danger,
    active: theme.colors.semantic.success,
  };
  const color = colors[status] || theme.colors.border;
  return <Badge style={{ backgroundColor: color, color: color === theme.colors.border ? theme.colors.text.main : theme.colors.text.inverse }}>{status.replace(/_/g, ' ')}</Badge>;
}

function PreviewTable({
  title,
  subtitle,
  action,
  headers,
  rows,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  headers: string[];
  rows: ReactNode;
}) {
  return (
    <DataTableShell title={title} subtitle={subtitle} action={action}>
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} style={{ textAlign: 'left', padding: `${theme.spacing[2]} ${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </DataTableShell>
  );
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : 'Unscheduled';
}

export function Reports() {
  const { currentWorkspace } = useWorkspace();
  const [overview, setOverview] = useState<OverviewReport | null>(null);
  const [risks, setRisks] = useState<RiskProfileEntry[]>([]);
  const [controls, setControls] = useState<ControlCoverageEntry[]>([]);
  const [vendors, setVendors] = useState<VendorReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);
        const makeFetch = (endpoint: string) =>
          fetch(`/api/v1/reports/${endpoint}`, {
            headers: { 'X-Workspace-Id': currentWorkspace.id },
          });
        const [overviewRes, risksRes, controlsRes, vendorsRes] = await Promise.all([
          makeFetch('overview'),
          makeFetch('risk-profile'),
          makeFetch('control-coverage'),
          makeFetch('vendors'),
        ]);
        if (!overviewRes.ok || !risksRes.ok || !controlsRes.ok || !vendorsRes.ok) {
          throw new Error('Failed to fetch reports');
        }
        const overviewData = await overviewRes.json();
        const risksData = await risksRes.json();
        const controlsData = await controlsRes.json();
        const vendorsData = await vendorsRes.json();
        setOverview(overviewData.data);
        setRisks(risksData.data || []);
        setControls(controlsData.data || []);
        setVendors(vendorsData.data || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void fetchReports();
  }, [currentWorkspace.id]);

  const exportCsv = (endpoint: string) => {
    window.location.href = `/api/v1/reports/${endpoint}?workspaceId=${currentWorkspace.id}`;
  };

  const metrics = useMemo(() => {
    if (!overview) {
      return [
        { label: 'Report Packs', value: 3, detail: 'Fallback templates available', tone: 'default' as const },
        { label: 'Risk Signals', value: '--', detail: 'Waiting for report data', tone: 'warning' as const },
        { label: 'Control Coverage', value: '--', detail: 'Waiting for report data', tone: 'default' as const },
        { label: 'Vendor Exposure', value: '--', detail: 'Waiting for report data', tone: 'default' as const },
      ];
    }
    const controlCoverage = overview.controls.total > 0 ? Math.round((overview.controls.implemented / overview.controls.total) * 100) : 0;
    return [
      { label: 'Open Risks', value: overview.risks.open, detail: `${overview.risks.bySeverity.high + overview.risks.bySeverity.critical} elevated`, tone: 'warning' as const },
      { label: 'Control Coverage', value: `${controlCoverage}%`, detail: `${overview.controls.implemented} implemented`, tone: 'success' as const },
      { label: 'Evidence Items', value: overview.evidence.total, detail: `${overview.evidence.withControlLink} linked to controls`, tone: 'primary' as const },
      { label: 'Vendors', value: overview.vendors.total, detail: `${overview.vendors.overdueReviews} overdue reviews`, tone: 'danger' as const },
    ];
  }, [overview]);

  const highestRisks = [...risks].slice(0, 5);
  const controlGaps = controls.filter((control) => control.status !== 'implemented').slice(0, 5);
  const vendorWatchlist = [...vendors].slice(0, 5);

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Reports & Analytics" description="Board-ready reporting packs, previews, and operating analytics." />
        <PageSectionCard title="Loading Reports">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Building the reporting workspace...</div>
        </PageSectionCard>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Reports & Analytics"
        description="Board-ready reporting packs, previews, and operating analytics."
        action={
          <>
            <Button variant="outline" onClick={() => window.print()}>Print View</Button>
            <Button variant="primary" onClick={() => exportCsv('risk-profile.csv')}>Export Risk Pack</Button>
          </>
        }
      />

      <SummaryMetricStrip metrics={metrics} />

      {error ? (
        <PageSectionCard title="Fallback Report Templates" subtitle="Report APIs are unavailable, but the standard reporting patterns remain available for use.">
          <div style={{ marginBottom: theme.spacing[4], padding: theme.spacing[3], backgroundColor: theme.colors.semantic.warningLight, borderRadius: theme.borderRadius.lg, color: theme.colors.text.main }}>
            Report data could not be loaded: {error}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: theme.spacing[3] }}>
            {fallbackTemplates.map((template) => (
              <Card key={template.title} style={{ padding: theme.spacing[4], minWidth: 0, backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>{template.audience}</div>
                <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                  {template.title}
                </div>
                <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {template.description}
                </div>
                <div style={{ marginTop: theme.spacing[4] }}>
                  <Button variant="outline" onClick={() => window.alert(`${template.title} template opened for offline preparation.`)}>Use Template</Button>
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      ) : overview ? (
        <>
          <PageSectionCard title="Reporting Packs" subtitle="Use the standard packs to move from reporting into stakeholder action quickly.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: theme.spacing[3] }}>
              {[
                { title: 'Board Risk Pack', detail: 'Top risks, treatment movement, and executive signal', action: () => exportCsv('risk-profile.csv') },
                { title: 'Control Coverage Pack', detail: 'Implementation status, domain concentration, and evidence depth', action: () => exportCsv('control-coverage.csv') },
                { title: 'Vendor Oversight Pack', detail: 'Third-party risk, due reviews, and renewal timing', action: () => exportCsv('vendors.csv') },
              ].map((pack) => (
                <Card key={pack.title} style={{ padding: theme.spacing[4], minWidth: 0 }}>
                  <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{pack.title}</div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{pack.detail}</div>
                  <div style={{ marginTop: theme.spacing[4] }}>
                    <Button variant="primary" onClick={pack.action}>Export</Button>
                  </div>
                </Card>
              ))}
            </div>
          </PageSectionCard>

          <PreviewTable
            title="Priority Risk Preview"
            subtitle="Highest-risk items most likely to appear in the next leadership update."
            headers={['Risk', 'Owner', 'Category', 'Status', 'Severity', 'Due']}
            rows={
              highestRisks.length > 0 ? highestRisks.map((risk) => (
                <tr key={risk.id}>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{risk.title}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{risk.owner}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{risk.category}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}><StatusBadge status={risk.status} /></td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <Badge style={{ backgroundColor: severityColors[risk.severity as keyof typeof severityColors]?.bg, color: severityColors[risk.severity as keyof typeof severityColors]?.text }}>{risk.severity}</Badge>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{formatDate(risk.dueDate)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{ padding: theme.spacing[4], color: theme.colors.text.secondary }}>No risks are available for reporting.</td></tr>
              )
            }
          />

          <PreviewTable
            title="Control Follow-Through"
            subtitle="Controls that still need implementation or evidence attention."
            headers={['Control', 'Owner', 'Status', 'Frameworks', 'Evidence', 'Last Evidence']}
            rows={
              controlGaps.length > 0 ? controlGaps.map((control) => (
                <tr key={control.id}>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{control.title}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{control.owner}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}><StatusBadge status={control.status} /></td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{control.frameworks.join(', ') || 'Unmapped'}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{control.evidenceCount}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{formatDate(control.lastEvidenceAt)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{ padding: theme.spacing[4], color: theme.colors.text.secondary }}>All controls appear implemented.</td></tr>
              )
            }
          />

          <PreviewTable
            title="Vendor Watchlist"
            subtitle="Third parties most likely to require immediate follow-through."
            headers={['Vendor', 'Category', 'Owner', 'Risk', 'Status', 'Next Review']}
            rows={
              vendorWatchlist.length > 0 ? vendorWatchlist.map((vendor) => (
                <tr key={vendor.id}>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{vendor.name}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{vendor.category}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{vendor.owner}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <Badge style={{ backgroundColor: severityColors[vendor.riskLevel as keyof typeof severityColors]?.bg, color: severityColors[vendor.riskLevel as keyof typeof severityColors]?.text }}>{vendor.riskLevel}</Badge>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{vendor.status}</td>
                  <td style={{ padding: `${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>{formatDate(vendor.nextReviewDate)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{ padding: theme.spacing[4], color: theme.colors.text.secondary }}>No vendors are available for reporting.</td></tr>
              )
            }
          />
        </>
      ) : (
        <EmptyStatePanel title="No reports are available yet" description="Connect reporting data sources or seed operating records to begin generating board and audit views." />
      )}
    </div>
  );
}
