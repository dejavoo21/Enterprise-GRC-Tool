import { useEffect, useState } from 'react';
import { theme } from '../theme';
import { Card, PageHeader, Button, Badge, ExportIcon, PrintIcon, DownloadIcon } from '../components';
import { useWorkspace } from '../context/WorkspaceContext';

// Type definitions
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
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood: number;
  residualImpact: number;
  dueDate?: string;
}

interface ControlCoverageEntry {
  id: string;
  title: string;
  owner: string;
  domain?: string;
  status: string;
  frameworks: string[];
  references: string[];
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
  hasDpa: boolean;
  regions: string[];
  dataTypesProcessed: string[];
}

// Colors for severity badges
const severityColors = {
  low: { bg: theme.colors.semantic.success, text: '#065F46' },
  medium: { bg: '#FEF3C7', text: '#92400E' },
  high: { bg: '#FED7AA', text: '#B45309' },
  critical: { bg: theme.colors.risk.critical, text: '#7F1D1D' },
};

function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    open: theme.colors.semantic.warning,
    closed: theme.colors.semantic.success,
    accepted: theme.colors.border,
    active: theme.colors.semantic.success,
    inactive: theme.colors.text.muted,
    onboarding: theme.colors.semantic.warning,
    implemented: theme.colors.semantic.success,
    'in_progress': theme.colors.semantic.warning,
    'not_implemented': theme.colors.semantic.danger,
  };

  const color = statusColors[status] || theme.colors.border;

  return (
    <Badge
      style={{
        backgroundColor: color,
        color: color === theme.colors.border ? theme.colors.text.main : 'white',
      }}
    >
      {status}
    </Badge>
  );
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

        // Helper to make workspace-aware fetch requests
        const makeFetch = (endpoint: string) =>
          fetch(`/api/v1/reports/${endpoint}`, {
            headers: {
              'X-Workspace-Id': currentWorkspace.id,
            },
          });

        // Fetch all reports in parallel
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
        console.error('Error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [currentWorkspace]);

  const downloadCsv = (endpoint: string) => {
    window.location.href = `/api/v1/reports/${endpoint}?workspaceId=${currentWorkspace.id}`;
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: `${theme.spacing[6]} 0` }}>
        <PageHeader
          title="Reports & Analytics"
          description="Generate, download, and schedule comprehensive GRC reports."
        />
        <Card>
          <div style={{ textAlign: 'center', padding: theme.spacing[6] }}>
            <p style={{ color: theme.colors.text.secondary }}>Loading reports...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: `${theme.spacing[6]} 0` }}>
        <PageHeader
          title="Reports & Analytics"
          description="Generate, download, and schedule comprehensive GRC reports."
        />
        <Card style={{ backgroundColor: '#FEE2E2', borderColor: theme.colors.semantic.danger }}>
          <div style={{ padding: theme.spacing[4] }}>
            <p style={{ color: theme.colors.semantic.danger, margin: 0 }}>Error loading reports: {error}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Reports & Analytics"
        description="Generate, download, and schedule comprehensive GRC reports. Track compliance posture, risk metrics, and control effectiveness."
        action={
          <>
            <Button variant="outline">
              <PrintIcon size={16} /> Print to PDF
            </Button>
            <Button variant="primary">
              <ExportIcon size={16} /> Export All
            </Button>
          </>
        }
      />

      {/* Overview Dashboard */}
      {overview && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: theme.spacing[6],
            marginBottom: theme.spacing[8],
          }}
        >
          {/* Risks Overview */}
          <Card>
            <h3 style={{ margin: `0 0 ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.base }}>Risks</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.colors.text.main }}>
                  {overview.risks.total}
                </div>
                <p style={{ margin: `${theme.spacing[1]} 0 0 0`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>
                  Total Risks
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: theme.colors.risk.critical }}>
                  {overview.risks.bySeverity.critical}
                </div>
                <p style={{ margin: `${theme.spacing[1]} 0 0 0`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>
                  Critical
                </p>
              </div>
            </div>
            <div style={{ marginTop: theme.spacing[3], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              <p style={{ margin: `0 0 ${theme.spacing[1]} 0` }}>Low: {overview.risks.bySeverity.low}</p>
              <p style={{ margin: `0 0 ${theme.spacing[1]} 0` }}>Medium: {overview.risks.bySeverity.medium}</p>
              <p style={{ margin: `0 0 ${theme.spacing[1]} 0` }}>High: {overview.risks.bySeverity.high}</p>
            </div>
          </Card>

          {/* Controls Overview */}
          <Card>
            <h3 style={{ margin: `0 0 ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.base }}>Controls</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.colors.text.main }}>
                  {overview.controls.total}
                </div>
                <p style={{ margin: `${theme.spacing[1]} 0 0 0`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>
                  Total Controls
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: theme.colors.semantic.success }}>
                  {overview.controls.implemented}
                </div>
                <p style={{ margin: `${theme.spacing[1]} 0 0 0`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>
                  Implemented
                </p>
              </div>
            </div>
            <div style={{ marginTop: theme.spacing[3], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              <p style={{ margin: `0 0 ${theme.spacing[1]} 0` }}>In Progress: {overview.controls.inProgress}</p>
              <p style={{ margin: `0 0 ${theme.spacing[1]} 0` }}>Not Implemented: {overview.controls.notImplemented}</p>
            </div>
          </Card>

          {/* Evidence Overview */}
          <Card>
            <h3 style={{ margin: `0 0 ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.base }}>Evidence</h3>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.colors.text.main }}>
                {overview.evidence.total}
              </div>
              <p style={{ margin: `${theme.spacing[1]} 0 0 0`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>
                Total Evidence Items
              </p>
            </div>
            <div style={{ marginTop: theme.spacing[3], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              <p style={{ margin: `0 0 ${theme.spacing[1]} 0` }}>Linked to Controls: {overview.evidence.withControlLink}</p>
              <p style={{ margin: `0 0 ${theme.spacing[1]} 0` }}>Linked to Risks: {overview.evidence.withRiskLink}</p>
            </div>
          </Card>

          {/* Vendors Overview */}
          <Card>
            <h3 style={{ margin: `0 0 ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.base }}>Vendors</h3>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.colors.text.main }}>
                {overview.vendors.total}
              </div>
              <p style={{ margin: `${theme.spacing[1]} 0 0 0`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>
                Total Vendors
              </p>
            </div>
            <div style={{ marginTop: theme.spacing[3], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              <p style={{ margin: `0 0 ${theme.spacing[1]} 0` }}>Critical: {overview.vendors.byRisk.critical}</p>
              <p style={{ margin: `0 0 ${theme.spacing[1]} 0` }}>Overdue Reviews: {overview.vendors.overdueReviews}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Risk Profile Report */}
      <Card style={{ marginBottom: theme.spacing[8] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[4] }}>
          <h3 style={{ margin: 0, fontSize: theme.typography.sizes.lg }}>Risk Profile Report</h3>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('risk-profile.csv')}>
            <DownloadIcon size={14} /> Export CSV
          </Button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm }}>
            <thead>
              <tr>
                {['Title', 'Owner', 'Category', 'Status', 'Severity', 'Likelihood', 'Impact', 'Due Date'].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: 'left',
                      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                      borderBottom: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.secondary,
                      fontWeight: theme.typography.weights.semibold,
                      fontSize: theme.typography.sizes.xs,
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => (
                <tr key={risk.id}>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <span style={{ color: theme.colors.text.main, fontWeight: theme.typography.weights.medium }}>{risk.title}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {risk.owner}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {risk.category}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <StatusBadge status={risk.status} />
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <Badge
                      style={{
                        backgroundColor: severityColors[risk.severity as keyof typeof severityColors]?.bg || theme.colors.border,
                        color: severityColors[risk.severity as keyof typeof severityColors]?.text || theme.colors.text.main,
                      }}
                    >
                      {risk.severity}
                    </Badge>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {risk.inherentLikelihood}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {risk.inherentImpact}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Control Coverage Report */}
      <Card style={{ marginBottom: theme.spacing[8] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[4] }}>
          <h3 style={{ margin: 0, fontSize: theme.typography.sizes.lg }}>Control Coverage Report</h3>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('control-coverage.csv')}>
            <DownloadIcon size={14} /> Export CSV
          </Button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm }}>
            <thead>
              <tr>
                {['Title', 'Owner', 'Status', 'Frameworks', 'Evidence Count', 'Last Updated'].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: 'left',
                      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                      borderBottom: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.secondary,
                      fontWeight: theme.typography.weights.semibold,
                      fontSize: theme.typography.sizes.xs,
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {controls.map((control) => (
                <tr key={control.id}>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <span style={{ color: theme.colors.text.main, fontWeight: theme.typography.weights.medium }}>{control.title}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {control.owner}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <StatusBadge status={control.status} />
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {control.frameworks.join(', ') || '—'}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {control.evidenceCount}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {control.lastEvidenceAt || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Vendor Report */}
      <Card style={{ marginBottom: theme.spacing[8] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[4] }}>
          <h3 style={{ margin: 0, fontSize: theme.typography.sizes.lg }}>Vendor Risk Report</h3>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('vendors.csv')}>
            <DownloadIcon size={14} /> Export CSV
          </Button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm }}>
            <thead>
              <tr>
                {['Name', 'Category', 'Owner', 'Risk Level', 'Status', 'DPA', 'Next Review'].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: 'left',
                      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                      borderBottom: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.secondary,
                      fontWeight: theme.typography.weights.semibold,
                      fontSize: theme.typography.sizes.xs,
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <span style={{ color: theme.colors.text.main, fontWeight: theme.typography.weights.medium }}>{vendor.name}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {vendor.category}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {vendor.owner}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <Badge
                      style={{
                        backgroundColor: severityColors[vendor.riskLevel as keyof typeof severityColors]?.bg || theme.colors.border,
                        color: severityColors[vendor.riskLevel as keyof typeof severityColors]?.text || theme.colors.text.main,
                      }}
                    >
                      {vendor.riskLevel}
                    </Badge>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                    <StatusBadge status={vendor.status} />
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {vendor.hasDpa ? '✓' : '—'}
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                    {vendor.nextReviewDate ? new Date(vendor.nextReviewDate).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
