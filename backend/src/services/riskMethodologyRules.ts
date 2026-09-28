export type ScaleLevel = { value: number; label: string; description: string };
export type RatingBand = { label: string; minScore: number; maxScore: number; colour: string; severityOrder: number };
export type WeightedFactor = { key: string; label: string; enabled: boolean; weight: number; minScore: number; maxScore: number; description: string; displayOrder: number };
export type MethodologyConfig = {
  name: string;
  description: string;
  scoringMethod: 'multiplication' | 'weighted';
  likelihoodLevels: ScaleLevel[];
  impactLevels: ScaleLevel[];
  ratingBands: RatingBand[];
  appetiteMaxScore: number;
  treatmentRequiredFromScore: number;
  escalationRequiredFromScore: number;
  targetRequired: boolean;
  weightedFactors?: WeightedFactor[];
};

export class MethodologyValidationError extends Error {}
function invalid(message: string): never { throw new MethodologyValidationError(message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Configuration must be an object.');
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) invalid(`${field} is required (maximum ${max} characters).`);
  return value.trim();
}
function integer(value: unknown, field: string, min: number, max: number): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) invalid(`${field} must be an integer from ${min} to ${max}.`);
  return Number(value);
}
function numeric(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid(`${field} must be between ${min} and ${max}.`);
  return value;
}
function weightedFactors(input: unknown): WeightedFactor[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 12) invalid('Weighted scoring requires 2 to 12 factors.');
  const keys = new Set<string>();
  const factors = input.map((entry, index) => {
    const row = object(entry); const key = text(row.key, 'Factor key', 60).toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(key) || keys.has(key)) invalid('Factor keys must be unique lower-case identifiers.');
    keys.add(key);
    const enabled = row.enabled !== false;
    return { key, label: text(row.label, 'Factor label', 80), enabled,
      weight: numeric(row.weight, 'Factor weight', 0, 100), minScore: numeric(row.minScore, 'Factor minimum', 0, 100),
      maxScore: numeric(row.maxScore, 'Factor maximum', 0, 100), description: row.description ? text(row.description, 'Factor description', 1000) : '',
      displayOrder: Number.isInteger(row.displayOrder) ? Number(row.displayOrder) : index + 1 };
  });
  for (const factor of factors) {
    if (factor.maxScore <= factor.minScore) invalid(`${factor.label} maximum must be greater than its minimum.`);
    if (factor.enabled && factor.weight <= 0) invalid('No enabled factor may have a zero weight.');
  }
  const total = factors.filter(f => f.enabled).reduce((sum, factor) => sum + factor.weight, 0);
  if (Math.abs(total - 100) > 0.0001) invalid('Enabled factor weights must total 100%.');
  return factors.sort((a, b) => a.displayOrder - b.displayOrder);
}
function levels(input: unknown, axis: string): ScaleLevel[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 10) invalid(`${axis} must contain 2 to 10 levels.`);
  const labels = new Set<string>();
  return input.map((entry, i) => {
    const row = object(entry);
    const value = integer(row.value, `${axis} value`, i + 1, i + 1);
    const label = text(row.label, `${axis} label`, 60);
    if (labels.has(label.toLowerCase())) invalid(`${axis} labels must be unique.`);
    labels.add(label.toLowerCase());
    const description = row.description === undefined || row.description === '' ? '' : text(row.description, `${axis} description`, 1000);
    return { value, label, description };
  });
}

export function validateMethodology(input: unknown): MethodologyConfig {
  const row = object(input);
  if (row.scoringMethod !== 'multiplication' && row.scoringMethod !== 'weighted') invalid('Scoring method must be multiplication or weighted.');
  const scoringMethod = row.scoringMethod;
  const likelihoodLevels = levels(row.likelihoodLevels, 'Likelihood');
  const impactLevels = levels(row.impactLevels, 'Impact');
  const factors = scoringMethod === 'weighted' ? weightedFactors(row.weightedFactors) : undefined;
  const enabledFactors = factors?.filter(factor => factor.enabled) || [];
  const min = scoringMethod === 'weighted' ? enabledFactors.reduce((sum, factor) => sum + factor.minScore * factor.weight / 100, 0) : 1;
  const max = scoringMethod === 'weighted' ? enabledFactors.reduce((sum, factor) => sum + factor.maxScore * factor.weight / 100, 0) : likelihoodLevels.length * impactLevels.length;
  if (!Array.isArray(row.ratingBands) || row.ratingBands.length < 1 || row.ratingBands.length > 10) invalid('Provide 1 to 10 rating bands.');
  const names = new Set<string>();
  let next = min;
  const ratingBands = row.ratingBands.map((input, index) => {
    const band = object(input);
    const label = text(band.label, 'Rating label', 60);
    if (names.has(label.toLowerCase())) invalid('Rating labels must be unique.');
    names.add(label.toLowerCase());
    const minScore = numeric(band.minScore, 'Band minimum', min, max);
    const maxScore = numeric(band.maxScore, 'Band maximum', minScore, max);
    if (Math.abs(minScore - next) > 0.001) invalid('Rating bands must be ordered, contiguous, and non-overlapping.');
    next = maxScore + (scoringMethod === 'weighted' ? 0.1 : 1);
    if (typeof band.colour !== 'string' || !/^#[0-9a-f]{6}$/i.test(band.colour)) invalid('Band colour must be a six-digit hex colour.');
    return { label, minScore, maxScore, colour: band.colour, severityOrder: index + 1 };
  });
  if (scoringMethod === 'weighted' ? Math.abs(next - (max + 0.1)) > 0.001 : next !== max + 1) invalid(`Rating bands must cover all scores from ${min} to ${max}.`);
  const appetiteMaxScore = numeric(row.appetiteMaxScore, 'Appetite threshold', min, max);
  const treatmentRequiredFromScore = numeric(row.treatmentRequiredFromScore, 'Treatment threshold', min, max);
  const escalationRequiredFromScore = numeric(row.escalationRequiredFromScore, 'Escalation threshold', treatmentRequiredFromScore, max);
  if (typeof row.targetRequired !== 'boolean') invalid('Target required must be a boolean.');
  return {
    name: text(row.name, 'Name'), description: row.description === '' || row.description === undefined ? '' : text(row.description, 'Description', 2000),
    scoringMethod, likelihoodLevels, impactLevels, ratingBands,
    appetiteMaxScore, treatmentRequiredFromScore, escalationRequiredFromScore, targetRequired: row.targetRequired, weightedFactors: factors,
  };
}

export function scoreRisk(config: MethodologyConfig, likelihood: unknown, impact: unknown) {
  if (config.scoringMethod !== 'multiplication') invalid('Unsupported scoring method.');
  const l = integer(likelihood, 'Likelihood', 1, config.likelihoodLevels.length);
  const i = integer(impact, 'Impact', 1, config.impactLevels.length);
  const score = l * i;
  const band = scoreBand(config, score);
  return { score, rating: band.label, colour: band.colour, outsideAppetite: score > config.appetiteMaxScore,
    treatmentRequired: score >= config.treatmentRequiredFromScore,
    escalationRequired: score >= config.escalationRequiredFromScore };
}

export function scoreBand(config: MethodologyConfig, value: unknown): RatingBand {
  const score = config.scoringMethod === 'weighted'
    ? numeric(value, 'Risk score', 0, 100)
    : integer(value, 'Risk score', 1, config.likelihoodLevels.length * config.impactLevels.length);
  const bands = config.ratingBands.filter(item => score >= item.minScore && score <= item.maxScore);
  if (bands.length !== 1) invalid('No unique rating band covers this score.');
  return bands[0];
}

export function scoreWeightedRisk(config: MethodologyConfig, values: unknown) {
  if (config.scoringMethod !== 'weighted') invalid('Weighted scoring configuration required.');
  const input = object(values); const breakdown = (config.weightedFactors || []).filter(f => f.enabled).map(factor => {
    const value = numeric(input[factor.key], `${factor.label} score`, factor.minScore, factor.maxScore);
    return { key: factor.key, label: factor.label, score: value, weight: factor.weight, contribution: Number((value * factor.weight / 100).toFixed(4)) };
  });
  // Rating bands are configured at one-decimal precision, so normalize before
  // band lookup to avoid unrated values between boundaries such as 1.9 and 2.0.
  const score = Number(breakdown.reduce((sum, item) => sum + item.contribution, 0).toFixed(1));
  const band = scoreBand(config, score);
  return { score, rating: band.label, colour: band.colour, breakdown, outsideAppetite: score > config.appetiteMaxScore,
    treatmentRequired: score >= config.treatmentRequiredFromScore, escalationRequired: score >= config.escalationRequiredFromScore };
}

export function scoreProfile(config: MethodologyConfig, input: Record<string, unknown>) {
  if (config.scoringMethod === 'weighted') {
    const inherent = scoreWeightedRisk(config, input.inherentFactors);
    const residual = scoreWeightedRisk(config, input.residualFactors);
    const target = input.targetFactors == null ? null : scoreWeightedRisk(config, input.targetFactors);
    if (!target && config.targetRequired) invalid('Target weighted factors are required.');
    return { inherent, residual, target, movement: !target ? 'Target not set' : residual.score <= target.score ? 'Target achieved' : residual.score < inherent.score ? 'Improving toward target' : 'No reduction yet' };
  }
  const inherent = scoreRisk(config, input.inherentLikelihood, input.inherentImpact);
  const residual = scoreRisk(config, input.residualLikelihood, input.residualImpact);
  const missingTarget = input.targetLikelihood == null && input.targetImpact == null;
  if (missingTarget && config.targetRequired) invalid('Target likelihood and impact are required.');
  const target = missingTarget ? null : scoreRisk(config, input.targetLikelihood, input.targetImpact);
  return { inherent, residual, target, movement: !target ? 'Target not set' : residual.score <= target.score ? 'Target achieved' : residual.score < inherent.score ? 'Improving toward target' : 'No reduction yet' };
}

export function previewMatrix(config: MethodologyConfig) {
  if (config.scoringMethod !== 'multiplication') return [];
  return [...config.likelihoodLevels].reverse().map(likelihood => config.impactLevels.map(impact => ({ likelihood: likelihood.value, impact: impact.value, ...scoreRisk(config, likelihood.value, impact.value) })));
}

export const legacyMethodology: MethodologyConfig = {
  name: 'Enterprise Risk Matrix', description: 'Legacy scoring compatibility. Thresholds require organisation review; historical risks are not rescored.', scoringMethod: 'multiplication',
  likelihoodLevels: ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'].map((label, i) => ({ value: i + 1, label, description: '' })),
  impactLevels: ['Minimal', 'Minor', 'Moderate', 'Major', 'Severe'].map((label, i) => ({ value: i + 1, label, description: '' })),
  ratingBands: [
    { label: 'Low', minScore: 1, maxScore: 5, colour: '#047857', severityOrder: 1 },
    { label: 'Medium', minScore: 6, maxScore: 11, colour: '#ca8a04', severityOrder: 2 },
    { label: 'High', minScore: 12, maxScore: 19, colour: '#ea580c', severityOrder: 3 },
    { label: 'Critical', minScore: 20, maxScore: 25, colour: '#dc2626', severityOrder: 4 },
  ],
  appetiteMaxScore: 11, treatmentRequiredFromScore: 12, escalationRequiredFromScore: 20, targetRequired: false,
};

export const weightedMethodology: MethodologyConfig = {
  name: 'Enterprise Weighted Risk Methodology', description: 'Optional factor-based scoring for mature risk programmes.', scoringMethod: 'weighted',
  likelihoodLevels: legacyMethodology.likelihoodLevels, impactLevels: legacyMethodology.impactLevels,
  weightedFactors: [
    { key: 'likelihood', label: 'Likelihood', enabled: true, weight: 30, minScore: 1, maxScore: 5, description: 'Probability or frequency of the scenario.', displayOrder: 1 },
    { key: 'impact', label: 'Impact', enabled: true, weight: 40, minScore: 1, maxScore: 5, description: 'Enterprise consequence if the scenario occurs.', displayOrder: 2 },
    { key: 'control_weakness', label: 'Control Weakness', enabled: true, weight: 20, minScore: 1, maxScore: 5, description: 'Weakness remaining in the current control environment.', displayOrder: 3 },
    { key: 'exposure', label: 'Exposure', enabled: true, weight: 10, minScore: 1, maxScore: 5, description: 'Extent and duration of exposure.', displayOrder: 4 },
  ],
  ratingBands: [
    { label: 'Low', minScore: 1, maxScore: 1.9, colour: '#047857', severityOrder: 1 },
    { label: 'Medium', minScore: 2, maxScore: 2.9, colour: '#ca8a04', severityOrder: 2 },
    { label: 'High', minScore: 3, maxScore: 3.9, colour: '#ea580c', severityOrder: 3 },
    { label: 'Critical', minScore: 4, maxScore: 5, colour: '#dc2626', severityOrder: 4 },
  ],
  appetiteMaxScore: 2.9, treatmentRequiredFromScore: 3, escalationRequiredFromScore: 4, targetRequired: false,
};
