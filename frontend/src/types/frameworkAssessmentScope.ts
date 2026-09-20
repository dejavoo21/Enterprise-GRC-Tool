export type ScopeInclusionStatus = 'included' | 'excluded' | 'not_applicable' | 'inherited' | 'deferred' | 'out_of_scope';
export type ScopeApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'expired';
export type ScopeExclusionReason = 'not_applicable_to_scope' | 'service_not_provided' | 'system_not_in_scope' | 'inherited_from_third_party' | 'covered_by_central_function' | 'legal_or_regulatory_exclusion' | 'compensating_control' | 'deferred_to_future_assessment' | 'duplicate_or_mapped_control' | 'other';

export interface FrameworkScopeControl {
  controlId: string; controlTitle: string; frameworkReference?: string | null; inclusionStatus: ScopeInclusionStatus;
  exclusionReason?: ScopeExclusionReason | null; justification?: string | null; evidenceReference?: string | null;
  reviewDate?: string | null; implementationStatus: string;
}
export interface FrameworkAssessmentScope {
  id: string; frameworkCode: string; frameworkName: string; frameworkVersion?: string | null; name: string;
  description?: string | null; organisationUnit?: string | null; approvalStatus: ScopeApprovalStatus;
  controls: FrameworkScopeControl[];
  summary: { total: number; included: number; excluded: number; notApplicable: number; inherited: number; deferred: number; outOfScope: number; applicable: number; assessed: number; completed: number; readinessPercent: number; requiringJustification: number };
}

export const SCOPE_STATUS_OPTIONS: Array<{ value: ScopeInclusionStatus; label: string }> = [
  { value: 'included', label: 'In Scope' }, { value: 'excluded', label: 'Excluded from Assessment' },
  { value: 'not_applicable', label: 'Not Applicable' }, { value: 'inherited', label: 'Inherited' },
  { value: 'deferred', label: 'Deferred' }, { value: 'out_of_scope', label: 'Out of Scope' },
];
export const SCOPE_REASON_OPTIONS: Array<{ value: ScopeExclusionReason; label: string }> = [
  { value: 'not_applicable_to_scope', label: 'Not applicable to scope' }, { value: 'service_not_provided', label: 'Service not provided' },
  { value: 'system_not_in_scope', label: 'System not in scope' }, { value: 'inherited_from_third_party', label: 'Control inherited from third party' },
  { value: 'covered_by_central_function', label: 'Control covered by central function' }, { value: 'legal_or_regulatory_exclusion', label: 'Legal or regulatory exclusion' },
  { value: 'compensating_control', label: 'Compensating control in place' }, { value: 'deferred_to_future_assessment', label: 'Deferred to future assessment' },
  { value: 'duplicate_or_mapped_control', label: 'Duplicate or mapped control' }, { value: 'other', label: 'Other' },
];
