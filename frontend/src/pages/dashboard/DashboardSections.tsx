import { useMemo, type ReactNode } from 'react';
import { Badge, Button, Card } from '../../components';
import { theme } from '../../theme';
import type { Risk as EngineRisk } from '@/services/grcEngine/riskEngine';

export type Tone = 'default' | 'critical' | 'warning' | 'success';
export type ScoringMode = 'inherent' | 'residual' | 'target';

export const border = `1px solid ${theme.colors.border}`;

export function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function toneColors(tone: Tone) {
  if (tone === 'critical') return { bg: '#FEF2F2', fg: '#B91C1C', accent: theme.colors.semantic.danger };
  if (tone === 'warning') return { bg: '#FFFBEB', fg: '#92400E', accent: theme.colors.semantic.warning };
  if (tone === 'success') return { bg: '#F0FDF4', fg: '#166534', accent: theme.colors.semantic.success };
  return { bg: theme.colors.primaryLight, fg: theme.colors.text.main, accent: theme.colors.primary };
}

export function severityVariant(severity: string): 'danger' | 'warning' | 'success' | 'default' {
  if (severity === 'critical') return 'danger';
  if (severity === 'high') return 'warning';
  if (severity === 'low') return 'success';
  return 'default';
}

export function getFrameworkDisplayName(
  scoreKey: string,
  frameworkOptions: Array<{ value: string; label: string }>,
) {
  const match = frameworkOptions.find(
    (option) =>
      option.value === scoreKey ||
      option.value.toUpperCase().replace(/\s+/g, '_') === scoreKey,
  );
  return match?.label || titleCase(scoreKey);
}

export function SectionContainer({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card style={{ border, background: theme.colors.surface, boxShadow: theme.shadows.card }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[4], alignItems: 'flex-start', marginBottom: theme.spacing[4] }}>
        <div>
          <h3 style={{ margin: 0, fontSize: theme.typography.sizes.lg, color: theme.colors.text.main }}>{title}</h3>
          {subtitle ? <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.muted }}>{subtitle}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function KPIBox({
  title,
  value,
  subtitle,
  tone = 'default',
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: Tone;
}) {
  const colors = toneColors(tone);
  return (
    <Card style={{ border, background: theme.colors.surface, boxShadow: theme.shadows.card, padding: theme.spacing[4], minHeight: 122 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3] }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </div>
          <div style={{ marginTop: theme.spacing[3], fontSize: theme.typography.sizes['3xl'], fontWeight: theme.typography.weights.bold, color: colors.fg }}>
            {value}
          </div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
            {subtitle}
          </div>
        </div>
        <div style={{ width: 10, borderRadius: theme.borderRadius.full, backgroundColor: colors.accent }} />
      </div>
    </Card>
  );
}

export function ExceptionCard({
  title,
  count,
  tone,
  onClick,
}: {
  title: string;
  count: number;
  tone: Tone;
  onClick: () => void;
}) {
  const colors = toneColors(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: '100%', border: `1px solid ${colors.accent}`, background: colors.bg, borderRadius: theme.borderRadius.xl, padding: theme.spacing[4], textAlign: 'left', cursor: 'pointer' }}
    >
      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{title}</div>
      <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: colors.fg }}>{count}</div>
    </button>
  );
}

const scoringModeOptions: Array<{ value: ScoringMode; label: string }> = [
  { value: 'residual', label: 'Residual' },
  { value: 'inherent', label: 'Inherent' },
  { value: 'target', label: 'Target' },
];

export function RiskHeatmap({
  risks,
  scoringMode,
  onScoringModeChange,
}: {
  risks: EngineRisk[];
  scoringMode: ScoringMode;
  onScoringModeChange: (mode: ScoringMode) => void;
}) {
  const populatedMatrix = useMemo(() => {
    const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
    risks.forEach((risk) => {
      const point =
        scoringMode === 'inherent'
          ? risk.inherent
          : scoringMode === 'target'
            ? risk.target || risk.residual
            : risk.residual;
      matrix[Math.max(1, Math.min(5, point.likelihood)) - 1][Math.max(1, Math.min(5, point.impact)) - 1] += 1;
    });
    return matrix;
  }, [risks, scoringMode]);

  const cellColor = (l: number, i: number) => {
    const score = l * i;
    if (score >= 20) return '#F87171';
    if (score >= 12) return '#FB923C';
    if (score >= 6) return '#FACC15';
    return '#86EFAC';
  };

  return (
    <SectionContainer
      title="Enterprise Risk Concentration"
      subtitle="Prioritize upper-right quadrant. Appetite overlay can be layered here next."
      action={
        <select
          value={scoringMode}
          onChange={(event) => onScoringModeChange(event.target.value as ScoringMode)}
          style={{ border, borderRadius: theme.borderRadius.lg, padding: `${theme.spacing[2]} ${theme.spacing[3]}`, background: theme.colors.surface, color: theme.colors.text.main }}
        >
          {scoringModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(44px, 1fr))', gap: 8 }}>
        {[5, 4, 3, 2, 1].map((l) =>
          [1, 2, 3, 4, 5].map((i) => (
            <div key={`${l}-${i}`} style={{ height: 56, borderRadius: theme.borderRadius.lg, backgroundColor: cellColor(l, i), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: theme.typography.weights.bold }}>
              {populatedMatrix[l - 1][i - 1] || ''}
            </div>
          )),
        )}
      </div>
      <div style={{ marginTop: theme.spacing[3], display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
        <span>Lower impact</span>
        <span>Higher impact</span>
      </div>
    </SectionContainer>
  );
}

export function ControlPosture({
  controlStatus,
  evidenceCount,
  expiringEvidence,
  frameworkScores,
  frameworkOptions,
}: {
  controlStatus: { implemented: number; inProgress: number; notImplemented: number; notApplicable: number };
  evidenceCount: number;
  expiringEvidence: number;
  frameworkScores: Record<string, number>;
  frameworkOptions: Array<{ value: string; label: string }>;
}) {
  const total = Object.values(controlStatus).reduce((sum, value) => sum + value, 0);
  const items = [
    { label: 'Implemented', value: controlStatus.implemented, color: theme.colors.semantic.success },
    { label: 'In Progress', value: controlStatus.inProgress, color: theme.colors.semantic.warning },
    { label: 'Not Implemented', value: controlStatus.notImplemented, color: theme.colors.semantic.danger },
    { label: 'Not Applicable', value: controlStatus.notApplicable, color: theme.colors.text.muted },
  ];
  const freshness =
    expiringEvidence === 0
      ? 'Healthy freshness'
      : expiringEvidence <= 4
        ? 'Monitor freshness'
        : 'Freshness below target';

  const sortedFrameworkScores = Object.entries(frameworkScores)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  return (
    <SectionContainer title="Control & Evidence Posture" subtitle="Implementation distribution with evidence freshness and framework posture." action={<Badge variant="default" size="sm">{evidenceCount} evidence</Badge>}>
      <div style={{ display: 'grid', gap: theme.spacing[3] }}>
        {items.map((item) => (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
              <span style={{ color: theme.colors.text.secondary }}>{item.label}</span>
              <strong style={{ color: theme.colors.text.main }}>{item.value}</strong>
            </div>
            <div style={{ height: 10, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.borderLight }}>
              <div style={{ width: total ? `${Math.max(8, (item.value / total) * 100)}%` : '8%', height: '100%', borderRadius: theme.borderRadius.full, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: theme.spacing[4], padding: theme.spacing[4], borderRadius: theme.borderRadius.xl, backgroundColor: expiringEvidence === 0 ? '#F0FDF4' : expiringEvidence <= 4 ? '#FFFBEB' : '#FEF2F2', color: theme.colors.text.main }}>
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence Freshness</div>
        <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{freshness}</div>
        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{expiringEvidence} items expiring, stale, or missing</div>
      </div>
      <div style={{ marginTop: theme.spacing[4], display: 'grid', gap: theme.spacing[2] }}>
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Framework Scores
        </div>
        {sortedFrameworkScores.map(([framework, score]) => (
          <div key={framework} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>
            <span style={{ color: theme.colors.text.secondary }}>{getFrameworkDisplayName(framework, frameworkOptions)}</span>
            <strong style={{ color: theme.colors.text.main }}>{score}%</strong>
          </div>
        ))}
      </div>
    </SectionContainer>
  );
}

export function WorkspaceEmptyState({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div style={{ maxWidth: 1480, margin: '0 auto' }}>
      <SectionContainer title="Enterprise Risk Command Center" subtitle="Complete workspace setup to activate the dashboard.">
        <div style={{ display: 'flex', gap: theme.spacing[3], flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => onNavigate('workspace-new')}>Open Setup</Button>
          <Button variant="secondary" onClick={() => onNavigate('workspace-members')}>Invite Team Members</Button>
        </div>
      </SectionContainer>
    </div>
  );
}
