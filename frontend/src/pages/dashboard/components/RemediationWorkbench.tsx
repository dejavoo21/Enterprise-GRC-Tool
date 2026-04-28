import { Badge } from '../../../components';
import { SectionContainer, border } from '../DashboardSections';
import { theme } from '../../../theme';
import type { RemediationRow } from '@/services/dashboard/dashboardMetrics';

export type RemediationFilter = 'all' | 'overdue' | 'dueSoon' | 'inProgress' | 'blocked';

export function RemediationWorkbench({
  filter,
  onFilterChange,
  rows,
}: {
  filter: RemediationFilter;
  onFilterChange: (filter: RemediationFilter) => void;
  rows: RemediationRow[];
}) {
  return (
    <SectionContainer
      title="Risk Remediation Workbench"
      subtitle="Filter operational action by timing, blockage, and treatment progress."
    >
      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', marginBottom: theme.spacing[3] }}>
        {[
          ['all', 'All'],
          ['overdue', 'Overdue'],
          ['dueSoon', 'Due soon'],
          ['inProgress', 'In progress'],
          ['blocked', 'Blocked'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onFilterChange(value as RemediationFilter)}
            style={{
              border,
              borderRadius: theme.borderRadius.full,
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              background: filter === value ? theme.colors.primaryLight : theme.colors.surface,
              color: filter === value ? theme.colors.primary : theme.colors.text.secondary,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Action</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Owner</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Linked Risk</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Residual</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Target</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Due Date</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Progress</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Escalation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: border }}>
                <td style={{ padding: `${theme.spacing[3]} 0`, minWidth: 220, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{row.action}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.owner}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{row.linkedRisk}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.residualScore}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.targetScore}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.dueDate}</td>
                <td style={{ padding: `${theme.spacing[3]} 0` }}>
                  <Badge variant={row.progress >= 75 ? 'success' : row.progress >= 50 ? 'warning' : 'danger'} size="sm">
                    {row.progress}%
                  </Badge>
                </td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.escalation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
}

