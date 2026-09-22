import {
  RISK_TREATMENT_APPROVAL_STATUSES,
  RISK_TREATMENT_PRIORITIES,
  RISK_TREATMENT_STATUSES,
  RISK_TREATMENT_STRATEGIES,
  type RiskTreatmentPlan,
} from '../types/riskTreatment.js';

const includes = (values: readonly string[], value: unknown) => typeof value === 'string' && values.includes(value);

export function validateRiskTreatment(input: Partial<RiskTreatmentPlan>, existing?: RiskTreatmentPlan): string | null {
  const value = { ...existing, ...input };
  if (!String(value.title || '').trim()) return 'Treatment title is required';
  if (!includes(RISK_TREATMENT_STRATEGIES, value.strategy)) return 'A valid treatment strategy is required';
  if (!String(value.owner || '').trim()) return 'Treatment owner is required';
  if (!value.dueDate || Number.isNaN(Date.parse(value.dueDate))) return 'A valid due date is required';
  if (!includes(RISK_TREATMENT_STATUSES, value.status)) return 'A valid treatment status is required';
  if (!Number.isInteger(value.progressPercent) || Number(value.progressPercent) < 0 || Number(value.progressPercent) > 100) return 'Progress must be an integer between 0 and 100';
  if (!includes(RISK_TREATMENT_PRIORITIES, value.priority)) return 'A valid priority is required';
  if (!includes(RISK_TREATMENT_APPROVAL_STATUSES, value.approvalStatus)) return 'A valid approval status is required';
  if (value.status === 'completed' && value.progressPercent !== 100) return 'Completed treatments must have 100% progress';
  if (value.strategy === 'accept' && !String(value.notes || '').trim()) return 'Acceptance strategy requires rationale in Notes';
  if (value.expectedResidualScore != null && (!Number.isFinite(value.expectedResidualScore) || value.expectedResidualScore < 0 || value.expectedResidualScore > 25)) return 'Expected residual score must be between 0 and 25';
  if (value.effectivenessRating != null && (!Number.isFinite(value.effectivenessRating) || value.effectivenessRating < 0 || value.effectivenessRating > 100)) return 'Effectiveness rating must be between 0 and 100';
  if (value.reviewDate && Number.isNaN(Date.parse(value.reviewDate))) return 'Review date must be valid';
  return null;
}
