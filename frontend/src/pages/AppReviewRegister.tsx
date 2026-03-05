import { theme } from '../theme';
import { PageHeader, Badge } from '../components';
import { DataTable } from '../components/DataTable';

const appReviewData = [
  { id: 'APR-001', applicationName: 'Salesforce CRM', owner: 'Sales Team', lastReviewDate: '2024-01-15', status: 'Completed', findingsCount: 2 },
  { id: 'APR-002', applicationName: 'SAP ERP', owner: 'Finance', lastReviewDate: '2024-01-10', status: 'Completed', findingsCount: 5 },
  { id: 'APR-003', applicationName: 'Microsoft 365', owner: 'IT', lastReviewDate: '2024-02-01', status: 'In Progress', findingsCount: 0 },
  { id: 'APR-004', applicationName: 'AWS Console', owner: 'DevOps', lastReviewDate: '2023-12-20', status: 'Overdue', findingsCount: 8 },
  { id: 'APR-005', applicationName: 'GitHub Enterprise', owner: 'Engineering', lastReviewDate: '2024-01-25', status: 'Completed', findingsCount: 1 },
  { id: 'APR-006', applicationName: 'Jira', owner: 'Engineering', lastReviewDate: '2024-02-05', status: 'In Progress', findingsCount: 0 },
  { id: 'APR-007', applicationName: 'Slack', owner: 'IT', lastReviewDate: '2023-11-30', status: 'Overdue', findingsCount: 3 },
  { id: 'APR-008', applicationName: 'Workday HR', owner: 'HR', lastReviewDate: '2024-01-20', status: 'Completed', findingsCount: 0 },
  { id: 'APR-009', applicationName: 'ServiceNow', owner: 'IT Ops', lastReviewDate: '2024-02-10', status: 'Scheduled', findingsCount: 0 },
  { id: 'APR-010', applicationName: 'Okta', owner: 'IAM Team', lastReviewDate: '2024-01-30', status: 'Completed', findingsCount: 4 },
];

const columns = [
  { key: 'id', header: 'ID', width: '100px' },
  {
    key: 'applicationName',
    header: 'Application Name',
    render: (item: typeof appReviewData[0]) => (
      <span style={{ fontWeight: theme.typography.weights.medium }}>{item.applicationName}</span>
    ),
  },
  { key: 'owner', header: 'Owner' },
  { key: 'lastReviewDate', header: 'Last Review Date' },
  {
    key: 'status',
    header: 'Status',
    render: (item: typeof appReviewData[0]) => {
      const variant = {
        Completed: 'success',
        'In Progress': 'info',
        Scheduled: 'primary',
        Overdue: 'danger',
      }[item.status] as 'success' | 'info' | 'primary' | 'danger';
      return <Badge variant={variant}>{item.status}</Badge>;
    },
  },
  {
    key: 'findingsCount',
    header: 'Findings',
    render: (item: typeof appReviewData[0]) => {
      if (item.findingsCount === 0) {
        return <span style={{ color: theme.colors.text.muted }}>-</span>;
      }
      const color = item.findingsCount >= 5 ? theme.colors.risk.critical :
                    item.findingsCount >= 3 ? theme.colors.risk.high :
                    theme.colors.risk.medium;
      return (
        <span style={{
          fontWeight: theme.typography.weights.semibold,
          color
        }}>
          {item.findingsCount}
        </span>
      );
    },
  },
];

export function AppReviewRegister() {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Application Review Register"
        description="Track periodic security reviews of business applications. Monitor review schedules, findings, and remediation status."
      />

      <DataTable
        data={appReviewData}
        columns={columns}
        searchPlaceholder="Search applications..."
        primaryAction={{
          label: 'New Application Review',
          onClick: () => console.log('New Application Review clicked'),
        }}
        filterOptions={['Completed', 'In Progress', 'Scheduled', 'Overdue']}
      />
    </div>
  );
}
