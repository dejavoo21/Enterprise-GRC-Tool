export const SCOPE_STATUSES = ['included', 'excluded', 'not_applicable', 'inherited', 'deferred', 'out_of_scope'] as const;
export const EXCLUSION_REASONS = ['not_applicable_to_scope', 'service_not_provided', 'system_not_in_scope', 'inherited_from_third_party', 'covered_by_central_function', 'legal_or_regulatory_exclusion', 'compensating_control', 'deferred_to_future_assessment', 'duplicate_or_mapped_control', 'other'] as const;

export type ScopedControlState = { inclusionStatus: string; implementationStatus: string; exclusionReason?: string | null; justification?: string | null };

export function validateScopeControlUpdate(input: any): string | null {
  const { inclusionStatus, exclusionReason, justification, reviewDate } = input;
  if (!SCOPE_STATUSES.includes(inclusionStatus)) return 'Invalid inclusion status.';
  if (inclusionStatus !== 'included' && (!exclusionReason || !justification?.trim())) return 'Reason and audit-ready justification are required for this status.';
  if (exclusionReason && !EXCLUSION_REASONS.includes(exclusionReason)) return 'Invalid exclusion reason.';
  if (exclusionReason === 'other' && justification.trim().length < 20) return 'Other requires a detailed justification of at least 20 characters.';
  if (inclusionStatus === 'deferred' && !reviewDate) return 'Deferred controls require a review date.';
  return null;
}

export function summarizeScopedControls(controls: ScopedControlState[]) {
  const count = (status: string) => controls.filter((item) => item.inclusionStatus === status).length;
  const applicable = controls.filter((item) => !['excluded', 'not_applicable', 'out_of_scope'].includes(item.inclusionStatus));
  const assessed = applicable.filter((item) => item.implementationStatus !== 'not_implemented');
  const completed = applicable.filter((item) => item.implementationStatus === 'implemented');
  return { total: controls.length, included: count('included'), excluded: count('excluded'), notApplicable: count('not_applicable'), inherited: count('inherited'), deferred: count('deferred'), outOfScope: count('out_of_scope'), applicable: applicable.length, assessed: assessed.length, completed: completed.length, readinessPercent: applicable.length ? Math.round((completed.length / applicable.length) * 100) : 0, requiringJustification: controls.filter((item) => item.inclusionStatus !== 'included' && (!item.exclusionReason || !item.justification?.trim())).length };
}
