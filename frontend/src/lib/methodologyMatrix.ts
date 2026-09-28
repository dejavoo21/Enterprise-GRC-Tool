export type MethodologyLevel = { value: number; label: string; description: string };
export type MethodologyBand = { label: string; minScore: number; maxScore: number; colour: string; severityOrder: number };
export type WeightedFactor = { key: string; label: string; enabled: boolean; weight: number; minScore: number; maxScore: number; description: string; displayOrder: number };
export type MethodologyConfig = {
  name: string; description: string; scoringMethod: 'multiplication' | 'weighted';
  likelihoodLevels: MethodologyLevel[]; impactLevels: MethodologyLevel[]; ratingBands: MethodologyBand[];
  appetiteMaxScore: number; treatmentRequiredFromScore: number; escalationRequiredFromScore: number; targetRequired: boolean;
  weightedFactors?: WeightedFactor[];
};
export type MethodologyVersion = { id: string; workspaceId: string; version: number; status: 'Draft' | 'Active' | 'Retired'; config: MethodologyConfig; updatedAt: string };
export type MatrixRisk = {
  id: string; category: string; methodologyId?: string | null; methodologyVersion?: number | null;
  inherentLikelihood?: number | null; inherentImpact?: number | null;
  residualLikelihood?: number | null; residualImpact?: number | null;
  targetLikelihood?: number | null; targetImpact?: number | null;
};
export function axisScore(config: MethodologyConfig, likelihood: unknown, impact: unknown): number | null {
  if (config.scoringMethod !== 'multiplication' || typeof likelihood !== 'number' || typeof impact !== 'number') return null;
  if (!config.likelihoodLevels.some(level => level.value === likelihood) || !config.impactLevels.some(level => level.value === impact)) return null;
  return likelihood * impact;
}
export function weightedScore(config: MethodologyConfig, values: Record<string, number> | null | undefined) {
  if (config.scoringMethod !== 'weighted' || !values) return null;
  const breakdown = (config.weightedFactors || []).filter(f => f.enabled).map(factor => {
    const score = values[factor.key];
    if (typeof score !== 'number' || score < factor.minScore || score > factor.maxScore) return null;
    return { ...factor, score, contribution: score * factor.weight / 100 };
  });
  if (breakdown.some(item => item === null)) return null;
  return { score: Number(breakdown.reduce((sum, item) => sum + item!.contribution, 0).toFixed(1)), breakdown: breakdown.filter(Boolean) };
}
export function ratingFor(config: MethodologyConfig, score: number | null | undefined) {
  return score == null || !Number.isFinite(score) ? null : config.ratingBands.find(band => score >= band.minScore && score <= band.maxScore) || null;
}
export function matrixScope<T extends MatrixRisk>(risks: T[], active: MethodologyVersion | null): T[] {
  return risks.filter(risk => active ? risk.methodologyId === active.id && risk.methodologyVersion === active.version : !risk.methodologyId);
}
export function buildMatrix(config: MethodologyConfig, risks: MatrixRisk[], kind: 'inherent' | 'residual' | 'target') {
  return [...config.likelihoodLevels].reverse().map(likelihood => config.impactLevels.map(impact => {
    const score = axisScore(config, likelihood.value, impact.value);
    return { likelihood, impact, score, band: ratingFor(config, score), count: risks.filter(risk => risk[`${kind}Likelihood`] === likelihood.value && risk[`${kind}Impact`] === impact.value).length };
  }));
}
