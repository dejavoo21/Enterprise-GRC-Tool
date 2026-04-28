import { Badge } from '../../../components';
import { SectionContainer, border } from '../DashboardSections';
import { theme } from '../../../theme';
import type { AppetiteRow } from '@/services/dashboard/dashboardMetrics';

export function AppetiteBreachMatrix({
  rows,
}: {
  rows: AppetiteRow[];
}) {
  return (
    <SectionContainer
      title="Appetite Breach Matrix"
      subtitle="Residual scores versus appetite thresholds, sorted with breaches first."
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Risk Domain</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Appetite</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Threshold</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Current Residual</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Variance</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Status</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Owner</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Next Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} style={{ borderTop: border }}>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{row.label}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.appetiteLevel}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.threshold}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.residualScore}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: row.variance > 0 ? theme.colors.semantic.danger : theme.colors.semantic.success }}>
                  {row.variance > 0 ? `+${row.variance}` : row.variance}
                </td>
                <td style={{ padding: `${theme.spacing[3]} 0` }}>
                  <Badge variant={row.status === 'Within Appetite' ? 'success' : row.status === 'Breaching' ? 'warning' : 'danger'} size="sm">
                    {row.status}
                  </Badge>
                </td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.owner}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
}

