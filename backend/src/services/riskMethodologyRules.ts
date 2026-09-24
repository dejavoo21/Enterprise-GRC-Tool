export type ScaleLevel = { value: number; label: string; description: string };
export type RatingBand = { label: string; minScore: number; maxScore: number; colour: string; severityOrder: number };
export type MethodologyConfig = {
  name: string;
  description: string;
  scoringMethod: 'multiplication';
  likelihoodLevels: ScaleLevel[];
  impactLevels: ScaleLevel[];
  ratingBands: RatingBand[];
  appetiteMaxScore: number;
  treatmentRequiredFromScore: number;
  escalationRequiredFromScore: number;
  targetRequired: boolean;
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
  if (row.scoringMethod !== 'multiplication') invalid('Only multiplication scoring is supported in this release.');
  const likelihoodLevels = levels(row.likelihoodLevels, 'Likelihood');
  const impactLevels = levels(row.impactLevels, 'Impact');
  const max = likelihoodLevels.length * impactLevels.length;
  if (!Array.isArray(row.ratingBands) || row.ratingBands.length < 1 || row.ratingBands.length > 10) invalid('Provide 1 to 10 rating bands.');
  const names = new Set<string>();
  let next = 1;
  const ratingBands = row.ratingBands.map((input, index) => {
    const band = object(input);
    const label = text(band.label, 'Rating label', 60);
    if (names.has(label.toLowerCase())) invalid('Rating labels must be unique.');
    names.add(label.toLowerCase());
    const minScore = integer(band.minScore, 'Band minimum', 1, max);
    const maxScore = integer(band.maxScore, 'Band maximum', minScore, max);
    if (minScore !== next) invalid('Rating bands must be ordered, contiguous, and non-overlapping.');
    next = maxScore + 1;
    if (typeof band.colour !== 'string' || !/^#[0-9a-f]{6}$/i.test(band.colour)) invalid('Band colour must be a six-digit hex colour.');
    return { label, minScore, maxScore, colour: band.colour, severityOrder: index + 1 };
  });
  if (next !== max + 1) invalid(`Rating bands must cover all scores from 1 to ${max}.`);
  const appetiteMaxScore = integer(row.appetiteMaxScore, 'Appetite threshold', 0, max);
  const treatmentRequiredFromScore = integer(row.treatmentRequiredFromScore, 'Treatment threshold', 1, max);
  const escalationRequiredFromScore = integer(row.escalationRequiredFromScore, 'Escalation threshold', treatmentRequiredFromScore, max);
  if (typeof row.targetRequired !== 'boolean') invalid('Target required must be a boolean.');
  return {
    name: text(row.name, 'Name'), description: row.description === '' || row.description === undefined ? '' : text(row.description, 'Description', 2000),
    scoringMethod: 'multiplication', likelihoodLevels, impactLevels, ratingBands,
    appetiteMaxScore, treatmentRequiredFromScore, escalationRequiredFromScore, targetRequired: row.targetRequired,
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
  const score = integer(value, 'Risk score', 1, config.likelihoodLevels.length * config.impactLevels.length);
  const bands = config.ratingBands.filter(item => score >= item.minScore && score <= item.maxScore);
  if (bands.length !== 1) invalid('No unique rating band covers this score.');
  return bands[0];
}

export function scoreProfile(config: MethodologyConfig, input: Record<string, unknown>) {
  const inherent = scoreRisk(config, input.inherentLikelihood, input.inherentImpact);
  const residual = scoreRisk(config, input.residualLikelihood, input.residualImpact);
  const missingTarget = input.targetLikelihood == null && input.targetImpact == null;
  if (missingTarget && config.targetRequired) invalid('Target likelihood and impact are required.');
  const target = missingTarget ? null : scoreRisk(config, input.targetLikelihood, input.targetImpact);
  return { inherent, residual, target, movement: !target ? 'Target not set' : residual.score <= target.score ? 'Target achieved' : residual.score < inherent.score ? 'Improving toward target' : 'No reduction yet' };
}

export function previewMatrix(config: MethodologyConfig) {
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
