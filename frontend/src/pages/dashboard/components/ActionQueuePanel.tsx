import { Button } from '../../../components';
import { SectionContainer } from '../DashboardSections';
import { theme } from '../../../theme';

export function ActionQueuePanel({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  return (
    <SectionContainer
      title="Immediate Action Queue"
      subtitle="Fast operational decisions and drill-down actions."
    >
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        <Button variant="secondary" onClick={() => onNavigate('risks')}>
          View Risks
        </Button>
        <Button variant="secondary" onClick={() => onNavigate('controls')}>
          Review Controls
        </Button>
        <Button variant="secondary" onClick={() => onNavigate('evidence')}>
          Request Evidence
        </Button>
        <Button variant="secondary" onClick={() => onNavigate('issues')}>
          Escalate
        </Button>
        <Button variant="secondary" onClick={() => onNavigate('review-tasks')}>
          Open Treatment Plan
        </Button>
        <Button variant="secondary" onClick={() => onNavigate('reports')}>
          Export Snapshot
        </Button>
      </div>
    </SectionContainer>
  );
}

