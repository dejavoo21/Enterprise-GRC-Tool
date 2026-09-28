import { targetRiskScore, riskMovement, riskReduction, scoreLabel, validScore, type Scores } from '../lib/riskScoreProfile';
import { weightedScore } from '../lib/methodologyMatrix';
import './RiskScoreProfile.css';
export function RiskScoreProfile({ risk }: { risk: Scores }) {
  const config = risk.methodology?.config;
  const score = risk.residualScore;
  const reduction = riskReduction(risk);
  const weightedProfiles = config?.scoringMethod === 'weighted' ? [
    ['Inherent risk', weightedScore(config, risk.inherentFactors)],
    ['Current residual risk', weightedScore(config, risk.residualFactors)],
    ['Target risk', weightedScore(config, risk.targetFactors)],
  ] as const : [];
  return <section className="riskScoreProfile" aria-label="Risk Score Profile"><h3>Risk Score Profile</h3>
    <p>{risk.methodology ? `${risk.methodology.config.name} v${risk.methodology.version}` : risk.methodologyId ? `Methodology v${risk.methodologyVersion ?? 'unknown'} - configuration unavailable` : 'Methodology version: Not recorded (legacy rating bands)'}</p>
    {config && <p><strong>Scoring method:</strong> {config.scoringMethod === 'weighted' ? 'Weighted scoring' : 'Matrix scoring'}</p>}
    <dl>{([['Inherent risk', risk.inherentScore], ['Current residual risk', risk.residualScore], ['Target risk', targetRiskScore(risk)]] as const).map(([name, score]) => <div key={name}><dt>{name}</dt><dd><strong className={validScore(score) === null ? 'riskScoreMissing' : undefined}>{validScore(score) ?? 'Not set'}</strong><span>{validScore(score) === null ? 'Not recorded' : scoreLabel(risk, score).split(' - ').slice(1).join(' - ')}</span></dd></div>)}</dl>
    <p>{riskMovement(risk)}{reduction !== null && ` · ${Math.abs(reduction)}% ${reduction < 0 ? 'increase' : 'reduction'} from inherent`}</p><small>Inherent: before controls. Current residual: after existing controls. Target: desired position after treatment. Treatment forecasts do not update current residual risk.</small>
    {config && typeof score === 'number' && Number.isFinite(score) && <p aria-label="Methodology threshold indicators">
      {score > config.appetiteMaxScore ? 'Outside appetite' : 'Within appetite'}
      {Number.isFinite(config.treatmentRequiredFromScore) && ` · Treatment ${score >= config.treatmentRequiredFromScore ? 'required' : 'threshold not reached'}`}
      {Number.isFinite(config.escalationRequiredFromScore) && ` · Escalation ${score >= config.escalationRequiredFromScore ? 'required' : 'threshold not reached'}`}
      {' · Indicators only; no workflow tasks are automatically created.'}
    </p>}
    {weightedProfiles.map(([label, profile]) => profile && <div className="riskScoreBreakdown" aria-label={`${label} weighted factor breakdown`} key={label}>
      <h4>{label} factor breakdown</h4>
      {profile.breakdown.map(item => item && <p key={item.key}><span>{item.label}</span><strong>{item.score} × {item.weight}% = {item.contribution.toFixed(2)}</strong></p>)}
      <p><span>Weighted score</span><strong>{profile.score.toFixed(1)} / {Math.max(...(config!.weightedFactors || []).filter(f => f.enabled).map(f => f.maxScore))}</strong></p>
    </div>)}
  </section>;
}
