import { Badge, Card } from '../../../components';
import { SectionContainer, border } from '../DashboardSections';
import { theme } from '../../../theme';
import type { FrameworkRow } from '@/services/dashboard/dashboardMetrics';

export function FrameworkPosturePanel({
  selectedFramework,
  rows,
}: {
  selectedFramework: string;
  rows: FrameworkRow[];
}) {
  const highlighted = rows[0];
  return (
    <SectionContainer
      title="Framework Posture"
      subtitle="Coverage, posture, and appetite linkage for the selected scope."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[2], marginBottom: theme.spacing[3] }}>
        {rows.slice(0, 3).map((row) => (
          <Card key={row.framework} style={{ border, background: theme.colors.surface, padding: theme.spacing[3] }}>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{row.framework}</div>
            <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{row.coverage}%</div>
            <div style={{ marginTop: theme.spacing[2] }}>
              <Badge variant={row.posture === 'critical' ? 'danger' : row.posture === 'warning' ? 'warning' : 'success'} size="sm">
                {row.appetiteBreaches} breaches
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ border, background: theme.colors.surface, marginBottom: theme.spacing[3] }}>
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Selected Framework
        </div>
        <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.bold }}>
          {selectedFramework === 'ALL' ? 'All Frameworks' : selectedFramework}
        </div>
        {highlighted ? (
          <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Coverage</span><strong>{highlighted.coverage}%</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Controls Mapped</span><strong>{highlighted.controlsMapped}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Evidence Available</span><strong>{highlighted.evidenceAvailable}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Risks Linked</span><strong>{highlighted.risksLinked}</strong></div>
          </div>
        ) : null}
      </Card>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Framework</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Coverage</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Controls</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Evidence</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Breaches</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row) => (
              <tr key={row.framework} style={{ borderTop: border }}>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.framework}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.coverage}%</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.controlsMapped}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.evidenceAvailable}</td>
                <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={row.appetiteBreaches > 0 ? 'danger' : 'success'} size="sm">{row.appetiteBreaches}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
}

