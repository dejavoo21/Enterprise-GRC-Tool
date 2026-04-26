import { Badge, Card } from '../../components';
import { theme } from '../../theme';
import {
  border,
  SectionContainer,
  titleCase,
  toneColors,
  type Tone,
} from './DashboardSections';
import type { Risk as EngineRisk } from '@/services/grcEngine/riskEngine';
import { evaluateRiskAppetiteStatus } from '@/services/grcEngine/riskEngine';

export type ScoringMode = 'inherent' | 'residual' | 'target' | 'appetite';

export type AppetiteRow = {
  label: string;
  threshold: number;
  appetiteLevel: string;
  residualScore: number;
  status: 'Within Appetite' | 'Breaching' | 'Exceeded';
  action: string;
};

export type WeightedFactor = {
  label: string;
  weight: number;
  score: number;
};

export type RemediationRow = {
  id: string;
  owner: string;
  linkedRisk: string;
  dueBucket: string;
  targetScore: number;
  residualScore: number;
  progress: number;
};

export type InfoSecRow = {
  label: string;
  linkedRisks: number;
  controlGaps: number;
  evidenceGaps: number;
  remediation: number;
};

export type FrameworkRow = {
  framework: string;
  coverage: number;
  controlsMapped: number;
  evidenceAvailable: number;
  risksLinked: number;
  appetiteBreaches: number;
};

export function toneFromStatus(status: string): Tone {
  if (status === 'Exceeded' || status === 'Outside') return 'critical';
  if (status === 'Breaching') return 'warning';
  return 'success';
}

export function getFrameworkDisplayName(key: string, options: Array<{ value: string; label: string }>) {
  const match = options.find(
    (option) =>
      option.value === key ||
      option.value.toUpperCase().replace(/\s+/g, '_') === key,
  );
  return match?.label || titleCase(key);
}

export function RiskFoundationFlow({
  inherentScore,
  residualScore,
  targetScore,
  appetiteThreshold,
  thresholdBand,
}: {
  inherentScore: number;
  residualScore: number;
  targetScore: number;
  appetiteThreshold: number;
  thresholdBand: number;
}) {
  const steps = [
    { label: 'Inherent Risk', value: `${inherentScore}`, tone: 'critical' as Tone },
    { label: 'Controls Applied', value: `${Math.max(0, inherentScore - residualScore)}`, tone: 'default' as Tone },
    { label: 'Residual Risk', value: `${residualScore}`, tone: residualScore > appetiteThreshold ? 'warning' : 'success' as Tone },
    { label: 'Appetite Check', value: residualScore > appetiteThreshold ? 'Breaching' : 'Within', tone: residualScore > appetiteThreshold ? 'critical' : 'success' as Tone },
    { label: 'Remediation Plan', value: `${Math.max(0, residualScore - targetScore)} delta`, tone: 'default' as Tone },
    { label: 'Target Risk', value: `${targetScore}`, tone: 'success' as Tone },
  ];

  return (
    <SectionContainer title="Risk Assessment Foundation" subtitle="Inherent Risk → Controls Applied → Residual Risk → Appetite Check → Remediation Plan → Target Risk">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        {steps.map((step) => (
          <div key={step.label} style={{ border, borderRadius: theme.borderRadius.xl, padding: theme.spacing[3], background: theme.colors.surfaceHover }}>
            <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.colors.text.muted }}>{step.label}</div>
            <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: toneColors(step.tone).accent }}>{step.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: theme.spacing[4], display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <Card style={{ border, background: theme.colors.surface }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Appetite</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.bold }}>{appetiteThreshold}</div>
        </Card>
        <Card style={{ border, background: theme.colors.surface }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Threshold</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.bold }}>{thresholdBand}</div>
        </Card>
        <Card style={{ border, background: theme.colors.surface }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Reduction Path</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.bold, color: theme.colors.semantic.success }}>{Math.max(0, residualScore - targetScore)} points to target</div>
        </Card>
      </div>
    </SectionContainer>
  );
}

export function AppetiteThresholdTable({ rows }: { rows: AppetiteRow[] }) {
  return (
    <SectionContainer title="Risk Appetite & Threshold View" subtitle="Residual scores are evaluated against category appetite thresholds and action bands.">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Risk Category</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Appetite Level</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Threshold</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Current Residual</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Status</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Required Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} style={{ borderTop: border }}>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{row.label}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.appetiteLevel}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.threshold}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.residualScore}</td>
                <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={row.status === 'Within Appetite' ? 'success' : row.status === 'Breaching' ? 'warning' : 'danger'} size="sm">{row.status}</Badge></td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
}

export function WeightedRiskProfile({ factors, finalScore }: { factors: WeightedFactor[]; finalScore: number }) {
  return (
    <SectionContainer title="Weighted Risk Profile" subtitle="Priority scoring blends exposure, control weakness, evidence confidence, vendor exposure, and regulatory impact.">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) 320px', gap: theme.spacing[4] }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Factor</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Weight</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Score</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {factors.map((factor) => (
                <tr key={factor.label} style={{ borderTop: border }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{factor.label}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{Math.round(factor.weight * 100)}%</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{factor.score}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{Math.round(factor.score * factor.weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card style={{ border, background: theme.colors.surfaceHover, display: 'grid', alignContent: 'center' }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Weighted Priority Score</div>
          <div style={{ marginTop: theme.spacing[3], fontSize: '3rem', fontWeight: theme.typography.weights.bold, color: finalScore >= 70 ? theme.colors.semantic.danger : finalScore >= 50 ? theme.colors.semantic.warning : theme.colors.semantic.success }}>{finalScore}</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            {finalScore >= 70 ? 'Escalate for executive remediation.' : finalScore >= 50 ? 'Active treatment plan required.' : 'Within manageable operating range.'}
          </div>
        </Card>
      </div>
    </SectionContainer>
  );
}

export function EnhancedRiskHeatmap({
  risks,
  scoringMode,
  onScoringModeChange,
}: {
  risks: EngineRisk[];
  scoringMode: ScoringMode;
  onScoringModeChange: (mode: ScoringMode) => void;
}) {
  const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({ count: 0, breaches: 0 })));
  risks.forEach((risk) => {
    const evaluation = evaluateRiskAppetiteStatus(risk, { frameworks: risk.frameworks.map((mapping) => mapping.framework) });
    const point =
      scoringMode === 'inherent'
        ? risk.inherent
        : scoringMode === 'target'
          ? risk.target || risk.residual
          : risk.residual;
    const cell = matrix[Math.max(1, Math.min(5, point.likelihood)) - 1][Math.max(1, Math.min(5, point.impact)) - 1];
    cell.count += 1;
    if (evaluation.appetiteStatus === 'Outside') cell.breaches += 1;
  });

  const cellColor = (count: number, breaches: number, score: number) => {
    if (scoringMode === 'appetite') {
      if (breaches > 0) return '#FCA5A5';
      if (count > 0) return '#E5E7EB';
      return '#F8FAFC';
    }
    if (score >= 20) return '#F87171';
    if (score >= 12) return '#FB923C';
    if (score >= 6) return '#FACC15';
    return '#86EFAC';
  };

  return (
    <SectionContainer
      title="Risk Heatmap Enhancement"
      subtitle="Switch between inherent, residual, target, and appetite breach views to assess concentration and escalation pressure."
      action={
        <select
          value={scoringMode}
          onChange={(event) => onScoringModeChange(event.target.value as ScoringMode)}
          style={{ border, borderRadius: theme.borderRadius.lg, padding: `${theme.spacing[2]} ${theme.spacing[3]}`, background: theme.colors.surface, color: theme.colors.text.main }}
        >
          {[
            ['inherent', 'Inherent Risk'],
            ['residual', 'Residual Risk'],
            ['target', 'Target Risk'],
            ['appetite', 'Appetite Breach View'],
          ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(44px, 1fr))', gap: 8 }}>
        {[5, 4, 3, 2, 1].map((likelihood) =>
          [1, 2, 3, 4, 5].map((impact) => {
            const cell = matrix[likelihood - 1][impact - 1];
            return (
              <div key={`${likelihood}-${impact}`} style={{ minHeight: 62, borderRadius: theme.borderRadius.lg, border: cell.breaches > 0 ? `2px solid ${theme.colors.semantic.danger}` : border, backgroundColor: cellColor(cell.count, cell.breaches, likelihood * impact), display: 'grid', placeItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: theme.typography.weights.bold }}>{cell.count || ''}</div>
                  {cell.breaches > 0 ? <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.semantic.danger }}>{cell.breaches} breach</div> : null}
                </div>
              </div>
            );
          }),
        )}
      </div>
      <div style={{ marginTop: theme.spacing[3], display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
        <span>Lower impact</span>
        <span>Higher impact</span>
      </div>
    </SectionContainer>
  );
}

export function InfoSecRiskLinkage({ rows }: { rows: InfoSecRow[] }) {
  return (
    <SectionContainer title="Information Security Risk Linkage" subtitle="Risk exposure, control gaps, evidence gaps, and remediation status aligned to core InfoSec operating areas.">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>InfoSec Area</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Linked Risks</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Control Gaps</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Evidence Gaps</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Remediation Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} style={{ borderTop: border }}>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.label}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.linkedRisks}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.controlGaps}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.evidenceGaps}</td>
                <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={row.remediation >= 75 ? 'success' : row.remediation >= 50 ? 'warning' : 'danger'} size="sm">{row.remediation}% complete</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
}

export function RemediationCenter({
  rows,
  openActions,
  overdueActions,
  dueIn30Days,
}: {
  rows: RemediationRow[];
  openActions: number;
  overdueActions: number;
  dueIn30Days: number;
}) {
  return (
    <SectionContainer title="Risk Remediation Center" subtitle="Track owners, current residual scores, target scores, and progress toward appetite.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3], marginBottom: theme.spacing[4] }}>
        <Card style={{ border, background: theme.colors.surfaceHover }}><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open Remediation Actions</div><div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{openActions}</div></Card>
        <Card style={{ border, background: '#FEF2F2' }}><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overdue Actions</div><div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.semantic.danger }}>{overdueActions}</div></Card>
        <Card style={{ border, background: '#FFFBEB' }}><div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Due In 30 Days</div><div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.semantic.warning }}>{dueIn30Days}</div></Card>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Owner</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Linked Risk</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Timing</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Target Risk Score</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Current Residual</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: border }}>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.owner}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.linkedRisk}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{row.dueBucket}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.targetScore}</td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.residualScore}</td>
                <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={row.progress >= 75 ? 'success' : row.progress >= 50 ? 'warning' : 'danger'} size="sm">{row.progress}%</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
}

export function FrameworkAlignmentPanel({
  selectedFramework,
  rows,
}: {
  selectedFramework: string;
  rows: FrameworkRow[];
}) {
  const highlighted = rows[0];
  return (
    <SectionContainer title="Framework Alignment" subtitle="Coverage, mapping density, evidence support, linked risks, and appetite breaches by framework.">
      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <Card style={{ border, background: theme.colors.surfaceHover }}>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected Framework</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold }}>{selectedFramework === 'ALL' ? 'All Frameworks' : selectedFramework}</div>
          {highlighted ? (
            <div style={{ marginTop: theme.spacing[4], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Coverage</span><strong>{highlighted.coverage}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Controls Mapped</span><strong>{highlighted.controlsMapped}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Evidence Available</span><strong>{highlighted.evidenceAvailable}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Risks Linked</span><strong>{highlighted.risksLinked}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: theme.colors.text.secondary }}>Appetite Breaches</span><strong style={{ color: theme.colors.semantic.danger }}>{highlighted.appetiteBreaches}</strong></div>
            </div>
          ) : null}
        </Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Framework</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Coverage %</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Controls Mapped</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Evidence Available</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Risks Linked</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Breaches Linked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.framework} style={{ borderTop: border }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.framework}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.coverage}%</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.controlsMapped}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.evidenceAvailable}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm }}>{row.risksLinked}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0` }}><Badge variant={row.appetiteBreaches > 0 ? 'danger' : 'success'} size="sm">{row.appetiteBreaches}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SectionContainer>
  );
}
