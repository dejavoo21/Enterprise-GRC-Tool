import { targetRiskScore, riskMovement, scoreLabel, type Scores } from '../lib/riskScoreProfile';
import './RiskScoreProfile.css';
export function RiskScoreProfile({ risk }: { risk: Scores }) {
  const config = risk.methodology?.config;
  const score = risk.residualScore;
  return <section className="riskScoreProfile" aria-label="Risk Score Profile"><h3>Risk Score Profile</h3>
    <p>{risk.methodology ? `${risk.methodology.config.name} v${risk.methodology.version}` : risk.methodologyId ? `Methodology v${risk.methodologyVersion ?? 'unknown'} - configuration unavailable` : 'Methodology version: Not recorded (legacy rating bands)'}</p>
    <dl>{([['Inherent risk', risk.inherentScore], ['Current residual risk', risk.residualScore], ['Target risk', targetRiskScore(risk)]] as const).map(([name, score]) => <div key={name}><dt>{name}</dt><dd>{scoreLabel(risk, score)}</dd></div>)}</dl>
    <p>{riskMovement(risk)}</p><small>Inherent: before controls. Current residual: after existing controls. Target: desired position after treatment. Treatment forecasts do not update current residual risk.</small>
    {config && typeof score === 'number' && Number.isFinite(score) && <p aria-label="Methodology threshold indicators">
      {score > config.appetiteMaxScore ? 'Outside appetite' : 'Within appetite'}
      {Number.isInteger(config.treatmentRequiredFromScore) && ` · Treatment ${score >= config.treatmentRequiredFromScore ? 'required' : 'threshold not reached'}`}
      {Number.isInteger(config.escalationRequiredFromScore) && ` · Escalation ${score >= config.escalationRequiredFromScore ? 'required' : 'threshold not reached'}`}
      {' · Indicators only; no workflow tasks are automatically created.'}
    </p>}
  </section>;
}
