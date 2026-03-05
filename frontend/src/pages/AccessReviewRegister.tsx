import { theme } from '../theme';
import { PageHeader, Badge } from '../components';
import { DataTable } from '../components/DataTable';

const accessReviewData = [
  { id: 'ACR-001', system: 'AWS Production', owner: 'DevOps Team', reviewPeriod: 'Q1 2024', status: 'Completed', issuesFound: 3 },
  { id: 'ACR-002', system: 'Azure AD', owner: 'IAM Team', reviewPeriod: 'Q1 2024', status: 'Completed', issuesFound: 1 },
  { id: 'ACR-003', system: 'GitHub Enterprise', owner: 'Engineering', reviewPeriod: 'Q1 2024', status: 'In Progress', issuesFound: 0 },
  { id: 'ACR-004', system: 'Salesforce', owner: 'Sales Ops', reviewPeriod: 'Q4 2023', status: 'Overdue', issuesFound: 7 },
  { id: 'ACR-005', system: 'SAP ERP', owner: 'Finance', reviewPeriod: 'Q1 2024', status: 'Completed', issuesFound: 2 },
  { id: 'ACR-006', system: 'ServiceNow', owner: 'IT Ops', reviewPeriod: 'Q1 2024', status: 'In Progress', issuesFound: 0 },
  { id: 'ACR-007', system: 'Workday', owner: 'HR', reviewPeriod: 'Q1 2024', status: 'Scheduled', issuesFound: 0 },
  { id: 'ACR-008', system: 'Jira/Confluence', owner: 'Engineering', reviewPeriod: 'Q4 2023', status: 'Overdue', issuesFound: 4 },
  { id: 'ACR-009', system: 'Database Admin Access', owner: 'DBA Team', reviewPeriod: 'Q1 2024', status: 'Completed', issuesFound: 0 },
  { id: 'ACR-010', system: 'VPN Access', owner: 'Network Team', reviewPeriod: 'Q1 2024', status: 'Completed', issuesFound: 5 },
];

const columns = [
  { key: 'id', header: 'ID', width: '100px' },
  {
    key: 'system',
    header: 'System',
    render: (item: typeof accessReviewData[0]) => (
      <span style={{ fontWeight: theme.typography.weights.medium }}>{item.system}</span>
    ),
  },
  { key: 'owner', header: 'Owner' },
  { key: 'reviewPeriod', header: 'Review Period' },
  {
    key: 'status',
    header: 'Status',
    render: (item: typeof accessReviewData[0]) => {
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
    key: 'issuesFound',
    header: 'Issues Found',
    render: (item: typeof accessReviewData[0]) => {
      if (item.issuesFound === 0) {
        return <Badge variant="success">None</Badge>;
      }
      const variant = item.issuesFound >= 5 ? 'critical' :
                      item.issuesFound >= 3 ? 'high' :
                      'medium';
      return (
        <Badge variant={variant as 'critical' | 'high' | 'medium'}>
          {item.issuesFound} issue{item.issuesFound > 1 ? 's' : ''}
        </Badge>
      );
    },
  },
];

export function AccessReviewRegister() {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Access Review Register"
        description="Manage periodic access reviews across systems. Track user access certifications, revocations, and compliance with least-privilege principles."
      />

      <DataTable
        data={accessReviewData}
        columns={columns}
        searchPlaceholder="Search systems..."
        primaryAction={{
          label: 'New Access Review',
          onClick: () => console.log('New Access Review clicked'),
        }}
        filterOptions={['Completed', 'In Progress', 'Scheduled', 'Overdue']}
      />
    </div>
  );
}
