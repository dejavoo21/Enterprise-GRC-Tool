import type { CreateGovernancePolicyRuleInput, GovernancePolicyRule, PolicyRuleCriterion } from '../types/models.js';

const fields = new Set(['data_classification', 'business_unit', 'system_type', 'location', 'provider']);
const operators = new Set(['equals', 'contains', 'in']);
const severities = new Set(['low', 'medium', 'high', 'critical']);
const responses = new Set(['monitor', 'review']);

export function validatePolicyRuleTransition(current: GovernancePolicyRule['status'], next: GovernancePolicyRule['status']): string | null {
  const transitions: Record<GovernancePolicyRule['status'], GovernancePolicyRule['status'][]> = {
    draft: ['pending_review', 'archived'],
    pending_review: ['draft', 'active', 'rejected'],
    rejected: ['draft', 'pending_review', 'archived'],
    active: [],
    archived: [],
  };
  return transitions[current].includes(next) ? null : `Policy rule cannot move from ${current} to ${next}.`;
}

export function validatePolicyRuleDecisionActor(
  current: { status: GovernancePolicyRule['status']; createdBy?: string | null; submittedBy?: string | null },
  userId: string,
): string | null {
  if (current.status === 'pending_review' && (current.createdBy === userId || current.submittedBy === userId)) {
    return 'Policy rule author or submitting user cannot decide their own rule review.';
  }
  return null;
}

function validCriteria(value: unknown, required: boolean): value is PolicyRuleCriterion[] {
  return Array.isArray(value) && (!required || value.length > 0) && value.length <= 20
    && value.every((criterion) => criterion && typeof criterion === 'object'
      && fields.has(String((criterion as PolicyRuleCriterion).field))
      && operators.has(String((criterion as PolicyRuleCriterion).operator))
      && typeof (criterion as PolicyRuleCriterion).value === 'string'
      && (criterion as PolicyRuleCriterion).value.trim().length > 0
      && (criterion as PolicyRuleCriterion).value.trim().length <= 500);
}

export function validatePolicyRuleInput(input: Record<string, unknown>): string | null {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 200) return 'Rule name is required and must not exceed 200 characters.';
  if (input.description != null && (typeof input.description !== 'string' || input.description.trim().length > 2000)) return 'Purpose must not exceed 2,000 characters.';
  if (typeof input.scopeSummary !== 'string' || !input.scopeSummary.trim() || input.scopeSummary.trim().length > 2000) return 'Scope summary is required and must not exceed 2,000 characters.';
  if (!validCriteria(input.matchCriteria, true) || !validCriteria(input.excludeCriteria, false)) return 'Use 1-20 supported match conditions and up to 20 exclusion conditions; each value is limited to 500 characters.';
  if (!severities.has(String(input.severity)) || !responses.has(String(input.responseMode))) return 'Use a supported severity and review response.';
  if (typeof input.plainLanguageSummary !== 'string' || !input.plainLanguageSummary.trim() || input.plainLanguageSummary.trim().length > 4000) return 'Plain-language summary is required and must not exceed 4,000 characters.';
  return null;
}

export function normalizePolicyRuleInput(input: Record<string, unknown>): CreateGovernancePolicyRuleInput {
  const criteria = (value: unknown) => (value as PolicyRuleCriterion[]).map((criterion) => ({ ...criterion, value: criterion.value.trim() }));
  return {
    name: String(input.name).trim(),
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    scopeSummary: String(input.scopeSummary).trim(),
    matchCriteria: criteria(input.matchCriteria),
    excludeCriteria: criteria(input.excludeCriteria),
    severity: input.severity as CreateGovernancePolicyRuleInput['severity'],
    responseMode: input.responseMode as CreateGovernancePolicyRuleInput['responseMode'],
    plainLanguageSummary: String(input.plainLanguageSummary).trim(),
  };
}
