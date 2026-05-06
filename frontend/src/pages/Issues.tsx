import { theme } from '../theme';
import { Badge, Card, PageHeader } from '../components';
import { DataTable } from '../components/DataTable';

const issuesData = [
  { id: 'ISS-001', title: 'Expired SSL certificates on production servers', owner: 'Platform Operations', status: 'Open', priority: 'Critical', dueDate: '2026-03-10', domain: 'Infrastructure' },
  { id: 'ISS-002', title: 'Missing access reviews for privileged accounts', owner: 'Identity Team', status: 'In Progress', priority: 'High', dueDate: '2026-03-15', domain: 'Access' },
  { id: 'ISS-003', title: 'Firewall rule set contains stale exceptions', owner: 'Network Engineering', status: 'Open', priority: 'High', dueDate: '2026-03-20', domain: 'Infrastructure' },
  { id: 'ISS-004', title: 'Incomplete supplier diligence responses', owner: 'Vendor Oversight', status: 'Pending', priority: 'Medium', dueDate: '2026-03-25', domain: 'Third-Party' },
  { id: 'ISS-005', title: 'Audit log retention control not fully configured', owner: 'IT Operations', status: 'In Progress', priority: 'Medium', dueDate: '2026-03-30', domain: 'Monitoring' },
  { id: 'ISS-006', title: 'Data classification labels are missing for shared records', owner: 'Data Governance', status: 'Open', priority: 'Medium', dueDate: '2026-04-05', domain: 'Privacy' },
  { id: 'ISS-007', title: 'Awareness completion remains below target threshold', owner: 'People Operations', status: 'Resolved', priority: 'Low', dueDate: '2026-04-10', domain: 'Training' },
  { id: 'ISS-008', title: 'Disaster recovery plan evidence pack is incomplete', owner: 'Business Resilience', status: 'Pending', priority: 'Low', dueDate: '2026-04-15', domain: 'Resilience' },
  { id: 'ISS-009', title: 'Penetration test findings remain unremediated', owner: 'Security Operations', status: 'Open', priority: 'Critical', dueDate: '2026-03-08', domain: 'Security' },
  { id: 'ISS-010', title: 'Password policy configuration does not match standard', owner: 'IAM Team', status: 'Resolved', priority: 'High', dueDate: '2026-04-20', domain: 'Access' },
];

const columns = [
  { key: 'id', header: 'ID', width: '100px' },
  {
    key: 'title',
    header: 'Issue',
    render: (item: typeof issuesData[number]) => (
      <div>
        <div style={{ fontWeight: theme.typography.weights.semibold }}>{item.title}</div>
        <div style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.xs, marginTop: theme.spacing[1] }}>{item.domain}</div>
      </div>
    ),
  },
  { key: 'owner', header: 'Owner' },
  {
    key: 'status',
    header: 'Status',
    render: (item: typeof issuesData[number]) => {
      const variant = {
        Open: 'danger',
        'In Progress': 'info',
        Pending: 'warning',
        Resolved: 'success',
      }[item.status] as 'danger' | 'info' | 'warning' | 'success';
      return <Badge variant={variant}>{item.status}</Badge>;
    },
  },
  {
    key: 'priority',
    header: 'Priority',
    render: (item: typeof issuesData[number]) => {
      const variant = {
        Critical: 'critical',
        High: 'high',
        Medium: 'medium',
        Low: 'low',
      }[item.priority] as 'critical' | 'high' | 'medium' | 'low';
      return <Badge variant={variant}>{item.priority}</Badge>;
    },
  },
  { key: 'dueDate', header: 'Due Date' },
];

export function Issues() {
  const openIssues = issuesData.filter((item) => item.status !== 'Resolved');
  const criticalIssues = issuesData.filter((item) => item.priority === 'Critical');
  const overdueIssues = openIssues.filter((item) => item.dueDate < '2026-03-07');
  const domainCounts = issuesData.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.domain] = (accumulator[item.domain] || 0) + 1;
    return accumulator;
  }, {});

  const domainBreakdown = Object.entries(domainCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

  const maxDomainCount = Math.max(...domainBreakdown.map(([, count]) => count), 1);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Issue Resolution Center"
        description="Prioritize operational findings, unblock overdue remediation, and keep material issues from drifting across the control environment."
      />

      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #0f4c5c 46%, #38bdf8 100%)',
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing[6],
          marginBottom: theme.spacing[6],
          color: theme.colors.text.inverse,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
          gap: theme.spacing[5],
        }}
      >
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, letterSpacing: '0.08em', opacity: 0.76, marginBottom: theme.spacing[2] }}>
            ISSUE OPERATIONS
          </div>
          <div style={{ fontSize: theme.typography.sizes['3xl'], fontWeight: theme.typography.weights.bold, lineHeight: 1.15, marginBottom: theme.spacing[3] }}>
            Focus attention on the findings that can create exposure fastest.
          </div>
          <div style={{ color: 'rgba(255,255,255,0.82)', lineHeight: 1.7, maxWidth: '760px' }}>
            Use this page as the working queue for incidents, audit findings, access gaps, and supplier follow-ups that need active ownership and date control.
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: theme.borderRadius.xl,
            padding: theme.spacing[5],
          }}
        >
          <div style={{ fontSize: theme.typography.sizes.xs, opacity: 0.72, marginBottom: theme.spacing[3] }}>CURRENT SIGNAL</div>
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3] }}>
              <span style={{ opacity: 0.8 }}>Open remediation queue</span>
              <strong>{openIssues.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3] }}>
              <span style={{ opacity: 0.8 }}>Critical findings</span>
              <strong>{criticalIssues.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3] }}>
              <span style={{ opacity: 0.8 }}>Overdue actions</span>
              <strong>{overdueIssues.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3] }}>
              <span style={{ opacity: 0.8 }}>Execution posture</span>
              <strong>Daily follow-through</strong>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[6],
        }}
      >
        {[
          { label: 'New This Cycle', value: 4, color: theme.colors.primary },
          { label: 'Active Cases', value: openIssues.length, color: '#0F766E' },
          { label: 'Critical Cases', value: criticalIssues.length, color: '#DC2626' },
          { label: 'Overdue', value: overdueIssues.length, color: '#EA580C' },
        ].map((stat) => (
          <Card key={stat.label}>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginBottom: theme.spacing[3] }}>{stat.label}</div>
            <div style={{ fontSize: '38px', fontWeight: theme.typography.weights.bold, color: stat.color }}>{stat.value}</div>
          </Card>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)',
          gap: theme.spacing[5],
          marginBottom: theme.spacing[6],
        }}
      >
        <Card>
          <div style={{ marginBottom: theme.spacing[4] }}>
            <h3 style={{ margin: 0, fontSize: theme.typography.sizes.base }}>Issues by operational domain</h3>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginTop: theme.spacing[1] }}>
              Highest issue concentration by working area
            </div>
          </div>

          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {domainBreakdown.map(([domain, count], index) => {
              const width = `${(count / maxDomainCount) * 100}%`;
              const colorPalette = ['#F97316', '#38BDF8', '#84CC16', '#94A3B8', '#0F766E'];
              return (
                <div key={domain}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
                    <span>{domain}</span>
                    <strong>{count}</strong>
                  </div>
                  <div style={{ height: 10, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.borderLight, overflow: 'hidden' }}>
                    <div style={{ width, height: '100%', backgroundColor: colorPalette[index] || theme.colors.primary, borderRadius: theme.borderRadius.full }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div style={{ marginBottom: theme.spacing[4] }}>
            <h3 style={{ margin: 0, fontSize: theme.typography.sizes.base }}>Immediate escalation queue</h3>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginTop: theme.spacing[1] }}>
              Findings that require direct follow-through now
            </div>
          </div>

          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {issuesData
              .filter((item) => item.priority === 'Critical' || item.status === 'Pending')
              .slice(0, 4)
              .map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    padding: theme.spacing[3],
                    borderRadius: theme.borderRadius.lg,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], marginBottom: theme.spacing[2] }}>
                    <strong style={{ fontSize: theme.typography.sizes.sm }}>{issue.id}</strong>
                    <Badge variant={issue.priority === 'Critical' ? 'critical' : 'warning'}>{issue.priority}</Badge>
                  </div>
                  <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, lineHeight: 1.5 }}>{issue.title}</div>
                  <div style={{ marginTop: theme.spacing[2], color: theme.colors.text.muted, fontSize: theme.typography.sizes.xs }}>
                    {issue.owner} • due {issue.dueDate}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <DataTable
        data={issuesData}
        columns={columns}
        searchPlaceholder="Search issues..."
        primaryAction={{
          label: 'New Issue',
          onClick: () => console.log('New Issue clicked'),
        }}
        filterOptions={['Open', 'In Progress', 'Pending', 'Resolved']}
      />
    </div>
  );
}
