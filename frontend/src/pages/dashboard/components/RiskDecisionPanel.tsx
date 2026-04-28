import { Badge, Card, Button } from '../../../components';
import { SectionContainer, type Tone } from '../DashboardSections';
import { theme } from '../../../theme';

export type RiskDecisionItem = {
  label: string;
  count: number;
  reason: string;
  owner: string;
  nextAction: string;
  tone: Tone;
};

export function RiskDecisionPanel({
  decisions,
  onNavigate,
}: {
  decisions: RiskDecisionItem[];
  onNavigate: (path: string) => void;
}) {
  return (
    <SectionContainer
      title="Top 3 Decisions Required"
      subtitle="Immediate executive decisions driving posture movement."
      action={<Button variant="secondary" onClick={() => onNavigate('review-tasks')}>Open Queue</Button>}
    >
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        {decisions.slice(0, 3).map((decision) => (
          <Card key={decision.label} style={{ border: `1px solid ${theme.colors.border}`, background: theme.colors.surface, padding: theme.spacing[3] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                {decision.label}
              </div>
              <Badge variant={decision.tone === 'critical' ? 'danger' : decision.tone === 'warning' ? 'warning' : 'success'} size="sm">
                {decision.count}
              </Badge>
            </div>
            <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              {decision.reason}
            </div>
            <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
              Owner: {decision.owner}
            </div>
            <div style={{ marginTop: theme.spacing[3] }}>
              <Button variant="secondary" onClick={() => onNavigate('review-tasks')}>
                {decision.nextAction}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </SectionContainer>
  );
}

