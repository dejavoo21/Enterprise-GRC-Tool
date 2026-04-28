import { Button } from '../../../components';
import { border } from '../DashboardSections';
import { theme } from '../../../theme';

type Option = { value: string; label: string };

export function ExecutiveCommandBar({
  selectedFramework,
  frameworkOptions,
  scoringMode,
  onFrameworkChange,
  onScoringModeChange,
  onExport,
}: {
  selectedFramework: string;
  frameworkOptions: Option[];
  scoringMode: string;
  onFrameworkChange: (value: string) => void;
  onScoringModeChange: (value: string) => void;
  onExport: () => void;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: theme.colors.background,
        paddingBottom: theme.spacing[2],
        borderBottom: border,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: theme.spacing[3],
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: theme.typography.sizes.xs,
              fontWeight: theme.typography.weights.semibold,
              color: theme.colors.text.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Enterprise Risk Command Center
          </div>
          <h2
            style={{
              margin: `${theme.spacing[1]} 0 0 0`,
              fontSize: theme.typography.sizes['2xl'],
              color: theme.colors.text.main,
            }}
          >
            Board-ready risk operating view
          </h2>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          <select
            value={selectedFramework}
            onChange={(event) => onFrameworkChange(event.target.value)}
            style={{
              border,
              borderRadius: theme.borderRadius.lg,
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              background: theme.colors.surface,
              color: theme.colors.text.main,
            }}
          >
            {frameworkOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={scoringMode}
            onChange={(event) => onScoringModeChange(event.target.value)}
            style={{
              border,
              borderRadius: theme.borderRadius.lg,
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              background: theme.colors.surface,
              color: theme.colors.text.main,
            }}
          >
            <option value="inherent">Inherent</option>
            <option value="residual">Residual</option>
            <option value="target">Target</option>
            <option value="appetite">Appetite Breach</option>
          </select>
          <Button variant="secondary" onClick={onExport}>
            Export Snapshot
          </Button>
        </div>
      </div>
    </div>
  );
}

