import { axisScore, ratingFor, type MethodologyVersion } from './methodologyMatrix';
import { getRiskSeverityLabel } from '../types/risk';
export type Scores = {
  residualRating?: string | null;
  inherentScore?: number | null; residualScore?: number | null;
  targetScore?: number | null;
  targetLikelihood?: number | null; targetImpact?: number | null;
  methodologyId?: string | null; methodologyVersion?: number | null; methodology?: MethodologyVersion | null;
};
export function validScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? value : null;
}
export function targetRiskScore(risk: Scores): number | null {
  if (risk.targetScore !== undefined) return validScore(risk.targetScore);
  if (risk.methodology) return axisScore(risk.methodology.config, risk.targetLikelihood, risk.targetImpact);
  if (risk.methodologyId) return null; // Never apply legacy axes to an unknown pinned version.
  const { targetLikelihood: l, targetImpact: i } = risk;
  return typeof l === 'number' && typeof i === 'number' && Number.isInteger(l) && Number.isInteger(i) && l >= 1 && l <= 5 && i >= 1 && i <= 5 ? l * i : null;
}
export function scoreLabel(risk: Scores, value: unknown): string {
  const score = validScore(value);
  if (score === null) return 'Not set';
  const rating = risk.methodology ? ratingFor(risk.methodology.config, score)?.label || 'Rating not configured' : risk.methodologyId ? 'Methodology unavailable' : getRiskSeverityLabel(score);
  return `${Math.round(score)} - ${rating}`;
}
export function riskMovement(risk: Scores): string {
  const target = targetRiskScore(risk);
  const residual = validScore(risk.residualScore);
  const inherent = validScore(risk.inherentScore);
  if (target === null) return 'Target not set';
  if (residual === null) return 'Current residual risk not set';
  if (residual <= target) return 'Target achieved';
  if (inherent === null) return 'Inherent risk not set';
  if (residual < inherent) return 'Improving toward target';
  return 'No reduction yet';
}

export function residualRating(risk: Scores): string {
  if (risk.residualRating) return risk.residualRating;
  const value = validScore(risk.residualScore);
  if (value === null) return 'Not set';
  if (risk.methodology) return ratingFor(risk.methodology.config, value)?.label ?? 'Rating not configured';
  return risk.methodologyId ? 'Methodology unavailable' : getRiskSeverityLabel(value);
}
