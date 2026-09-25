export type MethodologyLevel = { value: number; label: string; description: string };
export type MethodologyBand = { label: string; minScore: number; maxScore: number; colour: string; severityOrder: number };
export type MethodologyConfig = {
  name: string; description: string; scoringMethod: 'multiplication';
  likelihoodLevels: MethodologyLevel[]; impactLevels: MethodologyLevel[]; ratingBands: MethodologyBand[];
  appetiteMaxScore: number; treatmentRequiredFromScore: number; escalationRequiredFromScore: number; targetRequired: boolean;
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
export function ratingFor(config: MethodologyConfig, score: number | null | undefined) {
  return score == null || !Number.isFinite(score) ? null : config.ratingBands.find(band => score >= band.minScore && score <= band.maxScore) || null;
}
export function matrixScope(risks: MatrixRisk[], active: MethodologyVersion | null) {
  return risks.filter(risk => active ? risk.methodologyId === active.id && risk.methodologyVersion === active.version : !risk.methodologyId);
}
export function buildMatrix(config: MethodologyConfig, risks: MatrixRisk[], kind: 'inherent' | 'residual' | 'target') {
  return [...config.likelihoodLevels].reverse().map(likelihood => config.impactLevels.map(impact => {
    const score = axisScore(config, likelihood.value, impact.value);
    return { likelihood, impact, score, band: ratingFor(config, score), count: risks.filter(risk => risk[`${kind}Likelihood`] === likelihood.value && risk[`${kind}Impact`] === impact.value).length };
  }));
}
