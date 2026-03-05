import { theme } from '../theme';
import { PageHeader, Badge } from '../components';
import { DataTable } from '../components/DataTable';

const issuesData = [
  { id: 'ISS-001', title: 'Expired SSL certificates on production servers', owner: 'Mike Ross', status: 'Open', priority: 'Critical', dueDate: '2024-03-10' },
  { id: 'ISS-002', title: 'Missing access reviews for Q4', owner: 'Sarah Kim', status: 'In Progress', priority: 'High', dueDate: '2024-03-15' },
  { id: 'ISS-003', title: 'Outdated firewall rules', owner: 'Network Team', status: 'Open', priority: 'High', dueDate: '2024-03-20' },
  { id: 'ISS-004', title: 'Incomplete vendor security questionnaires', owner: 'Lisa Chen', status: 'Pending', priority: 'Medium', dueDate: '2024-03-25' },
  { id: 'ISS-005', title: 'Audit log retention not configured', owner: 'IT Ops', status: 'In Progress', priority: 'Medium', dueDate: '2024-03-30' },
  { id: 'ISS-006', title: 'Missing data classification labels', owner: 'Data Team', status: 'Open', priority: 'Medium', dueDate: '2024-04-05' },
  { id: 'ISS-007', title: 'Security training completion below target', owner: 'HR', status: 'Resolved', priority: 'Low', dueDate: '2024-04-10' },
  { id: 'ISS-008', title: 'Documentation gaps in DR plan', owner: 'IT Ops', status: 'Pending', priority: 'Low', dueDate: '2024-04-15' },
  { id: 'ISS-009', title: 'Delayed penetration test remediation', owner: 'Security Ops', status: 'Open', priority: 'Critical', dueDate: '2024-03-08' },
  { id: 'ISS-010', title: 'Non-compliant password policy', owner: 'IAM Team', status: 'Resolved', priority: 'High', dueDate: '2024-04-20' },
];

const columns = [
  { key: 'id', header: 'ID', width: '100px' },
  {
    key: 'title',
    header: 'Title',
    render: (item: typeof issuesData[0]) => (
      <span style={{ fontWeight: theme.typography.weights.medium }}>{item.title}</span>
    ),
  },
  { key: 'owner', header: 'Owner' },
  {
    key: 'status',
    header: 'Status',
    render: (item: typeof issuesData[0]) => {
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
    render: (item: typeof issuesData[0]) => {
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
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Issues & Actions"
        description="Track issues, findings, and action items. Monitor remediation progress and ensure timely resolution."
      />

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
