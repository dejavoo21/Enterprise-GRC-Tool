import type { Risk } from './riskEngine';

export type ScoreVector = {
  likelihood: number;
  impact: number;
};

export type ResidualRiskScore = {
  rawScore: number;
  normalizedScore: number;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeLikelihoodOrImpact(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function normalizeTo100(score: number): number {
  return clamp((score / 25) * 100);
}

export function calculateRiskSeverityScore(vector: ScoreVector): number {
  return normalizeLikelihoodOrImpact(vector.likelihood) * normalizeLikelihoodOrImpact(vector.impact);
}

export function calculateRiskExposureScore(risk: Risk): number {
  const inherent = calculateRiskSeverityScore(risk.inherent);
  const residual = calculateRiskSeverityScore(risk.residual);
  const target = risk.target ? calculateRiskSeverityScore(risk.target) : residual;
  const gap = Math.max(0, residual - target);

  return clamp(normalizeTo100(residual) + gap * 1.5);
}

export function calculateResidualRiskScore(risk: Risk, controlEffectivenessScore: number): ResidualRiskScore {
  const inherentScore = calculateRiskSeverityScore(risk.inherent);
  const statedResidual = calculateRiskSeverityScore(risk.residual);
  const controlAdjustmentFactor = clamp(1 - controlEffectivenessScore / 100, 0.05, 1);
  const modeledResidual = inherentScore * controlAdjustmentFactor;
  const weightedResidual = statedResidual * 0.55 + modeledResidual * 0.45;

  return {
    rawScore: Number(weightedResidual.toFixed(2)),
    normalizedScore: Number(normalizeTo100(weightedResidual).toFixed(2)),
  };
}
