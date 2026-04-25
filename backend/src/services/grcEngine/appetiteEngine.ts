import type { AppetiteConfig, AppetiteStatus, Risk } from './riskEngine';

export type AppetiteEvaluationResult = {
  threshold: number;
  status: AppetiteStatus;
  delta: number;
};

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

export function evaluateRiskAppetite(
  risk: Risk,
  residualScoreNormalized: number,
  appetiteConfig: AppetiteConfig,
): AppetiteEvaluationResult {
  const categoryKey = normalizeCategory(risk.category);
  const threshold =
    appetiteConfig.categoryThresholds?.[categoryKey] ?? appetiteConfig.defaultThreshold;
  const delta = residualScoreNormalized - threshold;

  return {
    threshold,
    status: delta > 0 ? 'Outside' : 'Within',
    delta: Math.round(delta * 100) / 100,
  };
}
